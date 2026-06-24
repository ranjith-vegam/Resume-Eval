import { useEvalStore } from "../../store/useEvalStore";
import type { Step } from "../../store/useEvalStore";

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Setup" },
  { n: 2, label: "Upload & Process" },
  { n: 3, label: "Dashboard" },
];

type PillStatus = "active" | "done" | "incomplete" | "pending";

export function TopBar() {
  const currentStep = useEvalStore((s) => s.currentStep);
  const goToStep = useEvalStore((s) => s.goToStep);
  const setupComplete = useEvalStore((s) => s.setupComplete);

  const getStatus = (n: Step): PillStatus => {
    if (currentStep === n) return "active";
    if (n === 1) return setupComplete ? "done" : "incomplete";
    return currentStep > n ? "done" : "pending";
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">RE</span>
          </div>
          <span className="font-semibold text-slate-800 text-lg">ResumeEval</span>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto flex-1">
          {STEPS.map(({ n, label }) => {
            const status = getStatus(n);
            return (
              <div key={n} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => goToStep(n)}
                  title={status === "incomplete" ? "Setup is not complete — JD, KPIs, and Suite Name are required" : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                    status === "active"
                      ? "bg-brand-600 text-white"
                      : status === "done"
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : status === "incomplete"
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      status === "active"
                        ? "bg-white/30 text-white"
                        : status === "done"
                        ? "bg-green-500 text-white"
                        : status === "incomplete"
                        ? "bg-red-500 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {status === "done" ? "✓" : status === "incomplete" ? "!" : n}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
                {n < 3 && <span className="text-slate-300 text-xs">›</span>}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
