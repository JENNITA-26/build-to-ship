import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';

const ROUTE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b'];

function createStopIcon(sequenceOrder: number, status: string, slaStatus?: string) {
  let bg = '#4f46e5'; // pending indigo
  let ring = 'rgba(99, 102, 241, 0.35)';

  if (status === 'completed') {
    bg = '#10b981'; // emerald
    ring = 'rgba(16, 185, 129, 0.35)';
  } else if (status === 'failed' || slaStatus === 'violated') {
    bg = '#ef4444'; // red
    ring = 'rgba(239, 68, 68, 0.45)';
  } else if (status === 'rescheduled' || slaStatus === 'at_risk') {
    bg = '#f59e0b'; // amber
    ring = 'rgba(245, 158, 11, 0.4)';
  } else if (status === 'in_progress') {
    bg = '#06b6d4'; // cyan
    ring = 'rgba(6, 182, 212, 0.45)';
  }

  return L.divIcon({
    className: 'custom-stop-marker',
    html: `<div style="
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: ${bg};
      border: 2px solid #ffffff;
      box-shadow: 0 0 0 4px ${ring}, 0 4px 10px rgba(0,0,0,0.5);
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, sans-serif;
    ">${sequenceOrder}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

function createVehicleIcon(name: string, status: string) {
  const isBroken = status === 'broken_down';
  const bg = isBroken ? '#dc2626' : '#0f172a';
  const border = isBroken ? '#fca5a5' : '#38bdf8';
  const badge = (name || 'VAN').split(' ')[0];

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `<div style="
      padding: 3px 7px;
      border-radius: 8px;
      background: ${bg};
      border: 2px solid ${border};
      box-shadow: 0 6px 14px rgba(0,0,0,0.65);
      color: #f8fafc;
      font-weight: 700;
      font-size: 10px;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    ">
      <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:${
        isBroken ? '#f87171' : '#34d399'
      };"></span>
      🚚 ${badge}
    </div>`,
    iconSize: [74, 26],
    iconAnchor: [37, 13]
  });
}

function createDisruptionIcon(eventType: string) {
  const emoji =
    eventType === 'road_closure'
      ? '🚧'
      : eventType === 'breakdown'
      ? '⚠️'
      : eventType === 'failed_delivery'
      ? '📦'
      : '🚪';
  return L.divIcon({
    className: 'custom-disruption-marker',
    html: `<div style="
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: #dc2626;
      border: 2px solid #fecaca;
      box-shadow: 0 0 0 6px rgba(220, 38, 38, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    ">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

interface MapContainerProps {
  routes: any[];
  vehicles: any[];
  events: any[];
  selectedRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
  heightClass?: string;
}

export default function MapContainer({
  routes = [],
  vehicles = [],
  events = [],
  selectedRouteId = null,
  onSelectRoute,
  heightClass = 'h-[520px]'
}: MapContainerProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const visibleRoutes = useMemo(() => {
    if (!selectedRouteId || selectedRouteId === 'all') return routes;
    return routes.filter((r) => r.id === selectedRouteId);
  }, [routes, selectedRouteId]);

  const activeEvents = useMemo(
    () => events.filter((e) => !e.resolved && e.lat != null && e.lng != null),
    [events]
  );

  // Initialize Leaflet Map with official free OpenStreetMap tiles
  useEffect(() => {
    if (!mapElRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    }

    const map = L.map(mapElRef.current, {
      center: [13.0250, 80.2420],
      zoom: 12,
      scrollWheelZoom: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = group;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Render dynamic layers (routes, stops, vehicles, disruption circles)
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    // 1. Route polylines & stop pins
    visibleRoutes.forEach((route, idx) => {
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const positions =
        route.polyline && route.polyline.length > 1
          ? route.polyline
          : (route.stops || []).map((s: any) => [s.lat, s.lng]);

      if (positions.length > 1) {
        const poly = L.polyline(positions, {
          color,
          weight: selectedRouteId === route.id ? 5 : 4,
          opacity: 0.9
        });
        if (onSelectRoute) {
          poly.on('click', () => onSelectRoute(route.id));
        }
        poly.addTo(group);
      }

      (route.stops || []).forEach((stop: any) => {
        if (stop.lat == null || stop.lng == null) return;
        const marker = L.marker([stop.lat, stop.lng], {
          icon: createStopIcon(
            stop.sequence_order,
            stop.status,
            stop.delayPrediction?.slaStatus
          )
        });

        const prevBadge =
          stop.previous_sequence_order && stop.previous_sequence_order !== stop.sequence_order
            ? ` (was #${stop.previous_sequence_order})`
            : '';

        const etaStr = stop.estimated_arrival
          ? new Date(stop.estimated_arrival).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Scheduled';

        marker.bindPopup(`
          <div style="min-width:205px;font-family:Inter,sans-serif;font-size:12px;line-height:1.4;">
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #334155;padding-bottom:4px;margin-bottom:6px;">
              <strong style="color:#818cf8;">Stop #${stop.sequence_order}${prevBadge}</strong>
              <span style="text-transform:uppercase;font-size:10px;color:#cbd5e1;">${stop.status}</span>
            </div>
            <div style="font-weight:700;color:#ffffff;font-size:13px;">${stop.customer_name}</div>
            <div style="color:#94a3b8;margin-bottom:6px;">${stop.address}</div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#cbd5e1;">
              <span>Window: ${String(stop.time_window_start).slice(0, 5)}–${String(stop.time_window_end).slice(0, 5)}</span>
              <span style="color:#fbbf24;">+${stop.delayPrediction?.totalPredictedDelayMins ?? stop.historical_delay_mins}m delay</span>
            </div>
            <div style="margin-top:4px;font-family:monospace;font-size:11px;color:#38bdf8;">ETA: ${etaStr}</div>
          </div>
        `);

        marker.addTo(group);
      });
    });

    // 2. Vehicle markers
    vehicles.forEach((vehicle) => {
      if (vehicle.current_lat == null || vehicle.current_lng == null) return;
      const vMarker = L.marker([vehicle.current_lat, vehicle.current_lng], {
        icon: createVehicleIcon(vehicle.name, vehicle.status)
      });
      vMarker.bindPopup(`
        <div style="min-width:185px;font-family:Inter,sans-serif;font-size:12px;">
          <div style="font-weight:700;color:#ffffff;font-size:13px;">${vehicle.name}</div>
          <div style="color:#94a3b8;margin-top:2px;">Driver: <span style="color:#f1f5f9;">${vehicle.driver_name || 'Assigned'}</span></div>
          <div style="color:#94a3b8;">Status: <strong style="color:#34d399;text-transform:uppercase;">${vehicle.status}</strong></div>
          <div style="color:#94a3b8;">Capacity: <span style="color:#818cf8;font-family:monospace;">${vehicle.capacity_current}/${vehicle.capacity_max} units</span></div>
        </div>
      `);
      vMarker.addTo(group);
    });

    // 3. Active Disruption zones & pins
    activeEvents.forEach((ev) => {
      L.circle([ev.lat, ev.lng], {
        radius: 650,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.18,
        weight: 2,
        dashArray: '6 4'
      }).addTo(group);

      const dMarker = L.marker([ev.lat, ev.lng], {
        icon: createDisruptionIcon(ev.event_type)
      });
      dMarker.bindPopup(`
        <div style="min-width:195px;font-family:Inter,sans-serif;font-size:12px;">
          <div style="font-weight:700;color:#f87171;text-transform:uppercase;">Disruption: ${String(ev.event_type).replace('_', ' ')}</div>
          <div style="color:#f1f5f9;margin-top:4px;">${ev.description}</div>
        </div>
      `);
      dMarker.addTo(group);
    });
  }, [visibleRoutes, vehicles, activeEvents, selectedRouteId, onSelectRoute]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl ${heightClass}`}
    >
      <div ref={mapElRef} className="h-full w-full z-10" />

      {/* Floating Legend Overlay */}
      <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/90 bg-slate-950/90 px-3.5 py-2 text-[11px] text-slate-300 backdrop-blur-md shadow-lg">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> At-Risk / Rescheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Disruption Zone
        </span>
      </div>
    </div>
  );
}
