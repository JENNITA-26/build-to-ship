import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  DEFAULT_FLEET_ID,
  fetchFleetSnapshot,
  fetchPendingNotifications,
  fetchDecisionTraces,
  fetchBackendConfigStatus,
  injectDisruptionEvent,
  runRouteOptimizer,
  approveCustomerNotification,
  resolveEventById,
  resetSimulationBaseline,
  subscribeToSseStream
} from '../services/api.js';
import { subscribeToSupabaseRealtime } from '../services/supabaseClient.js';

const FleetContext = createContext(null);

export const DRIVER_VEHICLE_OPTIONS = [
  {
    vehicleType: 'Van',
    label: 'Delivery Van',
    vehicleName: 'Van Alpha-01 (Tata Ace EV)',
    vehicleId: '22222222-2222-2222-2222-222222222201',
    routeId: '33333333-3333-3333-3333-333333333301',
    routeName: 'Route 1 — Anna Salai, T. Nagar & Nungambakkam',
    driverName: 'Karthik Sundaram',
    driverEmail: 'driver.van@gmail.com'
  },
  {
    vehicleType: 'Cargo Truck',
    label: 'Cargo Truck',
    vehicleName: 'Truck Beta-02 (Ashok Leyland)',
    vehicleId: '22222222-2222-2222-2222-222222222202',
    routeId: '33333333-3333-3333-3333-333333333302',
    routeName: 'Route 2 — Guindy, Velachery & OMR IT Corridor',
    driverName: 'Anitha Krishnan',
    driverEmail: 'driver.truck@gmail.com'
  },
  {
    vehicleType: 'Electric Bike',
    label: 'Electric Bike',
    vehicleName: 'E-Bike Gamma-03 (Ather Cargo)',
    vehicleId: '22222222-2222-2222-2222-222222222203',
    routeId: '33333333-3333-3333-3333-333333333303',
    routeName: 'Route 3 — Mylapore, Adyar & Besant Nagar',
    driverName: 'Pradeep Kumar',
    driverEmail: 'driver.ebike@gmail.com'
  }
];

const DEFAULT_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dispatcher@gmail.com',
  fullName: 'Sarah Chen',
  role: 'dispatcher',
  fleetId: DEFAULT_FLEET_ID,
  token: 'demo-token-dispatcher'
};

export function FleetProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('routerescue_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_USER;
      }
    }
    return DEFAULT_USER;
  });

  const [allRoutes, setAllRoutes] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [events, setEvents] = useState([]);
  const [traces, setTraces] = useState([]);
  const [rawPendingNotifications, setRawPendingNotifications] = useState([]);
  const [rawAllNotifications, setRawAllNotifications] = useState([]);
  const [configStatus, setConfigStatus] = useState({
    supabaseConfigured: false,
    geminiConfigured: false
  });
  const [loading, setLoading] = useState(true);
  const [agentBusy, setAgentBusy] = useState(false);
  const [lastAgentReport, setLastAgentReport] = useState(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const fleetId = user?.fleetId || DEFAULT_FLEET_ID;

  const refreshAllData = useCallback(async () => {
    try {
      const [snapshot, notifData, traceData, cfg] = await Promise.all([
        fetchFleetSnapshot(fleetId),
        fetchPendingNotifications(fleetId),
        fetchDecisionTraces(fleetId),
        fetchBackendConfigStatus()
      ]);

      setAllRoutes(snapshot.routes || []);
      setAllVehicles(snapshot.vehicles || []);
      setEvents(snapshot.events || []);
      setRawPendingNotifications(notifData.pending || []);
      setRawAllNotifications(notifData.all || []);
      setTraces(traceData.traces || []);
      setConfigStatus(cfg);
    } catch (err) {
      console.error('[FleetContext] Error refreshing fleet data:', err);
    } finally {
      setLoading(false);
    }
  }, [fleetId]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Subscribe to both Backend SSE Real-Time Stream and Supabase Realtime
  useEffect(() => {
    const unsubSse = subscribeToSseStream(fleetId, (msg) => {
      if (msg.event === 'connected') {
        setRealtimeConnected(true);
        return;
      }
      if (msg.event === 'decision_trace_added' && msg.payload) {
        setTraces((prev) => {
          if (prev.some((t) => t.id === msg.payload.id)) return prev;
          return [msg.payload, ...prev];
        });
      }
      if (
        [
          'disruption_created',
          'disruption_resolved',
          'routes_updated',
          'notification_created',
          'notification_updated',
          'fleet_reset'
        ].includes(msg.event)
      ) {
        refreshAllData();
      }
    });

    const unsubSupa = subscribeToSupabaseRealtime(fleetId, () => {
      refreshAllData();
    });

    return () => {
      unsubSse();
      unsubSupa();
    };
  }, [fleetId, refreshAllData]);

  // Filter routes, vehicles, and stop notifications when logged in as a Driver
  const routes = useMemo(() => {
    if (user?.role !== 'driver') return allRoutes;
    const targetRouteId = user.routeId || DRIVER_VEHICLE_OPTIONS[0].routeId;
    const targetVehicleId = user.vehicleId || DRIVER_VEHICLE_OPTIONS[0].vehicleId;
    const matched = allRoutes.filter(
      (r) => r.id === targetRouteId || r.vehicle_id === targetVehicleId
    );
    return matched.length > 0 ? [matched[0]] : allRoutes.slice(0, 1);
  }, [allRoutes, user]);

  const vehicles = useMemo(() => {
    if (user?.role !== 'driver') return allVehicles;
    const activeRouteVehicleId = routes[0]?.vehicle_id || user.vehicleId || DRIVER_VEHICLE_OPTIONS[0].vehicleId;
    const matched = allVehicles.filter((v) => v.id === activeRouteVehicleId);
    return matched.length > 0 ? matched : allVehicles.slice(0, 1);
  }, [allVehicles, routes, user]);

  const driverStopIds = useMemo(() => {
    if (user?.role !== 'driver') return null;
    const ids = new Set();
    routes.forEach((r) => {
      (r.stops || []).forEach((s) => ids.add(s.id));
    });
    return ids;
  }, [routes, user]);

  const pendingNotifications = useMemo(() => {
    if (user?.role !== 'driver' || !driverStopIds) return rawPendingNotifications;
    return rawPendingNotifications.filter(
      (n) => driverStopIds.has(n.stop_id) || (n.stop && driverStopIds.has(n.stop.id))
    );
  }, [rawPendingNotifications, driverStopIds, user]);

  const allNotifications = useMemo(() => {
    if (user?.role !== 'driver' || !driverStopIds) return rawAllNotifications;
    return rawAllNotifications.filter(
      (n) => driverStopIds.has(n.stop_id) || (n.stop && driverStopIds.has(n.stop.id))
    );
  }, [rawAllNotifications, driverStopIds, user]);

  const loginWithRole = (role, customEmail, customName, customToken, vehicleType = 'Van') => {
    const vehiclePreset =
      DRIVER_VEHICLE_OPTIONS.find((v) => v.vehicleType === vehicleType) ||
      DRIVER_VEHICLE_OPTIONS[0];

    const nextUser = {
      id:
        role === 'dispatcher'
          ? '00000000-0000-0000-0000-000000000001'
          : '00000000-0000-0000-0000-000000000002',
      email:
        customEmail ||
        (role === 'dispatcher' ? 'dispatcher@routerescue.ai' : vehiclePreset.driverEmail),
      fullName:
        customName ||
        (role === 'dispatcher'
          ? 'Sarah Chen (Lead Dispatcher)'
          : `${vehiclePreset.driverName} (${vehiclePreset.label} Driver)`),
      role,
      vehicleType: role === 'driver' ? vehiclePreset.vehicleType : null,
      vehicleName: role === 'driver' ? vehiclePreset.vehicleName : null,
      vehicleId: role === 'driver' ? vehiclePreset.vehicleId : null,
      routeId: role === 'driver' ? vehiclePreset.routeId : null,
      fleetId: DEFAULT_FLEET_ID,
      token: customToken || `demo-token-${role}`
    };
    localStorage.setItem('routerescue_session', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem('routerescue_session');
    setUser(null);
  };

  const triggerDisruption = async (payload) => {
    setAgentBusy(true);
    try {
      const result = await injectDisruptionEvent({
        fleetId,
        ...payload
      });
      setLastAgentReport(result);
      await refreshAllData();
      return result;
    } finally {
      setAgentBusy(false);
    }
  };

  const triggerManualOptimization = async (routeId) => {
    setAgentBusy(true);
    try {
      const result = await runRouteOptimizer({
        fleetId,
        routeId,
        applyChanges: true
      });
      await refreshAllData();
      return result;
    } finally {
      setAgentBusy(false);
    }
  };

  const handleNotificationDecision = async (notificationId, approvedMessage, action = 'approve') => {
    const result = await approveCustomerNotification(notificationId, approvedMessage, action);
    await refreshAllData();
    return result;
  };

  const handleResolveDisruption = async (eventId) => {
    await resolveEventById(eventId);
    await refreshAllData();
  };

  const handleResetSimulation = async () => {
    setAgentBusy(true);
    try {
      await resetSimulationBaseline(fleetId);
      setLastAgentReport(null);
      await refreshAllData();
    } finally {
      setAgentBusy(false);
    }
  };

  return (
    <FleetContext.Provider
      value={{
        user,
        loginWithRole,
        logout,
        fleetId,
        routes,
        vehicles,
        events,
        traces,
        pendingNotifications,
        allNotifications,
        configStatus,
        loading,
        agentBusy,
        lastAgentReport,
        realtimeConnected,
        refreshAllData,
        triggerDisruption,
        triggerManualOptimization,
        handleNotificationDecision,
        handleResolveDisruption,
        handleResetSimulation
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet must be used within a FleetProvider');
  return ctx;
}
