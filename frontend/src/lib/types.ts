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
    decision_watch?: string;
    repair_engine?: string;
    living_lifecycle?: string;
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
  planned_start?: string;
  planned_return?: string;
  user_role: string;
  origin: GeoLocation;
}

export interface UserProfile {
  user_id: string;
  user_role: string;
  name: string;
  language: string;
  origin: GeoLocation;
}

export interface MissionDetails {
  purpose: string;
  zone_id: string;
  zone_name: string;
  destination?: GeoLocation;
  planned_start: string;
  planned_return?: string;
  original_query?: string;
}

export interface DecisionSnapshot {
  status: 'GO' | 'CAUTION' | 'WAIT';
  score: number;
  safety_score: number;
  fishing_score: number;
  effort_score: number;
  boundary_violation: boolean;
  hard_stop: boolean;
  reasons: string[];
  explanation?: string;
}

export interface ChangedFactor {
  factor: string;
  field_name: string;
  previous_value: any;
  current_value: any;
  threshold_value?: any;
  threshold_crossed: boolean;
  impact: string;
}

export interface ChangeHistoryEntry {
  checked_at: string;
  previous_status: string;
  new_status: string;
  previous_score: number;
  new_score: number;
  affected: boolean;
  changed_factors: ChangedFactor[];
  summary: string;
  explanation?: string;
  conditions_snapshot?: MarineConditions;
  action_taken?: string;
}

export interface RepairOption {
  option_id: string;
  type: 'TIME_CHANGE' | 'ZONE_CHANGE' | 'WAIT' | 'COMBINED';
  title: string;
  description: string;
  zone_id: string;
  zone_name: string;
  planned_start: string;
  status: 'GO' | 'CAUTION' | 'WAIT';
  score: number;
  safety_score: number;
  fishing_score: number;
  effort_score: number;
  reasons: string[];
  explanation?: string;
  conditions?: MarineConditions;
  rank: number;
}

export interface DecisionObject {
  decision_id: string;
  created_at: string;
  updated_at: string;
  last_checked_at: string;
  user: UserProfile;
  mission: MissionDetails;
  original_decision: DecisionSnapshot;
  original_conditions: MarineConditions;
  thresholds_snapshot: Record<string, any>;
  latest_decision?: DecisionSnapshot;
  latest_conditions?: MarineConditions;
  lifecycle_status: string;
  tracking_enabled: boolean;
  current_status: string;
  change_history: ChangeHistoryEntry[];
  repair_options: RepairOption[];
  selected_action?: RepairOption;
  feedback?: any;
}

export interface TrackDecisionRequest {
  decision_result?: DecisionResult;
  zone_id?: string;
  user_id?: string;
  user_name?: string;
  language?: string;
  planned_start?: string;
  planned_return?: string;
  origin?: GeoLocation;
  original_query?: string;
}

export interface TrackDecisionResponse {
  decision_id: string;
  status: string;
  message: string;
  decision: DecisionObject;
}

export interface RecheckResponse {
  decision_id: string;
  affected: boolean;
  previous_status: string;
  current_status: string;
  previous_score: number;
  current_score: number;
  changed_factors: ChangedFactor[];
  summary: string;
  explanation: string;
  last_checked_at: string;
  decision: DecisionObject;
}

export interface RepairResponse {
  decision_id: string;
  original_status: string;
  current_status: string;
  repair_available: boolean;
  options: RepairOption[];
  summary: string;
  explanation: string;
}

export interface SelectRepairResponse {
  decision_id: string;
  status: string;
  message: string;
  selected_option: RepairOption;
  decision: DecisionObject;
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
