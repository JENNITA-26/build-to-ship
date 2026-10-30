import React, { useEffect, useState } from 'react';
import { Route as RouteIcon, Clock, Sparkles } from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';
import RouteTable from '../components/RouteTable.tsx';
import { fetchAreaHeuristics } from '../services/api.js';

export default function RoutesPage() {
  const { routes, triggerManualOptimization } = useFleet();
  const [heuristics, setHeuristics] = useState([]);
  const [optFeedback, setOptFeedback] = useState(null);

  useEffect(() => {
    fetchAreaHeuristics().then((data) => setHeuristics(data.heuristics || []));
  }, []);

  const handleOptimizeRoute = async (routeId) => {
    setOptFeedback(null);
    const res = await triggerManualOptimization(routeId);
    const r = res?.optimizationResult;
    if (r) {
      setOptFeedback(
        `Deterministic NN + 2-Opt completed (${r.iterations} iterations, ${r.swapsPerformed} swaps). Total distance: ${r.totalRouteDistanceKm} km. Capacity check: ${r.capacityCheck.utilizationPct}% utilized.`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <RouteIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">
              Fleet Routes, Stop Sequencing & Vehicle Capacity Tracker
            </h1>
            <p className="text-xs text-slate-400">
              Inspect stop sequences, delivery time windows, historical + area/hour delay predictions, and trigger deterministic 2-Opt re-sequencing
            </p>
          </div>
        </div>
      </div>

      {optFeedback && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{optFeedback}</span>
        </div>
      )}

      {/* Route Tables */}
      <RouteTable routes={routes} onOptimizeRoute={handleOptimizeRoute} />

      {/* Area & Hourly Delay Prediction Heuristics Reference */}
      {heuristics.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">
              Historical Area & Hourly Delay Prediction Heuristics Engine
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {heuristics.map((h) => (
              <div
                key={h.area}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
              >
                <div className="font-bold text-white">{h.area}</div>
                <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-amber-400">
                  <span>Base: +{h.baseDelayMins}m</span>
                  <span>Peak: {h.peakHourMultiplier}x</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                  {h.riskNote}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

