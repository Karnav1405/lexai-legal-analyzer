import json
import logging
import os
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse

import azure.functions as func
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.textanalytics import ExtractKeyPhrasesAction, TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential
from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient
from openai import OpenAI
import python_multipart

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)


def _cors_headers() -> dict:
	allowed_origin = os.getenv("CORS_ALLOWED_ORIGIN", "*")
	return {
		"Access-Control-Allow-Origin": allowed_origin,
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type,Authorization,x-functions-key",
	}


def _json_response(payload: dict | list, status_code: int = 200) -> func.HttpResponse:
	return func.HttpResponse(
		body=json.dumps(payload, ensure_ascii=False),
		status_code=status_code,
		mimetype="application/json",
		headers=_cors_headers(),
	)


def _error_response(message: str, status_code: int = 400) -> func.HttpResponse:
	return _json_response({"error": message}, status_code=status_code)


def _preflight_response() -> func.HttpResponse:
	return func.HttpResponse(status_code=204, headers=_cors_headers())


def _get_required_env(name: str) -> str:
	value = os.getenv(name)
	if not value:
		raise ValueError(f"Missing required environment variable: {name}")
	return value


def _get_blob_service_client() -> BlobServiceClient:
	connection_string = _get_required_env("AZURE_STORAGE_CONNECTION_STRING")
	return BlobServiceClient.from_connection_string(connection_string)


def _get_blob_container_name() -> str:
	return os.getenv("AZURE_STORAGE_CONTAINER_NAME", "documents")


def _get_document_intelligence_client() -> DocumentIntelligenceClient:
	endpoint = _get_required_env("DOCUMENT_INTELLIGENCE_ENDPOINT")
	key = _get_required_env("DOCUMENT_INTELLIGENCE_KEY")
	return DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))


def _get_text_analytics_client() -> TextAnalyticsClient:
	endpoint = _get_required_env("AZURE_LANGUAGE_ENDPOINT")
	key = _get_required_env("AZURE_LANGUAGE_KEY")
	return TextAnalyticsClient(endpoint=endpoint, credential=AzureKeyCredential(key))


def _get_openai_client() -> OpenAI:
	key = _get_required_env("AZURE_OPENAI_KEY")
	return OpenAI(base_url="https://models.inference.ai.azure.com", api_key=key)


def _get_cosmos_container():
	endpoint = _get_required_env("COSMOS_ENDPOINT")
	key = _get_required_env("COSMOS_KEY")
	db_name = _get_required_env("COSMOS_DATABASE_NAME")
	container_name = _get_required_env("COSMOS_CONTAINER_NAME")

	cosmos_client = CosmosClient(endpoint, credential=key)
	database = cosmos_client.get_database_client(db_name)
	return database.get_container_client(container_name)


def _extract_pdf_from_request(req: func.HttpRequest) -> tuple[bytes, str]:
	content_type = req.headers.get("content-type", "")
	body = req.get_body()

	if not body:
		raise ValueError("Request body is empty.")

	normalized_content_type = content_type.lower()

	if "multipart/form-data" in normalized_content_type:
		uploaded_file_bytes: bytes | None = None
		uploaded_filename: str | None = None

		def _on_field(_field) -> None:
			# We only need the uploaded file, not text fields.
			return

		def _on_file(file) -> None:
			nonlocal uploaded_file_bytes, uploaded_filename
			field_name = (file.field_name or b"").decode("utf-8", errors="ignore")
			if field_name != "file":
				return

			file_obj = file.file_object
			file_obj.seek(0)
			uploaded_file_bytes = file_obj.read()
			uploaded_filename = (
				file.file_name.decode("utf-8", errors="ignore") if file.file_name else "document.pdf"
			)

		headers = {
			"Content-Type": content_type,
			"Content-Length": str(len(body)),
		}

		try:
			form_parser = python_multipart.create_form_parser(headers, _on_field, _on_file)
			form_parser.write(body)
			form_parser.finalize()
		except Exception as exc:
			raise ValueError("Invalid multipart/form-data body.") from exc

		if uploaded_file_bytes is None:
			raise ValueError("Missing file field. Send multipart/form-data with field name 'file'.")

		return uploaded_file_bytes, uploaded_filename or "document.pdf"

	if "application/pdf" in normalized_content_type:
		filename = req.params.get("filename", "document.pdf")
		return body, filename

	raise ValueError("Unsupported content type. Use multipart/form-data or application/pdf.")


def _parse_json(req: func.HttpRequest) -> dict:
	try:
		return req.get_json()
	except ValueError as exc:
		raise ValueError("Invalid JSON body.") from exc


def _blob_name_from_url(blob_url: str) -> tuple[str, str]:
	parsed = urlparse(blob_url)
	container_and_blob = parsed.path.lstrip("/").split("/", 1)
	if len(container_and_blob) != 2 or not container_and_blob[0] or not container_and_blob[1]:
		raise ValueError("Invalid blob_url format.")
	container_name, blob_name = container_and_blob
	return container_name, unquote(blob_name)


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
	doc_client = _get_document_intelligence_client()
	poller = doc_client.begin_analyze_document(
		model_id="prebuilt-read",
		body=pdf_bytes,
		content_type="application/pdf",
	)
	result = poller.result()

	lines: list[str] = []
	for page in result.pages or []:
		for line in page.lines or []:
			if line.content:
				lines.append(line.content)

	return "\n".join(lines).strip()


def _split_sentences(text: str) -> list[str]:
	if not text:
		return []
	chunks = re.split(r"(?<=[.!?])\s+|\n+", text)
	return [chunk.strip() for chunk in chunks if chunk and chunk.strip()]


def _extractive_summary_fallback(text: str, max_sentences: int = 5) -> list[str]:
	sentences = _split_sentences(text)
	if not sentences:
		return []

	stopwords = {
		"the",
		"and",
		"for",
		"that",
		"with",
		"this",
		"from",
		"are",
		"was",
		"were",
		"will",
		"shall",
		"may",
		"can",
		"not",
		"but",
		"any",
		"all",
		"into",
		"out",
		"our",
		"their",
		"your",
		"its",
		"has",
		"have",
		"had",
		"been",
		"being",
		"such",
		"here",
		"there",
		"where",
		"which",
		"what",
		"when",
		"who",
		"whom",
		"whose",
		"about",
		"under",
		"over",
		"between",
		"within",
		"without",
	}

	words = re.findall(r"[A-Za-z][A-Za-z0-9'-]*", text.lower())
	frequencies = Counter(word for word in words if len(word) > 2 and word not in stopwords)
	top_keywords = {word for word, _ in frequencies.most_common(40)}

	scored: list[tuple[float, int, str]] = []
	for index, sentence in enumerate(sentences):
		tokens = re.findall(r"[A-Za-z][A-Za-z0-9'-]*", sentence.lower())
		if not tokens:
			continue

		word_count = len(tokens)
		keyword_hits = sum(1 for token in tokens if token in top_keywords)
		keyword_density = keyword_hits / word_count
		length_score = min(word_count, 40) / 40
		score = (0.6 * keyword_density) + (0.4 * length_score)
		scored.append((score, index, sentence))

	if not scored:
		return sentences[:max_sentences]

	top = sorted(scored, key=lambda item: item[0], reverse=True)[:max_sentences]
	top_sorted_by_position = sorted(top, key=lambda item: item[1])
	return [sentence for _, _, sentence in top_sorted_by_position]


def _extract_abstractive_summary_sentences(action_results) -> list[str]:
	collected: list[str] = []

	for document_result in action_results:
		if hasattr(document_result, "abstractive_summarize_results"):
			per_doc_action_results = document_result.abstractive_summarize_results or []
		else:
			try:
				per_doc_action_results = list(document_result)
			except TypeError:
				per_doc_action_results = [document_result]

		for action_result in per_doc_action_results:
			if getattr(action_result, "is_error", False):
				continue

			summaries = getattr(action_result, "summaries", None)
			if summaries:
				for item in summaries:
					text = getattr(item, "text", None)
					if text:
						collected.append(text.strip())

			sentences = getattr(action_result, "sentences", None)
			if sentences:
				for item in sentences:
					text = getattr(item, "text", None)
					if text:
						collected.append(text.strip())

	# Preserve order while removing duplicates and empty strings.
	seen: set[str] = set()
	unique: list[str] = []
	for sentence in collected:
		normalized = sentence.strip()
		if not normalized or normalized in seen:
			continue
		seen.add(normalized)
		unique.append(normalized)

	return unique


def _run_language_analysis(text: str) -> tuple[list[str], list[str]]:
	ta_client = _get_text_analytics_client()

	key_phrases_response = ta_client.extract_key_phrases([text])
	key_phrases_result = next(iter(key_phrases_response), None)
	if not key_phrases_result or key_phrases_result.is_error:
		key_phrases = []
	else:
		key_phrases = key_phrases_result.key_phrases or []

	summary_sentences: list[str] = []
	try:
		from azure.ai.textanalytics import AbstractiveSummaryAction

		actions = [AbstractiveSummaryAction(max_sentence_count=5)]
		poller = ta_client.begin_analyze_actions([text], actions=actions)
		summary_sentences = _extract_abstractive_summary_sentences(poller.result())
	except (ImportError, AttributeError):
		# SDK lacks abstractive summarization support; use local extractive fallback.
		summary_sentences = _extractive_summary_fallback(text)
	except Exception:
		logging.exception("Abstractive summarization failed; using extractive fallback.")
		summary_sentences = _extractive_summary_fallback(text)

	if not summary_sentences:
		summary_sentences = _extractive_summary_fallback(text)

	return summary_sentences, key_phrases


def _run_legal_risk_analysis(text: str) -> dict:
	openai_client = _get_openai_client()
	deployment_name = _get_required_env("AZURE_OPENAI_DEPLOYMENT_NAME")

	prompt = (
		"You are a legal analyst. Return a JSON with: risk_score (0-100), "
		"risk_reasons (list of strings), detected_clauses (object with clause name as key "
		"and short excerpt as value), one_line_summary (string)"
	)

	completion = openai_client.chat.completions.create(
		model=deployment_name,
		response_format={"type": "json_object"},
		messages=[
			{"role": "system", "content": prompt},
			{
				"role": "user",
				"content": "Analyze this legal document text and return only valid JSON.\n\n" + text,
			},
		],
		temperature=0.2,
	)

	content = completion.choices[0].message.content
	if not content:
		raise ValueError("Azure OpenAI returned an empty analysis response.")
	return json.loads(content)


def _run_qa(text: str, question: str) -> str:
	openai_client = _get_openai_client()
	deployment_name = _get_required_env("AZURE_OPENAI_DEPLOYMENT_NAME")

	completion = openai_client.chat.completions.create(
		model=deployment_name,
		messages=[
			{
				"role": "system",
				"content": (
					"You are a legal assistant. Answer questions about this legal document "
					"accurately. If answer not found say so."
				),
			},
			{
				"role": "user",
				"content": f"Document:\n{text}\n\nQuestion: {question}",
			},
		],
		temperature=0.2,
	)

	answer = completion.choices[0].message.content
	return answer.strip() if answer else "Answer not found in the provided document."


@app.route(route="upload_document", methods=["POST", "OPTIONS"])
def upload_document(req: func.HttpRequest) -> func.HttpResponse:
	if req.method == "OPTIONS":
		return _preflight_response()

	try:
		pdf_bytes, filename = _extract_pdf_from_request(req)
		document_id = str(uuid.uuid4())

		blob_service_client = _get_blob_service_client()
		container_name = _get_blob_container_name()
		pdf_blob_name = f"raw/{document_id}/{filename}"

		blob_client = blob_service_client.get_blob_client(container=container_name, blob=pdf_blob_name)
		blob_client.upload_blob(pdf_bytes, overwrite=True, content_type="application/pdf")

		return _json_response(
			{
				"document_id": document_id,
				"blob_url": blob_client.url,
			},
			status_code=200,
		)
	except ValueError as exc:
		return _error_response(str(exc), status_code=400)
	except Exception as exc:
		logging.exception("upload_document failed")
		return _error_response(f"Failed to upload document: {str(exc)}", status_code=500)


@app.route(route="analyze_document", methods=["POST", "OPTIONS"])
def analyze_document(req: func.HttpRequest) -> func.HttpResponse:
	if req.method == "OPTIONS":
		return _preflight_response()

	try:
		body = _parse_json(req)
		document_id = body.get("document_id")
		blob_url = body.get("blob_url")

		if not document_id or not blob_url:
			return _error_response("document_id and blob_url are required.", status_code=400)

		configured_container = _get_blob_container_name()
		url_container, blob_name = _blob_name_from_url(blob_url)
		if url_container != configured_container:
			raise ValueError("Blob URL container does not match the configured storage container.")

		blob_service_client = _get_blob_service_client()
		blob_client = blob_service_client.get_blob_client(container=configured_container, blob=blob_name)
		pdf_bytes = blob_client.download_blob().readall()

		text = _extract_text_from_pdf(pdf_bytes)
		if not text:
			return _error_response("No text could be extracted from the document.", status_code=422)

		summary_sentences, key_phrases = _run_language_analysis(text)
		legal_analysis = _run_legal_risk_analysis(text)

		processed_blob_name = f"processed/{document_id}.txt"
		processed_blob_client = blob_service_client.get_blob_client(
			container=configured_container,
			blob=processed_blob_name,
		)
		processed_blob_client.upload_blob(text, overwrite=True, content_type="text/plain")

		saved_at = datetime.now(timezone.utc).isoformat()
		cosmos_record = {
			"id": document_id,
			"document_id": document_id,
			"blob_url": blob_url,
			"text_blob_url": processed_blob_client.url,
			"extractive_summary": summary_sentences,
			"key_phrases": key_phrases,
			"legal_analysis": legal_analysis,
			"created_at": saved_at,
		}

		cosmos_container = _get_cosmos_container()
		cosmos_container.upsert_item(cosmos_record)

		response = {
			"document_id": document_id,
			"blob_url": blob_url,
			"extracted_text": text,
			"extractive_summary": summary_sentences,
			"key_phrases": key_phrases,
			"legal_analysis": legal_analysis,
			"saved_at": saved_at,
		}
		return _json_response(response, status_code=200)
	except ValueError as exc:
		return _error_response(str(exc), status_code=400)
	except Exception as exc:
		logging.exception("analyze_document failed")
		return _error_response(f"Failed to analyze document: {str(exc)}", status_code=500)


@app.route(route="ask_question", methods=["POST", "OPTIONS"])
def ask_question(req: func.HttpRequest) -> func.HttpResponse:
	if req.method == "OPTIONS":
		return _preflight_response()

	try:
		body = _parse_json(req)
		document_id = body.get("document_id")
		question = body.get("question")

		if not document_id or not question:
			return _error_response("document_id and question are required.", status_code=400)

		cosmos_container = _get_cosmos_container()
		items = list(
			cosmos_container.query_items(
				query="SELECT * FROM c WHERE c.id = @document_id",
				parameters=[{"name": "@document_id", "value": document_id}],
				enable_cross_partition_query=True,
			)
		)
		if not items:
			return _error_response("Document analysis not found for the given document_id.", status_code=404)

		record = items[0]
		text_blob_url = record.get("text_blob_url")
		if not text_blob_url:
			return _error_response("Processed document text was not found.", status_code=404)

		configured_container = _get_blob_container_name()
		text_container, text_blob_name = _blob_name_from_url(text_blob_url)
		if text_container != configured_container:
			raise ValueError("Blob URL container does not match the configured storage container.")

		blob_service_client = _get_blob_service_client()
		text_blob_client = blob_service_client.get_blob_client(container=configured_container, blob=text_blob_name)
		text = text_blob_client.download_blob().readall().decode("utf-8")

		answer = _run_qa(text, question)
		return _json_response(
			{
				"document_id": document_id,
				"question": question,
				"answer": answer,
			},
			status_code=200,
		)
	except ValueError as exc:
		return _error_response(str(exc), status_code=400)
	except Exception as exc:
		logging.exception("ask_question failed")
		return _error_response(f"Failed to answer question: {str(exc)}", status_code=500)


@app.route(route="get_history", methods=["GET", "OPTIONS"])
def get_history(req: func.HttpRequest) -> func.HttpResponse:
	if req.method == "OPTIONS":
		return _preflight_response()

	try:
		cosmos_container = _get_cosmos_container()
		items = list(
			cosmos_container.query_items(
				query="SELECT * FROM c ORDER BY c.created_at DESC",
				enable_cross_partition_query=True,
			)
		)
		return _json_response(items, status_code=200)
	except Exception as exc:
		logging.exception("get_history failed")
		return _error_response(f"Failed to fetch history: {str(exc)}", status_code=500)