'use client';

import { useState, useEffect } from 'react';
import { GeoLocation, GeocodeResult } from '@/lib/types';
import { fetchConfigStatus, saveGeminiKey, searchLocations } from '@/lib/api';

export const DEMO_PORTS: GeoLocation[] = [
  { name: 'Kochi Port, Kerala', lat: 9.966, lon: 76.267 },
  { name: 'Munambam Harbour, Kerala', lat: 10.182, lon: 76.175 },
  { name: 'Beypore Port, Kozhikode', lat: 11.164, lon: 75.808 },
  { name: 'Neendakara Port, Kollam', lat: 8.937, lon: 76.536 },
  { name: 'Vizhinjam Port, Thiruvananthapuram', lat: 8.375, lon: 76.992 },
  { name: 'Mangalore Old Port, Karnataka', lat: 12.853, lon: 74.836 },
  { name: 'Mormugao Port, Goa', lat: 15.416, lon: 73.799 },
];

export type NavTabType = 'dashboard' | 'map' | 'decision' | 'monitor' | 'alerts' | 'chat' | 'feedback';

interface HeaderProps {
  userOrigin: GeoLocation;
  language: 'en' | 'hi';
  activeNavTab: NavTabType;
  alertCount?: number;
  onSelectNavTab: (tab: NavTabType) => void;
  onSelectOrigin: (origin: GeoLocation) => void;
  onToggleLanguage: () => void;
  onResetDemo: () => void;
}

export default function Header({
  userOrigin,
  language,
  activeNavTab,
  alertCount = 1,
  onSelectNavTab,
  onSelectOrigin,
  onToggleLanguage,
  onResetDemo,
}: HeaderProps) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelSelect, setModelSelect] = useState('gemini-3.6-flash');
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSearchPort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await searchLocations(searchQuery);
      setSearchResults(res.results || []);
    } catch (err) {
      console.warn('Geocoding search failed:', err);
    } finally {
      setSearching(false);
    }
  };

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

  const navItems: { id: NavTabType; label: string; icon: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'map', label: 'Map & GIS', icon: '🗺️' },
    { id: 'decision', label: 'Decision', icon: '🎯' },
    { id: 'monitor', label: 'Track & Monitor', icon: '⏱️' },
    { id: 'alerts', label: 'Alerts', icon: '🔔', badge: alertCount },
    { id: 'chat', label: 'ORCA Chat', icon: '💬' },
    { id: 'feedback', label: 'Feedback', icon: '📝' },
  ];

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur px-4 py-2 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50">
        
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 2v20m0-20l-4 4m4-4l4 4M4 12h16" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base text-white tracking-tight">ORCA</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-950/80 border border-blue-800 text-blue-300 font-mono font-semibold rounded tracking-wider">
                ENTERPRISE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans hidden sm:block">
              Marine Decision Support & Ocean Intelligence Engine
            </p>
          </div>
        </div>

        {/* Center: Module Navigation Links */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
          {navItems.map((item) => {
            const isActive = activeNavTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectNavTab(item.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Right: Base Port Selector, Gemini Config, Language, Reset */}
        <div className="flex items-center gap-2 text-xs">
          
          {/* Departure Port Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <select
              value={userOrigin.name}
              onChange={(e) => {
                const found = DEMO_PORTS.find((p) => p.name === e.target.value);
                if (found) onSelectOrigin(found);
              }}
              className="bg-transparent text-white font-medium text-xs outline-none cursor-pointer max-w-[130px] truncate"
            >
              {DEMO_PORTS.map((p) => (
                <option key={p.name || 'port'} value={p.name || ''} className="bg-slate-900 text-white">
                  {(p.name || 'Port').split(',')[0]}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowSearchModal(true)}
              className="text-[11px] text-slate-400 hover:text-cyan-300 ml-1 p-0.5 hover:bg-slate-700 rounded transition-colors"
              title="Search Coastal Port via Nominatim Geocoding"
            >
              🔍
            </button>
          </div>

          {/* Gemini AI Status Pill */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              geminiConfigured
                ? 'bg-blue-950/70 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Configure Gemini API Key (or use Multilingual Deterministic fallback)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${geminiConfigured ? 'bg-blue-400' : 'bg-emerald-400'}`} />
            <span className="hidden md:inline">{geminiConfigured ? 'Gemini AI Active' : 'AI Offline Fallback'}</span>
          </button>

          {/* Multilingual Switcher */}
          <button
            onClick={onToggleLanguage}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 font-semibold transition-colors text-xs"
            title="Toggle Language"
          >
            {language === 'en' ? 'EN' : 'हिंदी'}
          </button>

          {/* Reset Demo Button */}
          <button
            onClick={onResetDemo}
            className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 hover:border-rose-700 hover:text-rose-200 text-slate-300 border border-slate-700 rounded-lg font-medium transition-colors text-xs"
            title="Reset demo decision store"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Coastal Port & Harbor Geocoding Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[4000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 space-y-3.5 shadow-2xl text-xs font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
                  <span>⚓</span> Coastal Port & Location Search (Nominatim Geocoding)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select your departure harbour across the Indian coastline to update route calculations
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSearchPort} className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Mangalore, Vizhinjam, Goa, Tuticorin, Beypore..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs transition-colors shrink-0"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
                {searchResults.length > 0 ? 'Search Results:' : 'Curated Indian Fishing Harbours:'}
              </span>
              {(searchResults.length > 0 ? searchResults : DEMO_PORTS).map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelectOrigin({ name: p.name, lat: p.lat, lon: p.lon });
                    setShowSearchModal(false);
                  }}
                  className="w-full text-left p-2.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/60 rounded-lg transition-all flex items-center justify-between group"
                >
                  <div>
                    <strong className="text-white text-xs block group-hover:text-cyan-300 transition-colors">
                      {p.name}
                    </strong>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {p.lat.toFixed(3)}°N, {p.lon.toFixed(3)}°E
                    </span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 bg-slate-800 group-hover:bg-cyan-600 group-hover:text-white rounded text-slate-300 font-mono transition-colors">
                    Select Base
                  </span>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Key Settings Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[4000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveKey}
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-3.5 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Gemini API Key Configuration</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Optional: Connect your Google AI Studio API Key for enhanced dynamic synthesis
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
                Leave empty to use built-in multilingual deterministic safety engine.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Model Selection</label>
              <select
                value={modelSelect}
                onChange={(e) => setModelSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
              >
                <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
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

