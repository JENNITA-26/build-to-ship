import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Radio
} from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';
import EventInjector from '../components/EventInjector.tsx';
import DriverIncidentReporter from '../components/DriverIncidentReporter.tsx';
import MapContainer from '../components/MapContainer.tsx';

export default function DisruptionsPage() {
  const { routes, vehicles, events, handleResolveDisruption, user } = useFleet();
  const isDispatcher = user?.role === 'dispatcher';

  const visibleEvents = isDispatcher
    ? events
    : events.filter((e) => routes.some((r) => r.id === e.route_id));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Dispatcher Simulator OR Driver Mobile Field Incident Reporter */}
        <div className="xl:col-span-6">
          {isDispatcher ? (
            <EventInjector compact={false} />
          ) : (
            <DriverIncidentReporter />
          )}
        </div>

        {/* Right: Live Map Preview & Active Events Feed */}
        <div className="xl:col-span-6 space-y-6">
          <MapContainer
            routes={routes}
            vehicles={vehicles}
            events={visibleEvents}
            heightClass="h-[340px]"
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  {isDispatcher
                    ? `Fleet Disruption & Driver Field Alert Feed (${visibleEvents.length})`
                    : `My Route Reported Issues (${visibleEvents.length})`}
                </h3>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {visibleEvents.map((ev) => {
                const isDriverReport =
                  ev.reported_by_role === 'driver' ||
                  String(ev.description || '').includes('[Driver Field Report');

                return (
                  <div
                    key={ev.id}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3.5 text-xs ${ev.resolved
                        ? 'border-slate-800 bg-slate-950/50 opacity-75'
                        : isDriverReport
                          ? 'border-rose-500/60 bg-rose-950/25 shadow-lg shadow-rose-950/20'
                          : 'border-amber-500/40 bg-amber-950/15'
                      }`}
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex flex-wrap items-center gap-2">
                        {isDriverReport && (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            <Radio className="h-3 w-3 animate-pulse" />
                            Driver Alert {ev.reported_by_name ? `• ${ev.reported_by_name}` : ''}
                          </span>
                        )}
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${ev.resolved
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                        >
                          {ev.event_type.replace('_', ' ')}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </span>
                        {ev.lat != null && ev.lng != null && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500">
                            <MapPin className="h-3 w-3" />
                            {Number(ev.lat).toFixed(3)}, {Number(ev.lng).toFixed(3)}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-200 leading-relaxed">{ev.description}</p>
                    </div>

                    <div>
                      {ev.resolved ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                        </span>
                      ) : (
                        isDispatcher && (
                          <button
                            type="button"
                            onClick={() => handleResolveDisruption(ev.id)}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition"
                          >
                            Acknowledge & Resolve
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
