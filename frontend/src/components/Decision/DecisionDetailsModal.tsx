'use client';

import { useState } from 'react';
import { DecisionObject } from '@/lib/types';
import { cancelDecision } from '@/lib/api';

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
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const origDec = decision.original_decision;
  const origCond = decision.original_conditions;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono">
                {decision.decision_id}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                  decision.lifecycle_status === 'TRACKING'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {decision.lifecycle_status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              {decision.mission.zone_name} — Decision Snapshot
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Original Decision Banner */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Original Verdict at Decision Time:</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-sm font-extrabold px-3 py-1 rounded-lg ${
                  origDec.status === 'GO'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : origDec.status === 'CAUTION'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}
              >
                {origDec.status} (Score {origDec.score}/100)
              </span>
            </div>
          </div>

          <div className="text-right text-xs font-mono">
            <span className="text-slate-400 block">Created:</span>
            <span className="text-slate-200">
              {new Date(decision.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Immutable Conditions Snapshot Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Immutable Conditions Snapshot at Creation:
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">[PRESERVED ORIGINAL DATA]</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Wave</span>
              <strong className="text-slate-100 font-mono text-xs">{origCond.wave_height_m}m</strong>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Wind</span>
              <strong className="text-slate-100 font-mono text-xs">{origCond.wind_speed_kmh} km/h</strong>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Current</span>
              <strong className="text-slate-100 font-mono text-xs">{origCond.current_speed_ms} m/s</strong>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] text-slate-400 block">Visibility</span>
              <strong className="text-slate-100 font-mono text-xs">{origCond.visibility_km} km</strong>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] text-slate-400 block">PFZ Score</span>
              <strong className="text-cyan-400 font-mono text-xs">{origDec.fishing_score}/100</strong>
            </div>
            <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] text-slate-400 block">SST</span>
              <strong className="text-slate-100 font-mono text-xs">{origCond.sst_celsius || 28}°C</strong>
            </div>
          </div>
        </div>

        {/* Why ORCA Recommended it */}
        <div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block mb-2">
            Why ORCA Evaluated This Verdict:
          </span>
          <ul className="space-y-1.5 text-xs">
            {origDec.reasons.map((r, i) => (
              <li
                key={i}
                className="p-2 bg-slate-950 border border-slate-800/60 rounded-xl text-slate-300 leading-relaxed"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Mission & Tracking Parameters */}
        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs space-y-1 text-slate-400 font-mono">
          <div className="flex justify-between">
            <span>User / Vessel:</span>
            <span className="text-slate-200">{decision.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Origin Port:</span>
            <span className="text-slate-200">{decision.user.origin.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Planned Departure:</span>
            <span className="text-cyan-400">{new Date(decision.mission.planned_start).toLocaleDateString()}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono rounded-xl">
            {error}
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          {decision.lifecycle_status === 'TRACKING' ? (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2 bg-rose-900/60 hover:bg-rose-800 border border-rose-700 text-rose-200 rounded-xl text-xs font-medium transition-all"
            >
              {cancelling ? 'Cancelling Tracking...' : 'Stop Tracking Decision'}
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
