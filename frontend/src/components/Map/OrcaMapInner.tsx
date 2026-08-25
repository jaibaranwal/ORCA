'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, GeoJSON, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoneInfo, BoundariesGeoJSON, DecisionResult, GeoLocation } from '@/lib/types';

// Map center adjuster
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

interface OrcaMapInnerProps {
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
}: OrcaMapInnerProps) {
  // Layer Toggles
  const [layers, setLayers] = useState({
    weather: true,
    waves: true,
    pfz: true,
    boundaries: true,
    restricted: true,
    risk: true,
  });

  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Coordinates
  const originCoord: [number, number] = [userOrigin.lat, userOrigin.lon];
  const destCoord: [number, number] = selectedZone?.centroid
    ? [selectedZone.centroid.lat, selectedZone.centroid.lon]
    : [10.05, 75.92];

  const routePoints: [number, number][] = [originCoord, destCoord];

  // Port Icon
  const portIcon = L.divIcon({
    className: 'custom-port-icon',
    html: `<div style="
      background-color: #2563eb;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
    ">⚓</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  // Zone Marker
  const createZoneIcon = (zone: ZoneInfo, isSelected: boolean, verdict?: string) => {
    let bgColor = '#0284c7';
    if (verdict === 'GO') bgColor = '#16a34a';
    else if (verdict === 'CAUTION') bgColor = '#d97706';
    else if (verdict === 'WAIT') bgColor = '#dc2626';

    const size = isSelected ? 32 : 26;
    return L.divIcon({
      className: 'custom-zone-icon',
      html: `<div style="
        background-color: ${bgColor};
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${isSelected ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.85)'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: ${isSelected ? '12px' : '10px'};
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
      ">${zone.pfz_score}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // EEZ / IMBL Approximate Coordinates for Demo
  const eezLine: [number, number][] = [
    [12.5, 74.0],
    [11.5, 74.5],
    [10.5, 75.0],
    [9.5, 75.4],
    [8.5, 76.0],
    [7.8, 76.8]
  ];

  return (
    <div className="relative w-full h-full">
      {/* Floating Layer Controls Badge */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5 font-sans">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 backdrop-blur rounded-lg text-slate-200 text-xs font-medium shadow-lg flex items-center gap-1.5 transition-colors"
        >
          <span>🗺️ GIS Layers</span>
          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">
            {Object.values(layers).filter(Boolean).length}
          </span>
        </button>

        {showLayerMenu && (
          <div className="p-3 bg-slate-900/95 border border-slate-700/80 backdrop-blur rounded-xl shadow-2xl text-xs space-y-2 w-52 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 font-semibold text-slate-300 text-[11px]">
              <span>MARITIME GIS LAYERS</span>
              <button onClick={() => setShowLayerMenu(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>🌊 Waves & Swells</span>
              </span>
              <input
                type="checkbox"
                checked={layers.waves}
                onChange={(e) => setLayers({ ...layers, waves: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>🐟 PFZ Potential Zones</span>
              </span>
              <input
                type="checkbox"
                checked={layers.pfz}
                onChange={(e) => setLayers({ ...layers, pfz: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>🚫 Restricted Corridors</span>
              </span>
              <input
                type="checkbox"
                checked={layers.restricted}
                onChange={(e) => setLayers({ ...layers, restricted: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>🇮🇳 EEZ / Maritime Boundary</span>
              </span>
              <input
                type="checkbox"
                checked={layers.boundaries}
                onChange={(e) => setLayers({ ...layers, boundaries: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>⚠️ Risk & Shallow Shoals</span>
              </span>
              <input
                type="checkbox"
                checked={layers.risk}
                onChange={(e) => setLayers({ ...layers, risk: e.target.checked })}
                className="rounded accent-blue-600"
              />
            </label>
          </div>
        )}
      </div>

      {/* Floating Compass / Scale Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 border border-slate-800/90 backdrop-blur px-2.5 py-1.5 rounded-lg text-[10px] text-slate-300 font-mono flex items-center gap-3 shadow-md">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> GO Sector
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Caution
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> Restricted / Wait
        </span>
      </div>

      <MapContainer
        center={[9.95, 75.95]}
        zoom={9}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        className="z-10 shadow-inner"
      >
        <ChangeView center={selectedZone?.centroid ? [selectedZone.centroid.lat, selectedZone.centroid.lon] : [9.95, 75.95]} zoom={9} />

        {/* CartoDB Dark / Voyager Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* 1. Origin Port Marker */}
        <Marker position={originCoord} icon={portIcon}>
          <Popup className="custom-popup">
            <div className="text-xs p-1 text-slate-800 font-sans">
              <strong className="text-blue-700 block font-semibold">{userOrigin.name || 'Kochi Port'}</strong>
              <span className="text-slate-600">Vessel Departure Base • Arabian Sea</span>
            </div>
          </Popup>
        </Marker>

        {/* 2. Vessel Route Line */}
        {selectedZone && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: decision?.status === 'GO' ? '#16a34a' : decision?.status === 'CAUTION' ? '#d97706' : '#2563eb',
              weight: 3.5,
              dashArray: '6, 6',
              opacity: 0.9,
            }}
          />
        )}

        {/* 3. Indian EEZ / Maritime Boundary Line */}
        {layers.boundaries && (
          <Polyline
            positions={eezLine}
            pathOptions={{
              color: '#6366f1',
              weight: 2,
              dashArray: '8, 8',
              opacity: 0.75,
            }}
          />
        )}

        {/* 4. Simulated Marine Risk / Shoal Hazard Overlay */}
        {layers.risk && (
          <Circle
            center={[9.75, 76.15]}
            radius={9000}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '4, 4',
            }}
          />
        )}

        {/* 5. Restricted Boundaries */}
        {layers.restricted && boundaries && (
          <GeoJSON
            data={boundaries as any}
            style={() => ({
              color: '#dc2626',
              weight: 2,
              dashArray: '4, 4',
              fillColor: '#ef4444',
              fillOpacity: 0.18,
            })}
            onEachFeature={(feature, layer) => {
              const p = feature.properties;
              layer.bindPopup(
                `<div style="font-size: 11px; font-family: sans-serif; color: #0f172a; padding: 2px;">
                  <strong style="color: #b91c1c;">🚫 ${p.name}</strong><br/>
                  <span style="font-size: 10px; color: #475569;">Restriction: ${p.restriction_level}</span><br/>
                  <span>${p.description}</span>
                </div>`
              );
            }}
          />
        )}

        {/* 6. Fishing Zones Polygons & Centroid Markers */}
        {layers.pfz && zones.map((zone) => {
          const isSelected = selectedZone?.zone_id === zone.zone_id;
          const currentVerdict = isSelected ? decision?.status : undefined;
          
          let polyColor = '#0284c7';
          if (isSelected) {
            if (decision?.status === 'GO') polyColor = '#16a34a';
            else if (decision?.status === 'CAUTION') polyColor = '#d97706';
            else if (decision?.status === 'WAIT') polyColor = '#dc2626';
          }

          return (
            <div key={zone.zone_id}>
              {zone.polygon && (
                <Polygon
                  positions={zone.polygon as any}
                  eventHandlers={{
                    click: () => onSelectZone(zone),
                  }}
                  pathOptions={{
                    color: polyColor,
                    weight: isSelected ? 3.5 : 1.5,
                    fillColor: polyColor,
                    fillOpacity: isSelected ? 0.32 : 0.14,
                  }}
                />
              )}

              {zone.centroid && (
                <Marker
                  position={[zone.centroid.lat, zone.centroid.lon]}
                  icon={createZoneIcon(zone, isSelected, currentVerdict)}
                  eventHandlers={{
                    click: () => onSelectZone(zone),
                  }}
                >
                  <Popup>
                    <div className="text-xs p-1 text-slate-800 font-sans">
                      <strong className="text-blue-700 block font-semibold text-sm">{zone.zone_name}</strong>
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                        <div>PFZ Potential Score: <strong>{zone.pfz_score}/100</strong></div>
                        <div>Distance from base: <strong>{zone.distance_km} km</strong></div>
                        {zone.sst_celsius && <div>SST: <strong>{zone.sst_celsius}°C</strong></div>}
                        <div className="text-[10px] text-slate-500 pt-1">Click to select and evaluate sector</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}

