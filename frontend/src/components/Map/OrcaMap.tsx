'use client';

import dynamic from 'next/dynamic';
import { ZoneInfo, BoundariesGeoJSON, GeoLocation, DecisionResult } from '@/lib/types';

interface OrcaMapProps {
  zones: ZoneInfo[];
  boundaries: BoundariesGeoJSON | null;
  selectedZone: ZoneInfo | null;
  decision: DecisionResult | null;
  userOrigin: GeoLocation;
  onSelectZone: (zone: ZoneInfo) => void;
}

const DynamicMap = dynamic(() => import('./OrcaMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 text-sm">
      <div className="flex items-center gap-2">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
        Loading Marine GIS Map Engine...
      </div>
    </div>
  ),
});

export default function OrcaMap(props: OrcaMapProps) {
  return <DynamicMap {...props} />;
}
