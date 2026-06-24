import { useEffect } from "react";
import { useEvalStore } from "./store/useEvalStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { api } from "./api/client";
import { TopBar } from "./components/layout/TopBar";
import { StepSetup } from "./components/steps/StepSetup";
import { StepUploadProcess } from "./components/steps/StepUploadProcess";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ToastContainer } from "./components/shared/Toast";
import type { Provider } from "./store/useSettingsStore";

export default function App() {
  const { sessionId, currentStep, setSessionId } = useEvalStore();
  const { setProvider, setField } = useSettingsStore();

  useEffect(() => {
    if (!sessionId) {
      api.createSession().then((res) => setSessionId(res.session_id));
    }
    api.getSettings().then((s) => {
      if (s.provider) setProvider(s.provider as Provider);
      if (s.openai_api_key) setField("openaiApiKey", s.openai_api_key);
      if (s.openai_model) setField("openaiModel", s.openai_model);
      if (s.vllm_base_url) setField("vllmBaseUrl", s.vllm_base_url);
      if (s.vllm_model) setField("vllmModel", s.vllm_model);
    }).catch(() => {});
  }, []);

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <StepSetup />;
      case 2: return <StepUploadProcess />;
      case 3: return <Dashboard />;
      default: return <StepSetup />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <main className={`${currentStep < 3 ? "max-w-2xl mx-auto px-4 py-10" : "px-0 py-0"}`}>
        <div key={currentStep} className="animate-fade-in">
          {renderStep()}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
