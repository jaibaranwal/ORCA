'use client';

import { useState } from 'react';
import { DecisionObject } from '@/lib/types';
import { recheckDecision, simulateConditionChange } from '@/lib/api';

interface MissionRegistryProps {
  decisions: DecisionObject[];
  onSelectDecision: (decision: DecisionObject) => void;
  onDecisionUpdated: (updated: DecisionObject) => void;
  onRefresh: () => void;
}

export default function MissionRegistry({
  decisions,
  onSelectDecision,
  onDecisionUpdated,
  onRefresh,
}: MissionRegistryProps) {
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
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-2xl backdrop-blur h-full">
      <div>
        {/* Header */}
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>📋</span> Living Mission Registry
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Persisted Decision Objects ({decisions.length} Active in SQLite)
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-mono transition-all flex items-center gap-1"
          >
            <span>↻</span> Refresh
          </button>
        </div>

        {/* Decisions List */}
        <div className="mt-3 overflow-y-auto max-h-[460px] space-y-2.5 pr-1">
          {decisions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              <span className="text-3xl block mb-2 opacity-50">🧭</span>
              <strong className="text-slate-300 block mb-1">No Active Tracked Missions</strong>
              <p className="text-[11px] text-slate-400">
                Select a zone on the map or ask ORCA and click <strong>[Track Decision]</strong>.
              </p>
            </div>
          ) : (
            decisions.map((dec) => {
              const origDec = dec.original_decision;
              const currentStatus = dec.latest_decision?.status || origDec.status;
              const currentScore = dec.latest_decision?.score || origDec.score;
              const isAlert = dec.lifecycle_status === 'ALERT';
              const isRepaired = dec.lifecycle_status === 'REPAIRED';
              const isCompleted = dec.lifecycle_status === 'COMPLETED';

              return (
                <div
                  key={dec.decision_id}
                  onClick={() => onSelectDecision(dec)}
                  className={`p-3.5 bg-slate-950/90 hover:bg-slate-950 border rounded-xl cursor-pointer transition-all shadow-md group ${
                    isCompleted
                      ? 'border-blue-800/80 bg-blue-950/20'
                      : isAlert
                      ? 'border-rose-600 bg-rose-950/25 ring-1 ring-rose-500/40'
                      : isRepaired
                      ? 'border-cyan-700/80 bg-cyan-950/20'
                      : 'border-slate-800/80 hover:border-cyan-600/60'
                  }`}
                >
                  {/* Top Bar: ID & Lifecycle Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">
                        {dec.decision_id}
                      </span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                          isCompleted
                            ? 'bg-blue-950 text-blue-300 border border-blue-700'
                            : isAlert
                            ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                            : isRepaired
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                            : dec.lifecycle_status === 'TRACKING'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {isCompleted ? '✓ COMPLETED' : isAlert ? '⚠️ ALERT' : isRepaired ? '✓ REPAIRED' : dec.lifecycle_status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(dec.last_checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Main Zone & Verdict Comparison */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {dec.mission.zone_name}
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>Original: <strong className="text-slate-200">{origDec.status} ({origDec.score})</strong></span>
                        <span className="mx-1">•</span>
                        <span>Current: <strong className={isAlert ? 'text-rose-400' : 'text-emerald-400'}>{currentStatus} ({currentScore})</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      {isAlert ? (
                        <span className="px-2.5 py-1 bg-rose-900/80 text-rose-200 text-[10px] font-bold font-mono rounded-lg border border-rose-700 animate-pulse">
                          REVIEW CHANGE ➔
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2.5 py-1 bg-blue-950 text-blue-300 text-[10px] font-bold font-mono rounded-lg border border-blue-800">
                          VIEW OUTCOME
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-900 text-cyan-300 text-[10px] font-bold font-mono rounded-lg border border-slate-800">
                          OPEN MISSION
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Watch Triggers */}
                  {!isCompleted && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleQuickCheck(e, dec.decision_id)}
                        disabled={actionId === dec.decision_id}
                        className="px-2.5 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] rounded font-mono border border-slate-700 transition-all"
                      >
                        {actionId === dec.decision_id ? 'Checking...' : '🔄 Recheck'}
                      </button>
                      <button
                        onClick={(e) => handleQuickSimulate(e, dec.decision_id)}
                        disabled={actionId === dec.decision_id}
                        className="px-2.5 py-0.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-300 text-[10px] rounded font-mono transition-all"
                        title="Simulates adverse wave height of 2.8m for SIH judging flow"
                      >
                        ⚡ 2.8m Waves Demo
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between">
        <span>SQLite Persistent Storage</span>
        <span>Living Decision Lifecycle</span>
      </div>
    </div>
  );
}
