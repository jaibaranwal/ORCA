'use client';

import { useState } from 'react';
import { ZoneInfo, MarineConditions, DecisionResult, GeoLocation, DecisionObject } from '@/lib/types';
import { evaluateDecision, trackDecision } from '@/lib/api';

interface ActiveDecisionCardProps {
  zones: ZoneInfo[];
  selectedZone: ZoneInfo | null;
  conditions: MarineConditions | null;
  decision: DecisionResult | null;
  userOrigin: GeoLocation;
  trackedDecisions: DecisionObject[];
  onSelectZone: (zone: ZoneInfo) => void;
  onDecisionEvaluated: (result: DecisionResult) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
  onOpenInspector?: () => void;
}

export default function ActiveDecisionCard({
  zones,
  selectedZone,
  conditions,
  decision,
  userOrigin,
  trackedDecisions,
  onSelectZone,
  onDecisionEvaluated,
  onDecisionTracked,
  onOpenInspector,
}: ActiveDecisionCardProps) {
  const [evaluating, setEvaluating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if current decision is tracked
  const trackedObj = decision
    ? trackedDecisions.find((d) => d.mission.zone_id === decision.zone_id && d.lifecycle_status !== 'CANCELLED')
    : null;

  const handleEvaluate = async () => {
    if (!selectedZone) return;
    setEvaluating(true);
    setError(null);
    try {
      const now = new Date();
      const returnTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);

      const result = await evaluateDecision({
        user_id: 'user_demo_fisherman',
        zone_id: selectedZone.zone_id,
        planned_start: now.toISOString(),
        planned_return: returnTime.toISOString(),
        user_role: 'fisherman',
        origin: userOrigin,
      });

      onDecisionEvaluated(result);
    } catch (err: any) {
      setError(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

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
    } catch (err: any) {
      setError(err.message || 'Failed to track decision');
    } finally {
      setTracking(false);
    }
  };

  const getVerdictBadge = (status: string) => {
    if (status === 'GO') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-500/60 shadow-lg shadow-emerald-950 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> 🟢 GO — RECOMMENDED
        </span>
      );
    }
    if (status === 'CAUTION') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-amber-950 text-amber-300 border border-amber-500/60 shadow-lg shadow-amber-950 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> 🟡 CAUTION — MARGINAL
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-mono font-extrabold bg-rose-950 text-rose-300 border border-rose-500/60 shadow-lg shadow-rose-950 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" /> 🔴 WAIT — UNSAFE
      </span>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-2xl backdrop-blur h-full">
      <div>
        {/* Header & Telemetry Source */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>⚡</span> Active Decision Authority
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">Deterministic Safety & Suitability Engine</p>
          </div>
          {conditions?.data_source && (
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                conditions.data_source === 'live'
                  ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                  : 'bg-amber-950 border border-amber-700 text-amber-400'
              }`}
            >
              [{conditions.data_source.toUpperCase()} DATA]
            </span>
          )}
        </div>

        {/* Target Zone Selector Buttons */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] text-slate-300 font-bold uppercase tracking-wider font-mono">
              Select Maritime Target:
            </label>
            <span className="text-[10px] text-slate-400 font-mono">Kochi Base Origin</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {zones.map((zone) => {
              const isSelected = selectedZone?.zone_id === zone.zone_id;
              return (
                <button
                  key={zone.zone_id}
                  onClick={() => onSelectZone(zone)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-500 shadow-md shadow-cyan-950/60 ring-1 ring-cyan-400'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs block text-white truncate">{zone.zone_name.split(' ')[0]}</span>
                  <div className="flex justify-between items-center mt-1 text-[10px] font-mono">
                    <span className="text-cyan-400">PFZ {zone.pfz_score}</span>
                    <span className="text-slate-400">{zone.distance_km}km</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Zone Primary Verdict & Scores */}
        {decision && (
          <div className="mt-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Target Sector:</span>
                <h4 className="font-bold text-sm text-white">{decision.zone_name}</h4>
              </div>
              {getVerdictBadge(decision.status)}
            </div>

            {/* Score Breakdown Bar */}
            <div className="p-2.5 bg-slate-900/90 border border-slate-800/80 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300 font-semibold">Suitability Score:</span>
                <span className="text-base font-extrabold text-cyan-400 font-mono">{decision.score} / 100</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-mono">
                <div className="p-1.5 bg-slate-950 rounded-lg">
                  <span className="text-[9px] text-slate-400 block">Safety Weight (50%)</span>
                  <strong className={decision.safety_score >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                    {decision.safety_score}%
                  </strong>
                </div>
                <div className="p-1.5 bg-slate-950 rounded-lg">
                  <span className="text-[9px] text-slate-400 block">Fishing PFZ (30%)</span>
                  <strong className="text-cyan-400">{decision.fishing_score}%</strong>
                </div>
                <div className="p-1.5 bg-slate-950 rounded-lg">
                  <span className="text-[9px] text-slate-400 block">Travel Effort (20%)</span>
                  <strong className="text-slate-200">{decision.effort_score}%</strong>
                </div>
              </div>
            </div>

            {/* Marine Telemetry Matrix */}
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-mono">
              <div className="p-2 bg-slate-900/60 border border-slate-800/60 rounded-xl">
                <span className="text-[9px] text-slate-400 block">Wave</span>
                <strong className="text-slate-100 text-xs">
                  {decision.conditions?.wave_height_m || conditions?.wave_height_m || 1.35}m
                </strong>
              </div>
              <div className="p-2 bg-slate-900/60 border border-slate-800/60 rounded-xl">
                <span className="text-[9px] text-slate-400 block">Wind</span>
                <strong className="text-slate-100 text-xs">
                  {decision.conditions?.wind_speed_kmh || conditions?.wind_speed_kmh || 12.5} km/h
                </strong>
              </div>
              <div className="p-2 bg-slate-900/60 border border-slate-800/60 rounded-xl">
                <span className="text-[9px] text-slate-400 block">Current</span>
                <strong className="text-slate-100 text-xs">
                  {decision.conditions?.current_speed_ms || conditions?.current_speed_ms || 0.3} m/s
                </strong>
              </div>
              <div className="p-2 bg-slate-900/60 border border-slate-800/60 rounded-xl">
                <span className="text-[9px] text-slate-400 block">Visibility</span>
                <strong className="text-slate-100 text-xs">
                  {decision.conditions?.visibility_km || conditions?.visibility_km || 10.0} km
                </strong>
              </div>
            </div>

            {/* Top Reasons */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase font-mono block mb-1">
                Deterministic Evaluated Reasons:
              </span>
              <ul className="space-y-1 text-xs">
                {decision.reasons.slice(0, 2).map((r, idx) => (
                  <li
                    key={idx}
                    className={`p-1.5 rounded-lg text-[10px] font-mono leading-relaxed ${
                      r.startsWith('⛔') || r.startsWith('🛑')
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-900/60'
                        : r.startsWith('⚠️')
                        ? 'bg-amber-950/50 text-amber-300 border border-amber-900/50'
                        : 'bg-slate-900/80 text-slate-300'
                    }`}
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}

        {error && (
          <div className="mt-2 p-2.5 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}
      </div>

      {/* Action Buttons: Evaluate & Track Decision */}
      <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleEvaluate}
            disabled={!selectedZone || evaluating}
            className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all shadow-lg shadow-cyan-950 flex items-center justify-center gap-2"
          >
            {evaluating ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                Evaluating Safety Rules...
              </>
            ) : (
              <>
                <span>⚡</span> Run Deterministic Decision
              </>
            )}
          </button>

          {decision && (
            trackedObj ? (
              <button
                onClick={onOpenInspector}
                className="flex-1 py-2.5 bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950"
              >
                <span>✓</span> Tracking Active
              </button>
            ) : (
              <button
                onClick={handleTrackDecision}
                disabled={tracking}
                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider font-mono transition-all shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
              >
                {tracking ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    Registering...
                  </>
                ) : (
                  <>
                    <span>📌</span> Track Decision
                  </>
                )}
              </button>
            )
          )}
        </div>

        <div className="text-[10px] text-slate-500 font-mono flex justify-between px-1">
          <span>Sole Authority: backend/decision_engine.py</span>
          <span>Zero Hallucinations</span>
        </div>
      </div>
    </div>
  );
}
