'use client';

import { useState } from 'react';
import { NavTabType } from '@/components/Navigation/Header';
import { ZoneInfo, DecisionResult, DecisionObject, GeoLocation } from '@/lib/types';
import { evaluateDecision, trackDecision, simulateConditionChange, selectRepairOption, submitMissionFeedback, resetDemo } from '@/lib/api';

interface DemoTourBarProps {
  zones: ZoneInfo[];
  selectedZone: ZoneInfo | null;
  decision: DecisionResult | null;
  activeDecisionObject: DecisionObject | null;
  userOrigin: GeoLocation;
  language: 'en' | 'hi';
  onSelectZone: (zone: ZoneInfo) => void;
  onSetDecision: (decision: DecisionResult) => void;
  onSetActiveDecisionObject: (dec: DecisionObject) => void;
  onSelectNavTab: (tab: NavTabType) => void;
  onOpenThresholds: () => void;
  onOpenJudgeReference: () => void;
  onRefreshData: () => void;
}

export default function DemoTourBar({
  zones,
  selectedZone,
  decision,
  activeDecisionObject,
  userOrigin,
  language,
  onSelectZone,
  onSetDecision,
  onSetActiveDecisionObject,
  onSelectNavTab,
  onOpenThresholds,
  onOpenJudgeReference,
  onRefreshData,
}: DemoTourBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [tourMessage, setTourMessage] = useState<string>('Ready for SIH 2026 Presentation Tour.');

  const STEPS = [
    { num: 1, label: '1. Ask Query', desc: 'Pre-fills query & evaluates user intent' },
    { num: 2, label: '2. Multi-Zone Eval', desc: 'Deterministic GO/CAUTION/WAIT scoring' },
    { num: 3, label: '3. Track Decision', desc: 'Creates Living Decision Object in SQLite' },
    { num: 4, label: '4. Weather Change', desc: 'Simulates 2.8m adverse wave change' },
    { num: 5, label: '5. Decision Watch', desc: 'Detects impact & triggers alert' },
    { num: 6, label: '6. Safe Repairs', desc: 'Calculates verified alternative plans' },
    { num: 7, label: '7. Adopt Repair', desc: 'Applies shift +2hr & resumes watch' },
    { num: 8, label: '8. Mission Feedback', desc: 'Submits actuals & view Pred vs Actual' },
  ];

  // Step 1: Pre-fill query & open Chat
  const runStep1 = async () => {
    setIsExecuting(true);
    setTourMessage('Step 1: Navigating to Chat & evaluating natural query...');
    onSelectNavTab('chat');
    setCurrentStep(1);
    setIsExecuting(false);
  };

  // Step 2: Evaluate All Zones & select Zone B (GO)
  const runStep2 = async () => {
    setIsExecuting(true);
    setTourMessage('Step 2: Evaluating marine conditions & scoring zones...');
    try {
      const zoneB = zones.find((z) => z.zone_id === 'zone_b') || zones[1] || zones[0];
      if (zoneB) {
        onSelectZone(zoneB);
        const evalRes = await evaluateDecision({
          zone_id: zoneB.zone_id,
          origin: userOrigin,
          language: language === 'hi' ? 'hi' : 'en',
        });
        onSetDecision(evalRes);
        onSelectNavTab('decision');
        setTourMessage(`✓ Evaluated Zone B: Status ${evalRes.status} (${evalRes.score}/100)`);
      }
      setCurrentStep(2);
    } catch (err: any) {
      setTourMessage(`Step 2 error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Step 3: Track Decision into SQLite
  const runStep3 = async () => {
    setIsExecuting(true);
    setTourMessage('Step 3: Creating Living Decision Object in SQLite registry...');
    try {
      const zoneB = zones.find((z) => z.zone_id === 'zone_b') || zones[0];
      const targetDecision = decision || (await evaluateDecision({ zone_id: zoneB.zone_id, origin: userOrigin }));
      
      const res = await trackDecision({
        decision_result: targetDecision,
        zone_id: zoneB.zone_id,
        user_name: 'Captain Joseph (Demo)',
        origin: userOrigin,
      });

      onSetActiveDecisionObject(res.decision);
      onSelectNavTab('monitor');
      setTourMessage(`✓ Decision Saved: ID ${res.decision_id} (Tracking Active)`);
      setCurrentStep(3);
    } catch (err: any) {
      setTourMessage(`Step 3 error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Step 4 & 5: Simulate Weather Change & Alert
  const runStep4And5 = async () => {
    setIsExecuting(true);
    setTourMessage('Step 4 & 5: Injecting 2.8m wave change into Decision Watch...');
    try {
      let decObj = activeDecisionObject;
      if (!decObj) {
        // Create one first if missing
        const zoneB = zones.find((z) => z.zone_id === 'zone_b') || zones[0];
        const d = await evaluateDecision({ zone_id: zoneB.zone_id, origin: userOrigin });
        const tr = await trackDecision({ decision_result: d, zone_id: zoneB.zone_id, origin: userOrigin });
        decObj = tr.decision;
        onSetActiveDecisionObject(tr.decision);
      }

      const recheck = await simulateConditionChange(decObj.decision_id, { wave_height_m: 2.8 });
      setTourMessage(`🚨 ALERT: Wave exceeded limit (${recheck.previous_status} -> ${recheck.current_status}). Decision affected.`);
      onSelectNavTab('alerts');
      setCurrentStep(5);
    } catch (err: any) {
      setTourMessage(`Step 4/5 error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Step 6 & 7: Adopt verified repair
  const runStep6And7 = async () => {
    setIsExecuting(true);
    setTourMessage('Step 6 & 7: Calculating safe repairs & adopting Shift +2hr...');
    try {
      if (activeDecisionObject) {
        await selectRepairOption(activeDecisionObject.decision_id, 'opt_time_shift_2h');
        onSelectNavTab('monitor');
        setTourMessage('✓ Adopted Repair: Shift Departure +2 Hours (Verified GO status).');
      } else {
        onSelectNavTab('decision');
      }
      setCurrentStep(7);
    } catch (err: any) {
      setTourMessage(`Step 6/7 error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Step 8: Complete Mission & Feedback
  const runStep8 = async () => {
    setIsExecuting(true);
    setTourMessage('Step 8: Recording mission feedback & Prediction vs Actual comparison...');
    try {
      if (activeDecisionObject) {
        await submitMissionFeedback(activeDecisionObject.decision_id, {
          actual_wave_height_m: 1.4,
          actual_wind_speed_kmh: 14.0,
          fishing_outcome: 'Good',
          comment: 'Great catch near the thermal upwelling front. Verified GO forecast was accurate.',
        });
      }
      onSelectNavTab('feedback');
      setTourMessage('✓ Mission Completed: Prediction vs Actual Matrix generated.');
      setCurrentStep(8);
    } catch (err: any) {
      setTourMessage(`Step 8 error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleResetAll = async () => {
    setIsExecuting(true);
    setTourMessage('Resetting demo state...');
    try {
      await resetDemo();
      setCurrentStep(1);
      setTourMessage('✓ Demo reset to clean initial state.');
      onRefreshData();
    } catch (err: any) {
      setTourMessage(`Reset error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-slate-900 border-b border-slate-700/80 px-4 py-2 text-xs font-sans text-slate-200 shrink-0 shadow-md">
      <div className="flex items-center justify-between gap-3">
        
        {/* Left: Title & Step Stepper */}
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-700 to-cyan-600 rounded-lg text-white font-bold text-[11px] shadow-sm shrink-0">
            <span>🎬</span>
            <span>SIH DEMO TOUR</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {STEPS.map((step) => {
              const isActive = currentStep === step.num;
              return (
                <button
                  key={step.num}
                  disabled={isExecuting}
                  onClick={() => {
                    if (step.num === 1) runStep1();
                    else if (step.num === 2) runStep2();
                    else if (step.num === 3) runStep3();
                    else if (step.num === 4 || step.num === 5) runStep4And5();
                    else if (step.num === 6 || step.num === 7) runStep6And7();
                    else if (step.num === 8) runStep8();
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/60 shadow-sm font-semibold'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/70'
                  }`}
                  title={step.desc}
                >
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Quick Defense Tools */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenThresholds}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-amber-300 font-medium text-[11px] flex items-center gap-1 transition-colors"
            title="Adjust safety thresholds live"
          >
            <span>⚙️</span>
            <span className="hidden md:inline">Thresholds</span>
          </button>

          <button
            onClick={onOpenJudgeReference}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-cyan-300 font-medium text-[11px] flex items-center gap-1 transition-colors"
            title="View Judge Q&A Defense cheat sheet"
          >
            <span>🏛️</span>
            <span className="hidden md:inline">Judge Q&A</span>
          </button>

          <button
            onClick={handleResetAll}
            disabled={isExecuting}
            className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/70 hover:border-rose-700 text-rose-300 border border-slate-700 rounded-lg text-[11px] font-medium transition-colors"
            title="Reset demo decisions & state"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Live Tour Ticker Banner */}
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono text-cyan-200">{tourMessage}</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
          SIH 2026 Presentation Flow: Step {currentStep} of 8
        </span>
      </div>
    </div>
  );
}
