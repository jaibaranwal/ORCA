import { 
  HealthResponse, 
  ZoneInfo, 
  DecisionResult, 
  DecisionRequest,
  BoundariesGeoJSON,
  MarineConditions
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

export async function resetDemo(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/demo/reset`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to reset demo: ${res.status}`);
  return res.json();
}
