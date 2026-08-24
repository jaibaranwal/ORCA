'use client';

import { useState, useEffect } from 'react';
import { fetchHealth, fetchZones, fetchBoundaries, fetchConditions, resetDemo } from '@/lib/api';
import { HealthResponse, ZoneInfo, BoundariesGeoJSON, MarineConditions, DecisionResult, Location } from '@/lib/types';
import OrcaMap from '@/components/Map/OrcaMap';
import DecisionPanel from '@/components/Decision/DecisionPanel';

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [boundaries, setBoundaries] = useState<BoundariesGeoJSON | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const [conditions, setConditions] = useState<MarineConditions | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Default User Location: Kochi Port, Kerala
  const userOrigin: Location = {
    lat: 9.966,
    lon: 76.267,
    name: 'Kochi Port (Fisherman Base)',
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthData, zonesData, boundariesData] = await Promise.all([
        fetchHealth(),
        fetchZones(),
        fetchBoundaries(),
      ]);

      setHealth(healthData);
      setZones(zonesData);
      setBoundaries(boundariesData);

      // Default select Zone B (Offshore West)
      if (zonesData.length > 0) {
        const defaultZone = zonesData.find((z) => z.zone_id === 'zone_b') || zonesData[0];
        setSelectedZone(defaultZone);
        const cond = await fetchConditions(defaultZone.zone_id);
        setConditions(cond);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize ORCA marine platform');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectZone = async (zone: ZoneInfo) => {
    setSelectedZone(zone);
    setDecision(null); // Reset evaluation when zone changes
    try {
      const cond = await fetchConditions(zone.zone_id);
      setConditions(cond);
    } catch (err: any) {
      console.error('Failed to load zone conditions:', err);
    }
  };

  const handleReset = async () => {
    try {
      const res = await resetDemo();
      setResetMessage(res.message);
      setDecision(null);
      setTimeout(() => setResetMessage(null), 3000);
    } catch (err: any) {
      setError('Reset failed: ' + err.message);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xl shadow-md shadow-cyan-950">
            🐋
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-wide text-white">ORCA</h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                SIH 2026 • PS 26176
              </span>
            </div>
            <p className="text-xs text-slate-400">Marine Ecosystem Reasoning with Collaborative Agents</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Role: Fisherman</span>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs transition-all"
          >
            Reset State
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* Reset Feedback */}
        {resetMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
            <span>✓</span> {resetMessage}
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Phase 2 Interactive Workstation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Interactive GIS Map */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Marine GIS & Potential Fishing Zone (PFZ) Map
                </h2>
                <p className="text-xs text-slate-400">
                  Arabian Sea Maritime Corridor off Kochi Port • Real Open-Meteo Waves
                </p>
              </div>
              <span className="text-xs text-cyan-400 font-mono">
                {zones.length} Zones • {boundaries?.features.length || 0} Boundaries
              </span>
            </div>

            <div className="h-[540px]">
              <OrcaMap
                zones={zones}
                boundaries={boundaries}
                selectedZone={selectedZone}
                decision={decision}
                userOrigin={userOrigin}
                onSelectZone={handleSelectZone}
              />
            </div>
          </div>

          {/* Right Column: Deterministic Decision Engine Panel */}
          <div className="lg:col-span-5">
            <DecisionPanel
              zones={zones}
              selectedZone={selectedZone}
              conditions={conditions}
              decision={decision}
              userOrigin={userOrigin}
              onSelectZone={handleSelectZone}
              onDecisionEvaluated={(res) => setDecision(res)}
            />
          </div>

        </div>

        {/* Phase Status Bar */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono font-bold">
              ✓ Phase 2 Ready
            </span>
            <span>Deterministic Rule Engine • Point-in-Polygon Geofencing • Live Marine Weather</span>
          </div>
          <div className="font-mono text-slate-500">
            Next: Phase 3 (Gemini Intent & Explanation Layer)
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3.5 px-6 text-center text-xs text-slate-500">
        ORCA — Living Decision Lifecycle Prototype • ISRO SIH 2026
      </footer>
    </div>
  );
}
