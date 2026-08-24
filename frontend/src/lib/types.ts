export interface GeoLocation {
  lat: number;
  lon: number;
  name?: string;
}

export interface MarineConditions {
  timestamp: string;
  location: GeoLocation;
  wave_height_m: number;
  wave_direction_deg: number;
  wave_period_s: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  current_speed_ms: number;
  weather_code: number;
  visibility_km: number;
  lightning_alert: boolean;
  cyclone_alert: boolean;
  sst_celsius?: number;
  data_source: string;
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
    boundary_checker?: string;
    query_understanding?: string;
    explanation_engine?: string;
    data_collection?: string;
    gemini_integration?: string;
    environment?: string;
    [key: string]: any;
  };
}

export interface ZoneInfo {
  zone_id: string;
  zone_name: string;
  pfz_score: number;
  pfz_label: string;
  centroid?: {
    lat: number;
    lon: number;
    name?: string;
  };
  sst_celsius?: number;
  chlorophyll_mg_m3?: number;
  depth_m?: number;
  distance_km: number;
  restricted?: boolean;
  description?: string;
  coordinates?: any;
}

export interface DecisionResult {
  zone_id: string;
  zone_name: string;
  status: 'GO' | 'CAUTION' | 'WAIT';
  score: number;
  safety_score: number;
  fishing_score: number;
  effort_score: number;
  boundary_violation: boolean;
  hard_stop: boolean;
  reasons: string[];
  explanation?: string;
  conditions: MarineConditions;
  thresholds_used: Record<string, any>;
  data_source: string;
}

export interface DecisionRequest {
  user_id: string;
  zone_id: string;
  planned_start: string;
  planned_return: string;
  user_role: string;
  origin: GeoLocation;
}

export interface BoundaryFeature {
  type: string;
  properties: {
    boundary_id: string;
    name: string;
    type: string;
    restriction_level: string;
    description: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

export interface BoundariesGeoJSON {
  type: string;
  features: BoundaryFeature[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'orca';
  text: string;
  timestamp: string;
  intent?: Record<string, any>;
  decision?: DecisionResult;
  suggested_action?: string;
}

export interface QueryResponse {
  message: string;
  intent: Record<string, any>;
  decision?: DecisionResult;
  all_evaluations?: DecisionResult[];
  explanation: string;
  language: string;
  suggested_action: string;
}
