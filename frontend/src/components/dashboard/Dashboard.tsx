import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen, Layers, Trash2, AlertTriangle } from "lucide-react";
import { useEvalStore } from "../../store/useEvalStore";
import { useToastStore } from "../../store/useToastStore";
import { api } from "../../api/client";
import type { Suite, SuiteSummary } from "../../api/client";
import { OverviewCards } from "./OverviewCards";
import { ResumeTable } from "./ResumeTable";
import { ExportButton } from "./ExportButton";
import { Skeleton } from "../shared/Skeleton";
import type { BatchSummary, EvaluationResult, ResultsStats } from "../../types";

function sortResults(results: EvaluationResult[], sort: "score" | "name", order: "asc" | "desc"): EvaluationResult[] {
  const sorted = [...results].sort((a, b) => {
    if (sort === "score") return a.weighted_score - b.weighted_score;
    return (a.candidate_name || a.filename).toLowerCase().localeCompare((b.candidate_name || b.filename).toLowerCase());
  });
  return order === "desc" ? sorted.reverse() : sorted;
}

function pickDefaultBatch(list: BatchSummary[], suite: string, preferred: string): string {
  const pool = suite ? list.filter((b) => b.suite_name === suite) : list;
  if (pool.length === 0) return "";
  if (preferred && pool.some((b) => b.name === preferred)) return preferred;
  return pool[0].name; // list is sorted most-recent-first
}

function effectiveSelected(r: EvaluationResult, threshold: number): boolean {
  return r.manual_selected ?? r.weighted_score >= threshold;
}

export function Dashboard() {
  const { suiteName, batchName, selectionThreshold, setSelectionThreshold, goToStep } = useEvalStore();
  const addToast = useToastStore((s) => s.addToast);

  const [results, setResults] = useState<EvaluationResult[]>([]);
  const [stats, setStats] = useState<ResultsStats>({ total: 0, avg_score: 0 });
  const [sort, setSort] = useState<"score" | "name">("score");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [showCriteria, setShowCriteria] = useState(false);
  const [criteriaSuite, setCriteriaSuite] = useState<Suite | null>(null);

  const [suites, setSuites] = useState<SuiteSummary[]>([]);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selectedSuite, setSelectedSuite] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [ready, setReady] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refreshLists = async () => {
    const [suitesRes, batchesRes] = await Promise.all([
      api.listSuites().catch(() => ({ suites: [] })),
      api.listBatches().catch(() => ({ batches: [] })),
    ]);
    setSuites(suitesRes.suites);
    setBatches(batchesRes.batches);
    return { suites: suitesRes.suites, batches: batchesRes.batches };
  };

  useEffect(() => {
    refreshLists().then(({ suites: fetchedSuites, batches: fetchedBatches }) => {
      const suiteDefault = fetchedSuites.some((s) => s.name === suiteName)
        ? suiteName
        : fetchedBatches[0]?.suite_name || fetchedSuites[0]?.name || "";
      setSelectedSuite(suiteDefault);
      setSelectedBatch(pickDefaultBatch(fetchedBatches, suiteDefault, batchName));
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batchOptions = useMemo(
    () => (selectedSuite ? batches.filter((b) => b.suite_name === selectedSuite) : batches),
    [batches, selectedSuite]
  );

  const handleSuiteChange = (name: string) => {
    setSelectedSuite(name);
    setSelectedBatch(pickDefaultBatch(batches, name, selectedBatch));
  };

  const handleBatchChange = (name: string) => {
    setSelectedBatch(name);
    const batch = batches.find((b) => b.name === name);
    if (batch?.suite_name && batch.suite_name !== selectedSuite) {
      setSelectedSuite(batch.suite_name);
    }
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    const name = selectedBatch;
    try {
      await api.deleteBatch(name);
      addToast(`Batch "${name}" deleted.`, "success");
      setConfirmDelete(false);
      const { batches: freshBatches } = await refreshLists();
      setSelectedBatch(pickDefaultBatch(freshBatches, selectedSuite, ""));
    } catch (e: unknown) {
      addToast((e as Error).message || "Failed to delete batch.", "error");
    }
  };

  const fetchResults = async () => {
    if (!selectedBatch) {
      setResults([]);
      setStats({ total: 0, avg_score: 0 });
      return;
    }
    setLoading(true);
    try {
      const res = await api.getBatch(selectedBatch);
      const sorted = sortResults(res.results, sort, order);
      const total = res.results.length;
      const avg = total ? res.results.reduce((s, r) => s + r.weighted_score, 0) / total : 0;
      setResults(sorted);
      setStats({ total, avg_score: Math.round(avg * 10) / 10 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, order, selectedBatch, ready]);

  useEffect(() => {
    const s = suites.find((s) => s.name === selectedSuite);
    if (!s) {
      setCriteriaSuite(null);
      return;
    }
    api.getSuite(s.id).then(setCriteriaSuite).catch(() => setCriteriaSuite(null));
  }, [selectedSuite, suites]);

  const handleSetSelection = async (resumeId: string, selected: boolean | null) => {
    if (!selectedBatch) return;
    setResults((prev) => prev.map((r) => (r.resume_id === resumeId ? { ...r, manual_selected: selected } : r)));
    try {
      await api.setSelection(selectedBatch, resumeId, selected);
    } catch (e: unknown) {
      addToast((e as Error).message || "Failed to update selection.", "error");
      fetchResults();
    }
  };

  const selectedCount = useMemo(
    () => results.filter((r) => effectiveSelected(r, selectionThreshold)).length,
    [results, selectionThreshold]
  );
  const notSelectedCount = results.length - selectedCount;

  const isInitialLoad = !ready || (loading && stats.total === 0);
  const hasAnyBatch = batchOptions.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {selectedBatch || "No batches yet"}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{stats.total} resumes evaluated</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {suites.length > 0 && (
            <div className="relative">
              <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedSuite}
                onChange={(e) => handleSuiteChange(e.target.value)}
                className="pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {suites.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {hasAnyBatch && (
            <div className="relative">
              <FolderOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedBatch}
                onChange={(e) => handleBatchChange(e.target.value)}
                className="pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {batchOptions.map((b) => (
                  <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
                ))}
              </select>
            </div>
          )}
          {selectedBatch && (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete this batch"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={15} />
            </button>
          )}
          {selectedBatch && <ExportButton batchName={selectedBatch} />}
        </div>
      </div>

      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Delete batch "{selectedBatch}"?</p>
            <p className="text-sm text-red-700 mt-0.5">This permanently removes all {stats.total} candidate records and original files in this batch. This cannot be undone.</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleDeleteBatch}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-1.5 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {ready && !hasAnyBatch ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          No saved batches yet. Run an evaluation from Upload & Process to see results here.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium text-slate-700">Selection threshold</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={selectionThreshold}
                onChange={(e) => setSelectionThreshold(Number(e.target.value))}
                className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
            <p className="text-xs text-slate-400">
              Candidates with cumulative score at or above this threshold are marked Selected.
            </p>
          </div>

          <OverviewCards stats={stats} selectedCount={selectedCount} notSelectedCount={notSelectedCount} loading={loading} />

          {criteriaSuite && (
            <div className="bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                onClick={() => setShowCriteria((v) => !v)}
              >
                <span className="font-medium">View Job Description & KPIs ({criteriaSuite.name})</span>
                {showCriteria ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showCriteria && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                  {criteriaSuite.jd_text && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Job Description</p>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{criteriaSuite.jd_text}</p>
                    </div>
                  )}
                  {criteriaSuite.kpis.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">KPIs & Weights</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {criteriaSuite.kpis.map((k) => (
                          <div key={k.name} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700">{k.name}</p>
                              <p className="text-xs text-slate-400 truncate max-w-[200px]">{k.description}</p>
                            </div>
                            <span className="text-sm font-bold text-brand-600 ml-3 shrink-0">
                              {Math.round(k.weight * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isInitialLoad ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton height={32} width={32} className="rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton height={14} width="38%" />
                    <Skeleton height={10} width="22%" />
                  </div>
                  <Skeleton height={12} width={60} />
                  <Skeleton height={22} width={90} className="rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <ResumeTable
              results={results}
              sort={sort}
              setSort={(s) => setSort(s)}
              order={order}
              setOrder={(o) => setOrder(o)}
              threshold={selectionThreshold}
              onSetSelection={handleSetSelection}
            />
          )}
        </>
      )}

      <button
        onClick={() => goToStep(2)}
        className="mt-6 px-6 py-3 border border-slate-300 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}
