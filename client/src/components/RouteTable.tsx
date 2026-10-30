import React from 'react';
import {
  Truck,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  Package
} from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';

interface RouteTableProps {
  routes: any[];
  onOptimizeRoute?: (routeId: string) => void;
}

export default function RouteTable({ routes = [], onOptimizeRoute }: RouteTableProps) {
  const { agentBusy, user } = useFleet();

  return (
    <div className="space-y-6">
      {routes.map((route) => {
        const vehicle = route.vehicle || {};
        const maxCap = vehicle.capacity_max || 120;
        const currentCap = route.active_package_load ?? vehicle.capacity_current ?? 60;
        const utilPct = Math.min(100, Math.round((currentCap / maxCap) * 100));

        return (
          <div
            key={route.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl"
          >
            {/* Route Header & Capacity Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/60 px-5 py-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-bold text-white">{route.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                      route.status === 'reoptimized'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}
                  >
                    {route.status}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {route.total_distance_km} km • ~{route.estimated_duration_mins} mins
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Truck className="h-3.5 w-3.5 text-cyan-400" />
                    {vehicle.name || 'Assigned Fleet Van'} ({vehicle.driver_name || 'Driver'})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-indigo-400" />
                    Load: {currentCap}/{maxCap} units ({utilPct}%)
                  </span>
                </div>
              </div>

              {/* Capacity Progress & Re-Optimize Trigger */}
              <div className="flex items-center gap-4">
                <div className="hidden sm:block w-36">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>Capacity</span>
                    <span>{utilPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        utilPct > 90 ? 'bg-rose-500' : utilPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                </div>

                {user?.role === 'dispatcher' && onOptimizeRoute && (
                  <button
                    type="button"
                    disabled={agentBusy}
                    onClick={() => onOptimizeRoute(route.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/25 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${agentBusy ? 'animate-spin' : ''}`} />
                    Run NN + 2-Opt
                  </button>
                )}
              </div>
            </div>

            {/* Responsive Stops Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Seq</th>
                    <th className="py-3 px-4">Customer & Stop Address</th>
                    <th className="py-3 px-4">Area Zone</th>
                    <th className="py-3 px-4">Delivery Window</th>
                    <th className="py-3 px-4">Est. Arrival (ETA)</th>
                    <th className="py-3 px-4">Delay Prediction</th>
                    <th className="py-3 px-4">SLA / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {(route.stops || []).map((stop: any) => {
                    const pred = stop.delayPrediction || {};
                    const totalDelay =
                      pred.totalPredictedDelayMins ?? stop.historical_delay_mins ?? 0;
                    const seqMoved =
                      stop.previous_sequence_order &&
                      stop.previous_sequence_order !== stop.sequence_order;

                    return (
                      <tr
                        key={stop.id}
                        className="hover:bg-slate-800/40 transition"
                      >
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                              {stop.sequence_order}
                            </span>
                            {seqMoved && (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                                was #{stop.previous_sequence_order}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{stop.customer_name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-500" />
                              {stop.address}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                              <Phone className="h-3 w-3" />
                              {stop.customer_phone}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                            {pred.areaZone || stop.area_zone || 'Urban Core'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          <div className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-indigo-400" />
                            {String(stop.time_window_start).slice(0, 5)} –{' '}
                            {String(stop.time_window_end).slice(0, 5)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-cyan-300 font-medium">
                          {stop.estimated_arrival
                            ? new Date(stop.estimated_arrival).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Scheduled'}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span
                              className={`font-mono font-semibold ${
                                totalDelay >= 15
                                  ? 'text-rose-400'
                                  : totalDelay >= 9
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              +{totalDelay} mins expected
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Hist: {stop.historical_delay_mins}m • Factor: {pred.hourlyMultiplier || 1.2}x
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {stop.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> Completed
                              </span>
                            ) : pred.slaStatus === 'violated' || stop.status === 'failed' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                                <AlertTriangle className="h-3 w-3" /> SLA Risk
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                                {stop.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

