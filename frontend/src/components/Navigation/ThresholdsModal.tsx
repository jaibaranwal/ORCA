'use client';

import { useState, useEffect } from 'react';
import { ThresholdsConfig } from '@/lib/types';
import { fetchThresholdsConfig, saveThresholdsConfig, resetThresholdsConfig } from '@/lib/api';

interface ThresholdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThresholdsUpdated?: () => void;
}

export default function ThresholdsModal({ isOpen, onClose, onThresholdsUpdated }: ThresholdsModalProps) {
  const [config, setConfig] = useState<ThresholdsConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchThresholdsConfig()
        .then((data) => setConfig(data))
        .catch((err) => setStatusMsg(`Error loading: ${err.message}`))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await saveThresholdsConfig(config);
      setConfig(res.config);
      setStatusMsg('✓ Safety thresholds saved and active in decision engine.');
      if (onThresholdsUpdated) onThresholdsUpdated();
    } catch (err: any) {
      setStatusMsg(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await resetThresholdsConfig();
      setConfig(res.config);
      setStatusMsg('✓ Thresholds reset to marine regulatory standard defaults.');
      if (onThresholdsUpdated) onThresholdsUpdated();
    } catch (err: any) {
      setStatusMsg(`Failed to reset: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[4500] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl text-xs font-sans text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
              <span>⚙️</span> Dynamic Safety Thresholds & Weight Tuner
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live operational configuration for maritime safety parameters (Section 13)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        {statusMsg && (
          <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-700 text-blue-200 text-xs">
            {statusMsg}
          </div>
        )}

        {loading || !config ? (
          <div className="py-8 text-center text-slate-400">Loading thresholds...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3.5">
            
            {/* Safety Limits Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Wave Height Safe Limit (&le; GO)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    value={config.wave_height_safe_m}
                    onChange={(e) => setConfig({ ...config, wave_height_safe_m: parseFloat(e.target.value) || 1.5 })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:border-cyan-400"
                  />
                  <span className="text-slate-400">m</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Wave Height Caution (&le; CAUTION)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="6.0"
                    value={config.wave_height_caution_m}
                    onChange={(e) => setConfig({ ...config, wave_height_caution_m: parseFloat(e.target.value) || 2.5 })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:border-cyan-400"
                  />
                  <span className="text-slate-400">m</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Wind Speed Safe Limit (&le; GO)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    min="10"
                    max="80"
                    value={config.wind_speed_safe_kmh}
                    onChange={(e) => setConfig({ ...config, wind_speed_safe_kmh: parseFloat(e.target.value) || 30 })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:border-cyan-400"
                  />
                  <span className="text-slate-400">km/h</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Wind Speed Caution Limit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    min="20"
                    max="100"
                    value={config.wind_speed_caution_kmh}
                    onChange={(e) => setConfig({ ...config, wind_speed_caution_kmh: parseFloat(e.target.value) || 50 })}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:border-cyan-400"
                  />
                  <span className="text-slate-400">km/h</span>
                </div>
              </div>
            </div>

            {/* Scoring Thresholds */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Score GO Threshold (&ge; GO verdict)
                </label>
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={config.score_go_threshold}
                  onChange={(e) => setConfig({ ...config, score_go_threshold: parseInt(e.target.value) || 75 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Score Caution Threshold (&ge; CAUTION)
                </label>
                <input
                  type="number"
                  min="20"
                  max="70"
                  value={config.score_caution_threshold}
                  onChange={(e) => setConfig({ ...config, score_caution_threshold: parseInt(e.target.value) || 50 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Weights Distribution */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Composite Score Weight Distribution (Total = 1.0)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Safety Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="0.8"
                    value={config.weights.safety}
                    onChange={(e) => setConfig({
                      ...config,
                      weights: { ...config.weights, safety: parseFloat(e.target.value) || 0.5 }
                    })}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Fishing (PFZ) Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="0.8"
                    value={config.weights.fishing}
                    onChange={(e) => setConfig({
                      ...config,
                      weights: { ...config.weights, fishing: parseFloat(e.target.value) || 0.3 }
                    })}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Effort/Dist Weight</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    max="0.5"
                    value={config.weights.effort}
                    onChange={(e) => setConfig({
                      ...config,
                      weights: { ...config.weights, effort: parseFloat(e.target.value) || 0.2 }
                    })}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
              >
                Reset to Standard Defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-xs transition-colors"
                >
                  {saving ? 'Saving...' : 'Apply Live Thresholds'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
