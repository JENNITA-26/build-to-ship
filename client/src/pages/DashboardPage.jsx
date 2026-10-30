import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  MapPin,
  AlertTriangle,
  MessageSquare,
  ArrowUpRight,
  Sparkles,
  Phone,
  Radio,
  CheckCircle2
} from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';
import MapContainer from '../components/MapContainer.tsx';
import EventInjector from '../components/EventInjector.tsx';
import DriverIncidentReporter from '../components/DriverIncidentReporter.tsx';
import DecisionTracePanel from '../components/DecisionTracePanel.tsx';

export default function DashboardPage() {
  const {
    user,
    routes,
    vehicles,
    events,
    traces,
    pendingNotifications,
    allNotifications,
    lastAgentReport,
    handleResolveDisruption
  } = useFleet();

  const isDispatcher = user?.role === 'dispatcher';
  const [selectedRouteId, setSelectedRouteId] = useState('all');

  const allStops = routes.flatMap((r) => r.stops || []);
  const completedStops = allStops.filter((s) => s.status === 'completed').length;
  const activeDisruptions = isDispatcher
    ? events.filter((e) => !e.resolved)
    : events.filter(
        (e) => !e.resolved && routes.some((r) => r.id === e.route_id)
      );

  // Live Driver Field Alerts for Central Dispatch
  const activeDriverAlerts = events.filter(
    (e) =>
      !e.resolved &&
      (e.reported_by_role === 'driver' ||
        String(e.description || '').includes('[Driver Field Report'))
  );

  const avgDelayMins =
    allStops.length > 0
      ? Math.round(
          allStops.reduce(
            (sum, s) =>
              sum +
              (s.delayPrediction?.totalPredictedDelayMins ?? s.historical_delay_mins ?? 5),
            0
          ) / allStops.length
        )
      : 0;

  // ============================================================================
  // DRIVER DASHBOARD VIEW (Driver's Route, Field Issue Reporter, Stops & Stop Messages; NO Decision Trace)
  // ============================================================================
  if (!isDispatcher) {
    const driverRoute = routes[0];
    const driverVehicle = vehicles[0];
    const driverStops = driverRoute?.stops || [];

    return (
      <div className="space-y-6">
        {/* Driver Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                My Assigned Vehicle
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-lg font-bold text-white">
              {driverVehicle?.name || user?.vehicleName || 'Assigned Fleet Vehicle'}
            </div>
            <div className="mt-1 text-xs text-emerald-400 font-medium">
              {driverRoute?.name || 'Assigned Delivery Route'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                My Stops Progress
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                <MapPin className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {completedStops}/{driverStops.length}
              </span>
              <span className="text-xs text-cyan-400 font-medium">
                Stops Completed
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {driverRoute?.total_distance_km || 12} km total route distance
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Messages for My Stops
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">
                {allNotifications.length}
              </span>
              <Link
                to="/approvals"
                className="inline-flex items-center gap-0.5 text-xs text-indigo-400 font-semibold hover:underline"
              >
                View My Stop Messages <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Customer notifications for your route only
            </div>
          </div>
        </div>

        {/* Driver Main Grid: Map & Stops (Left 7 cols) + Mobile Field Incident Reporter & Messages (Right 5 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">
                  My Active Route Map — {driverRoute?.name}
                </h2>
                <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  Vehicle: {user?.vehicleType || 'Van'}
                </span>
              </div>

              <MapContainer
                routes={routes}
                vehicles={vehicles}
                events={activeDisruptions}
                selectedRouteId={driverRoute?.id || 'all'}
                heightClass="h-[440px]"
              />
            </div>

            {/* Driver's Stop Sequence Checklist */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    My Delivery Stops Sequence ({driverStops.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Follow this stop order for your {user?.vehicleType || 'Van'} route in Chennai
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {driverStops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold text-white ${
                          stop.status === 'completed'
                            ? 'bg-emerald-600'
                            : stop.status === 'in_progress'
                            ? 'bg-cyan-600'
                            : 'bg-indigo-600'
                        }`}
                      >
                        {stop.sequence_order}
                      </span>
                      <div>
                        <div className="font-bold text-white">{stop.customer_name}</div>
                        <div className="text-[11px] text-slate-400">{stop.address}</div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                          <span>
                            Window: {String(stop.time_window_start).slice(0, 5)}–
                            {String(stop.time_window_end).slice(0, 5)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {stop.customer_phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          stop.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}
                      >
                        {stop.status.replace('_', ' ')}
                      </span>
                      {stop.estimated_arrival && (
                        <div className="mt-1 font-mono text-[11px] text-cyan-300">
                          ETA:{' '}
                          {new Date(stop.estimated_arrival).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column for Driver: Mobile Field Incident Reporter + Customer Messages for Driver's Stops */}
          <div className="xl:col-span-5 space-y-5">
            <DriverIncidentReporter />

            {/* Customer Messages for This Driver's Stops Only */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Customer Messages for My Stops ({allNotifications.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    ETA updates for customers on {driverRoute?.name}
                  </p>
                </div>
                <Link
                  to="/approvals"
                  className="text-xs font-semibold text-indigo-400 hover:underline"
                >
                  Open All
                </Link>
              </div>

              {allNotifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No customer delay messages on your route right now.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[210px] overflow-y-auto pr-1">
                  {allNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">
                          {notif.stop?.customer_name || 'Route Customer'}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            notif.status === 'sent'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {notif.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{notif.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // DISPATCHER DASHBOARD VIEW (Full Fleet, Live Driver Alerts, All Routes, Simulator & Decision Trace)
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* Instant Central Dispatch Alert Banner for Active Disruptions & Driver Field Reports */}
      {activeDisruptions.length > 0 && (
        <div className="space-y-2.5">
          {activeDisruptions.map((alertEv) => {
            const isDriverReport =
              alertEv.reported_by_role === 'driver' ||
              String(alertEv.description || '').includes('[Driver Field Report');

            return (
              <div
                key={alertEv.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 shadow-xl ${
                  isDriverReport
                    ? 'border-rose-500/70 bg-rose-950/40 shadow-rose-950/30'
                    : 'border-amber-500/60 bg-amber-950/30 shadow-amber-950/20'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
                      isDriverReport
                        ? 'bg-rose-500 shadow-rose-500/40'
                        : 'bg-amber-500 shadow-amber-500/30'
                    }`}
                  >
                    {isDriverReport ? (
                      <Radio className="h-5 w-5 animate-ping" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white ${
                          isDriverReport ? 'bg-rose-500' : 'bg-amber-600'
                        }`}
                      >
                        {isDriverReport
                          ? 'LIVE DRIVER FIELD ALERT'
                          : `ACTIVE DISRUPTION • ${String(alertEv.event_type || '').replace('_', ' ')}`}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {alertEv.reported_by_name || 'Chennai Fleet Dispatch'} •{' '}
                        {alertEv.vehicle_name || 'Active Fleet Route'}
                      </span>
                      <span className="font-mono text-xs text-slate-300">
                        {new Date(alertEv.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-100 leading-relaxed">
                      {alertEv.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/approvals"
                    className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-lg"
                  >
                    Review Customer ETA Texts ({pendingNotifications.length})
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleResolveDisruption(alertEv.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge & Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Active Fleet Vehicles
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {vehicles.filter((v) => v.status === 'active').length}/{vehicles.length}
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              {routes.length} Active Routes
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Vans, Cargo Trucks & E-Bikes deployed across Chennai, TN
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Stops & SLA Progress
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {completedStops}/{allStops.length}
            </span>
            <span className="text-xs text-cyan-400 font-medium">
              Avg Delay: +{avgDelayMins}m
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Predicted via Area + Hourly Traffic Heuristics
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Active Disruptions
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {activeDisruptions.length}
            </span>
            <Link
              to="/disruptions"
              className="inline-flex items-center gap-0.5 text-xs text-amber-400 hover:underline"
            >
              Simulate Event <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Road closures, breakdowns & driver field alerts
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Approval Queue (Gemini SMS)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {pendingNotifications.length}
            </span>
            <Link
              to="/approvals"
              className="inline-flex items-center gap-0.5 text-xs text-rose-400 font-semibold hover:underline"
            >
              Review Drafts <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Awaiting dispatcher sign-off before sending
          </div>
        </div>
      </div>

      {/* Latest AI Re-Optimization Banner if triggered */}
      {lastAgentReport && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-500/40 bg-indigo-950/30 px-5 py-3.5 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Autonomous Re-Optimization Complete —{' '}
                {lastAgentReport.optimizationResult?.algorithmUsed}
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                {lastAgentReport.aiAnalysis?.reasoning}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/approvals"
              className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition"
            >
              Review {lastAgentReport.draftedNotifications?.length || 0} Customer ETA Drafts
            </Link>
          </div>
        </div>
      )}

      {/* Main Command Grid: Live Map (Left 7 cols) + Simulator & Decision Trace (Right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Live Leaflet Map & Route Filter Pills */}
        <div className="xl:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                Live Chennai, Tamil Nadu Fleet Operations Map (OSRM + Leaflet)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedRouteId('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  selectedRouteId === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Routes ({routes.length})
              </button>
              {routes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRouteId(r.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    selectedRouteId === r.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {r.name.split('—')[0].trim()}
                </button>
              ))}
            </div>
          </div>

          <MapContainer
            routes={routes}
            vehicles={vehicles}
            events={events}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(id) => setSelectedRouteId(id)}
            onResolveEvent={handleResolveDisruption}
            heightClass="h-[520px]"
          />

          {/* Fleet Vehicle Status Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {vehicles.map((v) => {
              const util = Math.min(
                100,
                Math.round(((v.capacity_current || 0) / (v.capacity_max || 120)) * 100)
              );
              return (
                <div
                  key={v.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate">{v.name}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        v.status === 'broken_down' ? 'bg-rose-500' : 'bg-emerald-400'
                      }`}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Driver: {v.driver_name || 'Assigned'}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>
                      Load: {v.capacity_current}/{v.capacity_max}
                    </span>
                    <span>{util}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Quick Disruption Injector & Live Decision Trace Console */}
        <div className="xl:col-span-5 space-y-6">
          <EventInjector compact={true} />
          <DecisionTracePanel traces={traces} maxHeightClass="max-h-[340px]" />
        </div>
      </div>
    </div>
  );
}
