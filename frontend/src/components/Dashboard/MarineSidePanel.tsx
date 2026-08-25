'use client';

import { useState } from 'react';
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

interface MarineSidePanelProps {
  zones: ZoneInfo[];
  selectedZone: ZoneInfo | null;
  conditions: MarineConditions | null;
  decision: DecisionResult | null;
  trackedDecision: DecisionObject | null;
  userOrigin: GeoLocation;
  language: 'en' | 'hi';
  onSelectZone: (zone: ZoneInfo) => void;
  onDecisionEvaluated: (result: DecisionResult) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
  onDecisionUpdated: (updated: DecisionObject) => void;
}

const PROMPT_SUGGESTIONS = [
  'Kal subah fishing ke liye kahan jaana chahiye?',
  'Is Zone B safe tomorrow morning?',
  'Zone B kab suitable hoga?'
];

export default function MarineSidePanel({
  zones,
  selectedZone,
  conditions,
  decision,
  trackedDecision,
  userOrigin,
  language,
  onSelectZone,
  onDecisionEvaluated,
  onDecisionTracked,
  onDecisionUpdated,
}: MarineSidePanelProps) {
  // Query Input State
  const [queryInput, setQueryInput] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'user' | 'orca'; text: string; time: string }>>([]);

  // Action Loading States
  const [evaluating, setEvaluating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [loadingRepair, setLoadingRepair] = useState(false);
  const [selectingOption, setSelectingOption] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Flow State
  const [repairData, setRepairData] = useState<RepairResponse | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResponse | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'alert' | 'info'; message: string } | null>(null);

  // Form State for Feedback
  const latestCond = trackedDecision?.latest_conditions || trackedDecision?.original_conditions || conditions;
  const [actualWave, setActualWave] = useState<number>(latestCond?.wave_height_m || 1.4);
  const [actualWind, setActualWind] = useState<number>(latestCond?.wind_speed_kmh || 14.0);
  const [fishingCatch, setFishingCatch] = useState<'Good' | 'Average' | 'Poor'>('Good');
  const [feedbackComment, setFeedbackComment] = useState<string>('Good catch at the shelf edge, sea conditions were manageable.');

  // Computed Statuses
  const isCompleted = trackedDecision?.lifecycle_status === 'COMPLETED';
  const isAlert = trackedDecision?.lifecycle_status === 'ALERT';
  const isRepaired = trackedDecision?.lifecycle_status === 'REPAIRED';
  const isWaiting = trackedDecision?.lifecycle_status === 'WAITING';

  const showToast = (type: 'success' | 'alert' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // 1. Natural Language Query Handler
  const handleQuerySubmit = async (queryText?: string) => {
    const text = (queryText || queryInput).trim();
    if (!text || queryLoading) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatHistory((prev) => [...prev, { sender: 'user', text, time }]);
    setQueryInput('');
    setQueryLoading(true);

    try {
      const res = await sendQuery(text, language, userOrigin);
      setChatHistory((prev) => [
        ...prev,
        { sender: 'orca', text: res.explanation, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);

      if (res.decision) {
        onDecisionEvaluated(res.decision);
        const match = zones.find((z) => z.zone_id === res.decision?.zone_id);
        if (match) onSelectZone(match);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        { sender: 'orca', text: 'Unable to process query. Please select a sector on the map to evaluate.', time }
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
        user_name: 'Raju (Fisherman)',
        origin: userOrigin,
        planned_start: new Date().toISOString(),
      });
      onDecisionTracked(res.decision);
      showToast('success', `Decision registered & living watch active: ${res.decision.decision_id}`);
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
        showToast('success', 'Conditions verified stable. Recommendation remains valid.');
      }
    } catch (err: any) {
      showToast('alert', err.message || 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  // 5. Simulate Adverse Conditions (Demo controlled injection)
  const handleSimulateChange = async () => {
    if (!trackedDecision) return;
    setSimulating(true);
    try {
      const res = await simulateConditionChange(trackedDecision.decision_id, { wave_height_m: 2.8 });
      onDecisionUpdated(res.decision);
      showToast('alert', 'Simulated 2.8m wave change injected. Safety limit crossed!');
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
      showToast('success', `Plan updated: ${res.selected_option.title}`);
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
        comment: feedbackComment,
      };
      const res = await submitMissionFeedback(trackedDecision.decision_id, payload);
      setFeedbackResult(res);
      setShowFeedbackModal(false);
      onDecisionUpdated(res.decision);
      showToast('success', 'Mission Completed! Prediction vs Actual outcome recorded.');
    } catch (err: any) {
      showToast('alert', err.message || 'Failed to record feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between h-full shadow-lg space-y-3.5 overflow-y-auto">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-2.5 rounded-xl text-xs font-mono flex items-center gap-2 border ${
            notification.type === 'alert'
              ? 'bg-rose-950/90 border-rose-700 text-rose-200'
              : notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
              : 'bg-cyan-950/90 border-cyan-700 text-cyan-200'
          }`}
        >
          <span>{notification.type === 'alert' ? '⚠️' : '✓'}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* SECTION 1: ASK ORCA (Natural Language Query) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
            Ask ORCA
          </label>
          <span className="text-[10px] text-slate-400 font-mono">English / Hindi / Hinglish</span>
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
            placeholder="Ask where to fish or check sea safety..."
            disabled={queryLoading}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-cyan-500 transition-all font-sans"
          />
          <button
            type="submit"
            disabled={!queryInput.trim() || queryLoading}
            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs font-mono transition-all shrink-0"
          >
            {queryLoading ? '...' : 'Ask'}
          </button>
        </form>

        {/* Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {PROMPT_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleQuerySubmit(s)}
              disabled={queryLoading}
              className="text-[10px] px-2 py-1 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-600 text-slate-300 whitespace-nowrap transition-all font-mono"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Chat History Snippet */}
        {chatHistory.length > 0 && (
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl max-h-24 overflow-y-auto space-y-1.5 text-xs font-sans">
            {chatHistory.slice(-2).map((item, idx) => (
              <div key={idx} className="leading-snug">
                <strong className={item.sender === 'user' ? 'text-cyan-400' : 'text-emerald-400 font-mono text-[11px]'}>
                  {item.sender === 'user' ? 'You: ' : 'ORCA: '}
                </strong>
                <span className="text-slate-300 text-[11px]">{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-[1px] bg-slate-800" />

      {/* SECTION 2: EVALUATE & ACTIVE DECISION */}
      {decision ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-mono uppercase block">Target Sector</span>
              <h3 className="font-bold text-sm text-white">{decision.zone_name}</h3>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                  decision.status === 'GO'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                    : decision.status === 'CAUTION'
                    ? 'bg-amber-950 text-amber-300 border border-amber-600'
                    : 'bg-rose-950 text-rose-300 border border-rose-600'
                }`}
              >
                {decision.status === 'GO' ? '🟢 GO' : decision.status === 'CAUTION' ? '🟡 CAUTION' : '🔴 WAIT'} ({decision.score}/100)
              </span>
            </div>
          </div>

          {/* Telemetry Matrix (Wave, Wind, PFZ, Distance, Boundary) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-mono">
            <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Wave Height</span>
              <strong className="text-slate-100 text-xs">
                {decision.conditions?.wave_height_m || 1.4} m
              </strong>
            </div>

            <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Wind Speed</span>
              <strong className="text-slate-100 text-xs">
                {decision.conditions?.wind_speed_kmh || 12.0} km/h
              </strong>
            </div>

            <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">PFZ Score</span>
              <strong className="text-cyan-400 text-xs">
                {decision.fishing_score}/100
              </strong>
            </div>

            <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Boundary</span>
              <strong className={decision.boundary_violation ? 'text-rose-400 text-xs' : 'text-emerald-400 text-xs'}>
                {decision.boundary_violation ? 'Violated' : 'Clear'}
              </strong>
            </div>
          </div>

          {/* Plain Language Grounded Explanation */}
          {decision.explanation && (
            <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] text-slate-300 leading-relaxed font-sans italic">
              "{decision.explanation}"
            </div>
          )}

          {/* Track Decision Button */}
          {!trackedDecision && (
            <button
              onClick={handleTrackDecision}
              disabled={tracking}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs font-mono transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              {tracking ? 'Saving Decision Object...' : '📌 Track Decision (Activate Living Watch)'}
            </button>
          )}
        </div>
      ) : (
        /* Sector Quick Picker if no decision generated yet */
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 font-mono uppercase block">
            Select Fishing Sector to Evaluate:
          </span>
          <div className="grid grid-cols-3 gap-2">
            {zones.map((z) => {
              const isSelected = selectedZone?.zone_id === z.zone_id;
              return (
                <button
                  key={z.zone_id}
                  onClick={() => onSelectZone(z)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <strong className="text-xs block truncate">{z.zone_name.split(' ')[0]}</strong>
                  <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">PFZ {z.pfz_score}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleEvaluateZone}
            disabled={!selectedZone || evaluating}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs font-mono transition-all mt-1"
          >
            {evaluating ? 'Evaluating Safety Rules...' : `Evaluate ${selectedZone?.zone_name || 'Sector'}`}
          </button>
        </div>
      )}

      {/* SECTION 3: LIVING DECISION WATCH (When Tracked) */}
      {trackedDecision && !isCompleted && (
        <div className="p-3 bg-slate-950 border border-cyan-800/80 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <strong className="text-white">✓ WATCHING</strong>
              <span className="text-[10px] text-slate-400">({trackedDecision.decision_id})</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Saved: {new Date(trackedDecision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCheckConditions}
              disabled={checking || simulating}
              className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-1"
            >
              {checking ? 'Checking...' : '🔄 Check Again'}
            </button>

            <button
              onClick={handleSimulateChange}
              disabled={checking || simulating}
              className="py-1.5 px-3 bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-200 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-1"
              title="Demo condition change simulation (Wave 2.8m)"
            >
              {simulating ? 'Simulating...' : '⚡ Simulate Change'}
            </button>
          </div>
        </div>
      )}

      {/* SECTION 4: ALERT & REPAIR ALTERNATIVES (When Conditions Change) */}
      {isAlert && !isCompleted && (
        <div className="p-3 bg-rose-950/80 border border-rose-700 rounded-xl space-y-2.5 text-xs">
          <div className="flex items-center justify-between font-mono">
            <span className="font-bold text-rose-200 flex items-center gap-1.5">
              <span>⚠️</span> ALERT: CONDITION CHANGED
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900 text-white font-bold">
              LIMIT EXCEEDED
            </span>
          </div>

          <div className="p-2 bg-rose-900/40 rounded-lg font-mono text-[11px] text-rose-200 flex justify-between">
            <span>Wave Height: 1.4m → <strong>2.8m</strong> (Safe Limit: 2.5m)</span>
            <span className="text-white font-bold">GO ➔ WAIT</span>
          </div>

          <p className="text-[11px] text-rose-200 leading-snug">
            Wave height has crossed safe operational thresholds. The original plan is no longer safe.
          </p>

          {!repairData ? (
            <button
              onClick={handleFindRepairOptions}
              disabled={loadingRepair}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-1"
            >
              {loadingRepair ? 'Generating Safe Options...' : '🔧 Find Verified Safe Alternatives'}
            </button>
          ) : (
            <div className="space-y-1.5 pt-1 border-t border-rose-800">
              <span className="text-[10px] text-slate-300 font-bold uppercase font-mono block">
                Verified Alternatives (Evaluated by Rule Engine):
              </span>
              {repairData.options.map((opt) => (
                <div
                  key={opt.option_id}
                  className="p-2 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between gap-2"
                >
                  <div className="text-xs">
                    <span className="font-bold text-white block text-[11px]">{opt.title}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{opt.status} ({opt.score}/100)</span>
                  </div>
                  <button
                    onClick={() => handleSelectRepairOption(opt)}
                    disabled={selectingOption === opt.option_id}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded font-mono shrink-0"
                  >
                    {selectingOption === opt.option_id ? '...' : opt.type === 'WAIT' ? 'Wait' : 'Select'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: REPAIRED STATUS BANNER */}
      {isRepaired && !isCompleted && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-700 rounded-xl space-y-1.5 text-xs font-mono">
          <div className="flex items-center justify-between text-cyan-300 font-bold">
            <span>✓ MISSION REPAIRED</span>
            <span className="text-[10px] text-cyan-400 font-normal">Active Monitoring</span>
          </div>
          <p className="text-[11px] text-slate-300 font-sans">
            Plan updated to: <strong>{trackedDecision.mission.zone_name}</strong> (Departure adjusted for calm sea state).
          </p>
        </div>
      )}

      {/* SECTION 6: MISSION COMPLETION & FEEDBACK */}
      {trackedDecision && !isCompleted && (
        <button
          onClick={() => setShowFeedbackModal(true)}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-1.5"
        >
          <span>✓</span> Complete Mission & Capture Outcome
        </button>
      )}

      {/* COMPLETED OUTCOME CARD */}
      {(isCompleted || trackedDecision?.feedback || feedbackResult) && (
        <div className="p-3.5 bg-slate-950 border border-emerald-700 rounded-xl space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-emerald-400 font-bold">
            <span>✓ MISSION COMPLETED</span>
            <span className="text-[10px] text-slate-400">Outcome Recorded</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-1.5 bg-slate-900 rounded">
              <span className="text-[10px] text-slate-400 block">Wave (Pred vs Actual)</span>
              <strong className="text-white">1.35m → {trackedDecision?.feedback?.actual_wave_height_m || actualWave}m (✓ Close)</strong>
            </div>
            <div className="p-1.5 bg-slate-900 rounded">
              <span className="text-[10px] text-slate-400 block">Wind (Pred vs Actual)</span>
              <strong className="text-white">12.5 → {trackedDecision?.feedback?.actual_wind_speed_kmh || actualWind} km/h (✓ Close)</strong>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 font-sans">
            Catch: <strong className="text-emerald-400 font-mono">{trackedDecision?.feedback?.fishing_outcome || fishingCatch}</strong> • "{trackedDecision?.feedback?.comment || feedbackComment}"
          </div>
        </div>
      )}

      {/* Feedback Modal Form */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitFeedback}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3.5 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Post-Mission Feedback</h3>
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
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none"
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
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Catch Experience</label>
              <select
                value={fishingCatch}
                onChange={(e) => setFishingCatch(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none"
              >
                <option value="Good">🟢 Good Catch</option>
                <option value="Average">🟡 Average Catch</option>
                <option value="Poor">🔴 Poor Catch</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Fisherman Notes</label>
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingFeedback}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl font-mono"
              >
                {submittingFeedback ? 'Submitting...' : 'Save Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono flex justify-between">
        <span>Deterministic Rule Authority</span>
        <span>Living Decision Protocol</span>
      </div>

    </div>
  );
}
