# LexAI — AI-Based Legal Document Analyzer & Summarizer

![LexAI Banner](https://img.shields.io/badge/LexAI-AI--Based%20Legal%20Analyzer%20%26%20Summarizer-0f172a?style=for-the-badge&logo=scale&logoColor=white)

![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-Vite%20Frontend-61DAFB?style=flat-square&logo=react&logoColor=0b0f19)
![Azure](https://img.shields.io/badge/Azure-Cloud%20Services-0078D4?style=flat-square&logo=microsoftazure&logoColor=white)
![GitHub Models](https://img.shields.io/badge/GitHub%20Models-GPT--4o-181717?style=flat-square&logo=github&logoColor=white)

## Overview
LexAI is an AI-powered SaaS web application for legal document analysis and summarization. It uses Azure cloud services to process uploaded documents, extract legal meaning, detect potential risks, and provide concise, context-aware outputs for faster legal review.

## Features
- PDF upload with drag-and-drop support
- AI-powered legal document summarization
- Risk scoring from 0–100
- Legal clause detection and highlighting
- Document Q&A chat experience
- Analysis history and retrieval

## Tech Stack
- Python 3.13
- Azure Functions
- Azure Blob Storage
- Azure Document Intelligence
- Azure AI Language
- Azure Cosmos DB
- GitHub Models (GPT-4o)
- React + Vite
- Tailwind CSS

## Architecture
LexAI follows a cloud-native client-server architecture:

1. React + Vite frontend handles user authentication flow, PDF upload, and result presentation.
2. Documents are uploaded to Azure Blob Storage.
3. Azure Functions orchestrates ingestion, extraction, and AI workflows.
4. Azure Document Intelligence parses structured text from legal PDFs.
5. Azure AI Language performs clause analysis, entity extraction, and relevance logic.
6. GitHub Models (GPT-4o) generates summaries and powers legal Q&A responses.
7. Azure Cosmos DB stores analysis metadata, scores, and history.

## Setup Instructions
### 1) Clone the repository
```bash
git clone <your-repo-url>
cd LexAi
```

### 2) Backend setup (Azure Functions)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create and configure `local.settings.json` with your Azure keys and connection strings:
- `AzureWebJobsStorage`
- `BLOB_CONNECTION_STRING`
- `DOCUMENT_INTELLIGENCE_ENDPOINT`
- `DOCUMENT_INTELLIGENCE_KEY`
- `AZURE_LANGUAGE_ENDPOINT`
- `AZURE_LANGUAGE_KEY`
- `COSMOS_ENDPOINT`
- `COSMOS_KEY`
- `GITHUB_MODELS_API_KEY`

Run the backend locally:
```bash
func start
```

### 3) Frontend setup (React + Vite)
```bash
cd ../frontend
npm install
npm run dev
```

### 4) Build for production
```bash
# Frontend
cd frontend
npm run build

# Backend is deployed through Azure Functions publish pipeline
```

## Screenshots
> Add product screenshots here.

- Upload page (drag-and-drop PDF)
- Analysis dashboard (summary, risk score, clauses)
- Q&A chat interface
- History page

## Future Improvements
- Multi-document comparison
- Contract template benchmarking
- Role-based collaboration and review workflows

---

**Built with Azure Student Credits**
