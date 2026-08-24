import json
import os
from typing import Dict, Any, List, Tuple
from shapely.geometry import Point, Polygon, shape

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
BOUNDARIES_FILE = os.path.join(DATA_DIR, "boundaries.geojson")

class BoundaryAdapter:
    def __init__(self):
        self.boundaries: List[Dict[str, Any]] = []
        self._load_boundaries()

    def _load_boundaries(self):
        if os.path.exists(BOUNDARIES_FILE):
            with open(BOUNDARIES_FILE, "r") as f:
                data = json.load(f)
                self.boundaries = data.get("features", [])

    def get_boundaries_geojson(self) -> Dict[str, Any]:
        self._load_boundaries()
        return {
            "type": "FeatureCollection",
            "features": self.boundaries
        }

    def check_point_boundary(self, lat: float, lon: float) -> Tuple[bool, List[str]]:
        """
        Deterministic check if a (lat, lon) point violates or lies within any restricted boundary.
        Returns: (is_violated, list_of_violation_reasons)
        """
        self._load_boundaries()
        pt = Point(lon, lat)  # Note: Shapely uses (x=lon, y=lat)
        violations = []

        for feature in self.boundaries:
            props = feature.get("properties", {})
            geom = shape(feature.get("geometry", {}))
            if geom.contains(pt) or geom.touches(pt):
                name = props.get("name", "Restricted Area")
                restriction = props.get("restriction_level", "STRICT_NO_ENTRY")
                violations.append(f"Location is inside restricted zone: '{name}' ({restriction})")

        return (len(violations) > 0, violations)

    def check_polygon_boundary(self, polygon_coords: List[List[float]]) -> Tuple[bool, List[str]]:
        """
        Deterministic check if a zone polygon intersects or overlaps with any restricted boundary.
        Returns: (is_violated, list_of_violation_reasons)
        """
        if not polygon_coords or len(polygon_coords) < 3:
            return (False, [])

        self._load_boundaries()
        try:
            zone_poly = Polygon(polygon_coords)
            violations = []

            for feature in self.boundaries:
                props = feature.get("properties", {})
                restricted_poly = shape(feature.get("geometry", {}))

                if zone_poly.intersects(restricted_poly):
                    name = props.get("name", "Restricted Maritime Zone")
                    violations.append(f"Zone boundary intersects with: '{name}'")

            return (len(violations) > 0, violations)
        except Exception as e:
            return (False, [f"Boundary check error: {str(e)}"])
