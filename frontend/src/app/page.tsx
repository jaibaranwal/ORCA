'use client';

import { useState, useEffect } from 'react';
import { 
  fetchHealth, 
  fetchZones, 
  fetchBoundaries, 
  fetchConditions, 
  fetchDecisions,
  resetDemo 
} from '@/lib/api';
import { 
  HealthResponse, 
  ZoneInfo, 
  BoundariesGeoJSON, 
  MarineConditions, 
  DecisionResult, 
  GeoLocation,
  DecisionObject 
} from '@/lib/types';
import OrcaMap from '@/components/Map/OrcaMap';
import DecisionLifecycleBar from '@/components/Lifecycle/DecisionLifecycleBar';
import ActiveDecisionCard from '@/components/Mission/ActiveDecisionCard';
import MissionRegistry from '@/components/Mission/MissionRegistry';
import AskOrcaDrawer from '@/components/Chat/AskOrcaDrawer';
import DecisionDetailsModal from '@/components/Decision/DecisionDetailsModal';

export default function MissionControlPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [boundaries, setBoundaries] = useState<BoundariesGeoJSON | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const [conditions, setConditions] = useState<MarineConditions | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [trackedDecisions, setTrackedDecisions] = useState<DecisionObject[]>([]);
  const [inspectedDecision, setInspectedDecision] = useState<DecisionObject | null>(null);
  
  // Tab view on right workstation: 'active' (Decision card), 'registry' (Mission registry), 'chat' (Ask ORCA)
  const [activeTab, setActiveTab] = useState<'active' | 'registry' | 'chat'>('active');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // User Base Location: Kochi Port, Kerala
  const userOrigin: GeoLocation = {
    lat: 9.966,
    lon: 76.267,
    name: 'Kochi Port (Fisherman Base)',
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthData, zonesData, boundariesData, decisionsData] = await Promise.all([
        fetchHealth(),
        fetchZones(),
        fetchBoundaries(),
        fetchDecisions(),
      ]);

      setHealth(healthData);
      setZones(zonesData);
      setBoundaries(boundariesData);
      setTrackedDecisions(decisionsData);

      if (zonesData.length > 0) {
        const defaultZone = zonesData.find((z) => z.zone_id === 'zone_b') || zonesData[0];
        setSelectedZone(defaultZone);
        const cond = await fetchConditions(defaultZone.zone_id);
        setConditions(cond);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to ORCA decision backend');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectZone = async (zone: ZoneInfo) => {
    setSelectedZone(zone);
    try {
      const cond = await fetchConditions(zone.zone_id);
      setConditions(cond);
    } catch (err: any) {
      console.error('Failed to load zone conditions:', err);
    }
  };

  const handleDecisionFromChat = async (res: DecisionResult, zoneId: string) => {
    setDecision(res);
    const matchedZone = zones.find((z) => z.zone_id === zoneId);
    if (matchedZone) {
      setSelectedZone(matchedZone);
    }
    setActiveTab('active');
  };

  const handleDecisionTracked = (tracked: DecisionObject) => {
    setTrackedDecisions((prev) => [tracked, ...prev.filter((d) => d.decision_id !== tracked.decision_id)]);
    setInspectedDecision(tracked);
    setActiveTab('registry');
  };

  const handleDecisionUpdated = (updated: DecisionObject) => {
    setTrackedDecisions((prev) =>
      prev.map((d) => (d.decision_id === updated.decision_id ? updated : d))
    );
    if (inspectedDecision && inspectedDecision.decision_id === updated.decision_id) {
      setInspectedDecision(updated);
    }
  };

  const handleReset = async () => {
    try {
      const res = await resetDemo();
      setResetMessage(res.message);
      setDecision(null);
      setTrackedDecisions([]);
      setInspectedDecision(null);
      setTimeout(() => setResetMessage(null), 3000);
    } catch (err: any) {
      setError('Reset failed: ' + err.message);
    }
  };

  const handleRefreshDecisions = async () => {
    try {
      const data = await fetchDecisions();
      setTrackedDecisions(data);
    } catch (err) {
      console.error('Refresh decisions failed', err);
    }
  };

  // Primary active tracked decision (if any)
  const activeTrackedDecision = trackedDecisions.find((d) => d.lifecycle_status !== 'CANCELLED') || null;

  useEffect(() => {
    loadInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* 1. Mission Control Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-5 py-3 flex items-center justify-between sticky top-0 z-50 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-2xl shadow-lg shadow-cyan-950">
            🐋
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-extrabold text-lg tracking-wider text-white uppercase font-mono">
                ORCA
              </h1>
              <span className="text-xs text-cyan-400 font-semibold font-sans">
                Living Marine Decision Intelligence
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono font-bold">
                SIH 2026 • PS 26176
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Operational Decision Lifecycle: Evaluate ➔ Track ➔ Watch ➔ Repair ➔ Outcome
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Vessel: Raju (Fisherman)</span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400">Base: Kochi Port</span>
          </div>

          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>↻</span> Reset Demo State
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-5 flex flex-col gap-4">
        
        {resetMessage && (
          <div className="p-3 bg-emerald-950/70 border border-emerald-700 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2 shadow-md">
            <span>✓</span> {resetMessage}
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/70 border border-rose-700 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2 shadow-md">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* 2. Living Decision Lifecycle Visualizer (Always Visible) */}
        <DecisionLifecycleBar
          decision={activeTrackedDecision}
          hasActiveDecision={Boolean(decision)}
          onOpenDetails={() => activeTrackedDecision && setInspectedDecision(activeTrackedDecision)}
        />

        {/* 3. Primary Command Center Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* Left / Primary Area: Interactive Marine GIS Map */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <span>🗺️</span> Marine GIS & Potential Fishing Zone Map
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Arabian Sea Maritime Corridor off Kochi • Real Open-Meteo Waves & GeoJSON
                </p>
              </div>
              <span className="text-[11px] text-cyan-400 font-mono">
                {zones.length} Zones • {boundaries?.features.length || 0} Boundaries
              </span>
            </div>

            <div className="h-[520px]">
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

          {/* Right / Primary Area: Workstation Panel (Active Decision / Mission Registry / Ask ORCA) */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 font-mono ${
                  activeTab === 'active'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⚡</span> Active Decision
              </button>
              <button
                onClick={() => setActiveTab('registry')}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 font-mono ${
                  activeTab === 'registry'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📋</span> Missions ({trackedDecisions.length})
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 font-mono ${
                  activeTab === 'chat'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/60'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>💬</span> Ask ORCA
              </button>
            </div>

            {/* Tab Content Containers */}
            <div className="h-[520px]">
              {activeTab === 'active' && (
                <ActiveDecisionCard
                  zones={zones}
                  selectedZone={selectedZone}
                  conditions={conditions}
                  decision={decision}
                  userOrigin={userOrigin}
                  trackedDecisions={trackedDecisions}
                  onSelectZone={handleSelectZone}
                  onDecisionEvaluated={(res) => setDecision(res)}
                  onDecisionTracked={handleDecisionTracked}
                  onOpenInspector={() => activeTrackedDecision && setInspectedDecision(activeTrackedDecision)}
                />
              )}

              {activeTab === 'registry' && (
                <MissionRegistry
                  decisions={trackedDecisions}
                  onSelectDecision={(dec) => setInspectedDecision(dec)}
                  onDecisionUpdated={handleDecisionUpdated}
                  onRefresh={handleRefreshDecisions}
                />
              )}

              {activeTab === 'chat' && (
                <AskOrcaDrawer
                  userOrigin={userOrigin}
                  zones={zones}
                  trackedDecisions={trackedDecisions}
                  onDecisionReceived={handleDecisionFromChat}
                  onDecisionTracked={handleDecisionTracked}
                  onOpenRegistry={() => setActiveTab('registry')}
                />
              )}
            </div>

          </div>

        </div>

        {/* System Telemetry Status Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 font-mono">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">
              ✓ ORCA MISSION CONTROL READY
            </span>
            <span className="text-[11px] text-slate-300">
              Living Decision Object • Deterministic Safety Engine • Decision Watch • Repair Engine
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            ISRO SIH 2026 • Prototype Architecture Complete
          </div>
        </div>

      </main>

      {/* Full Decision Inspector Modal */}
      {inspectedDecision && (
        <DecisionDetailsModal
          decision={inspectedDecision}
          onClose={() => setInspectedDecision(null)}
          onDecisionUpdated={handleDecisionUpdated}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-2.5 px-6 text-center text-xs text-slate-500 font-mono">
        ORCA — Living Marine Decision Intelligence Platform • Smart India Hackathon 2026
      </footer>
    </div>
  );
}
