'use client';

import { useState } from 'react';
import { ZoneInfo, MarineConditions, DecisionResult, GeoLocation, DecisionObject } from '@/lib/types';
import { evaluateDecision, trackDecision } from '@/lib/api';

interface DecisionPanelProps {
  zones: ZoneInfo[];
  selectedZone: ZoneInfo | null;
  conditions: MarineConditions | null;
  decision: DecisionResult | null;
  userOrigin: GeoLocation;
  trackedDecisions: DecisionObject[];
  onSelectZone: (zone: ZoneInfo) => void;
  onDecisionEvaluated: (result: DecisionResult) => void;
  onDecisionTracked: (tracked: DecisionObject) => void;
}

export default function DecisionPanel({
  zones,
  selectedZone,
  conditions,
  decision,
  userOrigin,
  trackedDecisions,
  onSelectZone,
  onDecisionEvaluated,
  onDecisionTracked,
}: DecisionPanelProps) {
  const [evaluating, setEvaluating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackMessage, setTrackMessage] = useState<string | null>(null);

  // Check if current decision is already tracked
  const isAlreadyTracked = Boolean(
    decision && trackedDecisions.some((d) => d.mission.zone_id === decision.zone_id && d.lifecycle_status === 'TRACKING')
  );

  const handleEvaluate = async () => {
    if (!selectedZone) return;
    setEvaluating(true);
    setError(null);
    setTrackMessage(null);

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
    setTrackMessage(null);

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
      setTrackMessage(`✓ Decision registered as ${res.decision_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to track decision');
    } finally {
      setTracking(false);
    }
  };

  const getStatusBadge = (status: 'GO' | 'CAUTION' | 'WAIT') => {
    switch (status) {
      case 'GO':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-lg shadow-emerald-950">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 🟢 GO — RECOMMENDED
          </span>
        );
      case 'CAUTION':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-lg shadow-amber-950">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> 🟡 CAUTION — MARGINAL
          </span>
        );
      case 'WAIT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-lg shadow-rose-950">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> 🔴 WAIT — UNSAFE
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between h-[540px] shadow-2xl backdrop-blur">
      <div className="overflow-y-auto pr-1">
        {/* Header and Zone Selector */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-xs">Deterministic Decision Engine</h3>
            <p className="text-[10px] text-slate-400">Rule-based Safety & Fishing Suitability</p>
          </div>
          {conditions?.data_source && (
            <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
              conditions.data_source === 'live' 
                ? 'bg-emerald-950 border border-emerald-700 text-emerald-400' 
                : 'bg-amber-950 border border-amber-700 text-amber-400'
            }`}>
              [{conditions.data_source.toUpperCase()} DATA]
            </span>
          )}
        </div>

        {/* Zone Selector Buttons */}
        <div className="mt-2.5">
          <label className="text-[10px] text-slate-400 font-medium block mb-1">Select Target Marine Sector:</label>
          <div className="grid grid-cols-3 gap-1.5">
            {zones.map((zone) => {
              const isSelected = selectedZone?.zone_id === zone.zone_id;
              return (
                <button
                  key={zone.zone_id}
                  onClick={() => onSelectZone(zone)}
                  className={`p-1.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-cyan-950/80 border-cyan-500 shadow-md shadow-cyan-950/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="font-semibold text-xs block text-white truncate">{zone.zone_name.split(' ')[0]}</span>
                  <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">PFZ: {zone.pfz_score}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Zone Quick Metrics */}
        {selectedZone && (
          <div className="mt-2.5 p-2.5 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Target Area:</span>
              <span className="text-white font-semibold">{selectedZone.zone_name}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-800/60 text-center">
              <div className="p-1 bg-slate-900/60 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Waves</span>
                <span className="text-xs font-bold text-slate-100 font-mono">
                  {conditions?.wave_height_m ? `${conditions.wave_height_m}m` : '1.4m'}
                </span>
              </div>
              <div className="p-1 bg-slate-900/60 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Wind</span>
                <span className="text-xs font-bold text-slate-100 font-mono">
                  {conditions?.wind_speed_kmh ? `${conditions.wind_speed_kmh} km/h` : '12 km/h'}
                </span>
              </div>
              <div className="p-1 bg-slate-900/60 rounded-lg">
                <span className="text-[9px] text-slate-400 block">Distance</span>
                <span className="text-xs font-bold text-cyan-400 font-mono">
                  {selectedZone.distance_km} km
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Evaluate Action Button */}
        <button
          onClick={handleEvaluate}
          disabled={!selectedZone || evaluating}
          className="mt-2.5 w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-950 flex items-center justify-center gap-2"
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

        {error && (
          <div className="mt-2 p-2 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-[11px] font-mono">
            {error}
          </div>
        )}

        {/* Decision Output Card */}
        {decision && (
          <div className="mt-2.5 p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Verdict</span>
              {getStatusBadge(decision.status)}
            </div>

            {/* Score Breakdown Bar */}
            <div className="space-y-1 pt-1 border-t border-slate-800/80">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Score:</span>
                <span className="font-bold text-cyan-400">{decision.score} / 100</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 font-mono text-center">
                <div className="p-1 bg-slate-900 rounded">
                  <span>Safety: </span>
                  <strong className={decision.safety_score >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                    {decision.safety_score}%
                  </strong>
                </div>
                <div className="p-1 bg-slate-900 rounded">
                  <span>PFZ: </span>
                  <strong className="text-sky-400">{decision.fishing_score}%</strong>
                </div>
                <div className="p-1 bg-slate-900 rounded">
                  <span>Effort: </span>
                  <strong className="text-slate-200">{decision.effort_score}%</strong>
                </div>
              </div>
            </div>

            {/* Reasons List */}
            <div className="pt-1 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-400 font-semibold block mb-1">Key Factors:</span>
              <ul className="space-y-1 text-xs">
                {decision.reasons.slice(0, 3).map((r, i) => (
                  <li
                    key={i}
                    className={`p-1.5 rounded text-[10px] leading-relaxed ${
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

            {/* PHASE 4: TRACK DECISION BUTTON */}
            <div className="pt-2 border-t border-slate-800/80">
              {isAlreadyTracked ? (
                <div className="w-full py-2 bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md font-mono">
                  <span>✓</span> Decision Registered & Tracked
                </div>
              ) : (
                <button
                  onClick={handleTrackDecision}
                  disabled={tracking}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
                >
                  {tracking ? (
                    <>
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                      Creating Decision Object...
                    </>
                  ) : (
                    <>
                      <span>📌</span> Track Decision
                    </>
                  )}
                </button>
              )}

              {trackMessage && (
                <p className="text-[10px] text-emerald-400 mt-1.5 text-center font-mono">{trackMessage}</p>
              )}
            </div>

          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800 text-[9px] text-slate-500 font-mono flex justify-between">
        <span>POST /api/decisions</span>
        <span>Living Decision Lifecycle</span>
      </div>
    </div>
  );
}
