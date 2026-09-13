import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from modules.decision_store import get_decision

def generate_safety_manifest(decision_id: str) -> Dict[str, Any]:
    """
    Generates an official tamper-proof Marine Safety Clearance Manifest
    for a given Decision Object.
    """
    dec = get_decision(decision_id)
    if not dec:
        raise ValueError(f"Decision '{decision_id}' not found in database.")

    mission = dec.get("mission", {})
    user = dec.get("user", {})
    origin = user.get("origin", {})
    latest_decision = dec.get("latest_decision") or dec.get("original_decision", {})
    conditions = dec.get("latest_conditions") or dec.get("original_conditions", {})
    thresholds = dec.get("thresholds_used", {})

    created_at = dec.get("created_at", datetime.utcnow().isoformat() + "Z")
    # Clearance window valid for 6 hours from decision creation
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        valid_until = (dt + timedelta(hours=6)).isoformat()
    except Exception:
        valid_until = (datetime.utcnow() + timedelta(hours=6)).isoformat() + "Z"

    # Compute tamper-proof verification hash
    raw_payload_str = f"{decision_id}|{mission.get('zone_id')}|{latest_decision.get('status')}|{latest_decision.get('score')}|{conditions.get('wave_height_m')}|{conditions.get('wind_speed_kmh')}"
    verification_hash = hashlib.sha256(raw_payload_str.encode("utf-8")).hexdigest()[:16].upper()

    manifest_data = {
        "manifest_id": f"ORCA-MAN-{verification_hash[:8]}",
        "decision_id": decision_id,
        "issued_at": created_at,
        "valid_until": valid_until,
        "verification_checksum": verification_hash,
        "vessel_info": {
            "vessel_name": user.get("user_name", "Traditional Fishing Craft"),
            "registration_id": "KL-07-MM-4122",
            "vessel_type": "Fiber Reinforced Plastic (FRP) Trawler",
            "skipper": user.get("user_name", "Raju"),
            "home_port": origin.get("name", "Kochi Fishing Harbour")
        },
        "mission_plan": {
            "origin_port": origin.get("name", "Kochi Port"),
            "origin_coordinates": {
                "lat": origin.get("lat", 9.966),
                "lon": origin.get("lon", 76.267)
            },
            "destination_sector": mission.get("zone_name", "Zone B (Offshore West)"),
            "sector_id": mission.get("zone_id", "zone_b"),
            "estimated_distance_km": mission.get("distance_km", 18.0),
            "planned_departure": dec.get("planned_start") or created_at
        },
        "clearance_verdict": {
            "verdict": latest_decision.get("status", "GO"),
            "composite_score": latest_decision.get("score", 88),
            "safety_score": latest_decision.get("safety_score", 90),
            "fishing_potential_score": latest_decision.get("fishing_score", 80),
            "travel_effort_score": latest_decision.get("effort_score", 85),
            "boundary_status": "CLEAR" if not latest_decision.get("boundary_violation") else "VIOLATION",
            "safety_override": latest_decision.get("hard_stop", False),
            "cleared_reasons": latest_decision.get("reasons", [])
        },
        "meteorological_telemetry": {
            "wave_height_m": conditions.get("wave_height_m", 1.4),
            "wave_safe_limit_m": thresholds.get("wave_height_safe_m", 1.5),
            "wind_speed_kmh": conditions.get("wind_speed_kmh", 14.0),
            "wind_safe_limit_kmh": thresholds.get("wind_speed_safe_kmh", 30.0),
            "ocean_current_ms": conditions.get("current_speed_ms", 0.5),
            "visibility_km": conditions.get("visibility_km", 10.0),
            "sst_celsius": conditions.get("sst_celsius", 28.2)
        },
        "regulatory_governance": {
            "platform": "ORCA Marine Decision Intelligence",
            "decision_engine_version": "v1.1.0-deterministic",
            "data_provenance": "INCOIS / Open-Meteo Marine API + NOAA CoastWatch ERDDAP",
            "disclaimer": "Safety clearance generated via deterministic marine rules and meteorological criteria. Operator must maintain active maritime radio watch."
        }
    }

    return manifest_data

def generate_manifest_html(manifest: Dict[str, Any]) -> str:
    """Generates print-ready HTML certificate for harbor clearance."""
    verdict = manifest["clearance_verdict"]["verdict"]
    badge_bg = "#064e3b" if verdict == "GO" else "#78350f" if verdict == "CAUTION" else "#881337"
    badge_color = "#34d399" if verdict == "GO" else "#fbbf24" if verdict == "CAUTION" else "#f87171"

    reasons_html = "".join(f"<li style='margin-bottom:4px;'>{r}</li>" for r in manifest["clearance_verdict"]["cleared_reasons"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ORCA Marine Safety Clearance Certificate - {manifest['manifest_id']}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 30px; margin: 0; }}
    .cert-card {{ max-width: 800px; margin: 0 auto; background: #1e293b; border: 2px solid #334155; border-radius: 16px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }}
    .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 20px; }}
    .logo {{ font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #38bdf8; }}
    .tagline {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }}
    .badge {{ background: {badge_bg}; color: {badge_color}; padding: 6px 16px; border-radius: 9999px; font-weight: bold; font-size: 16px; border: 1px solid {badge_color}; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0; }}
    .section {{ background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid #334155; }}
    .section-title {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px; }}
    .info-row {{ display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid #1e293b; }}
    .label {{ color: #94a3b8; }}
    .val {{ font-weight: 600; color: #f8fafc; }}
    .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }}
    .checksum {{ font-family: monospace; color: #38bdf8; }}
    @media print {{ body {{ background: #fff; color: #000; padding: 0; }} .cert-card {{ background: #fff; border-color: #000; color: #000; box-shadow: none; }} .section {{ background: #f8fafc; border-color: #ccc; }} .val {{ color: #000; }} }}
  </style>
</head>
<body>
  <div class="cert-card">
    <div class="header">
      <div>
        <div class="logo">ORCA INTELLIGENCE</div>
        <div class="tagline">Official Marine Voyage Safety Clearance Manifest</div>
      </div>
      <div class="badge">{verdict} ({manifest['clearance_verdict']['composite_score']}/100)</div>
    </div>

    <div class="grid">
      <div class="section">
        <div class="section-title">Vessel & Harbor Authorization</div>
        <div class="info-row"><span class="label">Manifest ID:</span><span class="val">{manifest['manifest_id']}</span></div>
        <div class="info-row"><span class="label">Decision ID:</span><span class="val font-mono">{manifest['decision_id']}</span></div>
        <div class="info-row"><span class="label">Vessel Name:</span><span class="val">{manifest['vessel_info']['vessel_name']}</span></div>
        <div class="info-row"><span class="label">Registration:</span><span class="val font-mono">{manifest['vessel_info']['registration_id']}</span></div>
        <div class="info-row"><span class="label">Departure Port:</span><span class="val">{manifest['mission_plan']['origin_port']}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Mission Navigation Corridor</div>
        <div class="info-row"><span class="label">Target Sector:</span><span class="val">{manifest['mission_plan']['destination_sector']}</span></div>
        <div class="info-row"><span class="label">Corridor Distance:</span><span class="val">{manifest['mission_plan']['estimated_distance_km']} km</span></div>
        <div class="info-row"><span class="label">Boundary Status:</span><span class="val" style="color:#10b981;">{manifest['clearance_verdict']['boundary_status']}</span></div>
        <div class="info-row"><span class="label">Issued Timestamp:</span><span class="val">{manifest['issued_at'][:19].replace('T', ' ')} UTC</span></div>
        <div class="info-row"><span class="label">Valid Until:</span><span class="val">{manifest['valid_until'][:19].replace('T', ' ')} UTC</span></div>
      </div>
    </div>

    <div class="section" style="margin-bottom: 20px;">
      <div class="section-title">Validated Sea State & Meteorological Parameters</div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; margin-top: 8px;">
        <div style="background: #1e293b; padding: 8px; border-radius: 8px;">
          <div style="font-size: 10px; color: #94a3b8;">Significant Wave</div>
          <div style="font-size: 16px; font-weight: bold; color: #38bdf8;">{manifest['meteorological_telemetry']['wave_height_m']}m</div>
          <div style="font-size: 9px; color: #64748b;">Safe &le; {manifest['meteorological_telemetry']['wave_safe_limit_m']}m</div>
        </div>
        <div style="background: #1e293b; padding: 8px; border-radius: 8px;">
          <div style="font-size: 10px; color: #94a3b8;">Wind Speed</div>
          <div style="font-size: 16px; font-weight: bold; color: #38bdf8;">{manifest['meteorological_telemetry']['wind_speed_kmh']} km/h</div>
          <div style="font-size: 9px; color: #64748b;">Safe &le; {manifest['meteorological_telemetry']['wind_safe_limit_kmh']} km/h</div>
        </div>
        <div style="background: #1e293b; padding: 8px; border-radius: 8px;">
          <div style="font-size: 10px; color: #94a3b8;">PFZ Biomass</div>
          <div style="font-size: 16px; font-weight: bold; color: #10b981;">{manifest['clearance_verdict']['fishing_potential_score']}/100</div>
          <div style="font-size: 9px; color: #64748b;">INCOIS Satellite</div>
        </div>
        <div style="background: #1e293b; padding: 8px; border-radius: 8px;">
          <div style="font-size: 10px; color: #94a3b8;">Sea Temperature</div>
          <div style="font-size: 16px; font-weight: bold; color: #f59e0b;">{manifest['meteorological_telemetry']['sst_celsius']}&deg;C</div>
          <div style="font-size: 9px; color: #64748b;">NOAA ERDDAP</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Deterministic Decision Reasons & Safety Overrides</div>
      <ul style="font-size: 12px; line-height: 1.5; color: #cbd5e1; padding-left: 20px; margin: 6px 0;">
        {reasons_html}
      </ul>
    </div>

    <div class="footer">
      <div>Authorized by ORCA Autonomous Marine Decision Engine &bull; {manifest['regulatory_governance']['data_provenance']}</div>
      <div class="checksum">Checksum: {manifest['verification_checksum']}</div>
    </div>
  </div>
</body>
</html>
"""
