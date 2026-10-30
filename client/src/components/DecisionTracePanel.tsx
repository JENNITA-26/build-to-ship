import React, { useState } from 'react';
import {
  Terminal,
  Cpu,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Wrench,
  Sparkles
} from 'lucide-react';

interface DecisionTracePanelProps {
  traces: any[];
  maxHeightClass?: string;
}

export default function DecisionTracePanel({
  traces = [],
  maxHeightClass = 'max-h-[540px]'
}: DecisionTracePanelProps) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredTraces = traces.filter((t) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (t.thought && t.thought.toLowerCase().includes(q)) ||
      (t.tool_called && t.tool_called.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
      {/* Terminal Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <Terminal className="h-4 w-4 text-indigo-400 ml-1" />
          <span className="font-mono text-xs font-bold tracking-wide text-white">
            AGENT_DECISION_TRACE.LOG
          </span>
          <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
            {traces.length} steps
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter thoughts or tools..."
            className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Trace Stream Body */}
      <div className={`overflow-y-auto p-4 space-y-3 font-mono text-xs ${maxHeightClass}`}>
        {filteredTraces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
            <Cpu className="h-8 w-8 mb-2 text-slate-600" />
            <p>No agent decision traces match your filter.</p>
          </div>
        ) : (
          filteredTraces.map((trace, idx) => {
            const isExpanded = expandedIds[trace.id] ?? idx < 3;
            const isGeminiStep =
              trace.tool_called && trace.tool_called.toLowerCase().includes('gemini');
            const isOptimizerStep =
              trace.tool_called && trace.tool_called.toLowerCase().includes('optimizer');

            return (
              <div
                key={trace.id}
                className="rounded-xl border border-slate-800/90 bg-slate-900/60 transition hover:border-slate-700"
              >
                <div
                  onClick={() => toggleExpand(trace.id)}
                  className="flex cursor-pointer items-start justify-between gap-3 p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      className="mt-0.5 text-slate-400 hover:text-white"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                          STEP #{trace.step_number}
                        </span>

                        {trace.tool_called && (
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold border ${
                              isGeminiStep
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : isOptimizerStep
                                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isGeminiStep ? (
                              <Sparkles className="h-3 w-3" />
                            ) : (
                              <Wrench className="h-3 w-3" />
                            )}
                            {trace.tool_called}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="h-3 w-3" />
                          {new Date(trace.created_at).toLocaleTimeString()}
                        </span>
                      </div>

                      <p className="font-sans text-xs leading-relaxed text-slate-200">
                        {trace.thought}
                      </p>
                    </div>
                  </div>

                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                </div>

                {/* Expandable Tool Input / Output JSON Inspector */}
                {isExpanded && (trace.tool_input || trace.tool_output) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 border-t border-slate-800/80 bg-slate-950/80 p-3 text-[11px]">
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Tool Input Payload
                      </div>
                      <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 text-cyan-300">
                        {JSON.stringify(trace.tool_input || {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Tool Execution Output
                      </div>
                      <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 text-emerald-300">
                        {JSON.stringify(trace.tool_output || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

