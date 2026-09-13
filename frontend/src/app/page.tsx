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
import dynamic from 'next/dynamic';

const Orca3DViewer = dynamic(() => import('@/components/Map/Orca3DViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 text-xs">
      <div className="flex items-center gap-2">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
        Initializing 3D Ocean Digital Twin...
      </div>
    </div>
  ),
});

import Header, { NavTabType, DEMO_PORTS } from '@/components/Navigation/Header';
import MarineSidePanel from '@/components/Dashboard/MarineSidePanel';
import DemoTourBar from '@/components/Navigation/DemoTourBar';
import ThresholdsModal from '@/components/Navigation/ThresholdsModal';
import JudgeReferenceModal from '@/components/Navigation/JudgeReferenceModal';

export default function MarineDashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [boundaries, setBoundaries] = useState<BoundariesGeoJSON | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneInfo | null>(null);
  const [conditions, setConditions] = useState<MarineConditions | null>(null);
  const [decision, setDecision] = useState<DecisionResult | null>(null);
  const [trackedDecisions, setTrackedDecisions] = useState<DecisionObject[]>([]);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [activeNavTab, setActiveNavTab] = useState<NavTabType>('dashboard');
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  
  const [showThresholdsModal, setShowThresholdsModal] = useState(false);
  const [showJudgeModal, setShowJudgeModal] = useState(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // User Base Location (Configurable)
  const [userOrigin, setUserOrigin] = useState<GeoLocation>(DEMO_PORTS[0]);

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
      setError(err.message || 'Failed to connect to ORCA backend');
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
      await resetDemo();
      setDecision(null);
      setTrackedDecisions([]);
      setActiveNavTab('dashboard');
      if (zones.length > 0) {
        const defaultZone = zones.find((z) => z.zone_id === 'zone_b') || zones[0];
        setSelectedZone(defaultZone);
      }
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header with Navigation and Controls */}
      <Header
        userOrigin={userOrigin}
        language={language}
        activeNavTab={activeNavTab}
        alertCount={activeTrackedDecision?.lifecycle_status === 'ALERT' ? 1 : 0}
        onSelectNavTab={(tab) => setActiveNavTab(tab)}
        onSelectOrigin={(origin) => setUserOrigin(origin)}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'en' ? 'hi' : 'en'))}
        onResetDemo={handleReset}
      />

      {/* SIH 2026 Interactive Guided Demo Tour Bar */}
      <DemoTourBar
        zones={zones}
        selectedZone={selectedZone}
        decision={decision}
        activeDecisionObject={activeTrackedDecision}
        userOrigin={userOrigin}
        language={language}
        onSelectZone={handleSelectZone}
        onSetDecision={(dec) => setDecision(dec)}
        onSetActiveDecisionObject={handleDecisionTracked}
        onSelectNavTab={(tab) => setActiveNavTab(tab)}
        onOpenThresholds={() => setShowThresholdsModal(true)}
        onOpenJudgeReference={() => setShowJudgeModal(true)}
        onRefreshData={loadInitialData}
      />

      {/* Main Dashboard Layout (Map on Left, Side Panel on Right) */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3.5 md:p-4 flex flex-col gap-3">
        
        {error && (
          <div className="p-2.5 bg-rose-950 border border-rose-700 rounded-xl text-rose-300 text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch h-[calc(100vh-125px)] min-h-[600px]">
          
          {/* Left Panel: GIS Map & 3D Ocean Twin (7 of 12 columns, ~60%) */}
          <div className="lg:col-span-7 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg p-2.5">
            <div className="flex items-center justify-between pb-2 px-1 text-xs text-slate-300 font-mono">
              <span className="font-bold flex items-center gap-1.5">
                <span>{viewMode === '2d' ? '🗺️' : '🌊'}</span> {userOrigin.name || 'Kochi Port'} {viewMode === '2d' ? 'Corridor & EEZ Waters' : '3D Ocean Digital Twin'}
              </span>
              <div className="flex items-center gap-2">
                <div className="bg-slate-950 border border-slate-800 p-0.5 rounded-lg flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('2d')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      viewMode === '2d' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🗺️ 2D Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('3d')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      viewMode === '3d' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🌊 3D Ocean Twin
                  </button>
                </div>
                <span className="text-slate-500 text-[10px] hidden sm:inline">
                  {zones.length} Sectors Active
                </span>
              </div>
            </div>

            <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-800">
              {viewMode === '2d' ? (
                <OrcaMap
                  zones={zones}
                  boundaries={boundaries}
                  selectedZone={selectedZone}
                  decision={decision}
                  userOrigin={userOrigin}
                  onSelectZone={handleSelectZone}
                />
              ) : (
                <Orca3DViewer
                  decision={decision}
                  selectedZone={selectedZone}
                  userOrigin={userOrigin}
                  language={language}
                />
              )}
            </div>
          </div>

          {/* Right Panel: Unified Marine Intelligence Side Panel (5 of 12 columns, ~40%) */}
          <div className="lg:col-span-5 h-full">
            <MarineSidePanel
              zones={zones}
              selectedZone={selectedZone}
              conditions={conditions}
              decision={decision}
              trackedDecision={activeTrackedDecision}
              userOrigin={userOrigin}
              language={language}
              activeNavTab={activeNavTab}
              onSelectNavTab={(tab) => setActiveNavTab(tab)}
              onSelectZone={handleSelectZone}
              onDecisionEvaluated={(res) => setDecision(res)}
              onDecisionTracked={handleDecisionTracked}
              onDecisionUpdated={handleDecisionUpdated}
            />
          </div>

        </div>

      </main>

      {/* Threshold Tuning Modal */}
      <ThresholdsModal
        isOpen={showThresholdsModal}
        onClose={() => setShowThresholdsModal(false)}
        onThresholdsUpdated={() => {
          if (selectedZone) handleSelectZone(selectedZone);
        }}
      />

      {/* SIH Judge Defense Reference Modal */}
      <JudgeReferenceModal
        isOpen={showJudgeModal}
        onClose={() => setShowJudgeModal(false)}
      />

    </div>
  );
}

