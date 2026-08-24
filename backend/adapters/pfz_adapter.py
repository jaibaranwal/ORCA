import json
import os
from typing import List, Dict, Any, Optional
from models.schemas import ZoneInfo, Location

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
PFZ_FILE = os.path.join(DATA_DIR, "pfz_zones.geojson")

class PFZAdapter:
    def __init__(self):
        self.zones_cache: Dict[str, Any] = {}
        self._load_zones()

    def _load_zones(self):
        if os.path.exists(PFZ_FILE):
            with open(PFZ_FILE, "r") as f:
                data = json.load(f)
                for feature in data.get("features", []):
                    props = feature.get("properties", {})
                    zone_id = props.get("zone_id")
                    geom = feature.get("geometry", {})
                    if zone_id:
                        self.zones_cache[zone_id] = {
                            "properties": props,
                            "geometry": geom
                        }

    def get_all_zones(self) -> List[Dict[str, Any]]:
        self._load_zones()
        return [
            {
                "zone_id": zid,
                **zdata["properties"],
                "coordinates": zdata["geometry"].get("coordinates", [])
            }
            for zid, zdata in self.zones_cache.items()
        ]

    def get_zone_by_id(self, zone_id: str) -> Optional[Dict[str, Any]]:
        self._load_zones()
        return self.zones_cache.get(zone_id)

    def get_zone_info(self, zone_id: str) -> Optional[ZoneInfo]:
        zdata = self.get_zone_by_id(zone_id)
        if not zdata:
            return None
        props = zdata["properties"]
        geom = zdata["geometry"]
        coords = geom.get("coordinates", [[]])[0]
        
        # Calculate centroid from coordinates
        if coords:
            avg_lon = sum(p[0] for p in coords) / len(coords)
            avg_lat = sum(p[1] for p in coords) / len(coords)
        else:
            avg_lon, avg_lat = 76.0, 10.0

        return ZoneInfo(
            zone_id=zone_id,
            zone_name=props.get("zone_name", zone_id.upper()),
            pfz_score=props.get("pfz_score", 70),
            pfz_label=props.get("pfz_label", "Moderate"),
            centroid=Location(lat=round(avg_lat, 4), lon=round(avg_lon, 4), name=props.get("zone_name")),
            polygon=coords,
            distance_km=props.get("distance_km", 20.0),
            boundary_violation=False,
            restricted=False
        )
