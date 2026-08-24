'use client';

import { useState } from 'react';
import { DecisionObject } from '@/lib/types';
import { recheckDecision, simulateConditionChange } from '@/lib/api';

interface TrackedDecisionsListProps {
  decisions: DecisionObject[];
  onSelectDecision: (decision: DecisionObject) => void;
  onDecisionUpdated: (updated: DecisionObject) => void;
  onRefresh: () => void;
}

export default function TrackedDecisionsList({
  decisions,
  onSelectDecision,
  onDecisionUpdated,
  onRefresh,
}: TrackedDecisionsListProps) {
  const [actionId, setActionId] = useState<string | null>(null);

  const handleQuickCheck = async (e: React.MouseEvent, decisionId: string) => {
    e.stopPropagation();
    setActionId(decisionId);
    try {
      const res = await recheckDecision(decisionId);
      onDecisionUpdated(res.decision);
    } catch (err) {
      console.error('Quick check failed', err);
    } finally {
      setActionId(null);
    }
  };

  const handleQuickSimulate = async (e: React.MouseEvent, decisionId: string) => {
    e.stopPropagation();
    setActionId(decisionId);
    try {
      const res = await simulateConditionChange(decisionId, { wave_height_m: 2.8 });
      onDecisionUpdated(res.decision);
    } catch (err) {
      console.error('Quick simulate failed', err);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between h-[540px] shadow-2xl backdrop-blur">
      <div>
        {/* Header */}
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">Living Decision Registry</h3>
            <p className="text-[11px] text-slate-400">Tracked Decision Objects ({decisions.length})</p>
          </div>
          <button
            onClick={onRefresh}
            className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-mono transition-all"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Decisions List */}
        <div className="mt-3 overflow-y-auto max-h-[430px] space-y-2.5 pr-1">
          {decisions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <span className="text-2xl block mb-2">📋</span>
              No decisions tracked yet.
              <p className="text-[11px] text-slate-400 mt-1">
                Evaluate a zone on the map or ask ORCA in chat and click <strong>[Track Decision]</strong>.
              </p>
            </div>
          ) : (
            decisions.map((dec) => {
              const origDec = dec.original_decision;
              const currentStatus = dec.latest_decision?.status || origDec.status;
              const currentScore = dec.latest_decision?.score || origDec.score;
              const isAlert = dec.lifecycle_status === 'ALERT';

              return (
                <div
                  key={dec.decision_id}
                  onClick={() => onSelectDecision(dec)}
                  className={`p-3.5 bg-slate-950/80 hover:bg-slate-950 border rounded-xl cursor-pointer transition-all shadow-md group ${
                    isAlert ? 'border-rose-700 bg-rose-950/20' : 'border-slate-800/80 hover:border-cyan-600/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">
                        {dec.decision_id}
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                          isAlert
                            ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                            : dec.lifecycle_status === 'TRACKING'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {isAlert ? '⚠️ ALERT' : dec.lifecycle_status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(dec.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {dec.mission.zone_name}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Orig: {dec.original_conditions.wave_height_m}m ➔ Now:{' '}
                        <strong className={isAlert ? 'text-rose-400' : 'text-slate-200'}>
                          {dec.latest_conditions?.wave_height_m || dec.original_conditions.wave_height_m}m
                        </strong>
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                        currentStatus === 'GO'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : currentStatus === 'CAUTION'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {currentStatus} ({currentScore})
                    </span>
                  </div>

                  {/* Quick Action Buttons on Card */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => handleQuickCheck(e, dec.decision_id)}
                      disabled={actionId === dec.decision_id}
                      className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] rounded font-mono border border-slate-700 transition-all"
                    >
                      {actionId === dec.decision_id ? 'Checking...' : '🔄 Recheck'}
                    </button>
                    <button
                      onClick={(e) => handleQuickSimulate(e, dec.decision_id)}
                      disabled={actionId === dec.decision_id}
                      className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-300 text-[10px] rounded font-mono transition-all"
                    >
                      ⚡ Demo Change
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-2.5 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between">
        <span>POST /api/decisions/.../check</span>
        <span>Living Decision Lifecycle</span>
      </div>
    </div>
  );
}
