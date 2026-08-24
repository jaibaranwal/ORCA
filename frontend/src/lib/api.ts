import { 
  HealthResponse, 
  ZoneInfo, 
  DecisionResult, 
  DecisionRequest,
  BoundariesGeoJSON,
  MarineConditions,
  GeoLocation,
  QueryResponse,
  DecisionObject,
  TrackDecisionRequest,
  TrackDecisionResponse
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchZones(): Promise<ZoneInfo[]> {
  const res = await fetch(`${API_BASE_URL}/zones`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch zones: ${res.status}`);
  return res.json();
}

export async function fetchBoundaries(): Promise<BoundariesGeoJSON> {
  const res = await fetch(`${API_BASE_URL}/boundaries`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch boundaries: ${res.status}`);
  return res.json();
}

export async function fetchConditions(zoneId?: string, lat?: number, lon?: number): Promise<MarineConditions> {
  const params = new URLSearchParams();
  if (zoneId) params.append('zone_id', zoneId);
  if (lat !== undefined) params.append('lat', lat.toString());
  if (lon !== undefined) params.append('lon', lon.toString());

  const res = await fetch(`${API_BASE_URL}/conditions?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch conditions: ${res.status}`);
  return res.json();
}

export async function evaluateDecision(req: DecisionRequest): Promise<DecisionResult> {
  const res = await fetch(`${API_BASE_URL}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Decision evaluation failed: ${res.status}`);
  return res.json();
}

export async function sendQuery(message: string, language?: string, origin?: GeoLocation): Promise<QueryResponse> {
  const res = await fetch(`${API_BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      language,
      origin
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Natural language query failed: ${res.status}`);
  return res.json();
}

export async function trackDecision(req: TrackDecisionRequest): Promise<TrackDecisionResponse> {
  const res = await fetch(`${API_BASE_URL}/decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Track decision failed: ${res.status}`);
  return res.json();
}

export async function fetchDecisions(): Promise<DecisionObject[]> {
  const res = await fetch(`${API_BASE_URL}/decisions`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to list decisions: ${res.status}`);
  return res.json();
}

export async function fetchSingleDecision(decisionId: string): Promise<DecisionObject> {
  const res = await fetch(`${API_BASE_URL}/decisions/${decisionId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch decision details: ${res.status}`);
  return res.json();
}

export async function cancelDecision(decisionId: string): Promise<{ status: string; message: string; decision: DecisionObject }> {
  const res = await fetch(`${API_BASE_URL}/decisions/${decisionId}/cancel`, {
    method: 'POST',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Cancel decision failed: ${res.status}`);
  return res.json();
}

export async function resetDemo(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/demo/reset`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to reset demo: ${res.status}`);
  return res.json();
}
