'use client';

import { useState } from 'react';
import { DecisionObject, RecheckResponse } from '@/lib/types';
import { recheckDecision, simulateConditionChange, cancelDecision } from '@/lib/api';

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
  const [cancelling, setCancelling] = useState(false);
  const [recheckResult, setRecheckResult] = useState<RecheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const origDec = decision.original_decision;
  const origCond = decision.original_conditions;
  const latestDec = decision.latest_decision || origDec;
  const latestCond = decision.latest_conditions || origCond;

  const handleRecheck = async () => {
    setChecking(true);
    setError(null);
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
    try {
      // Injects simulated 2.8m wave height through real decision engine
      const res = await simulateConditionChange(decision.decision_id, { wave_height_m: 2.8 });
      setRecheckResult(res);
      onDecisionUpdated(res.decision);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setSimulating(false);
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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-5 md:p-6 shadow-2xl space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono font-bold">
                {decision.decision_id}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                  decision.lifecycle_status === 'ALERT'
                    ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                    : decision.lifecycle_status === 'TRACKING'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {decision.lifecycle_status}
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

        {/* Phase 5 Recheck Actions Bar */}
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-white block">Decision Watch Trigger</span>
            <span className="text-[11px] text-slate-400 font-mono">
              Last Verified: {new Date(decision.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecheck}
              disabled={checking || simulating || decision.lifecycle_status === 'CANCELLED'}
              className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-cyan-950 flex items-center gap-1.5 font-mono"
            >
              {checking ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Rechecking...
                </>
              ) : (
                <>
                  <span>🔄</span> Check Conditions Now
                </>
              )}
            </button>

            <button
              onClick={handleSimulateChange}
              disabled={checking || simulating || decision.lifecycle_status === 'CANCELLED'}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 font-mono"
              title="Injects 2.8m waves through real decision engine for SIH Demo"
            >
              {simulating ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Simulating...
                </>
              ) : (
                <>
                  <span>⚡</span> Simulate Change (2.8m Waves)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Change Impact Alert Banner (If Affected) */}
        {(decision.lifecycle_status === 'ALERT' || recheckResult?.affected) && (
          <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
              <span className="text-base">⚠️</span> DECISION IMPACT DETECTED — ACTION REQUIRED
            </div>
            <p className="text-rose-200 leading-relaxed">
              {recheckResult?.explanation ||
                `Conditions for ${decision.mission.zone_name} have crossed safety limits. The original ${origDec.status} recommendation is no longer safe.`}
            </p>

            {/* Changed Factors Details */}
            {recheckResult?.changed_factors && recheckResult.changed_factors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-rose-800/60 space-y-1 font-mono text-[11px]">
                {recheckResult.changed_factors.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between text-rose-300">
                    <span>• {f.factor}:</span>
                    <span>
                      {f.previous_value} ➔ <strong className="text-white underline">{f.current_value}</strong> ({f.impact})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Side-by-Side Old vs New Comparison Grid */}
        <div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-2">
            Living Decision State: Original vs Latest Recheck
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left: Original Snapshot */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">Original Decision Snapshot</span>
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

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wave</span>
                  <strong className="text-slate-100">{origCond.wave_height_m}m</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wind</span>
                  <strong className="text-slate-100">{origCond.wind_speed_kmh} km/h</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">PFZ</span>
                  <strong className="text-cyan-400">{origDec.fishing_score}/100</strong>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-1">
                <span>Recorded: {new Date(decision.created_at).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Right: Latest Re-evaluation */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">Latest Re-evaluation</span>
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

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wave</span>
                  <strong className={latestCond.wave_height_m > 2.5 ? 'text-rose-400 font-bold' : 'text-slate-100'}>
                    {latestCond.wave_height_m}m
                  </strong>
                </div>
                <div className="p-2 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Wind</span>
                  <strong className="text-slate-100">{latestCond.wind_speed_kmh} km/h</strong>
                </div>
                <div className="p-2 bg-slate-900 rounded">
                  <span className="text-[10px] text-slate-400 block">Data Source</span>
                  <span className="text-[10px] text-cyan-400 font-mono uppercase">{latestCond.data_source}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-1">
                <span>Verified: {new Date(decision.last_checked_at).toLocaleTimeString()}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Change History Timeline */}
        {decision.change_history && decision.change_history.length > 0 && (
          <div>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-2">
              Verification & Change History ({decision.change_history.length} Rechecks Logged):
            </span>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {decision.change_history.map((h, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                    h.affected
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-semibold block">{h.summary}</span>
                    <span className="text-[10px] opacity-75 font-mono">
                      {new Date(h.checked_at).toLocaleTimeString()} • Verdict: {h.new_status} (Score {h.new_score})
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      h.affected ? 'bg-rose-900 text-white' : 'bg-emerald-950 text-emerald-300'
                    }`}
                  >
                    {h.affected ? 'AFFECTED' : 'STABLE'}
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
          {decision.lifecycle_status !== 'CANCELLED' ? (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-3.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-medium transition-all"
            >
              {cancelling ? 'Cancelling...' : 'Stop Tracking Decision'}
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-mono">Tracking Inactive</span>
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
