import React, { useState } from 'react';
import {
  AlertTriangle,
  Construction,
  Wrench,
  PackageX,
  UserX,
  Zap,
  CheckCircle2,
  MapPin
} from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';

const PRESET_SCENARIOS = [
  {
    id: 'road_closure_route2',
    title: 'Road Closure on Route 2 (Velachery & OMR)',
    eventType: 'road_closure',
    routeIndex: 1,
    severity: 'high',
    lat: 12.9905,
    lng: 80.2310,
    description:
      'CMRL Metro Phase-II girder installation blocking Taramani Link Road between Velachery & OMR. Commercial vehicles diverted — 4 stops impacted.'
  },
  {
    id: 'breakdown_route1',
    title: 'Van Breakdown on Route 1 (Anna Salai / T. Nagar)',
    eventType: 'breakdown',
    routeIndex: 0,
    severity: 'critical',
    lat: 13.0510,
    lng: 80.2450,
    description:
      'Van Alpha-01 battery thermal alert near Gemini Flyover on Anna Salai. Requires immediate rescue van re-assignment for remaining T. Nagar & Nungambakkam stops.'
  },
  {
    id: 'failed_delivery_route2',
    title: 'Loading Dock Blocked (Phoenix Marketcity Velachery)',
    eventType: 'failed_delivery',
    routeIndex: 1,
    severity: 'medium',
    lat: 12.9915,
    lng: 80.2167,
    description:
      'Service bay congestion at Velachery Main Road retail dock. Re-sequencing downstream OMR IT Corridor stops to preserve time windows.'
  },
  {
    id: 'customer_absent_route3',
    title: 'Customer Absent at Drop-off (Adyar LB Road)',
    eventType: 'customer_absent',
    routeIndex: 2,
    severity: 'medium',
    lat: 13.0063,
    lng: 80.2574,
    description:
      'Store manager unavailable for OTP verification on LB Road, Adyar. Shifting stop to end of window and alerting customer via SMS.'
  }
];

interface EventInjectorProps {
  compact?: boolean;
  onSuccess?: (result: any) => void;
}

export default function EventInjector({ compact = false, onSuccess }: EventInjectorProps) {
  const { routes, vehicles, triggerDisruption, agentBusy } = useFleet();

  const [eventType, setEventType] = useState('road_closure');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [severity, setSeverity] = useState('high');
  const [description, setDescription] = useState(
    'CMRL Metro construction road closure on Taramani Link Road blocking primary approach to OMR IT Corridor delivery stops.'
  );
  const [lat, setLat] = useState('12.9905');
  const [lng, setLng] = useState('80.2310');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeRouteId = selectedRouteId || routes[1]?.id || routes[0]?.id || '';
  const activeRoute = routes.find((r: any) => r.id === activeRouteId);
  const activeVehicleId =
    selectedVehicleId || activeRoute?.vehicle_id || vehicles[0]?.id || '';

  const handlePresetClick = async (preset: (typeof PRESET_SCENARIOS)[0]) => {
    setErrorMsg(null);
    setFeedback(null);
    const targetRoute = routes[preset.routeIndex] || routes[0];
    const targetVehicleId = targetRoute?.vehicle_id || vehicles[0]?.id;

    setEventType(preset.eventType);
    setSelectedRouteId(targetRoute?.id || '');
    setSelectedVehicleId(targetVehicleId || '');
    setSeverity(preset.severity);
    setDescription(preset.description);
    setLat(String(preset.lat));
    setLng(String(preset.lng));

    try {
      const res = await triggerDisruption({
        routeId: targetRoute?.id,
        vehicleId: targetVehicleId,
        eventType: preset.eventType,
        severity: preset.severity,
        description: preset.description,
        lat: preset.lat,
        lng: preset.lng
      });
      setFeedback(
        `Agent processed "${preset.title}" — ${res.draftedNotifications?.length || 0} customer ETA notifications queued for approval!`
      );
      if (onSuccess) onSuccess(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to inject preset disruption');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    try {
      const res = await triggerDisruption({
        routeId: activeRouteId || undefined,
        vehicleId: activeVehicleId || undefined,
        eventType,
        severity,
        description,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined
      });
      setFeedback(
        `Disruption injected! RouteRescue AI re-sequenced stops (NN + 2-Opt) and queued ${
          res.draftedNotifications?.length || 0
        } customer notifications.`
      );
      if (onSuccess) onSuccess(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Disruption injection failed');
    }
  };

  const eventTypeOptions = [
    {
      value: 'road_closure',
      label: 'Road Closure',
      icon: Construction,
      color: 'text-amber-400 border-amber-500/40 bg-amber-500/10'
    },
    {
      value: 'breakdown',
      label: 'Vehicle Breakdown',
      icon: Wrench,
      color: 'text-rose-400 border-rose-500/40 bg-rose-500/10'
    },
    {
      value: 'failed_delivery',
      label: 'Failed Delivery',
      icon: PackageX,
      color: 'text-orange-400 border-orange-500/40 bg-orange-500/10'
    },
    {
      value: 'customer_absent',
      label: 'Customer Not Home',
      icon: UserX,
      color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
    }
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Chennai Disruption Event Simulator
            </h3>
            <p className="text-xs text-slate-400">
              Simulate real-time Chennai road closures & breakdowns to trigger AI re-planning
            </p>
          </div>
        </div>
      </div>

      {/* 1-Click Scenario Triggers */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            1-Click Chennai Scenarios (Instant Trigger)
          </span>
        </div>
        <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
          {PRESET_SCENARIOS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={agentBusy}
              onClick={() => handlePresetClick(preset)}
              className="group flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-left transition hover:border-indigo-500/60 hover:bg-slate-900 disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white group-hover:text-indigo-300">
                  {preset.title}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                  <Zap className="h-3 w-3" /> Simulate
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-slate-400">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Event Simulation Form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-slate-800 pt-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Disruption Category
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {eventTypeOptions.map((opt) => {
              const Icon = opt.icon;
              const active = eventType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEventType(opt.value)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? opt.color
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Target Route
            </label>
            <select
              value={activeRouteId}
              onChange={(e) => {
                setSelectedRouteId(e.target.value);
                const r = routes.find((rt: any) => rt.id === e.target.value);
                if (r?.vehicle_id) setSelectedVehicleId(r.vehicle_id);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              {routes.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Target Vehicle
            </label>
            <select
              value={activeVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Severity Level
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="low">Low — Minor Slowdown</option>
              <option value="medium">Medium — Local Detour</option>
              <option value="high">High — Route Re-Sequencing Needed</option>
              <option value="critical">Critical — Immediate Fleet Rescue</option>
            </select>
          </div>
        </div>

        {!compact && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-300 mb-1">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" /> Disruption Latitude (Chennai)
              </label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-300 mb-1">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" /> Disruption Longitude (Chennai)
              </label>
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Disruption Field Notes & Context
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={5}
            placeholder="Describe road closure, vehicle issue, or customer delivery problem..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {feedback && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={agentBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-500/20 hover:from-amber-400 hover:to-rose-500 transition disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {agentBusy
              ? 'Running Agent Reasoning & 2-Opt Optimizer...'
              : 'Inject Disruption & Trigger AI Agent'}
          </button>
        </div>
      </form>
    </div>
  );
}
