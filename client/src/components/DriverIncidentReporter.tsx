import React, { useState } from 'react';
import {
  AlertTriangle,
  Construction,
  Wrench,
  TrafficCone,
  UserX,
  Send,
  CheckCircle2,
  MapPin,
  Radio
} from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';

const DRIVER_QUICK_REPORTS = [
  {
    id: 'roadblock',
    label: 'Roadblock Ahead',
    eventType: 'road_closure',
    severity: 'high',
    icon: Construction,
    color: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
    defaultNote:
      'Roadblock ahead due to metro barricade / fallen tree blocking my lane. Need route detour.'
  },
  {
    id: 'traffic',
    label: 'Heavy Traffic Jam',
    eventType: 'road_closure',
    severity: 'medium',
    icon: TrafficCone,
    color: 'border-orange-500/50 bg-orange-500/15 text-orange-300',
    defaultNote:
      'Severe traffic bottleneck at junction — moving very slowly, upcoming stops will be delayed by ~20 mins.'
  },
  {
    id: 'vehicle_issue',
    label: 'Vehicle Issue / Breakdown',
    eventType: 'breakdown',
    severity: 'critical',
    icon: Wrench,
    color: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
    defaultNote:
      'Vehicle mechanical / flat tyre issue on route. Unable to proceed — request backup vehicle for remaining packages.'
  },
  {
    id: 'customer_issue',
    label: 'Customer Unavailable',
    eventType: 'customer_absent',
    severity: 'medium',
    icon: UserX,
    color: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300',
    defaultNote:
      'Arrived at customer location in Chennai, recipient not answering phone or door for delivery.'
  }
];

export default function DriverIncidentReporter() {
  const { user, routes, vehicles, triggerDisruption, agentBusy } = useFleet();

  const driverRoute = routes[0];
  const driverVehicle = vehicles[0];
  const driverStops = driverRoute?.stops || [];
  const nextActiveStop =
    driverStops.find((s: any) => s.status !== 'completed') || driverStops[0];

  const [selectedQuickId, setSelectedQuickId] = useState('roadblock');
  const [selectedStopId, setSelectedStopId] = useState(nextActiveStop?.id || '');
  const [notes, setNotes] = useState(DRIVER_QUICK_REPORTS[0].defaultNote);
  const [sentConfirmation, setSentConfirmation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePreset =
    DRIVER_QUICK_REPORTS.find((q) => q.id === selectedQuickId) ||
    DRIVER_QUICK_REPORTS[0];

  const targetStop =
    driverStops.find((s: any) => s.id === selectedStopId) || nextActiveStop;

  const handleSelectQuickType = (preset: (typeof DRIVER_QUICK_REPORTS)[0]) => {
    setSelectedQuickId(preset.id);
    setNotes(preset.defaultNote);
    setSentConfirmation(null);
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSentConfirmation(null);
    setErrorMsg(null);

    const stopContext = targetStop
      ? `Near Stop #${targetStop.sequence_order} (${targetStop.customer_name}, ${targetStop.address.split(',')[0]})`
      : `On ${driverRoute?.name || 'Chennai Route'}`;

    try {
      await triggerDisruption({
        routeId: driverRoute?.id,
        vehicleId: driverVehicle?.id || user?.vehicleId,
        stopId: targetStop?.id,
        eventType: activePreset.eventType,
        severity: activePreset.severity,
        description: `[Driver Field Report — ${activePreset.label} ${stopContext}] ${notes}`,
        lat: targetStop?.lat ?? driverVehicle?.current_lat ?? 13.0418,
        lng: targetStop?.lng ?? driverVehicle?.current_lng ?? 80.2341,
        reportedByRole: 'driver',
        reportedByName: user?.fullName || 'Fleet Driver',
        vehicleName: driverVehicle?.name || user?.vehicleName || 'Fleet Vehicle'
      });

      setSentConfirmation(
        `Alert sent to Central Dispatch! The AI Dispatcher has automatically updated your route and queued customer ETA texts.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send field alert to Central Dispatch');
    }
  };

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-slate-900/95 p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Report Field Issue to Central Dispatch
            </h3>
            <p className="text-xs text-slate-400">
              Log a roadblock, vehicle problem, or traffic delay from the ground — alerts Dispatch immediately
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSendReport} className="mt-4 space-y-4">
        {/* 1-Tap Mobile Issue Buttons */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            1. What issue are you facing on the road?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DRIVER_QUICK_REPORTS.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedQuickId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectQuickType(item)}
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-bold transition ${
                    isSelected
                      ? item.color
                      : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Select Current / Nearest Stop on Driver's Route */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-400" />
            2. Which stop on your route are you near?
          </label>
          <select
            value={selectedStopId || nextActiveStop?.id || ''}
            onChange={(e) => setSelectedStopId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
          >
            {driverStops.map((s: any) => (
              <option key={s.id} value={s.id}>
                Stop #{s.sequence_order}: {s.customer_name} ({s.address.split(',')[0]})
              </option>
            ))}
          </select>
        </div>

        {/* Driver Field Notes */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            3. Quick Note for Dispatcher
          </label>
          <textarea
            rows={2}
            required
            minLength={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what happened on the road..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {sentConfirmation && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{sentConfirmation}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={agentBusy}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 py-3 text-xs font-bold text-white shadow-lg shadow-rose-600/25 hover:from-rose-500 hover:to-amber-500 transition disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span>
            {agentBusy
              ? 'Alerting Central Dispatch & Re-Planning Route...'
              : 'Send Live Alert to Central Dispatch'}
          </span>
        </button>
      </form>
    </div>
  );
}

