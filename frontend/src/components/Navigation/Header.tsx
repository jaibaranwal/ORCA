'use client';

import { GeoLocation } from '@/lib/types';

interface HeaderProps {
  userOrigin: GeoLocation;
  onResetDemo: () => void;
  onOpenChat: () => void;
  trackedCount: number;
}

export default function Header({
  userOrigin,
  onResetDemo,
  onOpenChat,
  trackedCount,
}: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur px-5 py-3 flex items-center justify-between sticky top-0 z-50">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xl shadow-md">
          🐋
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-wider text-white uppercase font-mono">
              ORCA
            </h1>
            <span className="text-xs text-cyan-400 font-semibold font-sans">
              Marine Decision Intelligence
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Living Marine Decision Engine • Base: {userOrigin.name || 'Kochi Port'}
          </p>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="flex items-center gap-2.5 text-xs font-mono">
        <button
          onClick={onOpenChat}
          className="px-3.5 py-1.5 bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-md shadow-cyan-950 flex items-center gap-1.5"
        >
          <span>💬</span> Ask ORCA
        </button>

        <button
          onClick={onResetDemo}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all"
          title="Reset active demo decisions in SQLite"
        >
          ↻ Reset State
        </button>
      </div>
    </header>
  );
}
