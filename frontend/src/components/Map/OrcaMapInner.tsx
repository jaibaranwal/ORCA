'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, GeoJSON, useMap } from 'react-leaflet';
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
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    ">⚓</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  // Zone Marker
  const createZoneIcon = (zone: ZoneInfo, isSelected: boolean, verdict?: string) => {
    let bgColor = '#0284c7';
    if (verdict === 'GO') bgColor = '#16a34a';
    else if (verdict === 'CAUTION') bgColor = '#d97706';
    else if (verdict === 'WAIT') bgColor = '#dc2626';

    const size = isSelected ? 30 : 24;
    return L.divIcon({
      className: 'custom-zone-icon',
      html: `<div style="
        background-color: ${bgColor};
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: ${isSelected ? '3px solid #ffffff' : '2px solid rgba(255,255,255,0.8)'};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: ${isSelected ? '11px' : '10px'};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      ">${zone.pfz_score}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  return (
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
            weight: 3,
            dashArray: '6, 6',
            opacity: 0.9,
          }}
        />
      )}

      {/* 3. Restricted Boundaries */}
      {boundaries && (
        <GeoJSON
          data={boundaries as any}
          style={() => ({
            color: '#dc2626',
            weight: 2,
            dashArray: '4, 4',
            fillColor: '#ef4444',
            fillOpacity: 0.15,
          })}
          onEachFeature={(feature, layer) => {
            const p = feature.properties;
            layer.bindPopup(
              `<div style="font-size: 11px; font-family: sans-serif; color: #0f172a; padding: 2px;">
                <strong style="color: #b91c1c;">${p.name}</strong><br/>
                <span style="font-size: 10px; color: #475569;">Restriction: ${p.restriction_level}</span><br/>
                <span>${p.description}</span>
              </div>`
            );
          }}
        />
      )}

      {/* 4. Fishing Zones Polygons & Centroid Markers */}
      {zones.map((zone) => {
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
                  weight: isSelected ? 3 : 1.5,
                  fillColor: polyColor,
                  fillOpacity: isSelected ? 0.3 : 0.12,
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
                      <div>Distance: <strong>{zone.distance_km} km</strong></div>
                      {zone.sst_celsius && <div>SST: <strong>{zone.sst_celsius}°C</strong></div>}
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
