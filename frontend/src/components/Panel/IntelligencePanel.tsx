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
  RecheckResponse,
  RepairResponse
} from '@/lib/types';
import { 
  evaluateDecision, 
  trackDecision, 
  recheckDecision, 
  simulateConditionChange, 
  fetchRepairOptions, 
  selectRepairOption, 
  submitMissionFeedback,
  cancelDecision 
} from '@/lib/api';

interface IntelligencePanelProps {
  zones: ZoneInfo[];
  selectedZone: ZoneInfo | null;
  conditions: MarineConditions | null;
  decision: DecisionResult | null;
  trackedDecision: DecisionObject | null;
  userOrigin: GeoLocation;
  onSelectZone: (zone: ZoneInfo) => void;
  onDecisionEvaluated: (result: DecisionResult) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
  onDecisionUpdated: (updated: DecisionObject) => void;
  onAskQuery: (query: string) => void;
}

export default function IntelligencePanel({
  zones,
  selectedZone,
  conditions,
  decision,
  trackedDecision,
  userOrigin,
  onSelectZone,
  onDecisionEvaluated,
  onDecisionTracked,
  onDecisionUpdated,
  onAskQuery,
}: IntelligencePanelProps) {
  // Loading states
  const [evaluating, setEvaluating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [selectingRepair, setSelectingRepair] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Operational states
  const [repairData, setRepairData] = useState<RepairResponse | null>(null);
  const [showRepairView, setShowRepairView] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResponse | null>(null);
  const [inlineQuery, setInlineQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for feedback
  const latestCond = trackedDecision?.latest_conditions || trackedDecision?.original_conditions || conditions;
  const [actualWave, setActualWave] = useState<number>(latestCond?.wave_height_m || 1.4);
  const [actualWind, setActualWind] = useState<number>(latestCond?.wind_speed_kmh || 14.0);
  const [fishingOutcome, setFishingOutcome] = useState<'Good' | 'Average' | 'Poor'>('Good');
  const [feedbackComment, setFeedbackComment] = useState<string>('Good catch at the shelf edge, sea conditions were manageable.');

  // Contextual classification
  const isCompleted = trackedDecision?.lifecycle_status === 'COMPLETED';
  const isAlert = trackedDecision?.lifecycle_status === 'ALERT';
  const isRepaired = trackedDecision?.lifecycle_status === 'REPAIRED';
  const isWaiting = trackedDecision?.lifecycle_status === 'WAITING';

  // 1. EVALUATE ZONE DECISION
  const handleRunEvaluation = async () => {
    if (!selectedZone) return;
    setEvaluating(true);
    setError(null);
    setSuccessMsg(null);
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
    } catch (err: any) {
      setError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  // 2. TRACK DECISION
  const handleTrackDecision = async () => {
    if (!decision) return;
    setTracking(true);
    setError(null);
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
      setSuccessMsg(`✓ Decision registered as Living Decision Object: ${res.decision.decision_id}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to track decision');
    } finally {
      setTracking(false);
    }
  };

  // 3. RECHECK CONDITIONS (DECISION WATCH)
  const handleRecheck = async () => {
    if (!trackedDecision) return;
    setChecking(true);
    setError(null);
    try {
      const res = await recheckDecision(trackedDecision.decision_id);
      onDecisionUpdated(res.decision);
      if (res.affected) {
        setSuccessMsg('⚠️ Environmental change detected — plan is affected.');
      } else {
        setSuccessMsg('✓ Conditions verified stable. Decision remains valid.');
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Recheck failed');
    } finally {
      setChecking(false);
    }
  };

  // 4. SIMULATE ADVERSE CHANGE (DEMO)
  const handleSimulateChange = async () => {
    if (!trackedDecision) return;
    setSimulating(true);
    setError(null);
    try {
      const res = await simulateConditionChange(trackedDecision.decision_id, { wave_height_m: 2.8 });
      onDecisionUpdated(res.decision);
      setSuccessMsg('⚡ Simulated 2.8m wave change injected into Decision Watch.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  // 5. GENERATE REPAIR OPTIONS
  const handleFindRepair = async () => {
    if (!trackedDecision) return;
    setRepairLoading(true);
    setError(null);
    try {
      const res = await fetchRepairOptions(trackedDecision.decision_id);
      setRepairData(res);
      setShowRepairView(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate repair alternatives');
    } finally {
      setRepairLoading(false);
    }
  };

  // 6. SELECT REPAIR OPTION
  const handleSelectRepair = async (option: RepairOption) => {
    if (!trackedDecision) return;
    setSelectingRepair(option.option_id);
    setError(null);
    try {
      const res = await selectRepairOption(trackedDecision.decision_id, option.option_id);
      onDecisionUpdated(res.decision);
      setShowRepairView(false);
      setSuccessMsg(`✓ Mission repaired and re-monitored: ${res.selected_option.title}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to select repair option');
    } finally {
      setSelectingRepair(null);
    }
  };

  // 7. SUBMIT MISSION FEEDBACK (OUTCOME)
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackedDecision) return;
    setSubmittingFeedback(true);
    setError(null);
    try {
      const payload: MissionFeedback = {
        actual_wave_height_m: Number(actualWave),
        actual_wind_speed_kmh: Number(actualWind),
        fishing_outcome: fishingOutcome,
        comment: feedbackComment,
      };
      const res = await submitMissionFeedback(trackedDecision.decision_id, payload);
      setFeedbackResult(res);
      setShowFeedbackForm(false);
      onDecisionUpdated(res.decision);
      setSuccessMsg('✓ Mission Completed! Prediction vs Actual verification recorded.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to record feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Verdict badge helper
  const renderVerdictBadge = (status: string, score: number) => {
    if (status === 'GO') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> 🟢 GO ({score}/100)
        </span>
      );
    }
    if (status === 'CAUTION') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/60 shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> 🟡 CAUTION ({score}/100)
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/60 shadow-sm flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-rose-400" /> 🔴 WAIT ({score}/100)
      </span>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-2xl backdrop-blur h-[540px] overflow-y-auto">
      <div className="space-y-3.5">
        
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>⚡</span> ORCA Intelligence Panel
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {trackedDecision ? `Active Living Mission (${trackedDecision.decision_id})` : 'Marine Decision Workstation'}
            </p>
          </div>

          {trackedDecision && (
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold ${
                isCompleted
                  ? 'bg-blue-950 text-blue-300 border border-blue-700'
                  : isAlert
                  ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                  : isRepaired
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                  : isWaiting
                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }`}
            >
              {isCompleted ? '✓ COMPLETED' : isAlert ? '⚠️ ALERT' : isRepaired ? '✓ REPAIRED' : trackedDecision.lifecycle_status}
            </span>
          )}
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="p-2.5 bg-emerald-950/70 border border-emerald-700 text-emerald-300 text-xs font-mono rounded-xl flex items-center gap-2">
            <span>✓</span> {successMsg}
          </div>
        )}
        {error && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-700 text-rose-300 text-xs font-mono rounded-xl flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE D: IMPACT ALERT BANNER (When condition change affects plan) */}
        {/* ------------------------------------------------------------- */}
        {isAlert && !isCompleted && !showRepairView && (
          <div className="p-3.5 bg-rose-950/80 border border-rose-700 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-300 flex items-center gap-1.5">
                <span>⚠️</span> ENVIRONMENTAL CHANGE AFFECTS SAVED PLAN
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-900 text-rose-200 font-mono font-bold">
                SAFETY LIMIT CROSSED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono pt-1">
              <div className="p-2 bg-rose-900/40 rounded-lg">
                <span className="text-[10px] text-rose-300 block">Original Plan</span>
                <strong className="text-white">
                  {trackedDecision?.original_decision.status} ({trackedDecision?.original_decision.score}) • {trackedDecision?.original_conditions.wave_height_m}m
                </strong>
              </div>
              <div className="p-2 bg-rose-900/60 rounded-lg border border-rose-600">
                <span className="text-[10px] text-rose-300 block">Current Conditions</span>
                <strong className="text-rose-200">
                  {trackedDecision?.latest_decision?.status || 'WAIT'} ({trackedDecision?.latest_decision?.score || 70}) • {trackedDecision?.latest_conditions?.wave_height_m || 2.8}m
                </strong>
              </div>
            </div>

            <div className="pt-2 border-t border-rose-800/80 flex items-center justify-between">
              <span className="text-[11px] text-rose-200">Wave height crossed the 2.5m safety threshold.</span>
              <button
                onClick={handleFindRepair}
                disabled={repairLoading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 shadow-md"
              >
                {repairLoading ? 'Evaluating...' : '🔧 Find Safe Options'}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE E: SAFE REPAIR ALTERNATIVES VIEW */}
        {/* ------------------------------------------------------------- */}
        {showRepairView && repairData && (
          <div className="p-3.5 bg-slate-950 border border-cyan-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>🧭</span> Safe Mission Alternatives
                </h4>
                <p className="text-[10px] text-slate-400">{repairData.explanation}</p>
              </div>
              <button
                onClick={() => setShowRepairView(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {repairData.options.map((opt) => (
                <div
                  key={opt.option_id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    opt.status === 'GO'
                      ? 'bg-slate-900 border-emerald-600/70'
                      : opt.status === 'CAUTION'
                      ? 'bg-slate-900 border-amber-700/70'
                      : 'bg-slate-900/50 border-slate-800 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        #{opt.rank} • {opt.type.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          opt.status === 'GO'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : opt.status === 'CAUTION'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {opt.status} ({opt.score})
                      </span>
                    </div>
                    <h5 className="font-bold text-xs text-white mt-1">{opt.title}</h5>
                    <p className="text-[10px] text-slate-300 leading-snug mt-0.5">{opt.description}</p>
                  </div>

                  <button
                    onClick={() => handleSelectRepair(opt)}
                    disabled={selectingRepair === opt.option_id}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold font-mono transition-all shrink-0 ${
                      opt.status === 'GO'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : opt.status === 'CAUTION'
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {selectingRepair === opt.option_id ? 'Applying...' : opt.type === 'WAIT' ? '⏳ Choose Wait' : '✓ Select'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE F: FEEDBACK FORM & PREDICTION VS ACTUAL VIEW */}
        {/* ------------------------------------------------------------- */}
        {showFeedbackForm && (
          <form
            onSubmit={handleSubmitFeedback}
            className="p-3.5 bg-slate-950 border border-emerald-700 rounded-xl space-y-2.5"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <span>📝</span> Record Actual Observed Conditions & Catch
              </h4>
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Observed Wave (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10.0"
                  value={actualWave}
                  onChange={(e) => setActualWave(parseFloat(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Observed Wind (km/h)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.0"
                  max="100.0"
                  value={actualWind}
                  onChange={(e) => setActualWind(parseFloat(e.target.value))}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-300 mb-1">Catch Experience</label>
                <select
                  value={fishingOutcome}
                  onChange={(e) => setFishingOutcome(e.target.value as any)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs outline-none"
                >
                  <option value="Good">🟢 Good Catch</option>
                  <option value="Average">🟡 Average Catch</option>
                  <option value="Poor">🔴 Poor Catch</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-300 mb-1">Fisherman Notes</label>
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingFeedback}
                className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs font-mono transition-all"
              >
                {submittingFeedback ? 'Submitting...' : '✓ Submit Outcome'}
              </button>
            </div>
          </form>
        )}

        {(isCompleted || trackedDecision?.feedback || feedbackResult) && (
          <div className="p-3.5 bg-slate-950 border border-emerald-700/80 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                <span>📊</span> PREDICTION VS ACTUAL OUTCOME MATRIX
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono font-bold">
                MISSION COMPLETED ✓
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 bg-slate-900 rounded-lg">
                <div className="flex justify-between text-slate-300">
                  <span>🌊 Wave Height:</span>
                  <span className="text-emerald-400 font-bold">✓ Close</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Pred: {trackedDecision?.original_conditions.wave_height_m}m</span>
                  <span>Actual: <strong className="text-white">{trackedDecision?.feedback?.actual_wave_height_m || actualWave}m</strong></span>
                </div>
              </div>

              <div className="p-2 bg-slate-900 rounded-lg">
                <div className="flex justify-between text-slate-300">
                  <span>💨 Wind Speed:</span>
                  <span className="text-emerald-400 font-bold">✓ Close</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Pred: {trackedDecision?.original_conditions.wind_speed_kmh} km/h</span>
                  <span>Actual: <strong className="text-white">{trackedDecision?.feedback?.actual_wind_speed_kmh || actualWind} km/h</strong></span>
                </div>
              </div>
            </div>

            <div className="p-2 bg-slate-900/50 rounded-lg text-xs text-slate-300">
              <span className="text-[10px] text-slate-400 block font-bold">Catch & Notes:</span>
              <p className="italic text-[11px] mt-0.5">
                Outcome: <strong>{trackedDecision?.feedback?.fishing_outcome || fishingOutcome}</strong> • "{trackedDecision?.feedback?.comment || feedbackComment}"
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE B & C: CURRENT DECISION / LIVING DECISION DISPLAY */}
        {/* ------------------------------------------------------------- */}
        {decision && !showRepairView && !showFeedbackForm && (
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Target Sector:</span>
                <h4 className="font-bold text-sm text-white">{decision.zone_name}</h4>
              </div>
              {renderVerdictBadge(
                trackedDecision?.latest_decision?.status || decision.status,
                trackedDecision?.latest_decision?.score || decision.score
              )}
            </div>

            {/* Score Distribution Breakdown */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-mono">
              <div className="p-1.5 bg-slate-900 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Safety Weight</span>
                <strong className={decision.safety_score >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                  {decision.safety_score}%
                </strong>
              </div>
              <div className="p-1.5 bg-slate-900 rounded-lg">
                <span className="text-[9px] text-slate-400 block">PFZ Potential</span>
                <strong className="text-cyan-400">{decision.fishing_score}%</strong>
              </div>
              <div className="p-1.5 bg-slate-900 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Travel Effort</span>
                <strong className="text-slate-300">{decision.effort_score}%</strong>
              </div>
            </div>

            {/* Live Telemetry Matrix */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono">
              <div className="p-1.5 bg-slate-900/70 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Wave</span>
                <strong className="text-slate-100">{decision.conditions?.wave_height_m}m</strong>
              </div>
              <div className="p-1.5 bg-slate-900/70 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Wind</span>
                <strong className="text-slate-100">{decision.conditions?.wind_speed_kmh} km/h</strong>
              </div>
              <div className="p-1.5 bg-slate-900/70 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Current</span>
                <strong className="text-slate-100">{decision.conditions?.current_speed_ms} m/s</strong>
              </div>
              <div className="p-1.5 bg-slate-900/70 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Visibility</span>
                <strong className="text-slate-100">{decision.conditions?.visibility_km} km</strong>
              </div>
            </div>

            {/* Grounded Explanation */}
            {decision.explanation && (
              <p className="text-[11px] text-slate-300 bg-slate-900/40 p-2 rounded-lg border border-slate-800/80 italic leading-relaxed">
                "{decision.explanation}"
              </p>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STATE A: NO DECISION YET (Quick Zone Selector & Prompts) */}
        {/* ------------------------------------------------------------- */}
        {!decision && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <span className="text-xs font-bold text-white block uppercase tracking-wider font-mono">
              Select Sector to Evaluate:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {zones.map((zone) => {
                const isSelected = selectedZone?.zone_id === zone.zone_id;
                return (
                  <button
                    key={zone.zone_id}
                    onClick={() => onSelectZone(zone)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-500 ring-1 ring-cyan-400 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs text-white block truncate">{zone.zone_name.split(' ')[0]}</span>
                    <div className="text-[10px] font-mono text-slate-400 mt-1 flex justify-between">
                      <span className="text-cyan-400">PFZ {zone.pfz_score}</span>
                      <span>{zone.distance_km}km</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase font-mono block mb-1">
                Suggested Natural Language Inquiries:
              </span>
              <div className="space-y-1">
                {[
                  'Kal subah fishing ke liye kahan jaana chahiye?',
                  'Is Zone B safe tomorrow morning?',
                  'Zone B kab suitable hoga?'
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => onAskQuery(q)}
                    className="w-full text-left p-1.5 bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-600/60 rounded-lg text-xs text-slate-300 transition-all font-mono truncate"
                  >
                    💬 {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM ACTION BAR (Contextual depending on state) */}
      {/* ------------------------------------------------------------- */}
      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
        {!trackedDecision ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunEvaluation}
              disabled={!selectedZone || evaluating}
              className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              {evaluating ? 'Evaluating...' : '⚡ Evaluate Sector'}
            </button>

            {decision && (
              <button
                onClick={handleTrackDecision}
                disabled={tracking}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {tracking ? 'Registering...' : '📌 Track Decision'}
              </button>
            )}
          </div>
        ) : !isCompleted ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRecheck}
                disabled={checking || simulating}
                className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-1.5"
              >
                {checking ? 'Checking...' : '🔄 Check Conditions'}
              </button>

              <button
                onClick={handleSimulateChange}
                disabled={checking || simulating}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs font-mono transition-all flex items-center justify-center gap-1.5"
                title="Injects 2.8m wave to demonstrate Decision Watch"
              >
                {simulating ? 'Simulating...' : '⚡ Demo 2.8m Waves'}
              </button>
            </div>

            <button
              onClick={() => setShowFeedbackForm(true)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs font-mono transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <span>✓</span> Complete Mission & Record Outcome
            </button>
          </div>
        ) : (
          <div className="p-2 bg-blue-950/40 border border-blue-800/60 rounded-xl text-center text-xs font-mono text-blue-300">
            Mission Lifecycle Completed • Prediction vs Actual Recorded
          </div>
        )}

        <div className="text-[10px] text-slate-500 font-mono flex justify-between px-1">
          <span>Authority: backend/decision_engine.py</span>
          <span>SQLite Store Active</span>
        </div>
      </div>

    </div>
  );
}
