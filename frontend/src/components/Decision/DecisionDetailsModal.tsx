'use client';

import { useState } from 'react';
import { 
  DecisionObject, 
  RecheckResponse, 
  RepairResponse, 
  RepairOption,
  FeedbackResponse,
  MissionFeedback
} from '@/lib/types';
import { 
  recheckDecision, 
  simulateConditionChange, 
  cancelDecision, 
  fetchRepairOptions, 
  selectRepairOption,
  submitMissionFeedback 
} from '@/lib/api';

interface DecisionDetailsModalProps {
  decision: DecisionObject;
  onClose: () => void;
  onDecisionUpdated: (updated: DecisionObject) => void;
}

export default function DecisionDetailsModal({
  decision,
  onClose,
  onDecisionUpdated,
}: DecisionDetailsModalProps) {
  const [checking, setChecking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [loadingRepair, setLoadingRepair] = useState(false);
  const [selectingOption, setSelectingOption] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  const [recheckResult, setRecheckResult] = useState<RecheckResponse | null>(null);
  const [repairData, setRepairData] = useState<RepairResponse | null>(null);
  const [feedbackResult, setFeedbackResult] = useState<FeedbackResponse | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Form state
  const origDec = decision.original_decision;
  const origCond = decision.original_conditions;
  const latestDec = decision.latest_decision || origDec;
  const latestCond = decision.latest_conditions || origCond;

  const [actualWave, setActualWave] = useState<number>(latestCond.wave_height_m || 1.4);
  const [actualWind, setActualWind] = useState<number>(latestCond.wind_speed_kmh || 14.0);
  const [fishingOutcome, setFishingOutcome] = useState<'Good' | 'Average' | 'Poor'>('Good');
  const [feedbackComment, setFeedbackComment] = useState<string>('Good catch at the shelf edge, sea state was manageable.');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isAlert = decision.lifecycle_status === 'ALERT' || Boolean(recheckResult?.affected);
  const isRepaired = decision.lifecycle_status === 'REPAIRED';
  const isWaiting = decision.lifecycle_status === 'WAITING';
  const isCompleted = decision.lifecycle_status === 'COMPLETED';

  const handleRecheck = async () => {
    setChecking(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await recheckDecision(decision.decision_id);
      setRecheckResult(res);
      onDecisionUpdated(res.decision);
    } catch (err: any) {
      setError(err.message || 'Recheck failed');
    } finally {
      setChecking(false);
    }
  };

  const handleSimulateChange = async () => {
    setSimulating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await simulateConditionChange(decision.decision_id, { wave_height_m: 2.8 });
      setRecheckResult(res);
      onDecisionUpdated(res.decision);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleFindRepairOptions = async () => {
    setLoadingRepair(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetchRepairOptions(decision.decision_id);
      setRepairData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate repair alternatives');
    } finally {
      setLoadingRepair(false);
    }
  };

  const handleSelectOption = async (option: RepairOption) => {
    setSelectingOption(option.option_id);
    setError(null);
    try {
      const res = await selectRepairOption(decision.decision_id, option.option_id);
      setSuccessMessage(`✓ Plan updated: ${res.selected_option.title}`);
      onDecisionUpdated(res.decision);
      setRepairData(null);
    } catch (err: any) {
      setError(err.message || 'Failed to apply repair selection');
    } finally {
      setSelectingOption(null);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    setError(null);
    try {
      const feedbackPayload: MissionFeedback = {
        actual_wave_height_m: Number(actualWave),
        actual_wind_speed_kmh: Number(actualWind),
        fishing_outcome: fishingOutcome,
        comment: feedbackComment,
      };

      const res = await submitMissionFeedback(decision.decision_id, feedbackPayload);
      setFeedbackResult(res);
      setShowFeedbackForm(false);
      setSuccessMessage('✓ Mission Completed! Outcome & prediction verification saved.');
      onDecisionUpdated(res.decision);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      const res = await cancelDecision(decision.decision_id);
      onDecisionUpdated(res.decision);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel tracking');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-5 md:p-6 shadow-2xl space-y-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono font-bold">
                {decision.decision_id}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
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
                {isCompleted ? '✓ COMPLETED' : decision.lifecycle_status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              {decision.mission.zone_name} — Living Decision Inspector
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {successMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-mono rounded-xl flex items-center gap-2">
            <span>✓</span> {successMessage}
          </div>
        )}

        {/* Phase 5 Recheck & Phase 7 Complete Actions Bar */}
        {!isCompleted && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">Mission Controls</span>
              <span className="text-[11px] text-slate-400 font-mono">
                Verified: {new Date(decision.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRecheck}
                disabled={checking || simulating || decision.lifecycle_status === 'CANCELLED'}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md font-mono flex items-center gap-1.5"
              >
                {checking ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Checking...
                  </>
                ) : (
                  <>
                    <span>🔄</span> Check
                  </>
                )}
              </button>

              <button
                onClick={handleSimulateChange}
                disabled={checking || simulating || decision.lifecycle_status === 'CANCELLED'}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md font-mono flex items-center gap-1.5"
              >
                {simulating ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <span>⚡</span> 2.8m Waves
                  </>
                )}
              </button>

              <button
                onClick={() => setShowFeedbackForm(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs font-mono transition-all shadow-md shadow-emerald-950 flex items-center gap-1.5"
              >
                <span>✓</span> Complete Mission
              </button>
            </div>
          </div>
        )}

        {/* PHASE 7: FEEDBACK FORM MODAL / DRAWER */}
        {showFeedbackForm && (
          <form
            onSubmit={handleSubmitFeedback}
            className="p-4 bg-slate-950 border border-emerald-700/80 rounded-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>📝</span> Record Mission Outcome & Observed Conditions
                </h3>
                <p className="text-[11px] text-slate-400">
                  Compare actual sea conditions and fishing catch against ORCA predictions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-300 font-medium mb-1">
                  Observed Wave Height (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10.0"
                  value={actualWave}
                  onChange={(e) => setActualWave(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl text-white font-mono text-xs outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 font-medium mb-1">
                  Observed Wind Speed (km/h)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.0"
                  max="100.0"
                  value={actualWind}
                  onChange={(e) => setActualWind(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl text-white font-mono text-xs outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 font-medium mb-1">
                  Fishing Catch Outcome
                </label>
                <select
                  value={fishingOutcome}
                  onChange={(e) => setFishingOutcome(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl text-white font-mono text-xs outline-none"
                >
                  <option value="Good">🟢 Good Catch</option>
                  <option value="Average">🟡 Average Catch</option>
                  <option value="Poor">🔴 Poor Catch</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-300 font-medium mb-1">
                Fisherman Notes / Observations (Optional)
              </label>
              <input
                type="text"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="e.g. Catch details, water clarity, or swell changes..."
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl text-white text-xs outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFeedbackForm(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingFeedback}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs font-mono transition-all flex items-center gap-1.5"
              >
                {submittingFeedback ? 'Submitting...' : '✓ Submit Outcome Feedback'}
              </button>
            </div>
          </form>
        )}

        {/* PHASE 7: PREDICTION VS ACTUAL OUTCOME VIEW (When Completed) */}
        {(isCompleted || decision.feedback || feedbackResult) && (
          <div className="p-4 bg-slate-950 border border-emerald-700/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold text-sm">📊 PREDICTION VS ACTUAL VERIFICATION</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono font-bold">
                  MISSION COMPLETED ✓
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Catch: {decision.feedback?.fishing_outcome || feedbackResult?.feedback?.fishing_outcome || 'Good'}
              </span>
            </div>

            {/* Comparison Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              
              {/* Wave Comparison */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-300">🌊 Wave Height:</span>
                  <span className="text-emerald-400 font-mono font-bold">✓ Close to prediction</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Predicted: {latestCond.wave_height_m}m</span>
                  <span>Actual: <strong className="text-white">{decision.feedback?.actual_wave_height_m || feedbackResult?.feedback?.actual_wave_height_m || actualWave}m</strong></span>
                </div>
              </div>

              {/* Wind Comparison */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-slate-300">💨 Wind Speed:</span>
                  <span className="text-emerald-400 font-mono font-bold">✓ Close to prediction</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Predicted: {latestCond.wind_speed_kmh} km/h</span>
                  <span>Actual: <strong className="text-white">{decision.feedback?.actual_wind_speed_kmh || feedbackResult?.feedback?.actual_wind_speed_kmh || actualWind} km/h</strong></span>
                </div>
              </div>

            </div>

            {/* Fisherman Observation */}
            <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-slate-300">
              <span className="text-[10px] text-slate-400 font-bold block">Fisherman Observation Note:</span>
              <p className="italic mt-0.5">
                "{decision.feedback?.comment || feedbackResult?.feedback?.comment || feedbackComment}"
              </p>
            </div>
          </div>
        )}

        {/* Change Impact Alert Banner (If Affected) */}
        {isAlert && !isCompleted && (
          <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                <span className="text-base">⚠️</span> ORIGINAL PLAN AFFECTED — SAFETY LIMIT CROSSED
              </div>
              <span className="text-[10px] bg-rose-900 text-rose-200 px-2 py-0.5 rounded font-mono font-bold">
                ALERT
              </span>
            </div>
            
            <p className="text-rose-200 leading-relaxed">
              {recheckResult?.explanation ||
                `Conditions for ${decision.mission.zone_name} have crossed safety limits. The original ${origDec.status} recommendation is no longer safe.`}
            </p>

            <div className="pt-2 border-t border-rose-800/60 flex items-center justify-between">
              <span className="text-[11px] text-rose-300 font-medium">
                ORCA can find alternative departure times or safe fishing zones:
              </span>
              <button
                onClick={handleFindRepairOptions}
                disabled={loadingRepair}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg font-mono flex items-center gap-1.5"
              >
                {loadingRepair ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Evaluating Alternatives...
                  </>
                ) : (
                  <>
                    <span>🔧</span> Find Safe Options
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* PHASE 6: REPAIR OPTIONS CARDS (When Generated) */}
        {repairData && repairData.options && repairData.options.length > 0 && !isCompleted && (
          <div className="p-4 bg-slate-950 border border-cyan-800/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>🧭</span> Safe Mission Repair Alternatives
                </h3>
                <p className="text-[11px] text-slate-400">{repairData.explanation}</p>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">
                {repairData.options.length} Candidates Evaluated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {repairData.options.map((opt) => (
                <div
                  key={opt.option_id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                    opt.status === 'GO'
                      ? 'bg-slate-900/90 border-emerald-600/60 hover:border-emerald-500 shadow-md shadow-emerald-950/40'
                      : opt.status === 'CAUTION'
                      ? 'bg-slate-900/80 border-amber-700/60'
                      : 'bg-slate-900/50 border-slate-800 opacity-80'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        #{opt.rank} • {opt.type.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
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

                    <h4 className="font-bold text-xs text-white">{opt.title}</h4>
                    <p className="text-[11px] text-slate-300 leading-snug">{opt.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handleSelectOption(opt)}
                      disabled={selectingOption === opt.option_id}
                      className={`w-full py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 ${
                        opt.status === 'GO'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                          : opt.status === 'CAUTION'
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {selectingOption === opt.option_id ? (
                        <span>Applying...</span>
                      ) : opt.type === 'WAIT' ? (
                        <span>⏳ Choose Wait</span>
                      ) : (
                        <span>✓ Select This Option</span>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Side-by-Side Old vs New Comparison Grid */}
        <div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-2">
            Living Decision State: Original vs Active Plan
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left: Original Snapshot */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">Original Plan Snapshot</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    origDec.status === 'GO'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : origDec.status === 'CAUTION'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {origDec.status} ({origDec.score}/100)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="p-1.5 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wave</span>
                  <strong className="text-slate-100">{origCond.wave_height_m}m</strong>
                </div>
                <div className="p-1.5 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wind</span>
                  <strong className="text-slate-100">{origCond.wind_speed_kmh} km/h</strong>
                </div>
                <div className="p-1.5 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">PFZ</span>
                  <strong className="text-cyan-400">{origDec.fishing_score}/100</strong>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-1 font-mono flex justify-between">
                <span>Target: {decision.original_conditions.location.name || decision.mission.zone_name}</span>
                <span>Recorded: {new Date(decision.created_at).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Right: Active Current Plan */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">Active Current Plan</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    latestDec.status === 'GO'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : latestDec.status === 'CAUTION'
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {latestDec.status} ({latestDec.score}/100)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="p-1.5 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wave</span>
                  <strong className={latestCond.wave_height_m > 2.5 ? 'text-rose-400 font-bold' : 'text-slate-100'}>
                    {latestCond.wave_height_m}m
                  </strong>
                </div>
                <div className="p-1.5 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wind</span>
                  <strong className="text-slate-100">{latestCond.wind_speed_kmh} km/h</strong>
                </div>
                <div className="p-1.5 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Departure</span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {new Date(decision.mission.planned_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-1 font-mono flex justify-between">
                <span>Sector: {decision.mission.zone_name}</span>
                <span>Verified: {new Date(decision.last_checked_at).toLocaleTimeString()}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Change History Timeline */}
        {decision.change_history && decision.change_history.length > 0 && (
          <div>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-1.5">
              Living Decision Lifecycle History ({decision.change_history.length} Events):
            </span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {decision.change_history.map((h, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                    h.action_taken === 'FEEDBACK_SUBMISSION'
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : h.action_taken
                      ? 'bg-cyan-950/40 border-cyan-800 text-cyan-300'
                      : h.affected
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-semibold block">{h.summary}</span>
                    <span className="text-[10px] opacity-75 font-mono">
                      {new Date(h.checked_at).toLocaleTimeString()} • Verdict: {h.new_status}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      h.action_taken === 'FEEDBACK_SUBMISSION'
                        ? 'bg-emerald-900 text-white'
                        : h.action_taken
                        ? 'bg-cyan-900 text-white'
                        : h.affected
                        ? 'bg-rose-900 text-white'
                        : 'bg-emerald-950 text-emerald-300'
                    }`}
                  >
                    {h.action_taken || (h.affected ? 'AFFECTED' : 'STABLE')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono rounded-xl">
            {error}
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          {!isCompleted && decision.lifecycle_status !== 'CANCELLED' ? (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-3.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-medium transition-all"
            >
              {cancelling ? 'Cancelling...' : 'Stop Tracking Decision'}
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-mono">
              {isCompleted ? 'Mission Lifecycle Finalized' : 'Tracking Inactive'}
            </span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
}
