import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, Phone, RotateCcw } from "lucide-react";
import type { EvaluationResult } from "../../types";

function effectiveSelected(r: EvaluationResult, threshold: number): boolean {
  return r.manual_selected ?? r.weighted_score >= threshold;
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-600",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

function getInitials(name: string | null, filename: string): string {
  const displayName = name || filename;
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string | null, filename: string): string {
  const displayName = name || filename;
  return AVATAR_COLORS[displayName.charCodeAt(0) % AVATAR_COLORS.length];
}

function getKpiCellStyle(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

interface Props {
  results: EvaluationResult[];
  sort: "score" | "name";
  setSort: (s: "score" | "name") => void;
  order: "asc" | "desc";
  setOrder: (o: "asc" | "desc") => void;
  threshold: number;
  onSetSelection: (resumeId: string, selected: boolean | null) => void;
}

const PAGE_SIZE = 20;

export function ResumeTable({ results, sort, setSort, order, setOrder, threshold, onSetSelection }: Props) {
  const [filter, setFilter] = useState<"all" | "selected" | "not_selected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showKpis, setShowKpis] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kpiNames = useMemo(
    () => Array.from(new Set(results.flatMap((r) => Object.keys(r.kpi_scores)))),
    [results]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  useEffect(() => { setPage(1); }, [filter, sort, order, results.length]);

  const filtered = useMemo(() => {
    let list = results;
    if (filter === "selected") list = list.filter((r) => effectiveSelected(r, threshold));
    else if (filter === "not_selected") list = list.filter((r) => !effectiveSelected(r, threshold));

    if (!debouncedQuery) return list;
    const q = debouncedQuery.toLowerCase();
    return list.filter(
      (r) =>
        (r.candidate_name && r.candidate_name.toLowerCase().includes(q)) ||
        (r.candidate_email && r.candidate_email.toLowerCase().includes(q)) ||
        (r.candidate_phone && r.candidate_phone.toLowerCase().includes(q)) ||
        r.filename.toLowerCase().includes(q)
    );
  }, [results, debouncedQuery, filter, threshold]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const usePagination = filtered.length > PAGE_SIZE;

  const toggleSort = (col: "score" | "name") => {
    if (sort === col) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(col);
      setOrder("desc");
    }
  };

  const SortIcon = ({ col }: { col: "score" | "name" }) =>
    sort === col ? (
      order === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />
    ) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap">
          <span className="text-sm font-medium text-slate-600 mr-1 shrink-0">Filter:</span>
          {([
            { id: "all", label: "all" },
            { id: "selected", label: "selected" },
            { id: "not_selected", label: "not selected" },
          ] as const).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize shrink-0 ${
                filter === f.id
                  ? f.id === "selected"
                    ? "bg-green-500 text-white"
                    : f.id === "not_selected"
                    ? "bg-red-500 text-white"
                    : "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <label className="flex items-center gap-1.5 ml-auto text-sm text-slate-600 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={showKpis}
              onChange={(e) => setShowKpis(e.target.checked)}
              className="accent-brand-600"
            />
            Show per-KPI scores
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold cursor-pointer hover:text-slate-700 select-none" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1">Candidate <SortIcon col="name" /></span>
              </th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              {showKpis && kpiNames.map((name) => (
                <th key={name} title={name} className="px-2 py-3 font-semibold min-w-[80px]">
                  <span className="block truncate max-w-[100px]">{name}</span>
                </th>
              ))}
              <th
                className="px-4 py-3 font-semibold cursor-pointer hover:text-slate-700 select-none"
                onClick={() => toggleSort("score")}
              >
                <span className="flex items-center gap-1">Cumulative % <SortIcon col="score" /></span>
              </th>
              <th className="px-4 py-3 font-semibold">Selected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={4 + (showKpis ? kpiNames.length : 0)} className="px-4 py-10 text-center text-slate-400">
                  {debouncedQuery
                    ? `No results match "${debouncedQuery}".`
                    : "No results match the filter."}
                </td>
              </tr>
            )}
            {paginated.map((r) => {
              const isSelected = effectiveSelected(r, threshold);
              const isManual = r.manual_selected != null;
              const name = r.candidate_name || r.filename;

              return (
                <tr key={r.resume_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getAvatarColor(r.candidate_name, r.filename)}`}>
                        {getInitials(r.candidate_name, r.filename)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 truncate max-w-[180px]">{name}</p>
                        {r.candidate_email && (
                          <p className="text-xs text-slate-400 truncate max-w-[180px]">{r.candidate_email}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.candidate_phone ? (
                      <span className="flex items-center gap-1 text-slate-600 text-xs whitespace-nowrap">
                        <Phone size={11} className="text-slate-400" /> {r.candidate_phone}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {showKpis && kpiNames.map((kpiName) => {
                    const score = r.kpi_scores[kpiName];
                    const rounded = score != null ? Math.round(score) : null;
                    return (
                      <td key={kpiName} className="px-2 py-3 text-center">
                        {rounded != null ? (
                          <span className={`px-1.5 py-0.5 rounded font-semibold tabular-nums text-xs ${getKpiCellStyle(rounded)}`}>
                            {rounded}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-1.5">
                        <div
                          className={`h-full rounded-full ${isSelected ? "bg-green-500" : "bg-red-400"}`}
                          style={{ width: `${r.weighted_score}%` }}
                        />
                      </div>
                      <span className="font-semibold tabular-nums text-slate-700">{r.weighted_score.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSetSelection(r.resume_id, !isSelected)}
                        title={isManual ? "Manually set — click to flip" : "Click to override"}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          isSelected
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-red-100 text-red-600 hover:bg-red-200"
                        } ${isManual ? "ring-2 ring-offset-1 " + (isSelected ? "ring-green-400" : "ring-red-300") : ""}`}
                      >
                        {isSelected ? "Selected" : "Not Selected"}
                      </button>
                      {isManual && (
                        <button
                          onClick={() => onSetSelection(r.resume_id, null)}
                          title="Reset to automatic (based on threshold)"
                          className="text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {usePagination && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium tabular-nums">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
