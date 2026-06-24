import { useState, useEffect, useRef } from "react";
import { FileText, AlertCircle, CheckCircle, XCircle, Loader2, Pencil, Trash2, Plus, Check, X, FolderOpen, AlertTriangle, Upload } from "lucide-react";
import { api } from "../../api/client";
import type { SuiteSummary } from "../../api/client";
import { useEvalStore } from "../../store/useEvalStore";
import { useToastStore } from "../../store/useToastStore";
import { FileDropzone } from "../shared/FileDropzone";
import type { KPI } from "../../types";

interface EditState {
  name: string;
  description: string;
}

function KPICard({
  kpi,
  onWeightChange,
  onEdit,
  onDelete,
}: {
  kpi: KPI;
  onWeightChange: (w: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pct = Math.round(kpi.weight * 100);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span className="font-medium text-slate-800">{kpi.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-brand-600 font-bold tabular-nums w-12 text-right mr-1">{pct}%</span>
          <button
            onClick={onEdit}
            title="Edit KPI"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            title="Delete KPI"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">{kpi.description}</p>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => onWeightChange(Number(e.target.value) / 100)}
        className="w-full accent-brand-600"
      />
    </div>
  );
}

function EditCard({
  initial,
  onCommit,
  onCancel,
}: {
  initial: EditState;
  onCommit: (s: EditState) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <div className="bg-white border-2 border-brand-300 rounded-xl p-4 space-y-2">
      <input
        value={state.name}
        onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
        placeholder="KPI name (e.g. Python Experience)"
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        autoFocus
      />
      <input
        value={state.description}
        onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
        placeholder="What it measures, and how to score it 0-100"
        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { if (state.name.trim()) onCommit(state); }}
          disabled={!state.name.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Check size={12} /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <X size={12} /> Cancel
        </button>
      </div>
    </div>
  );
}

function distributeWeights(kpiList: KPI[]): KPI[] {
  if (kpiList.length === 0) return kpiList;
  const w = Math.round((1 / kpiList.length) * 100) / 100;
  return kpiList.map((k) => ({ ...k, weight: w }));
}

function parseKPIJson(jsonText: string): KPI[] {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("That's not valid JSON — check for missing quotes, commas, or brackets.");
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Expected a non-empty JSON array of KPIs — see the format example below.");
  }
  return data.map((item, i) => {
    if (typeof item !== "object" || item === null || typeof item.name !== "string" || !item.name.trim()) {
      throw new Error(`Item ${i + 1} is missing a valid "name" string.`);
    }
    return {
      name: item.name.trim(),
      description: typeof item.description === "string" ? item.description.trim() : "",
      weight: typeof item.weight === "number" && item.weight >= 0 ? item.weight : 0,
    };
  });
}

type NameStatus = "idle" | "checking" | "available" | "taken";

export function StepSetup() {
  const {
    sessionId, jdText, setJDText, kpis, updateKPIWeight, updateKPI, setKPIs, goToStep,
    suiteName, setSuiteName, loadedSuiteId, loadedSuiteName, loadSuite, clearLoadedSuite,
    setSetupComplete,
  } = useEvalStore();
  const addToast = useToastStore((s) => s.addToast);

  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [jdLoading, setJdLoading] = useState(false);
  const [jdError, setJdError] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [jdFileName, setJdFileName] = useState("");

  const [editingName, setEditingName] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(kpis.length === 0);
  const [kpiError, setKpiError] = useState("");
  const [showKpiFormat, setShowKpiFormat] = useState(false);
  const [showKpiPaste, setShowKpiPaste] = useState(false);
  const [kpiPasteText, setKpiPasteText] = useState("");
  const [kpiJsonFileName, setKpiJsonFileName] = useState("");
  const kpiFileInputRef = useRef<HTMLInputElement>(null);

  const [suites, setSuites] = useState<SuiteSummary[]>([]);
  const [suiteNameStatus, setSuiteNameStatus] = useState<NameStatus>("idle");
  const [suiteLoading, setSuiteLoading] = useState(false);
  const [suiteError, setSuiteError] = useState("");
  const [confirmDeleteSuite, setConfirmDeleteSuite] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => { api.listSuites().then((r) => setSuites(r.suites)).catch(() => {}); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const name = suiteName.trim();
    if (!name) {
      setSuiteNameStatus("idle");
      return;
    }
    setSuiteNameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.checkSuiteName(name, loadedSuiteId ?? undefined);
        setSuiteNameStatus(res.available ? "available" : "taken");
      } catch {
        setSuiteNameStatus("idle");
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [suiteName, loadedSuiteId]);

  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  const totalPct = Math.round(totalWeight * 100);
  const isValid = Math.abs(totalWeight - 1.0) < 0.01;

  const handleLoadSuite = async (id: string) => {
    if (!id) return;
    setSuiteLoading(true);
    try {
      const suite = await api.getSuite(id);
      setJDText(suite.jd_text);
      setKPIs(suite.kpis);
      loadSuite(suite.id, suite.name);
      addToast(`Suite "${suite.name}" loaded.`, "success");
    } catch {
      addToast("Failed to load suite.", "error");
    } finally {
      setSuiteLoading(false);
    }
  };

  const handleDeleteSuite = async () => {
    if (!loadedSuiteId) return;
    const name = loadedSuiteName ?? "";
    try {
      await api.deleteSuite(loadedSuiteId);
      addToast(`Suite "${name}" deleted.`, "success");
      clearLoadedSuite();
      setSuites((prev) => prev.filter((s) => s.id !== loadedSuiteId));
      setConfirmDeleteSuite(false);
    } catch (e: unknown) {
      addToast((e as Error).message || "Failed to delete suite.", "error");
    }
  };

  const handleJDFile = async (files: File[]) => {
    if (!sessionId || !files[0]) return;
    setJdLoading(true);
    setJdError("");
    setCharCount(0);
    try {
      const res = await api.uploadJDFile(sessionId, files[0]);
      setJDText(res.preview + (res.char_count > 300 ? "..." : ""));
      setCharCount(res.char_count);
      setJdFileName(files[0].name);
    } catch (e: unknown) {
      setJdError((e as Error).message);
    } finally {
      setJdLoading(false);
    }
  };

  const handleAddKPI = (s: EditState) => {
    const newKpi: KPI = { name: s.name.trim(), description: s.description.trim(), weight: 0 };
    setKPIs(distributeWeights([...kpis, newKpi]));
    setAddingNew(false);
  };

  const handleDeleteKPI = (name: string) => {
    setKPIs(distributeWeights(kpis.filter((k) => k.name !== name)));
  };

  const applyParsedKPIs = (jsonText: string, source: "file" | "paste") => {
    setKpiError("");
    try {
      const parsed = parseKPIJson(jsonText);
      const totalW = parsed.reduce((s, k) => s + k.weight, 0);
      setKPIs(totalW > 0 ? parsed : distributeWeights(parsed));
      setAddingNew(false);
      addToast(`Loaded ${parsed.length} KPI${parsed.length !== 1 ? "s" : ""} from ${source === "file" ? "file" : "pasted JSON"}.`, "success");
      return true;
    } catch (e: unknown) {
      setKpiError(e instanceof Error ? e.message : "Could not parse that as KPI JSON.");
      return false;
    }
  };

  const handleKPIJsonUpload = async (file: File) => {
    const text = await file.text();
    if (applyParsedKPIs(text, "file")) {
      setKpiJsonFileName(file.name);
    }
  };

  const handleKPIJsonPaste = () => {
    if (applyParsedKPIs(kpiPasteText, "paste")) {
      setKpiPasteText("");
      setShowKpiPaste(false);
      setKpiJsonFileName("");
    }
  };

  const canProceed =
    suiteName.trim().length > 0 && suiteNameStatus === "available" &&
    jdText.trim().length > 0 && isValid && kpis.length > 0;

  const handleNext = async () => {
    if (!sessionId || !canProceed) return;
    setSaving(true);
    setJdError("");
    setKpiError("");
    setSuiteError("");
    try {
      if (mode === "paste") {
        await api.uploadJD(sessionId, jdText);
      }
    } catch (e: unknown) {
      setJdError((e as Error).message);
      setSaving(false);
      return;
    }
    try {
      await api.saveKPIs(sessionId, kpis, suiteName.trim());
    } catch (e: unknown) {
      setKpiError((e as Error).message);
      setSaving(false);
      return;
    }
    try {
      const name = suiteName.trim();
      if (loadedSuiteId && name === loadedSuiteName) {
        await api.updateSuite(loadedSuiteId, { name, jd_text: jdText, kpis });
      } else {
        await api.createSuite({ name, jd_text: jdText, kpis });
      }
    } catch (e: unknown) {
      setSuiteError((e as Error).message);
      setSaving(false);
      return;
    }
    setSetupComplete(true);
    addToast("Suite saved. Job description and KPIs ready.", "success");
    setSaving(false);
    goToStep(2);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Suite */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Setup</h2>
        <p className="text-slate-500">Load a saved suite, or name and define a new one below.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-8 space-y-3">
        {suites.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Load from Suites</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={loadedSuiteId ?? ""}
                  onChange={(e) => handleLoadSuite(e.target.value)}
                  disabled={suiteLoading}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">— Select a saved suite —</option>
                  {suites.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.kpi_count} KPIs)</option>
                  ))}
                </select>
              </div>
              {loadedSuiteId && (
                <button
                  onClick={() => setConfirmDeleteSuite(true)}
                  title="Delete this suite"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            {confirmDeleteSuite && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Delete suite "{loadedSuiteName}"?</p>
                  <p className="text-sm text-red-700 mt-0.5">This permanently removes the saved JD + KPI template. This cannot be undone.</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleDeleteSuite}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteSuite(false)}
                      className="px-4 py-1.5 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Suite Name</label>
          <div className="relative">
            <input
              type="text"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full pr-9 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {suiteNameStatus === "checking" && <Loader2 size={15} className="animate-spin text-slate-400" />}
              {suiteNameStatus === "available" && <CheckCircle size={15} className="text-green-500" />}
              {suiteNameStatus === "taken" && <XCircle size={15} className="text-red-500" />}
            </span>
          </div>
          {suiteNameStatus === "taken" && (
            <p className="text-xs text-red-500 mt-1">That name is already used by another suite — pick another.</p>
          )}
          {suiteNameStatus === "idle" && (
            <p className="text-xs text-slate-400 mt-1">Must be unique — names this JD + KPI combination for reuse later.</p>
          )}
        </div>
        {suiteError && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={14} /> {suiteError}
          </div>
        )}
      </div>

      {/* Job Description */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Job Description</h2>
        <p className="text-slate-500">Upload or paste the job description you want to evaluate candidates against.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {(["paste", "file"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              mode === m
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-slate-600 border-slate-300 hover:border-brand-400"
            }`}
          >
            {m === "paste" ? "Paste Text" : "Upload File"}
          </button>
        ))}
      </div>

      {mode === "paste" ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50">
            <FileText size={14} className="text-slate-400" />
            <span className="text-xs text-slate-500">Job Description</span>
          </div>
          <textarea
            value={jdText}
            onChange={(e) => setJDText(e.target.value)}
            placeholder="Paste your job description here..."
            className="w-full p-4 h-56 text-sm text-slate-700 resize-none focus:outline-none"
          />
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 text-right">
            {jdText.length} characters
          </div>
        </div>
      ) : (
        <>
          <FileDropzone
            mode="files"
            accept=".pdf,.docx,.txt"
            onFiles={handleJDFile}
            label="Drop JD file here or click to browse"
            hint="PDF, DOCX, or TXT — max 32,000 chars"
          />
          {jdLoading && (
            <div className="mt-3 flex items-center gap-2 text-slate-600 text-sm">
              <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
              Parsing job description...
            </div>
          )}
          {!jdLoading && charCount > 0 && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
                <CheckCircle size={16} />
                Job description uploaded successfully
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileText size={12} className="text-slate-400 shrink-0" />
                <span className="truncate">{jdFileName}</span>
                <span className="text-slate-400">· {charCount.toLocaleString()} characters</span>
              </div>
            </div>
          )}
        </>
      )}

      {jdError && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={14} /> {jdError}
        </div>
      )}

      <hr className="my-8 border-slate-200" />

      {/* KPIs */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Define KPIs</h2>
        <p className="text-slate-500">
          Add the KPIs to evaluate candidates against. For each, describe how it should be scored
          (0-100) and assign a weight — weights must total 100%.
        </p>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => kpiFileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          <Upload size={14} /> Upload KPIs JSON
        </button>
        <input
          ref={kpiFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleKPIJsonUpload(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => setShowKpiPaste((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          <FileText size={14} /> Paste JSON
        </button>
        <button
          onClick={() => setShowKpiFormat((v) => !v)}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium"
        >
          {showKpiFormat ? "Hide format example" : "View format example"}
        </button>
      </div>

      {showKpiPaste && (
        <div className="bg-white border-2 border-brand-300 rounded-xl p-4 mb-4 space-y-2">
          <textarea
            value={kpiPasteText}
            onChange={(e) => setKpiPasteText(e.target.value)}
            placeholder='Paste a JSON array of KPIs here, e.g. [{"name": "...", "description": "...", "weight": 0.5}]'
            className="w-full h-32 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleKPIJsonPaste}
              disabled={!kpiPasteText.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Check size={12} /> Load
            </button>
            <button
              onClick={() => { setShowKpiPaste(false); setKpiPasteText(""); }}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}

      {showKpiFormat && (
        <div className="mb-4">
          <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 overflow-x-auto">
{`[
  {
    "name": "Python Experience",
    "description": "Years of hands-on Python/FastAPI backend work",
    "weight": 0.4
  },
  {
    "name": "Leadership",
    "description": "Experience managing or mentoring engineers",
    "weight": 0.3
  },
  {
    "name": "System Design",
    "description": "Ability to design scalable, maintainable systems",
    "weight": 0.3
  }
]`}
          </pre>
          <p className="text-xs text-slate-400 mt-1.5">
            A JSON array of objects with <code>name</code> (required), <code>description</code>, and <code>weight</code> (0-1, optional —
            if omitted or all zero, weights are distributed evenly). This replaces any KPIs currently listed below. Weights must total 100% before continuing.
          </p>
        </div>
      )}

      {kpiJsonFileName && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-1">
            <CheckCircle size={16} />
            KPIs uploaded successfully
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FileText size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{kpiJsonFileName}</span>
            <span className="text-slate-400">· {kpis.length} KPI{kpis.length !== 1 ? "s" : ""} loaded</span>
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${
            isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {isValid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            Total: {totalPct}%{" "}
            {isValid ? "(Valid)" : `(Need ${100 - totalPct > 0 ? `+${100 - totalPct}` : 100 - totalPct}% more)`}
          </div>
          <button
            onClick={() => setKPIs(distributeWeights(kpis))}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Distribute evenly
          </button>
        </div>
      )}

      <div className="space-y-3">
        {kpis.map((kpi) =>
          editingName === kpi.name ? (
            <EditCard
              key={kpi.name}
              initial={{ name: kpi.name, description: kpi.description }}
              onCommit={(s) => {
                updateKPI(kpi.name, {
                  name: s.name.trim(),
                  description: s.description.trim(),
                  weight: kpi.weight,
                });
                setEditingName(null);
              }}
              onCancel={() => setEditingName(null)}
            />
          ) : (
            <KPICard
              key={kpi.name}
              kpi={kpi}
              onWeightChange={(w) => updateKPIWeight(kpi.name, w)}
              onEdit={() => setEditingName(kpi.name)}
              onDelete={() => handleDeleteKPI(kpi.name)}
            />
          )
        )}

        {addingNew ? (
          <EditCard
            key="__new__"
            initial={{ name: "", description: "" }}
            onCommit={handleAddKPI}
            onCancel={() => setAddingNew(false)}
          />
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-slate-300 hover:border-brand-400 rounded-xl text-sm text-slate-500 hover:text-brand-600 transition-colors"
          >
            <Plus size={15} /> Add KPI
          </button>
        )}
      </div>

      {kpiError && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={14} /> {kpiError}
        </div>
      )}

      <button
        onClick={handleNext}
        disabled={jdLoading || saving || !canProceed}
        className="mt-8 w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors"
      >
        {saving ? "Saving..." : "Next: Upload Resumes →"}
      </button>
    </div>
  );
}
