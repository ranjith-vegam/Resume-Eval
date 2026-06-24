interface Props {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: Props) {
  return (
    <div>
      {label && (
        <div className="flex justify-between text-sm text-slate-600 mb-1">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-brand-600 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
