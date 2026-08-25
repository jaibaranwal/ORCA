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
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-5 flex items-center justify-between sticky top-0 z-50">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2v20m0-20l-4 4m4-4l4 4M4 12h16" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-white tracking-tight">ORCA</span>
            <span className="text-xs text-slate-400 font-normal">Marine Decision Support</span>
          </div>
        </div>
      </div>

      {/* Center/Right Status & Controls */}
      <div className="flex items-center gap-3 text-xs">
        {/* Active Vessel & Base */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800/80 border border-slate-700/60 rounded-md text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-400">Vessel Base:</span>
          <span className="font-medium text-white">{userOrigin.name || 'Kochi Port'}</span>
        </div>

        {/* Language Toggle */}
        <button
          onClick={onToggleLanguage}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-slate-200 font-medium transition-colors"
        >
          {language === 'en' ? 'English' : 'हिंदी'}
        </button>

        {/* Demo Reset */}
        <button
          onClick={onResetDemo}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-md font-medium transition-colors"
        >
          Reset Demo
        </button>
      </div>
    </header>
  );
}
