export interface Location {
  lat: number;
  lon: number;
  name?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  phase: string;
  details: {
    database: string;
    decision_engine: string;
    gemini_integration: string;
    environment: string;
    [key: string]: any;
  };
}

export interface ZoneInfo {
  zone_id: string;
  zone_name: string;
  pfz_score: number;
  pfz_label: string;
  centroid: {
    lat: number;
    lon: number;
    name?: string;
  };
  distance_km: number;
  restricted: boolean;
}

export interface DecisionObject {
  decision_id: string;
  created_at: string;
  updated_at: string;
  user: {
    user_id: string;
    user_role: string;
    name: string;
    language: string;
  };
  mission: {
    purpose: string;
    zone_id: string;
    zone_name: string;
  };
  current_status: string;
  tracking_status: string;
  [key: string]: any;
}
