'use client';

import { DecisionObject } from '@/lib/types';

interface DecisionLifecycleBarProps {
  decision: DecisionObject | null;
  hasActiveDecision: boolean;
  onOpenDetails?: () => void;
}

export default function DecisionLifecycleBar({
  decision,
  hasActiveDecision,
  onOpenDetails,
}: DecisionLifecycleBarProps) {
  const isCompleted = decision?.lifecycle_status === 'COMPLETED';
  const isAlert = decision?.lifecycle_status === 'ALERT';
  const isRepaired = decision?.lifecycle_status === 'REPAIRED';
  const isWaiting = decision?.lifecycle_status === 'WAITING';
  const isTracking = Boolean(decision && decision.lifecycle_status === 'TRACKING');
  const isDecided = hasActiveDecision || Boolean(decision);

  const steps = [
    {
      id: 'decided',
      label: '1. DECIDED',
      description: 'Deterministic Verdict',
      active: isDecided,
      current: isDecided && !decision,
      color: 'emerald',
      icon: '⚡',
    },
    {
      id: 'tracking',
      label: '2. TRACKING',
      description: 'Decision Object Saved',
      active: Boolean(decision),
      current: isTracking,
      color: 'cyan',
      icon: '📌',
    },
    {
      id: 'change',
      label: '3. WATCH / CHANGE',
      description: isAlert ? 'Safety Limit Crossed' : 'Continuous Recheck',
      active: isAlert || isRepaired || isWaiting || isCompleted,
      current: isAlert,
      color: isAlert ? 'rose' : 'slate',
      icon: isAlert ? '⚠️' : '🔄',
    },
    {
      id: 'repair',
      label: '4. REPAIR / WAIT',
      description: isRepaired ? 'Mission Adopted' : isWaiting ? 'Wait in Port' : 'Safe Alternatives',
      active: isRepaired || isWaiting || isCompleted,
      current: isRepaired || isWaiting,
      color: isRepaired ? 'cyan' : isWaiting ? 'amber' : 'slate',
      icon: '🔧',
    },
    {
      id: 'remonitor',
      label: '5. RE-MONITORING',
      description: 'Active Safe Watch',
      active: isRepaired || isWaiting || isCompleted,
      current: (isRepaired || isWaiting) && !isCompleted,
      color: 'teal',
      icon: '👁️',
    },
    {
      id: 'completed',
      label: '6. COMPLETED',
      description: 'Prediction vs Actual',
      active: isCompleted,
      current: isCompleted,
      color: 'blue',
      icon: '✓',
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Living Decision Lifecycle Pipeline
          </h3>
        </div>
        
        {decision && (
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              Active Mission: <strong className="text-white font-bold">{decision.mission.zone_name}</strong> ({decision.decision_id})
            </span>
            {onOpenDetails && (
              <button
                onClick={onOpenDetails}
                className="text-[10px] px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 font-mono font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
              >
                <span>🔍</span> Open Mission Inspector
              </button>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Pipeline Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {steps.map((s) => {
          const isCurrent = s.current;
          const isActive = s.active;

          return (
            <div
              key={s.id}
              className={`p-2.5 rounded-xl border transition-all relative overflow-hidden ${
                isCurrent
                  ? s.id === 'change' && isAlert
                    ? 'bg-rose-950/70 border-rose-600 text-rose-200 shadow-md shadow-rose-950/50 animate-pulse'
                    : 'bg-cyan-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950/50'
                  : isActive
                  ? 'bg-slate-950/80 border-slate-700 text-slate-300'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-600 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono truncate">{s.label}</span>
                <span className="text-xs">{s.icon}</span>
              </div>
              <p className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                {s.description}
              </p>

              <div
                className={`h-0.5 w-full mt-2 rounded-full ${
                  isCurrent
                    ? s.id === 'change' && isAlert ? 'bg-rose-500' : 'bg-cyan-400'
                    : isActive
                    ? 'bg-emerald-500/80'
                    : 'bg-slate-800'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
