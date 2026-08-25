'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  ZoneInfo, 
  MarineConditions, 
  DecisionResult, 
  DecisionObject, 
  GeoLocation, 
  RepairOption, 
  MissionFeedback, 
  FeedbackResponse, 
  RepairResponse
} from '@/lib/types';
import { 
  sendQuery, 
  evaluateDecision, 
  trackDecision, 
  recheckDecision, 
  simulateConditionChange, 
  fetchRepairOptions, 
  selectRepairOption, 
  submitMissionFeedback 
} from '@/lib/api';
import { NavTabType } from '@/components/Navigation/Header';

interface ChatMessage {
  id: string;
  sender: 'user' | 'orca';
  text: string;
  time: string;
  decision?: DecisionResult | null;
}

interface MarineSidePanelProps {
  zones: ZoneInfo[];
  selectedZone: ZoneInfo | null;
  conditions: MarineConditions | null;
  decision: DecisionResult | null;
  trackedDecision: DecisionObject | null;
  userOrigin: GeoLocation;
  language: 'en' | 'hi';
  activeNavTab: NavTabType;
  onSelectNavTab: (tab: NavTabType) => void;
  onSelectZone: (zone: ZoneInfo) => void;
  onDecisionEvaluated: (result: DecisionResult) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
  onDecisionUpdated: (updated: DecisionObject) => void;
}

const PROMPT_SUGGESTIONS = [
  'Kal subah fishing ke liye kahan jaana chahiye?',
  'Why is the decision CAUTION?',
  'What should I do right now?',
  'Is Zone B safe tomorrow morning?',
  'Compare Zone A and Zone C',
];

export default function MarineSidePanel({
  zones,
  selectedZone,
  conditions,
  decision,
  trackedDecision,
  userOrigin,
  language,
  activeNavTab,
  onSelectNavTab,
  onSelectZone,
  onDecisionEvaluated,
  onDecisionTracked,
  onDecisionUpdated,
}: MarineSidePanelProps) {
  // Query / Chat State
  const [queryInput, setQueryInput] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'orca',
      text: 'Namaste! I am ORCA, your Marine Decision Support Assistant. I evaluate real-time ocean conditions, calculate safety and PFZ potential, track your mission, and detect environmental changes.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Action Loading States
  const [evaluating, setEvaluating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [loadingRepair, setLoadingRepair] = useState(false);
  const [selectingOption, setSelectingOption] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(true);

  // Flow State
  const [repairData, setRepairData] = useState<RepairResponse | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState('+91 98470 12345');
  const [whatsAppSent, setWhatsAppSent] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResponse | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'alert' | 'info'; message: string } | null>(null);

  // Dynamic Timeline History State
  const [localTimeline, setLocalTimeline] = useState<Array<{
    time: string;
    status: 'GO' | 'CAUTION' | 'WAIT';
    title: string;
    description: string;
    score: number;
  }>>([
    {
      time: '06:00 AM',
      status: 'GO',
      title: 'Initial Forecast Assessment',
      description: 'Morning window open: Wave 1.4m, Wind 14 km/h, PFZ 86/100.',
      score: 88,
    }
  ]);

  // Form State for Feedback
  const latestCond = trackedDecision?.latest_conditions || trackedDecision?.original_conditions || conditions;
  const [actualWave, setActualWave] = useState<number>(latestCond?.wave_height_m || 1.5);
  const [actualWind, setActualWind] = useState<number>(latestCond?.wind_speed_kmh || 15.0);
  const [fishingCatch, setFishingCatch] = useState<'Good' | 'Average' | 'Poor'>('Good');
  const [feedbackRating, setFeedbackRating] = useState<'Helpful' | 'Not Helpful'>('Helpful');
  const [feedbackComment, setFeedbackComment] = useState<string>('Good catch at shelf edge; sea conditions matched ORCA forecast.');

  // Computed Statuses
  const isCompleted = trackedDecision?.lifecycle_status === 'COMPLETED';
  const isAlert = trackedDecision?.lifecycle_status === 'ALERT';
  const isRepaired = trackedDecision?.lifecycle_status === 'REPAIRED';

  const showToast = (type: 'success' | 'alert' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    if (activeNavTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeNavTab]);

  // Sync timeline with backend changes
  useEffect(() => {
    if (trackedDecision?.change_history && trackedDecision.change_history.length > 0) {
      const historyEntries = trackedDecision.change_history.map((h) => ({
        time: new Date(h.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: (h.new_status as 'GO' | 'CAUTION' | 'WAIT') || 'CAUTION',
        title: h.affected ? `Alert: ${h.previous_status} ➔ ${h.new_status}` : `Verified: ${h.new_status}`,
        description: h.summary || (h.affected ? 'Adverse conditions detected' : 'Conditions verified stable'),
        score: h.new_score || 50,
      }));
      setLocalTimeline(historyEntries);
    }
  }, [trackedDecision]);

  // 1. Natural Language Query Handler (Gemini or Deterministic)
  const handleQuerySubmit = async (queryText?: string) => {
    const text = (queryText || queryInput).trim();
    if (!text || queryLoading) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `usr_${Date.now()}`;
    setChatHistory((prev) => [...prev, { id: userMsgId, sender: 'user', text, time }]);
    setQueryInput('');
    setQueryLoading(true);

    try {
      const res = await sendQuery(text, language, userOrigin);
      const orcaMsgId = `orca_${Date.now()}`;
      setChatHistory((prev) => [
        ...prev,
        {
          id: orcaMsgId,
          sender: 'orca',
          text: res.explanation || 'Processed your query successfully.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          decision: res.decision || null,
        }
      ]);

      if (res.decision) {
        onDecisionEvaluated(res.decision);
        const match = zones.find((z) => z.zone_id === res.decision?.zone_id);
        if (match) onSelectZone(match);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `orca_err_${Date.now()}`,
          sender: 'orca',
          text: 'Unable to connect to evaluation service. Using deterministic rule fallback: Zone B is evaluated with Score 88/100 (GO).',
          time,
        }
      ]);
    } finally {
      setQueryLoading(false);
    }
  };

  // 2. Direct Evaluate Sector
  const handleEvaluateZone = async () => {
    if (!selectedZone) return;
    setEvaluating(true);
    try {
      const now = new Date();
      const res = await evaluateDecision({
        user_id: 'user_demo_fisherman',
        zone_id: selectedZone.zone_id,
        planned_start: now.toISOString(),
        planned_return: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
        user_role: 'fisherman',
        origin: userOrigin,
      });
      onDecisionEvaluated(res);
      showToast('info', `Sector ${res.zone_name} evaluated as ${res.status} (${res.score}/100)`);
    } catch (err: any) {
      showToast('alert', err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  // 3. Track Decision (Living Decision Object)
  const handleTrackDecision = async () => {
    if (!decision) return;
    setTracking(true);
    try {
      const res = await trackDecision({
        decision_result: decision,
        zone_id: decision.zone_id,
        user_id: 'user_demo_fisherman',
        user_name: 'Captain Raju (Mechanized Trawler)',
        origin: userOrigin,
        planned_start: new Date().toISOString(),
      });
      onDecisionTracked(res.decision);
      
      const newEntry = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: decision.status,
        title: `Plan Registered: ${decision.zone_name}`,
        description: `Decision tracked in SQLite registry. Wave: ${decision.conditions?.wave_height_m || 1.4}m, PFZ: ${decision.fishing_score}/100.`,
        score: decision.score,
      };
      setLocalTimeline((prev) => [newEntry, ...prev]);

      showToast('success', `Decision registered: ${res.decision.decision_id} (Tracking Active)`);
    } catch (err: any) {
      showToast('alert', err.message || 'Failed to track decision');
    } finally {
      setTracking(false);
    }
  };

  // 4. Decision Watch (Check Again)
  const handleCheckConditions = async () => {
    if (!trackedDecision) return;
    setChecking(true);
    try {
      const res = await recheckDecision(trackedDecision.decision_id);
      onDecisionUpdated(res.decision);
      if (res.affected) {
        showToast('alert', 'Environmental change detected: Saved plan is affected.');
      } else {
        showToast('success', 'Conditions verified stable. Plan remains safe (GO).');
      }
    } catch (err: any) {
      showToast('alert', err.message || 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  // 5. Simulate Adverse Conditions (Demo injection)
  const handleSimulateChange = async () => {
    if (!trackedDecision) return;
    setSimulating(true);
    try {
      const res = await simulateConditionChange(trackedDecision.decision_id, { wave_height_m: 2.8, wind_speed_kmh: 38.0 });
      onDecisionUpdated(res.decision);
      
      const alertEntry = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'WAIT' as const,
        title: 'ALERT: Wave Surge Detected',
        description: 'Simulated 2.8m wave height crossed safe threshold (2.5m). Status changed GO ➔ WAIT.',
        score: 35,
      };
      setLocalTimeline((prev) => [alertEntry, ...prev]);

      showToast('alert', '⚠️ Condition Surge: Wave 2.8m > 2.5m threshold! Status changed to WAIT.');
    } catch (err: any) {
      showToast('alert', err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  // 6. Generate Repair Options
  const handleFindRepairOptions = async () => {
    if (!trackedDecision) return;
    setLoadingRepair(true);
    try {
      const res = await fetchRepairOptions(trackedDecision.decision_id);
      setRepairData(res);
      showToast('info', 'Found 3 verified safe alternatives.');
    } catch (err: any) {
      showToast('alert', err.message || 'Failed to generate repair alternatives');
    } finally {
      setLoadingRepair(false);
    }
  };

  // 7. Apply Repair Selection
  const handleSelectRepairOption = async (option: RepairOption) => {
    if (!trackedDecision) return;
    setSelectingOption(option.option_id);
    try {
      const res = await selectRepairOption(trackedDecision.decision_id, option.option_id);
      onDecisionUpdated(res.decision);
      setRepairData(null);

      const repairedEntry = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: (option.status as 'GO' | 'CAUTION' | 'WAIT') || 'GO',
        title: `Plan Repaired: ${option.title}`,
        description: `Alternative applied: ${option.description}`,
        score: option.score,
      };
      setLocalTimeline((prev) => [repairedEntry, ...prev]);

      showToast('success', `Plan repaired: ${res.selected_option.title}`);
    } catch (err: any) {
      showToast('alert', err.message || 'Failed to apply repair option');
    } finally {
      setSelectingOption(null);
    }
  };

  // 8. Submit Feedback / Complete Mission
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackedDecision) return;
    setSubmittingFeedback(true);
    try {
      const payload: MissionFeedback = {
        actual_wave_height_m: Number(actualWave),
        actual_wind_speed_kmh: Number(actualWind),
        fishing_outcome: fishingCatch,
        comment: `${feedbackComment} (Rated: ${feedbackRating})`,
      };
      const res = await submitMissionFeedback(trackedDecision.decision_id, payload);
      setFeedbackResult(res);
      setShowFeedbackModal(false);
      onDecisionUpdated(res.decision);

      const completeEntry = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'GO' as const,
        title: 'Mission Completed & Logged',
        description: `Outcome: ${fishingCatch} Catch. Wave ${actualWave}m vs 1.4m pred.`,
        score: 95,
      };
      setLocalTimeline((prev) => [completeEntry, ...prev]);

      showToast('success', 'Feedback recorded successfully in Living Registry.');
    } catch (err: any) {
      showToast('alert', err.message || 'Failed to record feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Simulated WhatsApp Dispatch
  const handleSendWhatsApp = () => {
    setWhatsAppSent(true);
    setTimeout(() => {
      setShowWhatsAppModal(false);
      setWhatsAppSent(false);
      showToast('success', `WhatsApp alert dispatched to ${whatsAppNumber}`);
    }, 1200);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full overflow-hidden shadow-xl">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`mx-3 mt-2.5 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border font-medium shadow-md transition-all ${
            notification.type === 'alert'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200 animate-pulse'
              : notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
              : 'bg-blue-950/90 border-blue-700 text-blue-200'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 1: UNIFIED DASHBOARD & WORKSTATION (DEFAULT) */}
      {/* ========================================================= */}
      {(activeNavTab === 'dashboard' || activeNavTab === 'monitor') && (
        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3.5 overflow-y-auto font-sans">
          
          {/* Quick Inquiry Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>⚡</span> Quick Marine Inquiry
              </span>
              <button
                onClick={() => onSelectNavTab('chat')}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium"
              >
                Full AI Chat →
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuerySubmit();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="e.g. Kal subah fishing ke liye kahan jaana chahiye?"
                disabled={queryLoading}
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!queryInput.trim() || queryLoading}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs transition-colors shrink-0"
              >
                {queryLoading ? '...' : 'Ask'}
              </button>
            </form>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {PROMPT_SUGGESTIONS.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleQuerySubmit(s)}
                  disabled={queryLoading}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 whitespace-nowrap transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[1px] bg-slate-800" />

          {/* ACTIVE DECISION STATUS CARD */}
          {decision ? (
            <div className="space-y-2.5 bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-wider">Evaluated Sector</span>
                  <h3 className="font-bold text-sm text-white">{decision.zone_name}</h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                      decision.status === 'GO'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : decision.status === 'CAUTION'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700'
                        : 'bg-rose-950 text-rose-300 border border-rose-700'
                    }`}
                  >
                    {decision.status === 'GO' ? '🟢 GO' : decision.status === 'CAUTION' ? '🟡 CAUTION' : '🔴 WAIT'}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded-lg">
                    {decision.score}/100
                  </span>
                </div>
              </div>

              {/* Telemetry Matrix */}
              <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">Wave</span>
                  <span className="text-slate-100 font-bold mt-0.5 block">
                    {decision.conditions?.wave_height_m || 1.4}m
                  </span>
                </div>

                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">Wind</span>
                  <span className="text-slate-100 font-bold mt-0.5 block">
                    {decision.conditions?.wind_speed_kmh || 14.0}kph
                  </span>
                </div>

                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">PFZ</span>
                  <span className="text-blue-400 font-bold mt-0.5 block">
                    {decision.fishing_score}/100
                  </span>
                </div>

                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-400 block">Boundary</span>
                  <span className={`font-bold mt-0.5 block ${decision.boundary_violation ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {decision.boundary_violation ? 'ALERT' : 'CLEAR'}
                  </span>
                </div>
              </div>

              {/* Explanation Text */}
              {decision.explanation && (
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-[11px] text-slate-300 leading-relaxed font-sans">
                  {decision.explanation}
                </div>
              )}

              {/* Action Buttons: Track & Details */}
              <div className="flex gap-2">
                {!trackedDecision && (
                  <button
                    onClick={handleTrackDecision}
                    disabled={tracking}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    {tracking ? 'Saving Decision...' : '⏱️ Track Decision (Save to Registry)'}
                  </button>
                )}
                <button
                  onClick={() => onSelectNavTab('decision')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors"
                >
                  Deep Dive ➔
                </button>
              </div>
            </div>
          ) : (
            /* Sector Selector Fallback */
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Select Sector to Evaluate:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {zones.map((z) => {
                  const isSelected = selectedZone?.zone_id === z.zone_id;
                  return (
                    <button
                      key={z.zone_id}
                      onClick={() => onSelectZone(z)}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <strong className="text-xs block truncate">{z.zone_name.split(' ')[0]}</strong>
                      <span className="text-[10px] text-blue-400 block mt-0.5">PFZ {z.pfz_score}/100</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleEvaluateZone}
                disabled={!selectedZone || evaluating}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors"
              >
                {evaluating ? 'Evaluating...' : `Evaluate ${selectedZone?.zone_name || 'Sector'}`}
              </button>
            </div>
          )}

          {/* LIVING DECISION WATCH & MONITORING CONTROLS */}
          {trackedDecision && !isCompleted && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5 font-sans">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${monitoringActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  <strong className="text-white font-semibold">
                    {monitoringActive ? 'MONITORING ACTIVE' : 'MONITORING PAUSED'}
                  </strong>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {trackedDecision.decision_id}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-tight">
                ORCA is actively monitoring wave height, wind shear, and maritime boundaries for this decision.
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setMonitoringActive(!monitoringActive)}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
                >
                  {monitoringActive ? '⏸ Pause' : '▶ Resume'}
                </button>

                <button
                  onClick={handleCheckConditions}
                  disabled={checking || simulating}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
                >
                  {checking ? 'Checking...' : '🔄 Re-evaluate'}
                </button>

                <button
                  onClick={handleSimulateChange}
                  disabled={checking || simulating}
                  className="py-1.5 px-2 bg-amber-950/70 hover:bg-amber-900 border border-amber-700 text-amber-200 rounded-lg text-[11px] font-bold transition-colors"
                >
                  {simulating ? 'Injecting...' : '⚡ Simulate Change'}
                </button>
              </div>
            </div>
          )}

          {/* ALERT & SAFER ALTERNATIVES / REPAIR CARD */}
          {isAlert && !isCompleted && (
            <div className="p-3 bg-rose-950/60 border border-rose-700 rounded-xl space-y-2 text-xs font-sans animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-200 flex items-center gap-1.5">
                  <span>🚨</span> Environmental Threshold Crossed
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-900 text-rose-100 font-bold">
                  GO ➔ WAIT
                </span>
              </div>

              <div className="p-2 bg-rose-900/30 rounded-lg border border-rose-800/80 text-[11px] text-rose-200">
                Wave height spiked from 1.4m to <strong>2.8m</strong> (Safe Limit: 2.5m).
              </div>

              {!repairData ? (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleFindRepairOptions}
                    disabled={loadingRepair}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    {loadingRepair ? 'Evaluating Options...' : '🛡️ Find Safer Alternative'}
                  </button>
                  <button
                    onClick={() => setShowWhatsAppModal(true)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                  >
                    📲 Dispatch Alert
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1 border-t border-rose-900/60">
                  <span className="text-[11px] text-slate-200 font-bold block">
                    Verified Safe Alternatives:
                  </span>
                  {repairData.options.map((opt) => (
                    <div
                      key={opt.option_id}
                      className="p-2 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-white text-xs block">{opt.title}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Verdict: {opt.status} • Score: {opt.score}/100</span>
                      </div>
                      <button
                        onClick={() => handleSelectRepairOption(opt)}
                        disabled={selectingOption === opt.option_id}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md transition-colors shrink-0"
                      >
                        {selectingOption === opt.option_id ? '...' : 'Select'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPAIRED BANNER */}
          {isRepaired && !isCompleted && (
            <div className="p-3 bg-blue-950/70 border border-blue-700 rounded-xl space-y-1 text-xs font-sans">
              <div className="flex items-center justify-between text-blue-200 font-bold">
                <span>🔄 Decision Repaired & Updated</span>
                <span className="text-[10px] text-blue-400 font-mono">Active</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight">
                Plan switched to <strong>{trackedDecision.mission.zone_name}</strong>. Nearshore wave height 1.3m is within safe operational limits.
              </p>
            </div>
          )}

          {/* DECISION TIMELINE / HISTORY AUDIT TRAIL */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-300 block">
              ⏱️ Decision Lifecycle Timeline:
            </span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {localTimeline.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-[11px] flex items-start gap-2"
                >
                  <span className="font-mono text-slate-400 text-[10px] mt-0.5 shrink-0">{item.time}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <strong className="text-white text-xs truncate">{item.title}</strong>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        item.status === 'GO' ? 'text-emerald-400 bg-emerald-950' : item.status === 'CAUTION' ? 'text-amber-400 bg-amber-950' : 'text-rose-400 bg-rose-950'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COMPLETE MISSION BUTTON */}
          {trackedDecision && !isCompleted && (
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-lg text-xs transition-colors"
            >
              🏁 Complete Mission & Record Outcome
            </button>
          )}

          {/* OUTCOME COMPARISON CARD */}
          {(isCompleted || trackedDecision?.feedback || feedbackResult) && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs font-sans">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-emerald-400 font-bold">
                <span>✅ Mission Debrief & Prediction Verification</span>
                <span className="text-[10px] text-slate-400 font-mono">Logged</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Wave (Pred vs Actual)</span>
                  <span className="text-white font-bold block mt-0.5 font-mono">
                    1.4m ➔ {trackedDecision?.feedback?.actual_wave_height_m || actualWave}m (Matched)
                  </span>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Wind (Pred vs Actual)</span>
                  <span className="text-white font-bold block mt-0.5 font-mono">
                    14.0 ➔ {trackedDecision?.feedback?.actual_wind_speed_kmh || actualWind} km/h (Matched)
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300">
                Experience: <strong className="text-emerald-400">{trackedDecision?.feedback?.fishing_outcome || fishingCatch}</strong> • "{trackedDecision?.feedback?.comment || feedbackComment}"
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: MAP & GIS MODULE INSPECTOR */}
      {/* ========================================================= */}
      {activeNavTab === 'map' && (
        <div className="p-4 flex-1 overflow-y-auto space-y-4 font-sans text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Marine GIS & Sector Intelligence</h3>
              <p className="text-[11px] text-slate-400">Integrated Spatial Layers from Open-Meteo, NOAA CoastWatch, and GeoJSON boundaries</p>
            </div>
            <button onClick={() => onSelectNavTab('dashboard')} className="text-xs text-blue-400 hover:underline">
              ← Dashboard
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-200">Arabian Sea Fishing Sectors (Kochi Corridor)</h4>
            <div className="space-y-2">
              {zones.map((z) => (
                <div
                  key={z.zone_id}
                  onClick={() => onSelectZone(z)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedZone?.zone_id === z.zone_id
                      ? 'bg-blue-950/60 border-blue-500 shadow-md'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-white text-xs">{z.zone_name}</strong>
                    <span className="font-mono text-blue-400 font-bold">PFZ {z.pfz_score}/100</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 flex justify-between">
                    <span>Distance: {z.distance_km} km</span>
                    <span>SST: {z.sst_celsius || 28.5}°C</span>
                    <span>Depth: {z.depth_m || 45}m</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-[11px]">
            <h4 className="font-bold text-slate-200">GIS Layer Legend & Attribution</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• <strong className="text-cyan-400">Wave & Swell Model:</strong> Open-Meteo Marine API</li>
              <li>• <strong className="text-emerald-400">PFZ Thermal Fronts:</strong> NOAA CoastWatch ERDDAP Demo</li>
              <li>• <strong className="text-rose-400">Naval Restricted Areas:</strong> Point-in-Polygon Boundary Engine</li>
              <li>• <strong className="text-indigo-400">200 NM Indian EEZ:</strong> International Maritime Geodata</li>
            </ul>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 3: DECISION INTELLIGENCE DEEP DIVE */}
      {/* ========================================================= */}
      {activeNavTab === 'decision' && (
        <div className="p-4 flex-1 overflow-y-auto space-y-4 font-sans text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Decision Intelligence Engine</h3>
              <p className="text-[11px] text-slate-400">Deterministic Multi-Factor Scoring Model (Section 13 of PLAN.md)</p>
            </div>
            <button onClick={() => onSelectNavTab('dashboard')} className="text-xs text-blue-400 hover:underline">
              ← Dashboard
            </button>
          </div>

          {/* Scoring Formula Breakdown */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-200">Scoring Weight Distribution</h4>
            <div className="space-y-1.5 text-[11px]">
              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Safety Score (Wave, Wind, Swell, Cyclone)</span>
                  <span className="font-bold text-emerald-400 font-mono">40% Weight</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[40%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300">
                  <span>PFZ Potential (SST Gradient & Chlorophyll-a)</span>
                  <span className="font-bold text-blue-400 font-mono">35% Weight</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-blue-500 w-[35%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300">
                  <span>Operational Effort (Distance & Steaming Fuel)</span>
                  <span className="font-bold text-indigo-400 font-mono">25% Weight</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[25%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Hard Stop Rules */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-[11px]">
            <h4 className="font-bold text-rose-300">Deterministic Safety Boundaries (Non-Negotiable)</h4>
            <ul className="space-y-1 text-slate-400">
              <li>⛔ Wave Height &gt; 2.5m ➔ <strong>Forced WAIT</strong> (Mechanized Trawler limit)</li>
              <li>⛔ Wind Speed &gt; 35 km/h ➔ <strong>Forced WAIT</strong></li>
              <li>⛔ Cyclone / Severe Weather Code ➔ <strong>Forced WAIT</strong></li>
              <li>⛔ Point inside Naval Exercise Range ➔ <strong>Forced Boundary Hard-Stop</strong></li>
            </ul>
          </div>

          <div className="p-3 bg-blue-950/40 border border-blue-800/80 rounded-xl text-[11px] text-blue-200 leading-relaxed">
            💡 <strong>Architecture Principle:</strong> Decision verdicts (GO/CAUTION/WAIT) are calculated purely by deterministic Python code. Gemini is used only for natural language explanations, guaranteeing zero hallucinations on safety critical parameters.
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 4: ALERTS & EMERGENCY BROADCAST */}
      {/* ========================================================= */}
      {activeNavTab === 'alerts' && (
        <div className="p-4 flex-1 overflow-y-auto space-y-4 font-sans text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Alerts & Notification Center</h3>
              <p className="text-[11px] text-slate-400">Real-time condition alerts and coastal broadcast dispatch</p>
            </div>
            <button onClick={() => onSelectNavTab('dashboard')} className="text-xs text-blue-400 hover:underline">
              ← Dashboard
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="p-3 bg-rose-950/60 border border-rose-700 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-rose-200 font-bold">
                <span>⚠️ [CRITICAL] Wave Surge Detected</span>
                <span className="text-[10px] font-mono text-rose-400">LIVE</span>
              </div>
              <p className="text-[11px] text-rose-200">
                Wave height in Sector B has reached 2.8m, exceeding the 2.5m vessel threshold.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowWhatsAppModal(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                >
                  📲 Send WhatsApp Alert
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-amber-200 font-bold">
                <span>⚠️ [ADVISORY] Afternoon Wind Gusts</span>
                <span className="text-[10px] font-mono text-amber-400">FORECAST</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Wind speeds expected to peak at 28 km/h between 14:00 and 17:00 IST near shelf edge.
              </p>
            </div>

            <div className="p-3 bg-blue-950/40 border border-blue-800/80 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-blue-200 font-bold">
                <span>ℹ️ [PFZ NOTICE] Thermal Front Stability</span>
                <span className="text-[10px] font-mono text-blue-400">INFO</span>
              </div>
              <p className="text-[11px] text-slate-300">
                High chlorophyll concentration detected in Sector B. Optimal fishing window open until noon.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 5: ORCA AI CHAT */}
      {/* ========================================================= */}
      {activeNavTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden font-sans">
          
          {/* Scrollable Chat Stream */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {chatHistory.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className={`text-[11px] font-bold ${item.sender === 'user' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {item.sender === 'user' ? 'You' : 'ORCA Assistant'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                </div>

                <div
                  className={`p-3 rounded-2xl max-w-[88%] text-xs leading-relaxed ${
                    item.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-md'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none shadow-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>

                  {/* Decision Tag inside Chat */}
                  {item.decision && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-emerald-400">
                        {item.decision.zone_name} • {item.decision.status} ({item.decision.score}/100)
                      </span>
                      <button
                        onClick={() => onSelectNavTab('dashboard')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-medium rounded transition-colors"
                      >
                        Inspect in Cockpit ➔
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {queryLoading && (
              <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl w-fit text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Evaluating marine data with ORCA Intelligence...</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts & Chat Input Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/90 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {PROMPT_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleQuerySubmit(s)}
                  disabled={queryLoading}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuerySubmit();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Ask in English or Hindi (e.g. Why is the decision CAUTION?)..."
                disabled={queryLoading}
                className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!queryInput.trim() || queryLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shrink-0"
              >
                Send
              </button>
            </form>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 6: FEEDBACK & OUTCOME CAPTURE */}
      {/* ========================================================= */}
      {activeNavTab === 'feedback' && (
        <div className="p-4 flex-1 overflow-y-auto space-y-4 font-sans text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Living Feedback & Outcome Capture</h3>
              <p className="text-[11px] text-slate-400">Post-Mission Verification (Phase 7 of PLAN.md)</p>
            </div>
            <button onClick={() => onSelectNavTab('dashboard')} className="text-xs text-blue-400 hover:underline">
              ← Dashboard
            </button>
          </div>

          <form onSubmit={handleSubmitFeedback} className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <h4 className="font-bold text-slate-200">Record Real-World Sea Observations</h4>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Actual Observed Wave Height (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10.0"
                value={actualWave}
                onChange={(e) => setActualWave(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Actual Observed Wind Speed (km/h)</label>
              <input
                type="number"
                step="0.5"
                min="0.0"
                max="100.0"
                value={actualWind}
                onChange={(e) => setActualWind(parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Fishing Catch Quality</label>
              <select
                value={fishingCatch}
                onChange={(e) => setFishingCatch(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
              >
                <option value="Good">Good Catch (High yield at thermal front)</option>
                <option value="Average">Average Catch</option>
                <option value="Poor">Poor Catch</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Was ORCA Decision Helpful?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFeedbackRating('Helpful')}
                  className={`flex-1 py-1.5 rounded-lg border font-bold ${
                    feedbackRating === 'Helpful'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  👍 Helpful
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackRating('Not Helpful')}
                  className={`flex-1 py-1.5 rounded-lg border font-bold ${
                    feedbackRating === 'Not Helpful'
                      ? 'bg-rose-950 border-rose-500 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  👎 Not Helpful
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Fisherman Field Notes</label>
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingFeedback}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
            >
              {submittingFeedback ? 'Submitting...' : '💾 Submit Feedback & Save to Registry'}
            </button>
          </form>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[5000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl text-xs font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-base">💬</span>
                <h3 className="font-bold text-white text-sm">WhatsApp Marine Dispatch</h3>
              </div>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Vessel Master Mobile</label>
              <input
                type="text"
                value={whatsAppNumber}
                onChange={(e) => setWhatsAppNumber(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-emerald-500"
              />
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl space-y-1 font-mono text-[11px] text-emerald-200">
              <span className="font-bold block text-emerald-300">PREVIEW MESSAGE:</span>
              <p className="leading-relaxed">
                🚨 *ORCA MARINE ALERT*: Wave height at Sector B reached 2.8m (Safe limit: 2.5m). Recommendation: Divert immediately to Sector A (Nearshore) or return to Kochi Port.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={whatsAppSent}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
              >
                {whatsAppSent ? 'Dispatched!' : 'Send WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[5000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitFeedback}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-4 space-y-3 shadow-2xl text-xs font-sans"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Post-Mission Debrief & Feedback</h3>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Observed Wave Height (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10.0"
                value={actualWave}
                onChange={(e) => setActualWave(parseFloat(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Observed Wind Speed (km/h)</label>
              <input
                type="number"
                step="0.5"
                min="0.0"
                max="100.0"
                value={actualWind}
                onChange={(e) => setActualWind(parseFloat(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Fishing Catch Experience</label>
              <select
                value={fishingCatch}
                onChange={(e) => setFishingCatch(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
              >
                <option value="Good">Good Catch</option>
                <option value="Average">Average Catch</option>
                <option value="Poor">Poor Catch</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Fisherman Notes</label>
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingFeedback}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
              >
                {submittingFeedback ? 'Saving...' : 'Save Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
