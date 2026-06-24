import { useState, useEffect, useRef } from "react";
import { FileText, AlertCircle, CheckCircle, XCircle, Loader2, Play, StopCircle, Settings, RotateCcw } from "lucide-react";
import { api } from "../../api/client";
import { useEvalStore } from "../../store/useEvalStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { FileDropzone } from "../shared/FileDropzone";
import { ProgressBar } from "../shared/ProgressBar";
import { SettingsModal } from "../layout/SettingsModal";
import type { EvaluationResult } from "../../types";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  vllm: "Local LLM",
};

type NameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const NAME_RE = /^[A-Za-z0-9 _-]{1,80}$/;

export function StepUploadProcess() {
  const {
    sessionId, uploadedFiles, setUploadedFiles, batchName, setBatchName,
    addResult, setProcessingStatus, processingStatus, selectionThreshold, goToStep,
    setupComplete, resetBatchState,
  } = useEvalStore();
  const { provider, openModal: openSettings } = useSettingsStore();

  // -- Upload state --
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const [uploadDone, setUploadDone] = useState(uploadedFiles.length > 0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const name = batchName.trim();
    if (uploadDone) return;
    if (!name) {
      setNameStatus("idle");
      return;
    }
    if (!NAME_RE.test(name)) {
      setNameStatus("invalid");
      return;
    }
    setNameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.checkBatchName(name);
        setNameStatus(res.available ? "available" : "taken");
      } catch {
        setNameStatus("idle");
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [batchName, uploadDone]);

  const nameReady = nameStatus === "available";

  const handleFiles = async (files: File[]) => {
    if (!sessionId) return;
    if (!nameReady) {
      setUploadError("Enter a unique batch name above before uploading resumes.");
      return;
    }
    setUploadLoading(true);
    setUploadError("");
    setFailed([]);
    setUploadDone(false);
    try {
      const res = await api.uploadResumes(sessionId, batchName.trim(), files);
      setUploadedFiles(res.filenames.map((name) => ({ name, size: 0 })));
      setFailed(res.failed);
      setUploadDone(true);
    } catch (e: unknown) {
      setUploadError((e as Error).message);
    } finally {
      setUploadLoading(false);
    }
  };

  // -- Process state --
  const [started, setStarted] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [processError, setProcessError] = useState("");
  const [liveResults, setLiveResults] = useState<EvaluationResult[]>([]);
  const [confirmBack, setConfirmBack] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const handleStart = async () => {
    if (!sessionId) return;
    setProcessError("");
    setStarted(true);
    setCancelled(false);
    setLiveResults([]);
    setConfirmBack(false);

    try {
      await api.startEvaluation(sessionId);
    } catch (e: unknown) {
      setProcessError((e as Error).message);
      setStarted(false);
      return;
    }

    const source = new EventSource(`/api/sessions/${sessionId}/evaluate/stream`);
    sourceRef.current = source;

    source.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "result") {
        setProcessingStatus({
          status: "processing",
          processed: event.processed,
          total: event.total,
          percent: event.percent,
        });
        addResult(event.result);
        setLiveResults((prev: EvaluationResult[]) => [...prev, event.result as EvaluationResult]);
      } else if (event.type === "done") {
        setProcessingStatus({ status: "done", percent: 100 });
        source.close();
        sourceRef.current = null;
      } else if (event.type === "error") {
        setProcessError(event.message || "Processing failed");
        source.close();
        sourceRef.current = null;
      }
    };

    source.onerror = () => {
      if (processingStatus.status !== "done") {
        setProcessError("Connection lost. Check backend.");
      }
      source.close();
      sourceRef.current = null;
    };
  };

  const handleCancel = () => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    setCancelled(true);
    setProcessingStatus({ status: "idle" });
  };

  const handleReset = async () => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    if (sessionId) {
      try { await api.resetBatch(sessionId); } catch { /* best-effort */ }
    }
    resetBatchState();
    setNameStatus("idle");
    setUploadLoading(false);
    setUploadError("");
    setFailed([]);
    setUploadDone(false);
    setStarted(false);
    setCancelled(false);
    setProcessError("");
    setLiveResults([]);
    setConfirmBack(false);
  };

  const metThreshold = liveResults.filter((r) => r.weighted_score >= selectionThreshold).length;
  const belowThreshold = liveResults.length - metThreshold;
  const isProcessing = started && processingStatus.status !== "done" && !cancelled;
  const isFinished = processingStatus.status === "done" || cancelled;

  const handleBack = () => {
    if (isProcessing) {
      setConfirmBack(true);
    } else {
      goToStep(1);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Upload Resumes */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Upload Resumes</h2>
          <p className="text-slate-500">Name this batch, then select individual PDF/DOCX files or pick a folder to upload all resumes at once.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(uploadDone || uploadedFiles.length > 0 || started) && (
            <button
              onClick={handleReset}
              title="Reset this batch"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors"
            >
              <RotateCcw size={15} />
              <span className="text-xs font-medium hidden sm:inline">Reset</span>
            </button>
          )}
          <button
            onClick={openSettings}
            title="LLM Settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-colors"
          >
            <Settings size={15} />
            <span className="text-xs font-medium">{PROVIDER_LABELS[provider] ?? provider}</span>
          </button>
        </div>
      </div>
      <SettingsModal />

      {!setupComplete && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Setup isn't complete</p>
            <p className="text-sm text-red-700 mt-0.5">
              You need a saved Job Description, KPIs, and Suite Name before you can upload resumes.
            </p>
            <button
              onClick={() => goToStep(1)}
              className="mt-3 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Go to Setup →
            </button>
          </div>
        </div>
      )}

      {setupComplete && (
      <>
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Batch Name</label>
        <div className="relative">
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="Batch-1"
            disabled={uploadDone}
            className="w-full pr-9 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {nameStatus === "checking" && <Loader2 size={15} className="animate-spin text-slate-400" />}
            {nameStatus === "available" && <CheckCircle size={15} className="text-green-500" />}
            {(nameStatus === "taken" || nameStatus === "invalid") && <XCircle size={15} className="text-red-500" />}
          </span>
        </div>
        {nameStatus === "taken" && (
          <p className="text-xs text-red-500 mt-1">That name is already used by a saved batch — pick another.</p>
        )}
        {nameStatus === "invalid" && (
          <p className="text-xs text-red-500 mt-1">Letters, numbers, spaces, hyphens, underscores only (1-80 chars).</p>
        )}
        {nameStatus === "idle" && !uploadDone && (
          <p className="text-xs text-slate-400 mt-1">Must be unique — this becomes the saved batch's name in the dashboard dropdown.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <FileDropzone
          mode="files"
          onFiles={handleFiles}
          label="Select Files"
          hint="Choose individual PDF or DOCX files"
        />
        <FileDropzone
          mode="folder"
          onFiles={handleFiles}
          label="Select Folder"
          hint="Upload all PDFs and DOCXs from a folder"
        />
      </div>

      {uploadLoading && (
        <div className="flex items-center gap-2 text-slate-600 text-sm">
          <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Parsing resumes...
        </div>
      )}

      {uploadDone && uploadedFiles.length > 0 && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
            <CheckCircle size={16} />
            {uploadedFiles.length} resume{uploadedFiles.length !== 1 ? "s" : ""} parsed successfully
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {uploadedFiles.map((f: { name: string }) => (
              <div key={f.name} className="flex items-center gap-2 text-sm text-slate-600">
                <FileText size={12} className="text-slate-400 shrink-0" />
                <span className="truncate">{f.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-sm font-medium text-yellow-700 mb-1">
            {failed.length} file(s) could not be parsed:
          </p>
          {failed.map((f) => (
            <p key={f} className="text-xs text-yellow-600">{f}</p>
          ))}
        </div>
      )}

      {uploadError && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={14} /> {uploadError}
        </div>
      )}

      {/* Process Resumes */}
      {uploadedFiles.length > 0 && (
        <>
          <hr className="my-8 border-slate-200" />

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Process Resumes</h2>
            <p className="text-slate-500">
              {uploadedFiles.length} resume{uploadedFiles.length !== 1 ? "s" : ""} ready. The AI will score each one against your KPIs.
            </p>
          </div>

          {!started && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-800">{uploadedFiles.length}</p>
                  <p className="text-sm text-slate-500">Resumes</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-slate-800">~{Math.ceil(uploadedFiles.length * 8 / 60)}m</p>
                  <p className="text-sm text-slate-500">Est. time</p>
                </div>
              </div>
              <button
                onClick={handleStart}
                className="w-full flex items-center justify-center gap-2 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-lg transition-colors"
              >
                <Play size={20} />
                Start Evaluation
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-4">
              <div className="mb-4">
                <ProgressBar
                  percent={processingStatus.percent}
                  label={`${processingStatus.processed} of ${processingStatus.total} processed`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-center mb-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xl font-bold text-green-700">{metThreshold}</p>
                  <p className="text-sm text-green-600">≥ {selectionThreshold}%</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xl font-bold text-slate-600">{belowThreshold}</p>
                  <p className="text-sm text-slate-500">Below threshold</p>
                </div>
              </div>
              {liveResults.length > 0 && (
                <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
                  {[...liveResults].reverse().slice(0, 10).map((r) => (
                    <div key={r.resume_id} className="flex items-center gap-2 text-sm py-1 border-b border-slate-50">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${r.weighted_score >= selectionThreshold ? "bg-green-500" : "bg-slate-300"}`} />
                      <span className="text-slate-600 truncate">{r.candidate_name || r.filename}</span>
                      <span className="ml-auto font-medium shrink-0 text-slate-500 tabular-nums">{r.weighted_score.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleCancel}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-xl text-sm transition-colors"
              >
                <StopCircle size={16} />
                Cancel Evaluation
              </button>
            </div>
          )}

          {processingStatus.status === "done" && !cancelled && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-4 text-center">
              <CheckCircle size={40} className="mx-auto mb-2 text-green-600" />
              <p className="text-xl font-bold text-green-800 mb-1">Evaluation Complete!</p>
              <p className="text-green-700">{metThreshold} of {liveResults.length} met the {selectionThreshold}% threshold</p>
            </div>
          )}

          {cancelled && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-4 text-center">
              <XCircle size={40} className="mx-auto mb-2 text-amber-500" />
              <p className="text-xl font-bold text-amber-800 mb-1">Evaluation Cancelled</p>
              <p className="text-amber-700 mb-4">
                {liveResults.length} of {uploadedFiles.length} resumes processed —{" "}
                {metThreshold} met the {selectionThreshold}% threshold
              </p>
              <p className="text-xs text-amber-600">You can view partial results in the dashboard.</p>
            </div>
          )}

          {processError && !cancelled && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm mb-4">
              <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-700">Evaluation failed</p>
                <p className="text-red-600 mt-0.5">{processError}</p>
              </div>
              <button
                onClick={() => { setProcessError(""); setStarted(false); }}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}
      </>
      )}

      {confirmBack && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 font-medium mb-3">
            Going back will stop the current evaluation. Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { handleCancel(); goToStep(1); }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Yes, go back
            </button>
            <button
              onClick={() => setConfirmBack(false)}
              className="px-4 py-2 border border-amber-300 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleBack}
          className="px-6 py-3 border border-slate-300 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
        >
          ← Back
        </button>
        {uploadedFiles.length > 0 && (
          <button
            onClick={() => goToStep(3)}
            disabled={!isFinished}
            className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors"
          >
            {cancelled ? "View Partial Dashboard →" : "View Dashboard →"}
          </button>
        )}
      </div>
    </div>
  );
}
