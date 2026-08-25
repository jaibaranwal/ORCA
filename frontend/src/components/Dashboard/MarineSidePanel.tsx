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
  onSelectZone: (zone: ZoneInfo) => void;
  onDecisionEvaluated: (result: DecisionResult) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
  onDecisionUpdated: (updated: DecisionObject) => void;
}

const PROMPT_SUGGESTIONS = [
  'Kal subah fishing ke liye kahan jaana chahiye?',
  'Is Zone B safe tomorrow morning?',
  'Zone B kab suitable hoga?',
  'Compare Zone A and Zone C',
  'What are current sea conditions?'
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
  // Active Tab: 'workstation' | 'chat'
  const [activeTab, setActiveTab] = useState<'workstation' | 'chat'>('workstation');

  // Query / Chat State
  const [queryInput, setQueryInput] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'orca',
      text: 'Namaste. I am ORCA, your Marine Decision Support Assistant. Ask me where to fish, check weather safety for tomorrow morning, or select a sector on the map.',
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

  const showToast = (type: 'success' | 'alert' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeTab]);

  // 1. Natural Language Query Handler
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
          text: 'Unable to connect to the evaluation service. Please select a sector on the map directly.',
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
      showToast('info', `Sector ${res.zone_name} evaluated as ${res.status}`);
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
      showToast('success', `Decision registered: ${res.decision.decision_id}`);
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
        showToast('success', 'Conditions verified stable. Plan remains safe.');
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
      showToast('alert', 'Simulated 2.8m wave change injected. Safety limit crossed.');
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
      showToast('success', 'Mission completed. Outcome recorded.');
    } catch (err: any) {
      showToast('alert', err.message || 'Failed to record feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden shadow-lg">
      
      {/* Top Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('workstation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'workstation'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Decision Workstation
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'chat'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Ask ORCA Chat</span>
            {chatHistory.length > 1 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
                {chatHistory.length - 1}
              </span>
            )}
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-normal">
          {language === 'en' ? 'EN' : 'HI'} Mode
        </span>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`mx-4 mt-3 p-3 rounded-lg text-xs flex items-center gap-2 border font-medium ${
            notification.type === 'alert'
              ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
              : notification.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
              : 'bg-blue-950/60 border-blue-800/80 text-blue-200'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* TAB CONTENT 1: WORKSTATION */}
      {activeTab === 'workstation' && (
        <div className="p-4 flex-1 flex flex-col justify-between space-y-4 overflow-y-auto">
          
          {/* Quick Inquiry Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Quick Inquiry</span>
              <button
                onClick={() => setActiveTab('chat')}
                className="text-[11px] text-blue-400 hover:underline"
              >
                Open Full Chat →
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
                placeholder="Ask where to fish or check sector safety..."
                disabled={queryLoading}
                className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!queryInput.trim() || queryLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs transition-colors shrink-0"
              >
                {queryLoading ? '...' : 'Ask'}
              </button>
            </form>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {PROMPT_SUGGESTIONS.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleQuerySubmit(s)}
                  disabled={queryLoading}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-slate-300 whitespace-nowrap transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[1px] bg-slate-800/80" />

          {/* ACTIVE DECISION CARD */}
          {decision ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Target Sector</span>
                  <h3 className="font-semibold text-sm text-white">{decision.zone_name}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      decision.status === 'GO'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : decision.status === 'CAUTION'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700'
                        : 'bg-rose-950 text-rose-300 border border-rose-700'
                    }`}
                  >
                    {decision.status === 'GO' ? 'GO — Recommended' : decision.status === 'CAUTION' ? 'CAUTION — Marginal' : 'WAIT — Unsafe'}
                  </span>
                </div>
              </div>

              {/* Telemetry Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Wave Height</span>
                  <span className="text-slate-100 font-semibold mt-0.5 block">
                    {decision.conditions?.wave_height_m || 1.4} m
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Wind Speed</span>
                  <span className="text-slate-100 font-semibold mt-0.5 block">
                    {decision.conditions?.wind_speed_kmh || 12.0} km/h
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">PFZ Score</span>
                  <span className="text-blue-400 font-semibold mt-0.5 block">
                    {decision.fishing_score}/100
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block">Boundary</span>
                  <span className={`font-semibold mt-0.5 block ${decision.boundary_violation ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {decision.boundary_violation ? 'Restricted' : 'Clear'}
                  </span>
                </div>
              </div>

              {/* Explanation text */}
              {decision.explanation && (
                <div className="p-3 bg-slate-950/70 border border-slate-800/90 rounded-lg text-xs text-slate-300 leading-relaxed">
                  {decision.explanation}
                </div>
              )}

              {/* Track Decision Button */}
              {!trackedDecision && (
                <button
                  onClick={handleTrackDecision}
                  disabled={tracking}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors shadow-sm"
                >
                  {tracking ? 'Saving Decision...' : 'Track Decision (Save to Living Registry)'}
                </button>
              )}
            </div>
          ) : (
            /* Sector selector fallback */
            <div className="space-y-2.5">
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
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'bg-blue-950/50 border-blue-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <strong className="text-xs block truncate">{z.zone_name.split(' ')[0]}</strong>
                      <span className="text-[11px] text-blue-400 block mt-0.5">PFZ {z.pfz_score}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleEvaluateZone}
                disabled={!selectedZone || evaluating}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs transition-colors mt-1"
              >
                {evaluating ? 'Evaluating...' : `Evaluate ${selectedZone?.zone_name || 'Sector'}`}
              </button>
            </div>
          )}

          {/* LIVING DECISION WATCH */}
          {trackedDecision && !isCompleted && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <strong className="text-white font-semibold">Monitoring Active</strong>
                  <span className="text-slate-400">({trackedDecision.decision_id})</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Saved: {new Date(trackedDecision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCheckConditions}
                  disabled={checking || simulating}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors"
                >
                  {checking ? 'Checking...' : 'Check Conditions'}
                </button>

                <button
                  onClick={handleSimulateChange}
                  disabled={checking || simulating}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 rounded-md text-xs font-medium transition-colors"
                >
                  {simulating ? 'Simulating...' : 'Simulate Change'}
                </button>
              </div>
            </div>
          )}

          {/* ALERT & REPAIR ALTERNATIVES */}
          {isAlert && !isCompleted && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-lg space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-200">
                  Condition Alert: Safety Limit Crossed
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-rose-900/80 text-rose-200 font-medium">
                  Action Required
                </span>
              </div>

              <div className="p-2 bg-rose-900/20 rounded border border-rose-900/40 text-[11px] text-rose-200 flex justify-between">
                <span>Wave Height: 1.4m → <strong>2.8m</strong> (Safe Limit: 2.5m)</span>
                <span className="text-white font-medium">GO ➔ WAIT</span>
              </div>

              <p className="text-[11px] text-rose-200 leading-relaxed">
                Wave height has crossed safe operational thresholds. The original plan is no longer safe.
              </p>

              {!repairData ? (
                <button
                  onClick={handleFindRepairOptions}
                  disabled={loadingRepair}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition-colors"
                >
                  {loadingRepair ? 'Evaluating Options...' : 'Find Safe Alternatives'}
                </button>
              ) : (
                <div className="space-y-2 pt-1 border-t border-rose-900/60">
                  <span className="text-[11px] text-slate-300 font-semibold block">
                    Verified Alternatives:
                  </span>
                  {repairData.options.map((opt) => (
                    <div
                      key={opt.option_id}
                      className="p-2.5 bg-slate-900 border border-slate-700/80 rounded-md flex items-center justify-between gap-2"
                    >
                      <div className="text-xs">
                        <span className="font-medium text-white block">{opt.title}</span>
                        <span className="text-[11px] text-emerald-400">{opt.status} ({opt.score}/100)</span>
                      </div>
                      <button
                        onClick={() => handleSelectRepairOption(opt)}
                        disabled={selectingOption === opt.option_id}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors shrink-0"
                      >
                        {selectingOption === opt.option_id ? '...' : opt.type === 'WAIT' ? 'Wait' : 'Select'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPAIRED BANNER */}
          {isRepaired && !isCompleted && (
            <div className="p-3 bg-blue-950/40 border border-blue-800/80 rounded-lg space-y-1 text-xs">
              <div className="flex items-center justify-between text-blue-200 font-semibold">
                <span>Mission Repaired</span>
                <span className="text-[11px] text-blue-400 font-normal">Active Monitoring</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Plan updated to: <strong>{trackedDecision.mission.zone_name}</strong> (Departure adjusted for calm sea state).
              </p>
            </div>
          )}

          {/* MISSION COMPLETION BUTTON */}
          {trackedDecision && !isCompleted && (
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors"
            >
              Complete Mission & Record Outcome
            </button>
          )}

          {/* OUTCOME CARD */}
          {(isCompleted || trackedDecision?.feedback || feedbackResult) && (
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-emerald-400 font-semibold">
                <span>Mission Completed</span>
                <span className="text-[11px] text-slate-400 font-normal">Outcome Recorded</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-[11px] text-slate-400 block">Wave (Pred vs Actual)</span>
                  <span className="text-white font-medium block mt-0.5">
                    1.35m → {trackedDecision?.feedback?.actual_wave_height_m || actualWave}m (Close)
                  </span>
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-[11px] text-slate-400 block">Wind (Pred vs Actual)</span>
                  <span className="text-white font-medium block mt-0.5">
                    12.5 → {trackedDecision?.feedback?.actual_wind_speed_kmh || actualWind} km/h (Close)
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                Catch Outcome: <strong className="text-emerald-400">{trackedDecision?.feedback?.fishing_outcome || fishingCatch}</strong> • "{trackedDecision?.feedback?.comment || feedbackComment}"
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between font-normal">
            <span>Deterministic Rule Engine</span>
            <span>Living Decision Registry</span>
          </div>

        </div>
      )}

      {/* TAB CONTENT 2: ASK ORCA CHAT (Full View) */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          
          {/* Scrollable Chat Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatHistory.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className={`text-[11px] font-semibold ${item.sender === 'user' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {item.sender === 'user' ? 'You' : 'ORCA Assistant'}
                  </span>
                  <span className="text-[10px] text-slate-500">{item.time}</span>
                </div>

                <div
                  className={`p-3 rounded-xl max-w-[88%] text-xs leading-relaxed ${
                    item.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>

                  {/* Decision Tag inside Chat if recommendation was attached */}
                  {item.decision && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-emerald-400">
                        {item.decision.zone_name} • {item.decision.status} ({item.decision.score}/100)
                      </span>
                      <button
                        onClick={() => setActiveTab('workstation')}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-medium rounded transition-colors"
                      >
                        View in Workstation →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {queryLoading && (
              <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl w-fit text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>ORCA is evaluating marine data...</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Suggestions & Input Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {PROMPT_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleQuerySubmit(s)}
                  disabled={queryLoading}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap transition-colors"
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
                placeholder="Type your question in English or Hindi..."
                disabled={queryLoading}
                className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!queryInput.trim() || queryLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs transition-colors shrink-0"
              >
                Send
              </button>
            </form>
          </div>

        </div>
      )}

      {/* Feedback Modal Form */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitFeedback}
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 space-y-3.5 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-semibold text-white text-sm">Post-Mission Feedback</h3>
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
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
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
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Catch Experience</label>
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
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg"
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
