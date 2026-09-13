'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ZoneInfo, DecisionResult, GeoLocation, AISVessel } from '@/lib/types';
import { playVoiceAudio } from '@/lib/api';

interface Orca3DViewerProps {
  decision: DecisionResult | null;
  selectedZone: ZoneInfo | null;
  userOrigin: GeoLocation;
  aisVessels?: AISVessel[];
  language?: 'en' | 'hi';
}

export default function Orca3DViewer({
  decision,
  selectedZone,
  userOrigin,
  aisVessels = [],
  language = 'en',
}: Orca3DViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [camMode, setCamMode] = useState<'orbit' | 'vessel' | 'top'>('orbit');

  const waveHeight = decision?.conditions?.wave_height_m || 1.4;
  const windSpeed = decision?.conditions?.wind_speed_kmh || 14.0;
  const verdict = decision?.status || 'GO';
  const score = decision?.score || 88;
  const zoneName = decision?.zone_name || selectedZone?.zone_name || 'Coastal Corridor';

  const handleVoiceListen = async () => {
    const text = decision?.explanation || `Sector ${zoneName} evaluated as ${verdict} with wave height ${waveHeight} meters.`;
    try {
      setIsPlayingVoice(true);
      await playVoiceAudio(text, language);
    } catch (err) {
      console.error('3D Voice readout failed:', err);
    } finally {
      setIsPlayingVoice(false);
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); // Slate 950 deep night ocean
    scene.fog = new THREE.FogExp2(0x020617, 0.025);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 8, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.6); // Cyan sky ambient
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(20, 40, 20);
    scene.add(sunLight);

    const waterLight = new THREE.PointLight(0x06b6d4, 1.2, 50);
    waterLight.position.set(0, 2, 0);
    scene.add(waterLight);

    // 3. Dynamic Ocean Water Mesh
    const waterWidth = 80;
    const waterSegments = 100;
    const waterGeo = new THREE.PlaneGeometry(waterWidth, waterWidth, waterSegments, waterSegments);
    waterGeo.rotateX(-Math.PI / 2);

    // Determine water color from SST & risk
    const waterColor = verdict === 'WAIT' ? 0x0f172a : verdict === 'CAUTION' ? 0x032b45 : 0x083344;

    const waterMat = new THREE.MeshStandardMaterial({
      color: waterColor,
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true,
      wireframe: false,
    });

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    scene.add(waterMesh);

    // Original positions buffer for wave displacement calculation
    const posAttr = waterGeo.attributes.position;
    const originalPositions = posAttr.array.slice();

    // 4. Detailed 3D Fishing Trawler Vessel (Indian FRP Craft / Vallam)
    const vesselGroup = new THREE.Group();

    // Hull (tapered wedge boat)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 1.8);
    hullShape.lineTo(0.9, 0.8);
    hullShape.lineTo(0.8, -1.8);
    hullShape.lineTo(-0.8, -1.8);
    hullShape.lineTo(-0.9, 0.8);
    hullShape.closePath();

    const extrudeSettings = { depth: 0.9, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.center();

    const hullMat = new THREE.MeshStandardMaterial({
      color: verdict === 'WAIT' ? 0xe11d48 : verdict === 'CAUTION' ? 0xf59e0b : 0x0ea5e9, // Verdict dynamic hull stripe
      roughness: 0.4,
      metalness: 0.2,
    });
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.position.y = 0.4;
    vesselGroup.add(hullMesh);

    // Deck & Wheelhouse Cabin
    const cabinGeo = new THREE.BoxGeometry(0.9, 0.7, 1.1);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.0, -0.4);
    vesselGroup.add(cabin);

    // Cabin Windows
    const windowGeo = new THREE.BoxGeometry(0.92, 0.25, 0.6);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.9 });
    const windows = new THREE.Mesh(windowGeo, windowMat);
    windows.position.set(0, 1.15, -0.4);
    vesselGroup.add(windows);

    // Mast & Flag
    const mastGeo = new THREE.CylinderGeometry(0.04, 0.05, 2.2);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 1.8, 0.4);
    vesselGroup.add(mast);

    // Indian Marine Safety Flag
    const flagGeo = new THREE.PlaneGeometry(0.4, 0.25);
    const flagMat = new THREE.MeshBasicMaterial({
      color: verdict === 'WAIT' ? 0xff0000 : 0x10b981,
      side: THREE.DoubleSide
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.25, 2.7, 0.4);
    vesselGroup.add(flag);

    // Navigation Green/Red Bow Lights
    const greenLightGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const greenLight = new THREE.Mesh(greenLightGeo, greenLightMat);
    greenLight.position.set(0.7, 0.8, 1.2);
    vesselGroup.add(greenLight);

    const redLightGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const redLight = new THREE.Mesh(redLightGeo, redLightMat);
    redLight.position.set(-0.7, 0.8, 1.2);
    vesselGroup.add(redLight);

    scene.add(vesselGroup);

    // 5. AIS Fleet Vessels in the Distance
    const aisGroup = new THREE.Group();
    const aisColors = [0x3b82f6, 0x10b981, 0x8b5cf6, 0xf59e0b];

    for (let i = 0; i < Math.min(aisVessels.length || 6, 8); i++) {
      const v = aisVessels[i];
      const dist = 12 + (i * 5) % 25;
      const angle = (i * 0.8) + 0.3;
      const vx = Math.cos(angle) * dist;
      const vz = Math.sin(angle) * dist;

      const miniHullGeo = new THREE.BoxGeometry(0.8, 0.4, 1.6);
      const miniHullMat = new THREE.MeshStandardMaterial({
        color: v?.type === 'patrol' ? 0xef4444 : aisColors[i % aisColors.length],
        roughness: 0.5
      });
      const miniVessel = new THREE.Mesh(miniHullGeo, miniHullMat);
      miniVessel.position.set(vx, 0.2, vz);
      miniVessel.rotation.y = angle + Math.PI / 2;

      // Small beacon light
      const beaconGeo = new THREE.SphereGeometry(0.1, 6, 6);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 0.4, 0);
      miniVessel.add(beacon);

      aisGroup.add(miniVessel);
    }
    scene.add(aisGroup);

    // 6. Subsurface Fish Biomass Particles (Potential Fishing Zone aggregation)
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 20;
      particlePositions[i * 3 + 1] = -0.5 - Math.random() * 3.5; // Subsurface depth
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.15,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const fishSchool = new THREE.Points(particleGeo, particleMat);
    scene.add(fishSchool);

    // 7. Interactive Orbit Controls (Pointer Dragging)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = 0.4;
    let targetRotationX = 0.25;
    let currentDist = 18;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetRotationY += deltaX * 0.006;
      targetRotationX = Math.max(0.05, Math.min(1.4, targetRotationX + deltaY * 0.006));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      currentDist = Math.max(6, Math.min(45, currentDist + e.deltaY * 0.02));
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    // Touch support
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        targetRotationY += deltaX * 0.008;
        targetRotationX = Math.max(0.05, Math.min(1.4, targetRotationX + deltaY * 0.008));
      }
    };
    domEl.addEventListener('touchstart', onTouchStart);
    domEl.addEventListener('touchmove', onTouchMove);

    // 8. Wave Function: Returns ocean surface elevation y at (x, z) at time t
    const getWaveElevation = (x: number, z: number, time: number) => {
      // Scaled by actual evaluated wave height
      const amp = Math.min(waveHeight * 0.35, 1.4);
      const freq1 = 0.25;
      const freq2 = 0.45;
      const speed = 1.2 + (windSpeed * 0.03);

      const w1 = Math.sin(x * freq1 + time * speed) * Math.cos(z * freq1 + time * speed * 0.8) * amp;
      const w2 = Math.sin((x + z) * freq2 - time * speed * 1.2) * (amp * 0.45);
      return w1 + w2;
    };

    // 9. Render Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Deform water vertices
      const pos = waterGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const ox = originalPositions[i * 3];
        const oz = originalPositions[i * 3 + 2];
        const y = getWaveElevation(ox, oz, elapsedTime);
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      waterGeo.computeVertexNormals();

      // Update Vessel flotation and rocking
      const vesselX = 0;
      const vesselZ = 0;
      const vesselY = getWaveElevation(vesselX, vesselZ, elapsedTime);
      vesselGroup.position.y = vesselY;

      // Surface normal pitch & roll based on neighboring wave points
      const sampleOffset = 0.8;
      const yNorth = getWaveElevation(vesselX, vesselZ + sampleOffset, elapsedTime);
      const ySouth = getWaveElevation(vesselX, vesselZ - sampleOffset, elapsedTime);
      const yEast = getWaveElevation(vesselX + sampleOffset, vesselZ, elapsedTime);
      const yWest = getWaveElevation(vesselX - sampleOffset, vesselZ, elapsedTime);

      const pitch = (yNorth - ySouth) * 0.5;
      const roll = (yWest - yEast) * 0.5;

      vesselGroup.rotation.x = pitch;
      vesselGroup.rotation.z = roll;

      // Subtle yaw swaying
      vesselGroup.rotation.y = Math.sin(elapsedTime * 0.4) * 0.15;

      // Gentle motion for fish school
      const fishPos = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const px = fishPos.getX(i);
        const pz = fishPos.getZ(i);
        fishPos.setX(i, px + Math.cos(elapsedTime + i) * 0.01);
        fishPos.setZ(i, pz + Math.sin(elapsedTime + i) * 0.01);
      }
      fishPos.needsUpdate = true;

      // Camera Positioning
      if (camMode === 'vessel') {
        // Follow vessel closely
        camera.position.set(
          vesselGroup.position.x + Math.sin(targetRotationY) * 6,
          vesselGroup.position.y + 2.5 + targetRotationX * 3,
          vesselGroup.position.z + Math.cos(targetRotationY) * 6
        );
        camera.lookAt(vesselGroup.position.x, vesselGroup.position.y + 0.8, vesselGroup.position.z);
      } else if (camMode === 'top') {
        // Tactical top-down view
        camera.position.set(0, 30, 0.01);
        camera.lookAt(0, 0, 0);
      } else {
        // Free Orbit view
        camera.position.x = Math.sin(targetRotationY) * currentDist * Math.cos(targetRotationX);
        camera.position.y = Math.sin(targetRotationX) * currentDist + 3;
        camera.position.z = Math.cos(targetRotationY) * currentDist * Math.cos(targetRotationX);
        camera.lookAt(0, 1, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Resize handler
    const handleResize = () => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domEl.removeEventListener('mousedown', onMouseDown);
      domEl.removeEventListener('wheel', onWheel);
      domEl.removeEventListener('touchstart', onTouchStart);
      domEl.removeEventListener('touchmove', onTouchMove);
      renderer.dispose();
      waterGeo.dispose();
      waterMat.dispose();
    };
  }, [waveHeight, windSpeed, verdict, camMode, aisVessels]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 rounded-xl overflow-hidden select-none font-sans">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top HUD: Status, Telemetry & Camera Modes */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Vessel & Zone Badge */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl shadow-lg pointer-events-auto flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
              3D Ocean Digital Twin • {userOrigin.name || 'Kerala Coast'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">{zoneName}</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  verdict === 'GO'
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700'
                    : verdict === 'CAUTION'
                    ? 'bg-amber-950/90 text-amber-300 border border-amber-700'
                    : 'bg-rose-950/90 text-rose-300 border border-rose-700'
                }`}
              >
                {verdict === 'GO' ? '🟢 GO' : verdict === 'CAUTION' ? '🟡 CAUTION' : '🔴 WAIT'} ({score}/100)
              </span>
            </div>
          </div>
        </div>

        {/* Camera Perspective Mode Toggles & Voice Button */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 p-1 rounded-xl shadow-lg flex items-center gap-1 text-xs">
            <button
              onClick={() => setCamMode('orbit')}
              className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                camMode === 'orbit' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔄 Orbit
            </button>
            <button
              onClick={() => setCamMode('vessel')}
              className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                camMode === 'vessel' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⛵ Helm
            </button>
            <button
              onClick={() => setCamMode('top')}
              className={`px-2.5 py-1 rounded-lg transition-colors text-[11px] font-medium ${
                camMode === 'top' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              🛰️ Tactical
            </button>
          </div>

          <button
            onClick={handleVoiceListen}
            disabled={isPlayingVoice}
            className="px-3 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-semibold shadow-lg backdrop-blur-md flex items-center gap-1.5 transition-all"
            title="Listen to 3D simulation analysis via Gnani Timbre v2.5"
          >
            <span>{isPlayingVoice ? '🔊' : '🎙️'}</span>
            <span className="hidden sm:inline">{isPlayingVoice ? 'Speaking...' : 'Read Aloud'}</span>
          </button>
        </div>
      </div>

      {/* Bottom Floating Telemetry Overlay */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        
        {/* Wave & Sea State Gauges */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 px-3.5 py-2 rounded-xl shadow-lg pointer-events-auto flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Wave Surge</span>
            <span className={`font-bold text-sm ${waveHeight > 2.0 ? 'text-rose-400' : waveHeight > 1.5 ? 'text-amber-400' : 'text-cyan-300'}`}>
              {waveHeight.toFixed(1)}m
            </span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Wind Drift</span>
            <span className="font-bold text-sm text-slate-200">
              {windSpeed.toFixed(0)} km/h
            </span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">PFZ Biomass</span>
            <span className="font-bold text-sm text-emerald-400">
              {decision?.fishing_score || 82}%
            </span>
          </div>
          <div className="h-6 w-[1px] bg-slate-800" />
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">AIS Traffic</span>
            <span className="font-bold text-sm text-blue-400">
              {aisVessels.length || 8} Ships
            </span>
          </div>
        </div>

        {/* Interaction Hint */}
        <div className="hidden md:flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-mono text-slate-400 pointer-events-auto">
          <span>🖱️ Click & Drag to Rotate 360°</span>
          <span>•</span>
          <span>Scroll to Zoom</span>
        </div>
      </div>
    </div>
  );
}
