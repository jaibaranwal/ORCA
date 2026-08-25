'use client';

import { GeoLocation } from '@/lib/types';

interface HeaderProps {
  userOrigin: GeoLocation;
  language: 'en' | 'hi';
  onToggleLanguage: () => void;
  onResetDemo: () => void;
}

export default function Header({
  userOrigin,
  language,
  onToggleLanguage,
  onResetDemo,
}: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900 px-5 py-2.5 flex items-center justify-between sticky top-0 z-50">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold text-lg">
          ⚓
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm tracking-wide text-white uppercase font-mono">
              ORCA
            </h1>
            <span className="text-xs text-slate-400 font-medium">
              Marine Decision Support System
            </span>
          </div>
        </div>
      </div>

      {/* Operational Selectors & Actions */}
      <div className="flex items-center gap-3 text-xs font-mono">
        {/* User Role & Base */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Role: Fisherman</span>
          <span className="text-slate-600">|</span>
          <span>Base: {userOrigin.name || 'Kochi Port'}</span>
        </div>

        {/* Language Toggle */}
        <button
          onClick={onToggleLanguage}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 text-[11px] font-bold transition-all"
        >
          🌐 {language.toUpperCase()}
        </button>

        {/* Reset Demo State */}
        <button
          onClick={onResetDemo}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] transition-all"
          title="Reset decisions in SQLite for fresh demo"
        >
          ↻ Reset
        </button>
      </div>
    </header>
  );
}
