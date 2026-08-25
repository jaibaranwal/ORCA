'use client';

import { useState, useEffect } from 'react';
import { GeoLocation } from '@/lib/types';
import { fetchConfigStatus, saveGeminiKey } from '@/lib/api';

interface HeaderProps {
  userOrigin: GeoLocation;
  language: 'en' | 'hi';
  onToggleLanguage: () => void;
  onResetDemo: () => void;
}

export default function Header({
  userOrigin,
  language,
  onToggleLanguage,
  onResetDemo,
}: HeaderProps) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelSelect, setModelSelect] = useState('gemini-1.5-flash');
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigStatus()
      .then((data) => {
        setGeminiConfigured(data.gemini_configured);
        if (data.gemini_model) setModelSelect(data.gemini_model);
      })
      .catch(() => {});
  }, []);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    setStatusMsg(null);
    try {
      const res = await saveGeminiKey(apiKeyInput, modelSelect);
      setGeminiConfigured(Boolean(apiKeyInput.trim()));
      setStatusMsg(res.message);
      setTimeout(() => {
        if (apiKeyInput.trim()) setShowKeyModal(false);
      }, 1500);
    } catch (err: any) {
      setStatusMsg(err.message || 'Failed to save key');
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <>
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-5 flex items-center justify-between sticky top-0 z-50">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v20m0-20l-4 4m4-4l4 4M4 12h16" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white tracking-tight">ORCA</span>
              <span className="text-xs text-slate-400 font-normal">Marine Decision Support</span>
            </div>
          </div>
        </div>

        {/* Center/Right Status & Controls */}
        <div className="flex items-center gap-3 text-xs">
          {/* Active Vessel & Base */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800/80 border border-slate-700/60 rounded-md text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400">Base:</span>
            <span className="font-medium text-white">{userOrigin.name || 'Kochi Port'}</span>
          </div>

          {/* Gemini API Status / Key Setup */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              geminiConfigured
                ? 'bg-blue-950/60 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Configure Gemini API Key"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${geminiConfigured ? 'bg-blue-400' : 'bg-slate-500'}`} />
            <span>{geminiConfigured ? 'Gemini API Active' : 'Gemini Key (Optional)'}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={onToggleLanguage}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-200 font-medium transition-colors"
          >
            {language === 'en' ? 'English' : 'हिंदी'}
          </button>

          {/* Demo Reset */}
          <button
            onClick={onResetDemo}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-md font-medium transition-colors"
          >
            Reset Demo
          </button>
        </div>
      </header>

      {/* Gemini Key Settings Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[4000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveKey}
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-3.5 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Gemini API Configuration</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Optional: Connect your Google AI Studio Gemini API Key
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {statusMsg && (
              <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-700 text-blue-200 text-xs">
                {statusMsg}
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-medium mb-1">Gemini API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Leave empty to use built-in multilingual deterministic fallback engine.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Model Selection</label>
              <select
                value={modelSelect}
                onChange={(e) => setModelSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast & Recommended)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={savingKey}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg"
              >
                {savingKey ? 'Saving...' : 'Save & Activate'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
