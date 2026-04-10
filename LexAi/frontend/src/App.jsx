import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import {
  BarChart3,
  Bot,
  FileSearch,
  FileText,
  FileUp,
  FolderClock,
  Loader2,
  MessageSquare,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
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

const chunkArray = (items, size) => {
  if (!Array.isArray(items) || size <= 0) return [];
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const inferClauseType = (clauseName = "") => {
  const normalized = clauseName.toLowerCase();

  if (normalized.includes("termination") || normalized.includes("breach")) return "Termination";
  if (normalized.includes("liability") || normalized.includes("indemn")) return "Liability";
  if (normalized.includes("payment") || normalized.includes("fee")) return "Payment";
  if (normalized.includes("confidential") || normalized.includes("privacy")) return "Confidentiality";
  if (normalized.includes("dispute") || normalized.includes("arbitration") || normalized.includes("governing")) {
    return "Dispute";
  }

  return "General";
};

const clauseTypeStyles = {
  Termination: {
    border: "border-l-red-400",
    chip: "bg-red-500/15 text-red-300 ring-red-500/25",
  },
  Liability: {
    border: "border-l-amber-400",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  },
  Payment: {
    border: "border-l-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  },
  Confidentiality: {
    border: "border-l-cyan-400",
    chip: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  },
  Dispute: {
    border: "border-l-violet-400",
    chip: "bg-violet-500/15 text-violet-300 ring-violet-500/25",
  },
  General: {
    border: "border-l-slate-400",
    chip: "bg-slate-500/15 text-slate-300 ring-slate-500/25",
  },
};

const splitSummarySteps = (summaryItems = []) => {
  if (!Array.isArray(summaryItems) || summaryItems.length === 0) return [];

  const raw = summaryItems
    .map((item) => String(item || ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return [];

  return raw
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
};

const renderInlineMarkdown = (text = "") => {
  const chunks = String(text).split(/(\*\*[^*]+\*\*)/g);

  return chunks.map((chunk, index) => {
    const match = chunk.match(/^\*\*([^*]+)\*\*$/);
    if (match) {
      return <strong key={`bold-${index}`}>{match[1]}</strong>;
    }

    return <span key={`text-${index}`}>{chunk}</span>;
  });
};

const renderMessageMarkdown = (text = "") => {
  const lines = String(text).split("\n");
  const blocks = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;

    blocks.push(
      <ol key={`list-${blocks.length}`} className="ml-5 list-decimal space-y-1">
        {listBuffer.map((item, index) => (
          <li key={`li-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>
    );
    listBuffer = [];
  };

  lines.forEach((line, index) => {
    const listMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (listMatch) {
      listBuffer.push(listMatch[1]);
      return;
    }

    flushList();

    if (!line.trim()) {
      blocks.push(<br key={`br-${index}`} />);
      return;
    }

    blocks.push(
      <span key={`line-${index}`}>
        {renderInlineMarkdown(line)}
        <br />
      </span>
    );
  });

  flushList();

  return blocks;
};

function Sidebar({ activePage, setActivePage }) {
  return (
    <aside className="w-full border-b border-white/10 bg-gradient-to-b from-[#0b1426] via-[#08101d]/95 to-[#07101a] p-3 backdrop-blur md:w-60 md:border-b-0 md:border-r md:px-4 md:py-5">
      <div className="mb-5 border-b border-cyan-300/20 pb-4 shadow-[0_1px_0_rgba(34,211,238,0.2)]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/20 ring-1 ring-cyan-300/40">
            <Scale className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">LexAI</p>
            <p className="text-xs text-slate-400">AI Legal Document Analyzer</p>
          </div>
        </div>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
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

      <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-100/90 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        <p className="font-semibold">Enterprise Insight</p>
        <p className="mt-2 text-xs text-cyan-100/75">
          Analyze obligations, detect risk clauses, and ask contextual legal questions in one workflow.
        </p>
      </div>
    </aside>
  );
}

function UploadPage({ file, setFile, onAnalyze, isAnalyzing, isDragging, setIsDragging }) {
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
    <section className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-white md:text-[2rem]">Upload Legal Document</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-300">
          Drag and drop a contract or agreement PDF to begin LexAI analysis.
        </p>
      </header>

      <div
        data-active={isDragging ? "true" : "false"}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDropFile}
        className={`lexai-upload-dropzone mx-auto flex min-h-[420px] max-w-3xl flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed px-6 py-10 text-center transition md:px-10 md:py-14 ${
          isDragging
            ? "border-cyan-300 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.2)]"
            : "border-white/20 bg-white/[0.03] hover:border-cyan-300/55"
        }`}
      >
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-300/20">
          <FileUp className="h-7 w-7" />
        </div>
        <p className="text-xl font-semibold text-white md:text-2xl">Drop your PDF here</p>
        <p className="mt-2 text-sm text-slate-400">or browse from your computer</p>

        <label className="mt-7 inline-flex cursor-pointer items-center rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-cyan-300">
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

      <div className="mx-auto max-w-3xl">
        <button
          onClick={onAnalyze}
          disabled={!file || isAnalyzing}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-4 text-sm font-semibold text-slate-900 shadow-[0_0_28px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 hover:shadow-[0_0_34px_rgba(34,211,238,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isAnalyzing ? "Analyzing Document..." : "Analyze"}
        </button>
      </div>

      <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-3">
        {[
          {
            icon: Zap,
            title: "Fast Analysis",
            description: "Quick PDF processing with a streamlined legal review flow.",
          },
          {
            icon: ShieldCheck,
            title: "Secure Processing",
            description: "Your documents stay in a controlled workflow from upload to review.",
          },
          {
            icon: Bot,
            title: "AI Powered",
            description: "Extract risk signals, summaries, and clause insights automatically.",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_22px_rgba(34,211,238,0.04)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/25">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-6 text-slate-400">{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RiskGauge({ score = 0, reasons = [] }) {
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

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Risk Reasons</p>
        <div className="flex flex-wrap gap-2">
          {!Array.isArray(reasons) || reasons.length === 0 ? (
            <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
              No explicit reasons returned.
            </span>
          ) : (
            reasons.map((reason, index) => (
              <span
                key={`${reason}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200"
              >
                <span aria-hidden="true">⚠️</span>
                <span>{reason}</span>
              </span>
            ))
          )}
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
  const riskMeta = getRiskMeta(riskScore);
  const riskReasons = analysis?.legal_analysis?.risk_reasons || [];
  const topKeyPhrases = keyPhrases.slice(0, 15);
  const groupedKeyPhrases = chunkArray(topKeyPhrases, 5);
  const summarySteps = splitSummarySteps(extractiveSummary);
  const totalClauses = Object.keys(clauses).length;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/35">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Total Clauses Detected</p>
          <p className="mt-2 text-4xl font-bold text-white">{totalClauses}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/35">
            <BarChart3 className="h-4 w-4" />
          </div>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Risk Level</p>
          <p className={`mt-2 text-3xl font-bold ${riskMeta.text}`}>{riskMeta.label}</p>
          <p className="mt-1 text-sm text-slate-400">Score: {Math.round(riskScore)}/100</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/35">
            <FileText className="h-4 w-4" />
          </div>
          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Key Phrases Found</p>
          <p className="mt-2 text-4xl font-bold text-white">{topKeyPhrases.length}</p>
          <p className="mt-1 text-sm text-slate-400">Showing top 15 most relevant phrases</p>
        </div>
      </div>

      <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">One-Line Summary</p>
        <p className="mt-2 text-lg font-medium text-cyan-50">
          {analysis?.legal_analysis?.one_line_summary || "No summary available."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <RiskGauge score={riskScore} reasons={riskReasons} />

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-cyan-300" />
            <p className="text-sm font-semibold text-slate-100">Detected Legal Clauses</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {Object.keys(clauses).length === 0 && (
              <p className="col-span-full text-sm text-slate-400">No clauses detected.</p>
            )}

            {Object.entries(clauses).map(([name, excerpt]) => {
              const clauseType = inferClauseType(name);
              const typeStyle = clauseTypeStyles[clauseType] || clauseTypeStyles.General;

              return (
                <article
                  key={name}
                  className={`min-h-44 rounded-2xl border border-white/10 border-l-4 ${typeStyle.border} bg-slate-900/45 p-4`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h4 className="text-base font-bold text-slate-100">{name}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${typeStyle.chip}`}>
                      {clauseType}
                    </span>
                  </div>
                  <p className="text-sm leading-7 text-slate-300">{excerpt || "No excerpt available."}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm font-semibold text-slate-100">Key Phrases</p>
          <p className="mt-1 text-xs text-slate-400">Showing the top 15 phrase signals from language analysis.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {topKeyPhrases.length === 0 && <p className="text-sm text-slate-400">No key phrases extracted.</p>}
            {groupedKeyPhrases.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`} className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                {group.map((phrase) => (
                  <span
                    key={phrase}
                    className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3.5 py-2 text-sm font-medium text-cyan-100"
                  >
                    {phrase}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm font-semibold text-slate-100">Extractive Summary</p>
          <div className="mt-4 space-y-3">
            {summarySteps.length === 0 && <p className="text-sm text-slate-400">No summary points available.</p>}
            {summarySteps.map((item, index) => (
              <article
                key={`${item}-${index}`}
                className="relative rounded-2xl border border-white/10 bg-slate-900/45 p-4 pl-14"
              >
                <div className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/15 text-xs font-bold text-cyan-100">
                  {index + 1}
                </div>
                {index < summarySteps.length - 1 && (
                  <div className="absolute bottom-[-14px] left-[1.8rem] h-4 w-px bg-cyan-300/30" aria-hidden="true" />
                )}
                <p className="text-sm leading-7 text-slate-200">{item}</p>
              </article>
            ))}
          </div>
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
                  : "mr-auto max-w-[92%] border-l-2 border-cyan-300/50 bg-white/10 text-slate-100"
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-300">
                {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {message.role === "assistant" ? "LexAI Assistant" : "You"}
              </div>
              <div className="leading-6">{renderMessageMarkdown(message.text)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!isAsking && question.trim()) {
                  onAskQuestion();
                }
              }
            }}
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
    <div className="lexai-shell min-h-screen text-slate-100">
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

        <main className="flex-1 p-3 md:p-6 xl:p-7">
          <div className="lexai-header-bar mb-4 rounded-2xl border border-white/10 bg-[#0b1424]/70 px-4 py-3 backdrop-blur md:px-5 md:py-4">
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
