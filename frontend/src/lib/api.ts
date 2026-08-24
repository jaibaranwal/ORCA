import { HealthResponse, ZoneInfo, DecisionObject } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch health status: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchZones(): Promise<ZoneInfo[]> {
  const res = await fetch(`${API_BASE_URL}/zones`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch zones: ${res.status}`);
  }
  return res.json();
}

export async function fetchDecisions(): Promise<DecisionObject[]> {
  const res = await fetch(`${API_BASE_URL}/decisions`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch decisions: ${res.status}`);
  }
  return res.json();
}

export async function resetDemo(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE_URL}/demo/reset`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to reset demo: ${res.status}`);
  }
  return res.json();
}
