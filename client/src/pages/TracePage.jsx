import React from 'react';
import { Cpu, Sparkles, Route as RouteIcon, ShieldCheck } from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';
import DecisionTracePanel from '../components/DecisionTracePanel.tsx';

export default function TracePage() {
  const { traces, configStatus } = useFleet();

  return (
    <div className="space-y-6">
      {/* Architecture Pipeline Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <Sparkles className="h-4 w-4" /> 1. Event Triage (Gemini 2.5)
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Parses incoming disruption context, identifies impacted stops, and selects mitigation strategy.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <Cpu className="h-4 w-4" /> 2. Area/Hour Delay Engine
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Applies Chennai zone congestion factors & hourly traffic multipliers to project SLA risk.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
            <RouteIcon className="h-4 w-4" /> 3. Deterministic NN + 2-Opt
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Executes Nearest-Neighbor + 2-Opt local search with OSRM road network geometry & capacity checks.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> 4. Human-in-the-Loop Gate
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Drafts empathetic customer SMS updates and holds in Dispatcher Approval Queue ({configStatus.geminiConfigured ? 'Live Gemini' : 'AI Ready'}).
          </p>
        </div>
      </div>

      {/* Full-Height Decision Trace Console */}
      <DecisionTracePanel traces={traces} maxHeightClass="max-h-[680px]" />
    </div>
  );
}

