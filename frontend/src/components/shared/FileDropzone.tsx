import { useRef, useState } from "react";
import { Folder, Files } from "lucide-react";

interface Props {
  mode: "files" | "folder";
  onFiles: (files: File[]) => void;
  label: string;
  hint?: string;
  accept?: string; // overrides default .pdf,.docx filter for mode="files"
}

const DEFAULT_EXTS = new Set(["pdf", "docx"]);

function filterFiles(list: FileList | null, accept?: string): File[] {
  if (!list) return [];
  const allowed = accept
    ? new Set(accept.split(",").map((a) => a.trim().replace(/^\./, "").toLowerCase()))
    : DEFAULT_EXTS;
  return Array.from(list).filter((f) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    return allowed.has(ext);
  });
}

export function FileDropzone({ mode, onFiles, label, hint, accept }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (list: FileList | null) => {
    const files = filterFiles(list, accept);
    if (files.length) onFiles(files);
  };

  const Icon = mode === "folder" ? Folder : Files;

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
        dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400 bg-white"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <Icon className="mx-auto mb-2 text-slate-400" size={28} />
      <p className="font-medium text-slate-700 text-sm">{label}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        {...(mode === "files"
          ? { accept: accept ?? ".pdf,.docx" }
          : { ...({"webkitdirectory": "true"} as Record<string, string>) }
        )}
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
