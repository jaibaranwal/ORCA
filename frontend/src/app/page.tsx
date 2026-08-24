'use client';

import { useState, useEffect } from 'react';
import { fetchHealth, fetchZones, resetDemo } from '@/lib/api';
import { HealthResponse, ZoneInfo } from '@/lib/types';

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    setError(null);
    setResetMessage(null);
    try {
      const [healthData, zonesData] = await Promise.all([
        fetchHealth(),
        fetchZones()
      ]);
      setHealth(healthData);
      setZones(zonesData);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      const res = await resetDemo();
      setResetMessage(res.message);
      setTimeout(() => setResetMessage(null), 3000);
    } catch (err: any) {
      setError('Reset failed: ' + err.message);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xl">
            🐋
          </div>
          <div>
            <h1 className="font-semibold text-lg tracking-wide text-white">ORCA</h1>
            <p className="text-xs text-slate-400">Marine Ecosystem Reasoning with Collaborative Agents</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 font-medium">
            SIH 2026 • PS 26176
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">
            Phase 1: Foundation
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10 flex flex-col gap-8">
        
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-cyan-400 font-mono text-xs uppercase tracking-widest">Phase 1 — Complete & Verified</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
                Project Foundation & State Architecture
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
                Frontend & Backend communication established. Deterministic rules, Decision Object store, and data adapter scaffolding are ready for Phase 2 data ingestion & decision evaluation.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={checkConnection}
                disabled={loading}
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all shadow-lg shadow-cyan-950 flex items-center gap-2"
              >
                {loading ? (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <span>⚡</span>
                )}
                Ping Backend Health
              </button>
            </div>
          </div>
        </div>

        {/* Connection Diagnostics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Backend Health Status */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-200">Backend Status</span>
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Connecting
                  </span>
                ) : health ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Connected (200 OK)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Offline
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-4 p-3.5 bg-rose-950/40 border border-rose-800/50 rounded-xl text-rose-300 text-xs font-mono">
                  {error}
                </div>
              )}

              {health && (
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Service:</span>
                    <span className="text-slate-200 font-medium">{health.service}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Version:</span>
                    <span className="text-slate-200 font-mono">{health.version}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Database:</span>
                    <span className="text-emerald-400 font-medium">{health.details.database}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Decision Engine:</span>
                    <span className="text-slate-200">{health.details.decision_engine}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Last Synced:</span>
                    <span className="text-cyan-400 font-mono">{lastChecked}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">Endpoint: /api/health</span>
              <button
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-slate-200 underline font-mono"
              >
                Reset Demo State
              </button>
            </div>
            {resetMessage && (
              <p className="text-xs text-emerald-400 mt-2 font-mono">{resetMessage}</p>
            )}
          </div>

          {/* Preloaded Scaffolding & Zones */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-sm font-semibold text-slate-200">Preloaded Demo Zones</span>
                <span className="text-xs font-mono text-cyan-400">{zones.length} Zones Ready</span>
              </div>

              <div className="mt-4 space-y-2.5">
                {zones.map((zone) => (
                  <div
                    key={zone.zone_id}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{zone.zone_name}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Distance: {zone.distance_km} km • Lat: {zone.centroid.lat}, Lon: {zone.centroid.lon}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono text-[11px]">
                        PFZ: {zone.pfz_score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Endpoint: /api/zones</span>
              <span>Ready for Leaflet in Phase 2</span>
            </div>
          </div>

        </div>

        {/* Phase Blueprint Tracker */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Architecture Roadmap & Execution Plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-cyan-950/30 border border-cyan-800/50 rounded-xl">
              <span className="font-bold text-cyan-400 block mb-1">✓ Phase 1: Foundation</span>
              <p className="text-slate-400">FastAPI, Next.js, SQLite Decision Store, CORS, and Config Schemas established.</p>
            </div>
            <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl opacity-75">
              <span className="font-bold text-slate-300 block mb-1">Phase 2: Data & Decision Engine</span>
              <p className="text-slate-500">Open-Meteo adapter, Leaflet map integration, boundary checks, and GO/CAUTION/WAIT engine.</p>
            </div>
            <div className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl opacity-75">
              <span className="font-bold text-slate-300 block mb-1">Phase 3+: Living Lifecycle</span>
              <p className="text-slate-500">Track Decision, simulated condition change, impact checks, and verified repair options.</p>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        ORCA — Living Decision Lifecycle Prototype • ISRO SIH 2026
      </footer>
    </div>
  );
}
