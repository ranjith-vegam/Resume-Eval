import { useState } from "react";
import { X, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useSettingsStore, type Provider } from "../../store/useSettingsStore";
import { useToastStore } from "../../store/useToastStore";
import { api } from "../../api/client";

const PROVIDERS: { id: Provider; label: string; description: string }[] = [
  { id: "openai", label: "OpenAI", description: "GPT models via OpenAI API" },
  { id: "vllm", label: "Local LLM", description: "Self-hosted OpenAI-compatible endpoint" },
];

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];

interface MaskedInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}

function MaskedInput({ label, value, onChange, placeholder, hint }: MaskedInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, hint }: Omit<MaskedInputProps, "hint"> & { hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function SettingsModal() {
  const {
    isOpen, closeModal,
    provider, setProvider,
    openaiApiKey, openaiModel, vllmBaseUrl, vllmModel,
    setField,
  } = useSettingsStore();

  const addToast = useToastStore((s) => s.addToast);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; response: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.saveSettings({
        provider,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
        vllm_base_url: vllmBaseUrl,
        vllm_model: vllmModel,
      });
      setSaveMsg({ ok: true, text: "Settings saved." });
      addToast("Settings saved successfully.", "success");
      closeModal();
    } catch (e: unknown) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
      addToast(e instanceof Error ? e.message : "Failed to save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Save first so the backend uses the latest config
    try {
      await api.saveSettings({
        provider,
        openai_api_key: openaiApiKey,
        openai_model: openaiModel,
        vllm_base_url: vllmBaseUrl,
        vllm_model: vllmModel,
      });
      const res = await api.testConnection();
      setTestResult({ ok: true, response: res.response });
      addToast("Connection successful.", "success");
    } catch (e: unknown) {
      setTestResult({ ok: false, response: e instanceof Error ? e.message : "Connection failed" });
      addToast("Connection failed.", "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeModal}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">LLM Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure the AI provider used for resume evaluation</p>
          </div>
          <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Provider selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-colors ${
                    provider === p.id
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <ProviderIcon id={p.id} active={provider === p.id} />
                  <span className="text-xs font-semibold">{p.label}</span>
                  <span className="text-[10px] opacity-60 leading-tight">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Provider-specific fields */}
          {provider === "openai" && (
            <>
              <MaskedInput
                label="OpenAI API Key"
                value={openaiApiKey}
                onChange={(v) => setField("openaiApiKey", v)}
                placeholder="sk-..."
                hint="Get your key at platform.openai.com"
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                <select
                  value={openaiModel}
                  onChange={(e) => setField("openaiModel", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {OPENAI_MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {provider === "vllm" && (
            <>
              <TextInput
                label="Local LLM Base URL"
                value={vllmBaseUrl}
                onChange={(v) => setField("vllmBaseUrl", v)}
                placeholder="http://localhost:8080/v1"
                hint="OpenAI-compatible endpoint (e.g. vLLM, Ollama with openai-compat, LM Studio)"
              />
              <TextInput
                label="Model Name"
                value={vllmModel}
                onChange={(v) => setField("vllmModel", v)}
                placeholder="meta-llama/Llama-3.1-8B-Instruct"
                hint="Exact model identifier as loaded by your local server."
              />
            </>
          )}

          {/* Test connection */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Test Connection</p>
                <p className="text-xs text-slate-500">Sends "Hi" to the LLM and shows the response</p>
              </div>
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {testing ? (
                  <><Loader2 size={14} className="animate-spin" /> Testing...</>
                ) : (
                  "Test"
                )}
              </button>
            </div>

            {testResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                testResult.ok
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {testResult.ok
                  ? <CheckCircle size={15} className="mt-0.5 shrink-0 text-green-600" />
                  : <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />}
                <div>
                  {testResult.ok && (
                    <p className="font-medium text-xs text-green-600 mb-0.5">Connection successful</p>
                  )}
                  <p className="leading-relaxed">{testResult.response}</p>
                </div>
              </div>
            )}
          </div>

          {saveMsg && (
            <div className={`flex items-center gap-2 text-sm ${saveMsg.ok ? "text-green-600" : "text-red-600"}`}>
              {saveMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {saveMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={closeModal}
            className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderIcon({ id, active }: { id: Provider; active: boolean }) {
  const cls = `text-lg font-bold ${active ? "text-brand-600" : "text-slate-400"}`;
  if (id === "openai") return <span className={cls}>⬡</span>;
  return <span className={cls}>⚙</span>;
}
