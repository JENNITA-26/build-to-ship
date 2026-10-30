const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const DEFAULT_FLEET_ID =
  import.meta.env.VITE_DEFAULT_FLEET_ID || '11111111-1111-1111-1111-111111111111';

function getAuthHeaders() {
  const storedSession = localStorage.getItem('routerescue_session');
  let token = 'demo-token-dispatcher';
  let role = 'dispatcher';
  let fleetId = DEFAULT_FLEET_ID;

  if (storedSession) {
    try {
      const parsed = JSON.parse(storedSession);
      token = parsed.token || `demo-token-${parsed.role || 'dispatcher'}`;
      role = parsed.role || 'dispatcher';
      fleetId = parsed.fleetId || DEFAULT_FLEET_ID;
    } catch {
      // ignore parse error
    }
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-user-role': role,
    'x-fleet-id': fleetId
  };
}

export async function fetchFleetSnapshot(fleetId = DEFAULT_FLEET_ID) {
  const res = await fetch(`${API_BASE_URL}/api/routes/${fleetId}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to load fleet routes');
  return res.json();
}

export async function fetchPendingNotifications(fleetId = DEFAULT_FLEET_ID) {
  const res = await fetch(`${API_BASE_URL}/api/notifications/pending/${fleetId}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to load customer notifications');
  return res.json();
}

export async function fetchDecisionTraces(fleetId = DEFAULT_FLEET_ID) {
  const res = await fetch(`${API_BASE_URL}/api/traces/${fleetId}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to load decision traces');
  return res.json();
}

export async function injectDisruptionEvent(eventPayload) {
  const res = await fetch(`${API_BASE_URL}/api/events`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fleetId: DEFAULT_FLEET_ID,
      ...eventPayload
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to inject disruption event');
  }
  return data;
}

export async function runRouteOptimizer(payload) {
  const res = await fetch(`${API_BASE_URL}/api/optimizer/run`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fleetId: DEFAULT_FLEET_ID,
      ...payload
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to run route optimizer');
  }
  return data;
}

export async function approveCustomerNotification(notificationId, approvedMessage, action = 'approve') {
  const res = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      notificationId,
      approvedMessage,
      action
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update notification');
  }
  return data;
}

export async function resolveEventById(eventId) {
  const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/resolve`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to resolve event');
  return data;
}

export async function resetSimulationBaseline(fleetId = DEFAULT_FLEET_ID) {
  const res = await fetch(`${API_BASE_URL}/api/reset/${fleetId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset fleet state');
  return data;
}

export async function fetchAreaHeuristics() {
  const res = await fetch(`${API_BASE_URL}/api/heuristics`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) return { heuristics: [] };
  return res.json();
}

export async function fetchBackendConfigStatus() {
  const res = await fetch(`${API_BASE_URL}/api/config/status`);
  if (!res.ok) return { supabaseConfigured: false, geminiConfigured: false };
  return res.json();
}

export async function updateBackendApiKeys(keysPayload) {
  const res = await fetch(`${API_BASE_URL}/api/config/keys`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(keysPayload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save API keys');
  return data;
}

export function subscribeToSseStream(fleetId = DEFAULT_FLEET_ID, onMessage) {
  const evtSource = new EventSource(`${API_BASE_URL}/api/stream/${fleetId}`);
  evtSource.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      onMessage(parsed);
    } catch {
      // ignore malformed event
    }
  };
  return () => {
    evtSource.close();
  };
}

