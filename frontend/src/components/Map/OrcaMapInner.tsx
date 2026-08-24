'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoneInfo, BoundariesGeoJSON, DecisionResult, GeoLocation } from '@/lib/types';

// Custom Map center adjuster
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
  // Origin coordinate
  const originCoord: [number, number] = [userOrigin.lat, userOrigin.lon];
  
  // Destination coordinate
  const destCoord: [number, number] = selectedZone?.centroid
    ? [selectedZone.centroid.lat, selectedZone.centroid.lon]
    : [10.05, 75.92];

  // Route points: Origin -> Destination
  const routePoints: [number, number][] = [originCoord, destCoord];

  // Port Icon
  const portIcon = L.divIcon({
    className: 'custom-port-icon',
    html: `<div style="
      background-color: #0284c7;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      box-shadow: 0 0 12px rgba(2,132,199,0.8);
    ">⚓</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  // Zone Centroid Icon helper
  const createZoneIcon = (zone: ZoneInfo, isSelected: boolean, verdict?: string) => {
    let bgColor = '#0284c7';
    if (verdict === 'GO') bgColor = '#10b981';
    else if (verdict === 'CAUTION') bgColor = '#f59e0b';
    else if (verdict === 'WAIT') bgColor = '#f43f5e';
    else if (zone.pfz_score >= 80) bgColor = '#06b6d4';

    const size = isSelected ? 32 : 26;
    return L.divIcon({
      className: 'custom-zone-icon',
      html: `<div style="
        background-color: ${bgColor};
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${isSelected ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.7)'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: ${isSelected ? '12px' : '10px'};
        font-family: monospace;
        box-shadow: 0 0 ${isSelected ? '16px' : '8px'} ${bgColor};
      ">${zone.pfz_score}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  return (
    <MapContainer
      center={[9.95, 75.95]}
      zoom={9}
      style={{ height: '100%', width: '100%', borderRadius: '1rem' }}
      className="z-10 shadow-2xl border border-slate-800"
    >
      <ChangeView center={selectedZone?.centroid ? [selectedZone.centroid.lat, selectedZone.centroid.lon] : [9.95, 75.95]} zoom={9} />

      {/* CartoDB Dark Matter Tiles */}
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* 1. Origin / Port Marker */}
      <Marker position={originCoord} icon={portIcon}>
        <Popup className="custom-popup">
          <div className="text-xs p-1 text-slate-900 font-sans font-medium">
            <strong className="text-sky-700 block font-bold">⚓ {userOrigin.name || 'Kochi Port'}</strong>
            <span>Vessel Departure Base • Arabian Sea Corridor</span>
          </div>
        </Popup>
      </Marker>

      {/* 2. Active Mission Route Polyline */}
      {selectedZone && (
        <Polyline
          positions={routePoints}
          pathOptions={{
            color: decision?.status === 'GO' ? '#10b981' : decision?.status === 'CAUTION' ? '#f59e0b' : '#06b6d4',
            weight: 3,
            dashArray: '6, 8',
            opacity: 0.85,
          }}
        />
      )}

      {/* 3. Restricted Maritime Boundaries Layer */}
      {boundaries && (
        <GeoJSON
          data={boundaries as any}
          style={(feature) => ({
            color: '#e11d48',
            weight: 2,
            dashArray: '4, 4',
            fillColor: '#f43f5e',
            fillOpacity: 0.18,
          })}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            layer.bindPopup(
              `<div style="font-size: 11px; font-family: sans-serif; color: #0f172a; padding: 2px;">
                <strong style="color: #be123c;">⛔ ${p.name}</strong><br/>
                <span style="font-size: 10px; color: #475569;">Restriction: ${p.restriction_level}</span><br/>
                <span>${p.description}</span>
              </div>`
            );
          }}
        />
      )}

      {/* 4. Fishing Zones Polygons & Markers */}
      {zones.map((zone) => {
        const isSelected = selectedZone?.zone_id === zone.zone_id;
        const currentVerdict = isSelected ? decision?.status : undefined;
        
        let polyColor = '#0284c7';
        if (isSelected) {
          if (decision?.status === 'GO') polyColor = '#10b981';
          else if (decision?.status === 'CAUTION') polyColor = '#f59e0b';
          else if (decision?.status === 'WAIT') polyColor = '#f43f5e';
          else polyColor = '#06b6d4';
        }

        return (
          <div key={zone.zone_id}>
            {/* Zone Polygon */}
            {zone.polygon && (
              <Polygon
                positions={zone.polygon as any}
                eventHandlers={{
                  click: () => onSelectZone(zone),
                }}
                pathOptions={{
                  color: polyColor,
                  weight: isSelected ? 3 : 1.5,
                  fillColor: polyColor,
                  fillOpacity: isSelected ? 0.35 : 0.15,
                }}
              />
            )}

            {/* Zone Centroid Marker */}
            {zone.centroid && (
              <Marker
                position={[zone.centroid.lat, zone.centroid.lon]}
                icon={createZoneIcon(zone, isSelected, currentVerdict)}
                eventHandlers={{
                  click: () => onSelectZone(zone),
                }}
              >
                <Popup>
                  <div className="text-xs p-1 text-slate-900 font-sans">
                    <strong className="text-cyan-700 block font-bold text-sm">{zone.zone_name}</strong>
                    <div className="mt-1 space-y-0.5 text-[11px] text-slate-700 font-mono">
                      <div>PFZ Potential Score: <strong>{zone.pfz_score}/100</strong></div>
                      <div>Distance: <strong>{zone.distance_km} km</strong></div>
                      {zone.sst_celsius && <div>SST: <strong>{zone.sst_celsius}°C</strong></div>}
                      {isSelected && decision && (
                        <div className="mt-1 pt-1 border-t border-slate-200">
                          Verdict: <strong className={decision.status === 'GO' ? 'text-emerald-700' : 'text-amber-700'}>{decision.status} ({decision.score}/100)</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}
