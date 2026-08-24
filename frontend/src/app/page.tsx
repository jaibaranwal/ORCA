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
import DecisionPanel from '@/components/Decision/DecisionPanel';
import ChatPanel from '@/components/Chat/ChatPanel';
import TrackedDecisionsList from '@/components/Decision/TrackedDecisionsList';
import DecisionDetailsModal from '@/components/Decision/DecisionDetailsModal';

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [boundaries, setBoundaries] = useState<BoundariesGeoJSON | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const [conditions, setConditions] = useState<MarineConditions | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [trackedDecisions, setTrackedDecisions] = useState<DecisionObject[]>([]);
  const [inspectedDecision, setInspectedDecision] = useState<DecisionObject | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'decision' | 'tracked'>('chat');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

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
      setError(err.message || 'Failed to initialize ORCA marine platform');
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
  };

  const handleDecisionTracked = (tracked: DecisionObject) => {
    setTrackedDecisions((prev) => [tracked, ...prev.filter((d) => d.decision_id !== tracked.decision_id)]);
    setActiveTab('tracked');
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

  useEffect(() => {
    loadInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-50">
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
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Fisherman: Raju</span>
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-5">
        
        {resetMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
            <span>✓</span> {resetMessage}
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Workstation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Interactive GIS Map */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Marine GIS & Potential Fishing Zone (PFZ) Map
                </h2>
                <p className="text-[11px] text-slate-400">
                  Arabian Sea Maritime Corridor off Kochi Port • Real Open-Meteo Waves & GeoJSON
                </p>
              </div>
              <span className="text-[11px] text-cyan-400 font-mono">
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

          {/* Right Column: Tabbed Views (Chat, Decision Rules, Tracked Decisions Registry) */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'chat'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>💬</span> Chat
              </button>
              <button
                onClick={() => setActiveTab('decision')}
                className={`flex-1 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'decision'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>⚡</span> Rules
              </button>
              <button
                onClick={() => setActiveTab('tracked')}
                className={`flex-1 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'tracked'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📌</span> Tracked ({trackedDecisions.length})
              </button>
            </div>

            {/* Tab 1: Conversational Chat */}
            {activeTab === 'chat' && (
              <ChatPanel
                userOrigin={userOrigin}
                zones={zones}
                trackedDecisions={trackedDecisions}
                onDecisionReceived={handleDecisionFromChat}
                onDecisionTracked={handleDecisionTracked}
              />
            )}

            {/* Tab 2: Decision Rules & Inspector */}
            {activeTab === 'decision' && (
              <div className="h-[540px]">
                <DecisionPanel
                  zones={zones}
                  selectedZone={selectedZone}
                  conditions={conditions}
                  decision={decision}
                  userOrigin={userOrigin}
                  trackedDecisions={trackedDecisions}
                  onSelectZone={handleSelectZone}
                  onDecisionEvaluated={(res) => setDecision(res)}
                  onDecisionTracked={handleDecisionTracked}
                />
              </div>
            )}

            {/* Tab 3: Tracked Decisions Registry */}
            {activeTab === 'tracked' && (
              <TrackedDecisionsList
                decisions={trackedDecisions}
                onSelectDecision={(dec) => setInspectedDecision(dec)}
                onDecisionUpdated={handleDecisionUpdated}
                onRefresh={handleRefreshDecisions}
              />
            )}

          </div>

        </div>

        {/* Phase Status Bar */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono font-bold">
              ✓ Phase 5 Ready
            </span>
            <span>Decision Watch • Meaningful Change Detection • Impact Explanation • History Timeline</span>
          </div>
          <div className="font-mono text-slate-500 text-[11px]">
            Next: Phase 6 (Living Decision Repair & Wait Engine)
          </div>
        </div>

      </main>

      {/* Decision Details Snapshot Modal */}
      {inspectedDecision && (
        <DecisionDetailsModal
          decision={inspectedDecision}
          onClose={() => setInspectedDecision(null)}
          onDecisionUpdated={handleDecisionUpdated}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-3 px-6 text-center text-xs text-slate-500">
        ORCA — Living Decision Lifecycle Prototype • ISRO SIH 2026
      </footer>
    </div>
  );
}
