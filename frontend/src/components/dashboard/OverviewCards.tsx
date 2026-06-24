import { Users, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import type { ResultsStats } from "../../types";
import { Skeleton } from "../shared/Skeleton";

interface Props {
  stats: ResultsStats;
  selectedCount: number;
  notSelectedCount: number;
  loading?: boolean;
}

export function OverviewCards({ stats, selectedCount, notSelectedCount, loading }: Props) {
  if (loading && stats.total === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <Skeleton height={36} width={36} className="rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton height={10} width="60%" />
                <Skeleton height={24} width="50%" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Resumes",
      value: stats.total,
      icon: Users,
      color: "bg-blue-50 text-blue-600 border-blue-200",
      iconBg: "bg-blue-100",
    },
    {
      label: "Selected",
      value: `${selectedCount} (${stats.total ? Math.round((selectedCount / stats.total) * 100) : 0}%)`,
      icon: CheckCircle,
      color: "bg-green-50 text-green-700 border-green-200",
      iconBg: "bg-green-100",
    },
    {
      label: "Not Selected",
      value: `${notSelectedCount} (${stats.total ? Math.round((notSelectedCount / stats.total) * 100) : 0}%)`,
      icon: XCircle,
      color: "bg-red-50 text-red-700 border-red-200",
      iconBg: "bg-red-100",
    },
    {
      label: "Avg. Cumulative %",
      value: stats.avg_score.toFixed(1),
      icon: TrendingUp,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      iconBg: "bg-purple-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg}`}>
              <c.icon size={18} />
            </div>
            <div>
              <p className="text-xs opacity-70 font-medium">{c.label}</p>
              <p className="text-xl font-bold">{c.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
