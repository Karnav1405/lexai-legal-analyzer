import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  Bot,
  FileSearch,
  FileUp,
  FolderClock,
  Loader2,
  MessageSquare,
  Scale,
  ShieldAlert,
  Sparkles,
  UploadCloud,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
});

const navItems = [
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "results", label: "Results", icon: FileSearch },
  { id: "history", label: "History", icon: FolderClock },
];

const getRiskMeta = (score) => {
  const safeScore = Number.isFinite(score) ? score : 0;

  if (safeScore > 70) {
    return {
      label: "High Risk",
      ring: "#ef4444",
      glow: "shadow-[0_0_28px_rgba(239,68,68,0.35)]",
      text: "text-red-400",
      pill: "bg-red-500/15 text-red-300 ring-red-500/25",
    };
  }

  if (safeScore >= 40) {
    return {
      label: "Moderate Risk",
      ring: "#f59e0b",
      glow: "shadow-[0_0_28px_rgba(245,158,11,0.35)]",
      text: "text-amber-400",
      pill: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
    };
  }

  return {
    label: "Low Risk",
    ring: "#22c55e",
    glow: "shadow-[0_0_28px_rgba(34,197,94,0.35)]",
    text: "text-emerald-400",
    pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  };
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString();
};

const extractFilename = (blobUrl = "") => {
  const candidate = blobUrl.split("?")[0].split("/").pop();
  return candidate || "document.pdf";
};

function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="w-full border-b border-white/10 bg-[#08101d]/80 p-4 backdrop-blur md:w-72 md:border-b-0 md:border-r md:p-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/20 ring-1 ring-cyan-300/40">
          <Scale className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">LexAI</p>
          <p className="text-xs text-slate-400">AI Legal Document Analyzer</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                active
                  ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/35"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100/90">
        <p className="font-semibold">Enterprise Insight</p>
        <p className="mt-2 text-xs text-cyan-100/75">
          Analyze obligations, detect risk clauses, and ask contextual legal questions in one workflow.
        </p>
      </div>
    </aside>
  );
}

function UploadPage({
  file,
  setFile,
  onAnalyze,
  isAnalyzing,
  isDragging,
  setIsDragging,
}) {
  const onDropFile = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const picked = event.dataTransfer.files?.[0];
    if (!picked) return;

    if (picked.type !== "application/pdf") {
      toast.error("Please upload a PDF file only.");
      return;
    }

    setFile(picked);
  };

  const onFileInput = (event) => {
    const picked = event.target.files?.[0];
    if (!picked) return;

    if (picked.type !== "application/pdf") {
      toast.error("Please upload a PDF file only.");
      return;
    }

    setFile(picked);
  };

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-white md:text-3xl">Upload Legal Document</h1>
        <p className="mt-2 text-sm text-slate-300">
          Drag and drop a contract or agreement PDF to begin LexAI analysis.
        </p>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDropFile}
        className={`rounded-3xl border-2 border-dashed p-8 text-center transition md:p-12 ${
          isDragging
            ? "border-cyan-400 bg-cyan-400/10"
            : "border-white/20 bg-white/[0.03] hover:border-cyan-300/50"
        }`}
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/20 text-cyan-200">
          <FileUp className="h-7 w-7" />
        </div>
        <p className="text-lg font-medium text-white">Drop your PDF here</p>
        <p className="mt-1 text-sm text-slate-400">or browse from your computer</p>

        <label className="mt-6 inline-flex cursor-pointer items-center rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300">
          Choose PDF
          <input type="file" accept="application/pdf" className="hidden" onChange={onFileInput} />
        </label>

        {file && (
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-left">
            <p className="text-sm font-semibold text-emerald-200">Selected File</p>
            <p className="mt-1 truncate text-sm text-slate-100">{file.name}</p>
            <p className="mt-1 text-xs text-slate-300">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        )}
      </div>

      <button
        onClick={onAnalyze}
        disabled={!file || isAnalyzing}
        className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" />}
        {isAnalyzing ? "Analyzing Document..." : "Analyze"}
      </button>
    </section>
  );
}

function RiskGauge({ score = 0 }) {
  const bounded = Math.max(0, Math.min(100, Number(score) || 0));
  const meta = getRiskMeta(bounded);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-200">Risk Score</p>
        <span className={`rounded-full px-3 py-1 text-xs ring-1 ${meta.pill}`}>{meta.label}</span>
      </div>

      <div className="grid place-items-center">
        <div
          className={`relative grid h-44 w-44 place-items-center rounded-full ${meta.glow}`}
          style={{
            background: `conic-gradient(${meta.ring} ${bounded * 3.6}deg, rgba(148,163,184,0.18) 0deg)`,
          }}
        >
          <div className="grid h-32 w-32 place-items-center rounded-full bg-[#0d1524] ring-1 ring-white/10">
            <p className={`text-4xl font-bold ${meta.text}`}>{Math.round(bounded)}</p>
            <p className="-mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">out of 100</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsPage({ analysis, question, setQuestion, onAskQuestion, isAsking, chatMessages }) {
  const clauses = analysis?.legal_analysis?.detected_clauses || {};
  const keyPhrases = analysis?.key_phrases || [];
  const extractiveSummary = analysis?.extractive_summary || [];

  if (!analysis) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-cyan-300" />
        <p className="mt-3 text-lg font-medium text-white">No analysis available yet</p>
        <p className="mt-1 text-sm text-slate-400">Upload a document and run analysis to view legal insights.</p>
      </section>
    );
  }

  const riskScore = analysis?.legal_analysis?.risk_score ?? 0;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">One-Line Summary</p>
        <p className="mt-2 text-lg font-medium text-cyan-50">
          {analysis?.legal_analysis?.one_line_summary || "No summary available."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <RiskGauge score={riskScore} />

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-cyan-300" />
            <p className="text-sm font-semibold text-slate-100">Detected Legal Clauses</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {Object.keys(clauses).length === 0 && (
              <p className="col-span-full text-sm text-slate-400">No clauses detected.</p>
            )}

            {Object.entries(clauses).map(([name, excerpt]) => (
              <details
                key={name}
                className="group rounded-2xl border border-white/10 bg-slate-900/45 p-4 transition open:border-cyan-400/40"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100">
                  {name}
                </summary>
                <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-6 text-slate-300">{excerpt}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm font-semibold text-slate-100">Key Phrases</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {keyPhrases.length === 0 && <p className="text-sm text-slate-400">No key phrases extracted.</p>}
            {keyPhrases.map((phrase) => (
              <span
                key={phrase}
                className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100"
              >
                {phrase}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm font-semibold text-slate-100">Extractive Summary</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-200">
            {extractiveSummary.length === 0 && <li className="text-slate-400">No summary points available.</li>}
            {extractiveSummary.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-cyan-300" />
          <p className="text-sm font-semibold text-slate-100">Ask About This Document</p>
        </div>

        <div className="mb-4 max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1221]/90 p-4">
          {chatMessages.length === 0 && (
            <p className="text-sm text-slate-400">Ask a question to get contextual legal guidance.</p>
          )}

          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl px-4 py-3 text-sm ${
                message.role === "user"
                  ? "ml-auto max-w-[85%] bg-cyan-400/20 text-cyan-100"
                  : "mr-auto max-w-[85%] bg-white/10 text-slate-100"
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-300">
                {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {message.role === "assistant" ? "LexAI Assistant" : "You"}
              </div>
              <p>{message.text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask: What termination liabilities are present?"
            className="h-12 flex-1 rounded-xl border border-white/15 bg-[#0f172a]/80 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          />
          <button
            onClick={onAskQuestion}
            disabled={isAsking || !question.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAsking && <Loader2 className="h-4 w-4 animate-spin" />}
            Ask
          </button>
        </div>
      </div>
    </section>
  );
}

function HistoryPage({ items, onView }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4 flex items-center gap-2">
        <FolderClock className="h-4 w-4 text-cyan-300" />
        <p className="text-sm font-semibold text-slate-100">Document Analysis History</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.16em] text-slate-400">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Filename</th>
              <th className="px-3 py-3">Risk Score</th>
              <th className="px-3 py-3">One Line Summary</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No historical analyses found.
                </td>
              </tr>
            )}

            {items.map((row) => (
              <tr key={row.id || row.document_id} className="text-slate-200">
                <td className="px-3 py-3">{formatDateTime(row.created_at || row.saved_at)}</td>
                <td className="max-w-[220px] truncate px-3 py-3">{row.filename || extractFilename(row.blob_url)}</td>
                <td className="px-3 py-3">{row.legal_analysis?.risk_score ?? "-"}</td>
                <td className="max-w-[360px] truncate px-3 py-3">{row.legal_analysis?.one_line_summary || "-"}</td>
                <td className="px-3 py-3">
                  <button
                    onClick={() => onView(row)}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("upload");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  const headerTitle = useMemo(() => {
    if (activePage === "upload") return "Upload";
    if (activePage === "results") return "Results";
    return "History";
  }, [activePage]);

  const fetchHistory = async () => {
    try {
      const response = await api.get("/get_history");
      setHistory(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error("Could not load analysis history.");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Please select a PDF file first.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await api.post("/upload_document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { document_id, blob_url } = uploadResponse.data;

      const analysisResponse = await api.post("/analyze_document", {
        document_id,
        blob_url,
      });

      const nextAnalysis = {
        ...analysisResponse.data,
        filename: file.name,
      };

      setAnalysis(nextAnalysis);
      setChatMessages([]);
      setActivePage("results");
      toast.success("Document analyzed successfully.");
      await fetchHistory();
    } catch (error) {
      const message = error?.response?.data?.error || "Document analysis failed.";
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!analysis?.document_id) {
      toast.error("No analyzed document available.");
      return;
    }

    if (!question.trim()) return;

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: question.trim(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsAsking(true);

    try {
      const response = await api.post("/ask_question", {
        document_id: analysis.document_id,
        question: userMessage.text,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: response?.data?.answer || "No answer returned.",
        },
      ]);
      setQuestion("");
    } catch (error) {
      const message = error?.response?.data?.error || "Could not answer question.";
      toast.error(message);
    } finally {
      setIsAsking(false);
    }
  };

  const handleViewHistory = (row) => {
    setAnalysis({
      ...row,
      extracted_text: row.extracted_text || "",
      extractive_summary: row.extractive_summary || [],
      key_phrases: row.key_phrases || [],
      legal_analysis: row.legal_analysis || {},
    });
    setChatMessages([]);
    setActivePage("results");
  };

  return (
    <div className="min-h-screen text-slate-100">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            border: "1px solid rgba(148, 163, 184, 0.25)",
          },
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <Sidebar activePage={activePage} setActivePage={setActivePage} />

        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#0b1424]/70 px-5 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">LexAI Workspace</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{headerTitle}</h2>
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs text-slate-300 md:flex">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                Premium Legal Intelligence
              </div>
            </div>
          </div>

          {activePage === "upload" && (
            <UploadPage
              file={file}
              setFile={setFile}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
            />
          )}

          {activePage === "results" && (
            <ResultsPage
              analysis={analysis}
              question={question}
              setQuestion={setQuestion}
              onAskQuestion={handleAskQuestion}
              isAsking={isAsking}
              chatMessages={chatMessages}
            />
          )}

          {activePage === "history" && <HistoryPage items={history} onView={handleViewHistory} />}
        </main>
      </div>
    </div>
  );
}
