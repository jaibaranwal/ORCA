import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")
AIS_DEMO_FILE = os.path.join(CACHE_DIR, "ais_demo.json")

class AISAdapter:
    """
    Adapter for Coastal Automatic Identification System (AIS) Vessel Fleet Tracking.
    Provides real-time / simulated maritime vessel telemetry (fishing, patrol, cargo, research)
    across the Kerala Coastal Corridor and Arabian Sea.
    """

    def __init__(self):
        self._vessels_cache: List[Dict[str, Any]] = []
        self._load_demo_data()

    def _load_demo_data(self):
        if os.path.exists(AIS_DEMO_FILE):
            try:
                with open(AIS_DEMO_FILE, "r") as f:
                    data = json.load(f)
                    self._vessels_cache = data.get("vessels", [])
            except Exception as e:
                print(f"[AISAdapter] Error loading demo AIS data: {e}")

    def get_vessels(
        self,
        vessel_type: Optional[str] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Retrieves active vessel fleet records with optional bounding-box or vessel-type filtering.
        """
        if not self._vessels_cache:
            self._load_demo_data()

        filtered = self._vessels_cache
        if vessel_type and vessel_type.lower() != "all":
            filtered = [v for v in filtered if v.get("type", "").lower() == vessel_type.lower()]

        if min_lat is not None and max_lat is not None:
            filtered = [v for v in filtered if min_lat <= v.get("lat", 0) <= max_lat]

        if min_lon is not None and max_lon is not None:
            filtered = [v for v in filtered if min_lon <= v.get("lon", 0) <= max_lon]

        return {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "region": "Arabian Sea - Kerala Coastal Corridor",
            "data_source": "SIMULATED_AIS_COASTAL_NETWORK",
            "total_vessels": len(filtered),
            "vessels": filtered
        }

    def get_vessel_by_mmsi(self, mmsi: str) -> Optional[Dict[str, Any]]:
        """Finds a specific vessel by its 9-digit Maritime Mobile Service Identity (MMSI)."""
        for v in self._vessels_cache:
            if v.get("mmsi") == str(mmsi):
                return v
        return None

# Singleton instance
ais_adapter = AISAdapter()
