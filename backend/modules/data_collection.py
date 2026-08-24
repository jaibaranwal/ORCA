import math
from typing import Dict, Any, Optional
from adapters.weather_adapter import WeatherAdapter
from adapters.pfz_adapter import PFZAdapter
from adapters.boundary_adapter import BoundaryAdapter
from models.schemas import MarineConditions, Location, ZoneInfo

weather_adapter = WeatherAdapter()
pfz_adapter = PFZAdapter()
boundary_adapter = BoundaryAdapter()

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

async def collect_marine_conditions(
    lat: float, 
    lon: float, 
    zone_id: Optional[str] = None,
    origin_lat: float = 9.966,  # Default Kochi Port
    origin_lon: float = 76.267
) -> MarineConditions:
    """
    Collects and standardizes marine, meteorological, and satellite indicators.
    """
    weather_data = await weather_adapter.get_marine_weather(lat, lon, zone_id=zone_id or "default")
    
    # Retrieve satellite SST / Chlorophyll data from zone info if available
    sst_val = 28.0
    if zone_id:
        zdata = pfz_adapter.get_zone_by_id(zone_id)
        if zdata:
            sst_val = zdata.get("properties", {}).get("sst_celsius", 28.0)

    return MarineConditions(
        timestamp=weather_data.get("timestamp"),
        location=Location(lat=lat, lon=lon),
        wave_height_m=weather_data.get("wave_height_m", 1.4),
        wave_direction_deg=weather_data.get("wave_direction_deg", 220.0),
        wave_period_s=weather_data.get("wave_period_s", 7.5),
        wind_speed_kmh=weather_data.get("wind_speed_kmh", 12.0),
        wind_direction_deg=weather_data.get("wind_direction_deg", 210.0),
        current_speed_ms=weather_data.get("current_speed_ms", 0.3),
        weather_code=weather_data.get("weather_code", 1),
        visibility_km=weather_data.get("visibility_km", 10.0),
        lightning_alert=weather_data.get("lightning_alert", False),
        cyclone_alert=weather_data.get("cyclone_alert", False),
        sst_celsius=sst_val,
        data_source=weather_data.get("data_source", "demo")
    )
