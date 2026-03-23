"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  FileCode2,
  FileJson,
  FileText,
  Image as ImageIcon,
  Palette,
  Settings,
  Sparkles,
  Table2,
  Download,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
} from "lucide-react";
import ThreeBackground from "../components/ThreeBackground";

const conversions = [
  { value: "jpg_to_png", label: "JPG to PNG", icon: ImageIcon, category: "image", inputExt: ["jpg", "jpeg"] },
  { value: "png_to_jpg", label: "PNG to JPG", icon: Palette, category: "image", inputExt: ["png"] },
  { value: "webp_to_png", label: "WEBP to PNG", icon: Sparkles, category: "image", inputExt: ["webp"] },
  { value: "webp_to_jpg", label: "WEBP to JPG", icon: Camera, category: "image", inputExt: ["webp"] },
  { value: "txt_to_pdf", label: "TXT to PDF", icon: FileText, category: "document", inputExt: ["txt"] },
  { value: "csv_to_json", label: "CSV to JSON", icon: Table2, category: "data", inputExt: ["csv"] },
  { value: "json_to_csv", label: "JSON to CSV", icon: FileJson, category: "data", inputExt: ["json"] },
];

const HISTORY_KEY = "fch_history_v2";
const THEME_KEY = "fch_theme_v2";
const SETTINGS_KEY = "fch_settings_v2";

type Theme = "aurora" | "clean" | "neo";
type HistoryItem = {
  id: string;
  file: string;
  type: string;
  status: "success" | "error";
  message: string;
  time: string;
  downloadUrl?: string;
};
type RunResult = {
  id: string;
  file: string;
  status: "success" | "error";
  message: string;
  downloadUrl?: string;
};
type AppSettings = {
  maxHistory: number;
  autoClearMessages: boolean;
};

function smartError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("expects")) return "File type does not match selected conversion.";
  if (m.includes("array of objects")) return "For JSON to CSV, use array format like [{}, {}].";
  if (m.includes("empty")) return "The file appears to be empty.";
  if (m.includes("corrupted") || m.includes("invalid")) return "File may be invalid or corrupted.";
  return message;
}

function byId() {
  return Math.random().toString(36).slice(2, 10);
}

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [conversionType, setConversionType] = useState("");
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingText, setProcessingText] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [theme, setTheme] = useState<Theme>("aurora");
  const [activeCategory, setActiveCategory] = useState<"image" | "document" | "data">("image");
  const [previewText, setPreviewText] = useState("");
  const [previewTable, setPreviewTable] = useState<string[][]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [afterImageUrl, setAfterImageUrl] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [runResults, setRunResults] = useState<RunResult[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ maxHistory: 15, autoClearMessages: false });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedConversion = useMemo(() => conversions.find((item) => item.value === conversionType), [conversionType]);

  const selectedConversionLabel = selectedConversion?.label || "Not selected";
  const filteredConversions = useMemo(
    () => conversions.filter((item) => item.category === activeCategory),
    [activeCategory]
  );
  const validationBadge = useMemo(() => {
    if (!files.length || !selectedConversion) return null;
    const firstExt = getExt(files[0].name);
    const ok = selectedConversion.inputExt.includes(firstExt);
    return {
      ok,
      text: ok
        ? `Supported: .${firstExt} matches ${selectedConversion.label}`
        : `Unsupported for ${selectedConversion.label}. Expected: ${selectedConversion.inputExt.join(", ")}`,
    };
  }, [files, selectedConversion]);

  const stats = useMemo(() => {
    const total = history.length;
    const today = new Date().toDateString();
    const todayCount = history.filter((h) => new Date(h.time).toDateString() === today).length;
    const map: Record<string, number> = {};
    history.forEach((h) => {
      map[h.type] = (map[h.type] || 0) + 1;
    });
    let topType = "-";
    let topCount = 0;
    Object.entries(map).forEach(([k, v]) => {
      if (v > topCount) {
        topType = k;
        topCount = v;
      }
    });
    return { total, todayCount, topType };
  }, [history]);

  const setSelectedFiles = async (incoming: File[]) => {
    setFiles(incoming);
    setPreviewImageUrl("");
    setPreviewText("");
    setPreviewTable([]);
    setAfterImageUrl("");
    if (!incoming.length) return;

    const first = incoming[0];
    const ext = getExt(first.name);
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      setPreviewImageUrl(URL.createObjectURL(first));
      return;
    }
    const text = await first.text();
    if (ext === "txt") {
      setPreviewText(text.split("\n").slice(0, 10).join("\n"));
      return;
    }
    if (ext === "csv") {
      const rows = text
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 6)
        .map((r) => r.split(","));
      setPreviewTable(rows);
    }
  };

  const addHistory = (item: HistoryItem) => {
    const updated = [item, ...history].slice(0, settings.maxHistory);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const onConvert = async () => {
    setMessage("");
    setDownloadUrl("");
    setProgress(0);
    setRunResults([]);
    setProcessingText("");

    if (!files.length) {
      setMessage("Please choose file(s).");
      return;
    }
    if (!conversionType) {
      setMessage("Please select a conversion type.");
      return;
    }

    setLoading(true);
    let done = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversion_type", conversionType);
      setProcessingText(`Processing file ${done + 1}/${files.length}: ${file.name}`);

      try {
        const response = await fetch("/api/convert", { method: "POST", body: formData });
        if (!response.ok) {
          const data = await response.json();
          const errMsg = smartError(data.message || "Conversion failed.");
          const entry = {
            id: byId(),
            file: file.name,
            type: selectedConversionLabel,
            status: "error" as const,
            message: errMsg,
            time: new Date().toISOString(),
          };
          addHistory(entry);
          setRunResults((prev) => [...prev, { id: entry.id, file: file.name, status: "error", message: errMsg }]);
          setMessage(errMsg);
        } else {
          const blob = await response.blob();
          const fileUrl = URL.createObjectURL(blob);
          const entry = {
            id: byId(),
            file: file.name,
            type: selectedConversionLabel,
            status: "success" as const,
            message: "Conversion completed.",
            time: new Date().toISOString(),
            downloadUrl: fileUrl,
          };
          addHistory(entry);
          setRunResults((prev) => [
            ...prev,
            { id: entry.id, file: file.name, status: "success", message: "Done", downloadUrl: fileUrl },
          ]);
          setMessage(`Conversion completed. (${file.name})`);
          setDownloadUrl(fileUrl);

          if (selectedConversion?.category === "image") {
            setAfterImageUrl(fileUrl);
          }
        }
      } catch {
        const err = "Cannot reach server. Check if Flask is running.";
        const id = byId();
        addHistory({
          id,
          file: file.name,
          type: selectedConversionLabel,
          status: "error",
          message: err,
          time: new Date().toISOString(),
        });
        setRunResults((prev) => [...prev, { id, file: file.name, status: "error", message: err }]);
        setMessage(err);
      }

      done += 1;
      setProgress(Math.round((done / files.length) * 100));
    }
    setLoading(false);
    setProcessingText("Batch complete.");
    if (settings.autoClearMessages) {
      setTimeout(() => setMessage(""), 2200);
    }
  };

  const downloadSample = (kind: "txt" | "csv" | "json") => {
    const contentMap = {
      txt: "File Converter Hub sample text.\nLine 2 example.\nLine 3 for PDF.",
      csv: "name,age,city\nAli,22,Istanbul\nEce,21,Ankara",
      json: JSON.stringify([{ name: "Ali", age: 22, city: "Istanbul" }, { name: "Ece", age: 21, city: "Ankara" }], null, 2),
    };
    const blob = new Blob([contentMap[kind]], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHistory = (format: "json" | "csv") => {
    if (!history.length) return;
    if (format === "json") {
      const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "conversion-history.json";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const csv = [
      "file,type,status,message,time",
      ...history.map((h) => `"${h.file}","${h.type}","${h.status}","${h.message.replace(/"/g, "'")}","${h.time}"`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "conversion-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedTheme) setTheme(savedTheme);
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (!loading) onConvert();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main className="page">
      <ThreeBackground />
      <div className="overlay" />
      <div className="shell">
        <section className="topbar">
          <div className="brand">
            <span className="brand-dot" />
            <span>File Converter Hub</span>
          </div>
          <div className="theme-pills top-right">
            <button className={`pill-btn ${theme === "aurora" ? "active" : ""}`} onClick={() => setTheme("aurora")}>
              Aurora
            </button>
            <button className={`pill-btn ${theme === "clean" ? "active" : ""}`} onClick={() => setTheme("clean")}>
              Clean
            </button>
            <button className={`pill-btn ${theme === "neo" ? "active" : ""}`} onClick={() => setTheme("neo")}>
              Neo
            </button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
              <Settings size={16} />
            </button>
          </div>
        </section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="hero">
          <span className="badge">3D Experience</span>
          <h1>File Converter Hub</h1>
          <p className="subtitle">Convert files in seconds. Faster, cleaner, and presentation-ready.</p>
          <div className="chips">
            <span>Image Convert</span>
            <span>TXT to PDF</span>
            <span>CSV/JSON</span>
          </div>
          <div className="story-grid">
            <article>
              <h4>Problem</h4>
              <p>Users need quick format changes without complex software.</p>
            </article>
            <article>
              <h4>Solution</h4>
              <p>One polished conversion workspace with instant outputs.</p>
            </article>
            <article>
              <h4>Value</h4>
              <p>Fast demos, simple flow, and no account required.</p>
            </article>
          </div>
          <div className="sample">
            <span>Sample Files:</span>
            <button className="sample-btn" onClick={() => downloadSample("txt")}>Sample TXT</button>
            <button className="sample-btn" onClick={() => downloadSample("csv")}>Sample CSV</button>
            <button className="sample-btn" onClick={() => downloadSample("json")}>Sample JSON</button>
          </div>
          <div className="stats">
            <h3>Statistics</h3>
            <div><strong>Total:</strong> {stats.total}</div>
            <div><strong>Top Type:</strong> {stats.topType}</div>
            <div><strong>Today:</strong> {stats.todayCount}</div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="panel">
          <h2>Start Conversion</h2>

          <label>Conversion Type</label>
          <div className="category-tabs" role="tablist" aria-label="Conversion categories">
            <button className={`tab-btn ${activeCategory === "image" ? "active" : ""}`} onClick={() => setActiveCategory("image")}>Images</button>
            <button className={`tab-btn ${activeCategory === "document" ? "active" : ""}`} onClick={() => setActiveCategory("document")}>Documents</button>
            <button className={`tab-btn ${activeCategory === "data" ? "active" : ""}`} onClick={() => setActiveCategory("data")}>Data</button>
          </div>
          <p className="conversion-help">Choose one conversion below</p>
          <div className="conversion-grid">
            {filteredConversions.map((item) => {
              const Icon = item.icon;
              return (
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  key={item.value}
                  className={`conversion-card ${conversionType === item.value ? "active" : ""}`}
                  onClick={() => setConversionType(item.value)}
                >
                  <span className="conversion-icon"><Icon size={16} /></span>
                  <span>{item.label}</span>
                </motion.button>
              );
            })}
          </div>

          <label>Upload File</label>
          <div
            className={`dropzone ${isDragOver ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              setSelectedFiles(Array.from(e.dataTransfer.files || []));
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload files"
          >
            Drop file here or click
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden-input"
            onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
          />

          {validationBadge && (
            <div className={`validation ${validationBadge.ok ? "valid" : "invalid"}`}>
              {validationBadge.ok ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
              <span>{validationBadge.text}</span>
            </div>
          )}

          <div className="meta">
            <span>Selected: {files.length ? `${files.length} file(s)` : "None"}</span>
            <span>Mode: {selectedConversionLabel}</span>
            <span>Shortcuts: Ctrl+U upload, Ctrl+Enter convert</span>
          </div>

          <button onClick={onConvert} disabled={loading}>{loading ? "Converting..." : "Convert"}</button>
          <div className="progress-track"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
          <div className="progress-text">{processingText || "Idle"}</div>

          <AnimatePresence>
            {message && (
              <motion.p
                className="message"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                aria-live="polite"
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>
          {downloadUrl && <a className="download" href={downloadUrl}>Download latest output</a>}

          {(previewImageUrl || afterImageUrl) && (
            <div className="before-after">
              {!!previewImageUrl && <img className="preview-image" src={previewImageUrl} alt="Before conversion preview" />}
              {!!afterImageUrl && <img className="preview-image" src={afterImageUrl} alt="After conversion preview" />}
            </div>
          )}
          {!!previewText && <pre className="preview-text">{previewText}</pre>}
          {!!previewTable.length && (
            <div className="preview-table-wrap">
              <table className="preview-table">
                <tbody>
                  {previewTable.map((row, i) => (
                    <tr key={`r-${i}`}>{row.map((cell, j) => <td key={`c-${i}-${j}`}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        <section className="history">
          <div className="history-head">
            <h3>Recent Conversions</h3>
            <div className="history-actions">
              <button className="clear-btn" onClick={() => exportHistory("json")}><Download size={14} /> JSON</button>
              <button className="clear-btn" onClick={() => exportHistory("csv")}><FileCode2 size={14} /> CSV</button>
              <button className="clear-btn" onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }}>Clear</button>
            </div>
          </div>

          {!!runResults.length && (
            <div className="batch-results">
              <h4>Batch Result</h4>
              {runResults.map((r) => (
                <div key={r.id} className={`batch-item ${r.status}`}>
                  <span>{r.file}</span>
                  <span>{r.status}</span>
                  {r.downloadUrl ? <a href={r.downloadUrl}>Download</a> : <span>-</span>}
                </div>
              ))}
            </div>
          )}

          {!history.length && <p className="muted">No records yet.</p>}
          {!!history.length && (
            <ul>
              {history.map((h) => (
                <motion.li key={h.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <div><strong>{h.file}</strong> - {h.type}</div>
                  <small>{new Date(h.time).toLocaleString()}</small>
                  <div className={h.status === "success" ? "ok" : "err"}>{h.message}</div>
                  {h.downloadUrl && <a href={h.downloadUrl} className="mini-download">Download</a>}
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.aside
            className="settings-drawer"
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            <div className="settings-head">
              <h3><SlidersHorizontal size={16} /> Settings</h3>
              <button className="icon-btn" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <label className="settings-label">Max history items: {settings.maxHistory}</label>
            <input
              type="range"
              min={5}
              max={30}
              value={settings.maxHistory}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxHistory: Number(e.target.value) }))}
            />
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.autoClearMessages}
                onChange={(e) => setSettings((prev) => ({ ...prev, autoClearMessages: e.target.checked }))}
              />
              Auto clear status messages
            </label>
          </motion.aside>
        )}
      </AnimatePresence>
    </main>
  );
}
