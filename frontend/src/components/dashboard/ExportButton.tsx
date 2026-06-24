import { Download } from "lucide-react";
import { api } from "../../api/client";
import { useEvalStore } from "../../store/useEvalStore";

interface Props {
  batchName?: string;
}

export function ExportButton({ batchName }: Props) {
  const sessionId = useEvalStore((s) => s.sessionId);
  const threshold = useEvalStore((s) => s.selectionThreshold);

  const handleExport = () => {
    if (batchName) {
      window.open(api.exportBatchCSV(batchName, threshold), "_blank");
    } else if (sessionId) {
      window.open(api.exportCSV(sessionId, threshold), "_blank");
    }
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg text-sm transition-colors"
    >
      <Download size={15} />
      Export CSV
    </button>
  );
}
