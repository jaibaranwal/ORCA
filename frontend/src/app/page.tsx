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
import Header from '@/components/Navigation/Header';
import DecisionLifecycleBar from '@/components/Lifecycle/DecisionLifecycleBar';
import IntelligencePanel from '@/components/Panel/IntelligencePanel';
import AskOrcaModal from '@/components/Chat/AskOrcaModal';

export default function MissionControlPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [boundaries, setBoundaries] = useState<BoundariesGeoJSON | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const [conditions, setConditions] = useState<MarineConditions | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [trackedDecisions, setTrackedDecisions] = useState<DecisionObject[]>([]);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // User Base Location: Kochi Port, Kerala
  const userOrigin: GeoLocation = {
    lat: 9.966,
    lon: 76.267,
    name: 'Kochi Port',
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
      setError(err.message || 'Failed to connect to ORCA backend services');
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

  const handleDecisionFromChat = (res: DecisionResult, zoneId: string) => {
    setDecision(res);
    const matchedZone = zones.find((z) => z.zone_id === zoneId);
    if (matchedZone) {
      setSelectedZone(matchedZone);
    }
  };

  const handleDecisionTracked = (tracked: DecisionObject) => {
    setTrackedDecisions((prev) => [tracked, ...prev.filter((d) => d.decision_id !== tracked.decision_id)]);
  };

  const handleDecisionUpdated = (updated: DecisionObject) => {
    setTrackedDecisions((prev) =>
      prev.map((d) => (d.decision_id === updated.decision_id ? updated : d))
    );
  };

  const handleReset = async () => {
    try {
      const res = await resetDemo();
      setResetMessage(res.message);
      setDecision(null);
      setTrackedDecisions([]);
      setTimeout(() => setResetMessage(null), 3000);
    } catch (err: any) {
      setError('Reset failed: ' + err.message);
    }
  };

  // Primary active tracked decision
  const activeTrackedDecision = trackedDecisions.find((d) => d.lifecycle_status !== 'CANCELLED') || null;

  useEffect(() => {
    loadInitialData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* 1. Header */}
      <Header
        userOrigin={userOrigin}
        onResetDemo={handleReset}
        onOpenChat={() => setIsChatOpen(true)}
        trackedCount={trackedDecisions.length}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-5 flex flex-col gap-3.5">
        
        {resetMessage && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-700 rounded-xl text-emerald-300 text-xs font-mono flex items-center gap-2">
            <span>✓</span> {resetMessage}
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-rose-950/80 border border-rose-700 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* 2. Living Decision Lifecycle Pipeline */}
        <DecisionLifecycleBar
          decision={activeTrackedDecision}
          hasActiveDecision={Boolean(decision)}
        />

        {/* 3. Primary Command Center Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* Left / Large: Interactive Marine GIS Map */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <span>🗺️</span> Marine GIS & Fishing Potential Map
                </h2>
                <p className="text-[11px] text-slate-400 font-mono">
                  Arabian Sea Maritime Corridor off Kochi • Open-Meteo Waves & Navigational Boundaries
                </p>
              </div>
              <span className="text-[11px] text-cyan-400 font-mono">
                {zones.length} Sectors • {boundaries?.features.length || 0} Boundaries
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

          {/* Right: ORCA Contextual Intelligence Panel */}
          <div className="lg:col-span-5">
            <IntelligencePanel
              zones={zones}
              selectedZone={selectedZone}
              conditions={conditions}
              decision={decision}
              trackedDecision={activeTrackedDecision}
              userOrigin={userOrigin}
              onSelectZone={handleSelectZone}
              onDecisionEvaluated={(res) => setDecision(res)}
              onDecisionTracked={handleDecisionTracked}
              onDecisionUpdated={handleDecisionUpdated}
              onAskQuery={() => setIsChatOpen(true)}
            />
          </div>

        </div>

      </main>

      {/* Multilingual Natural Language Chat Modal */}
      {isChatOpen && (
        <AskOrcaModal
          userOrigin={userOrigin}
          zones={zones}
          trackedDecisions={trackedDecisions}
          onClose={() => setIsChatOpen(false)}
          onDecisionReceived={handleDecisionFromChat}
          onDecisionTracked={handleDecisionTracked}
        />
      )}

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 py-3 px-6 text-center text-xs text-slate-500 font-mono flex flex-col sm:flex-row items-center justify-between max-w-7xl w-full mx-auto">
        <span>ORCA — Living Marine Decision Intelligence System</span>
        <span>ISRO / SIH PS 26176 • Prototype v1.0</span>
      </footer>

    </div>
  );
}
