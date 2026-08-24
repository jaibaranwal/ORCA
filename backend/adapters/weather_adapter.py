import httpx
import os
import json
import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger("orca.weather_adapter")

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "cache")
DEMO_FALLBACK_FILE = os.path.join(CACHE_DIR, "weather_demo.json")

class WeatherAdapter:
    def __init__(self):
        self.marine_url = os.getenv(
            "OPEN_METEO_MARINE_URL", 
            "https://marine-api.open-meteo.com/v1/marine"
        )
        self.forecast_url = os.getenv(
            "OPEN_METEO_FORECAST_URL", 
            "https://api.open-meteo.com/v1/forecast"
        )
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR, exist_ok=True)

    async def get_marine_weather(self, lat: float, lon: float, zone_id: str = "default") -> Dict[str, Any]:
        """
        Retrieves marine and forecast weather with 3-layer fallback:
        1. Live Open-Meteo API
        2. Local zone cache
        3. Static demo fallback
        """
        cache_file = os.path.join(CACHE_DIR, f"weather_{zone_id}.json")

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                # 1. Query Marine API for wave height, direction, period
                marine_resp = await client.get(
                    self.marine_url,
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "wave_height,wave_direction,wave_period,ocean_current_velocity",
                        "timezone": "auto"
                    }
                )

                # 2. Query Forecast API for wind speed, direction, weather code, visibility
                forecast_resp = await client.get(
                    self.forecast_url,
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "wind_speed_10m,wind_direction_10m,weather_code,visibility,precipitation",
                        "timezone": "auto"
                    }
                )

                if marine_resp.status_code == 200 and forecast_resp.status_code == 200:
                    marine_data = marine_resp.json().get("current", {})
                    forecast_data = forecast_resp.json().get("current", {})

                    weather_code = int(forecast_data.get("weather_code", 0))
                    # Weather codes >= 95 indicate thunderstorm / lightning
                    lightning_alert = weather_code >= 95
                    # Extreme winds or pressure drop in real life, demo flag check
                    cyclone_alert = False

                    result = {
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "wave_height_m": float(marine_data.get("wave_height", 1.4) or 1.4),
                        "wave_direction_deg": float(marine_data.get("wave_direction", 220.0) or 220.0),
                        "wave_period_s": float(marine_data.get("wave_period", 7.5) or 7.5),
                        "current_speed_ms": float(marine_data.get("ocean_current_velocity", 0.3) or 0.3),
                        "wind_speed_kmh": float(forecast_data.get("wind_speed_10m", 12.0) or 12.0),
                        "wind_direction_deg": float(forecast_data.get("wind_direction_10m", 210.0) or 210.0),
                        "weather_code": weather_code,
                        "visibility_km": float(forecast_data.get("visibility", 10000) or 10000) / 1000.0,
                        "precipitation_mm": float(forecast_data.get("precipitation", 0.0) or 0.0),
                        "lightning_alert": lightning_alert,
                        "cyclone_alert": cyclone_alert,
                        "data_source": "live"
                    }

                    # Cache successful response
                    with open(cache_file, "w") as f:
                        json.dump(result, f, indent=2)

                    return result

        except Exception as e:
            logger.warning(f"Live weather fetch failed ({e}). Attempting fallback to cache.")

        # Fallback 1: Local zone cache
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r") as f:
                    cached_data = json.load(f)
                    cached_data["data_source"] = "cache"
                    return cached_data
            except Exception:
                pass

        # Fallback 2: Default static demo file
        if os.path.exists(DEMO_FALLBACK_FILE):
            with open(DEMO_FALLBACK_FILE, "r") as f:
                demo_data = json.load(f)
                demo_data["data_source"] = "demo"
                return demo_data

        # Final default fallback in memory
        return {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "wave_height_m": 1.4,
            "wave_direction_deg": 220.0,
            "wave_period_s": 7.5,
            "current_speed_ms": 0.3,
            "wind_speed_kmh": 12.0,
            "wind_direction_deg": 210.0,
            "weather_code": 1,
            "visibility_km": 10.0,
            "precipitation_mm": 0.0,
            "lightning_alert": False,
            "cyclone_alert": False,
            "data_source": "demo"
        }
