'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ZoneInfo, BoundariesGeoJSON, GeoLocation, DecisionResult } from '@/lib/types';

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const userPortIcon = L.divIcon({
  className: 'custom-port-icon',
  html: `<div style="background-color: #06b6d4; border: 2px solid white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(6, 182, 212, 0.8); font-size: 13px;">⚓</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destinationIcon = L.divIcon({
  className: 'custom-dest-icon',
  html: `<div style="background-color: #10b981; border: 2px solid white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(16, 185, 129, 0.8); font-size: 12px;">🎯</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface OrcaMapProps {
  zones: ZoneInfo[];
  boundaries: BoundariesGeoJSON | null;
  selectedZone: ZoneInfo | null;
  decision: DecisionResult | null;
  userOrigin: GeoLocation;
  onSelectZone: (zone: ZoneInfo) => void;
}

export default function OrcaMapInner({
  zones,
  boundaries,
  selectedZone,
  decision,
  userOrigin,
  onSelectZone,
}: OrcaMapProps) {
  const defaultCenter: [number, number] = [10.15, 75.95];
  const mapCenter: [number, number] = selectedZone?.centroid
    ? [selectedZone.centroid.lat, selectedZone.centroid.lon]
    : defaultCenter;

  const getZoneStyle = (zone: ZoneInfo) => {
    const isSelected = selectedZone?.zone_id === zone.zone_id;

    if (decision && decision.zone_id === zone.zone_id) {
      if (decision.status === 'GO') {
        return {
          fillColor: '#10b981',
          fillOpacity: 0.45,
          color: '#34d399',
          weight: 3,
        };
      } else if (decision.status === 'CAUTION') {
        return {
          fillColor: '#f59e0b',
          fillOpacity: 0.45,
          color: '#fbbf24',
          weight: 3,
        };
      } else {
        return {
          fillColor: '#ef4444',
          fillOpacity: 0.45,
          color: '#f87171',
          weight: 3,
        };
      }
    }

    if (isSelected) {
      return {
        fillColor: '#06b6d4',
        fillOpacity: 0.4,
        color: '#22d3ee',
        weight: 3,
      };
    }

    const color = zone.pfz_score >= 80 ? '#38bdf8' : '#818cf8';
    return {
      fillColor: color,
      fillOpacity: 0.2,
      color: color,
      weight: 1.5,
      dashArray: '4, 4',
    };
  };

  return (
    <div className="w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
      <MapContainer
        center={defaultCenter}
        zoom={8}
        scrollWheelZoom={true}
        className="w-full h-full min-h-[420px]"
      >
        <ChangeView center={mapCenter} zoom={selectedZone ? 9 : 8} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & CartoDB'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <Marker position={[userOrigin.lat, userOrigin.lon]} icon={userPortIcon}>
          <Popup>
            <div className="text-xs">
              <strong className="text-cyan-400 block font-semibold">{userOrigin.name || 'User Port'}</strong>
              <span className="text-slate-300">Base Origin & Vessel Mooring</span>
              <p className="text-[11px] text-slate-400 mt-1">Lat: {userOrigin.lat}, Lon: {userOrigin.lon}</p>
            </div>
          </Popup>
        </Marker>

        {boundaries?.features.map((feature, idx) => {
          const coords = feature.geometry.coordinates[0] || [];
          const latLngs: [number, number][] = coords.map((c: any) => [c[1], c[0]]);
          const isNaval = feature.properties.type === 'military_restricted';

          return (
            <Polygon
              key={feature.properties.boundary_id || idx}
              positions={latLngs}
              pathOptions={{
                fillColor: isNaval ? '#dc2626' : '#ea580c',
                fillOpacity: 0.35,
                color: isNaval ? '#ef4444' : '#f97316',
                weight: 2,
                dashArray: '6, 6',
              }}
            >
              <Popup>
                <div className="text-xs max-w-xs">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400">
                    <span>⛔</span> {feature.properties.name}
                  </div>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-[10px]">
                    {feature.properties.restriction_level}
                  </span>
                  <p className="text-slate-300 mt-1 text-[11px] leading-relaxed">
                    {feature.properties.description}
                  </p>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {zones.map((zone) => {
          if (!zone.coordinates || zone.coordinates.length === 0) return null;
          
          const coordsList = Array.isArray(zone.coordinates[0]) && Array.isArray(zone.coordinates[0][0])
            ? (zone.coordinates[0] as any)
            : zone.coordinates;

          const latLngs: [number, number][] = coordsList.map((c: any) => [Number(c[1]), Number(c[0])]);
          const style = getZoneStyle(zone);

          return (
            <Polygon
              key={zone.zone_id}
              positions={latLngs}
              pathOptions={style}
              eventHandlers={{
                click: () => onSelectZone(zone),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <strong className="text-white font-bold block text-sm">{zone.zone_name}</strong>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono text-[11px]">
                      PFZ Score: {zone.pfz_score}
                    </span>
                    <span className="text-slate-400 font-medium">Dist: {zone.distance_km} km</span>
                  </div>
                  {zone.sst_celsius && (
                    <p className="text-slate-400 text-[11px] mt-1">
                      SST: {zone.sst_celsius}°C • Chl: {zone.chlorophyll_mg_m3} mg/m³
                    </p>
                  )}
                  <button
                    onClick={() => onSelectZone(zone)}
                    className="mt-2 w-full py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-semibold"
                  >
                    Select Zone
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {selectedZone?.centroid && (
          <>
            <Marker
              position={[selectedZone.centroid.lat, selectedZone.centroid.lon]}
              icon={destinationIcon}
            >
              <Popup>
                <div className="text-xs">
                  <strong className="text-emerald-400 font-semibold">{selectedZone.zone_name} Centroid</strong>
                  <p className="text-[11px] text-slate-300">PFZ Target Aggregation Area</p>
                </div>
              </Popup>
            </Marker>

            <Polyline
              positions={[
                [userOrigin.lat, userOrigin.lon],
                [selectedZone.centroid.lat, selectedZone.centroid.lon],
              ]}
              pathOptions={{
                color: decision?.status === 'GO' ? '#10b981' : decision?.status === 'CAUTION' ? '#f59e0b' : '#38bdf8',
                weight: 3,
                dashArray: '8, 8',
                opacity: 0.8,
              }}
            />
          </>
        )}
      </MapContainer>

      <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 flex flex-wrap items-center gap-3 shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span>⚓ Kochi Port</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-sky-500/40 border border-sky-400" />
          <span>Fishing Zones (PFZ)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-rose-500/40 border border-rose-500" />
          <span>Restricted Maritime Boundary</span>
        </div>
      </div>
    </div>
  );
}
