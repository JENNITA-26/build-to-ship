import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Truck,
  LayoutDashboard,
  Route as RouteIcon,
  AlertTriangle,
  MessageSquare,
  Terminal,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  LogOut,
  Radio
} from 'lucide-react';
import { useFleet } from '../context/FleetContext.jsx';

export default function Navbar() {
  const {
    user,
    logout,
    fleetId,
    pendingNotifications,
    events,
    agentBusy,
    realtimeConnected,
    handleResetSimulation
  } = useFleet();

  const navigate = useNavigate();

  const isDispatcher = user?.role === 'dispatcher';
  const activeDisruptionsCount = events.filter((e: any) => !e.resolved).length;
  const pendingCount = pendingNotifications.length;

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      to: '/routes',
      label: isDispatcher ? 'Routes & Stops' : 'My Route & Stops',
      icon: RouteIcon
    },
    {
      to: '/disruptions',
      label: isDispatcher ? 'Disruptions' : 'Report Road Issue',
      icon: AlertTriangle,
      badge: isDispatcher && activeDisruptionsCount > 0 ? activeDisruptionsCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    {
      to: '/approvals',
      label: isDispatcher ? 'Approval Queue' : 'My Stop Messages',
      icon: MessageSquare,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-rose-500 text-white animate-pulse'
    },
    ...(isDispatcher
      ? [{ to: '/trace', label: 'Decision Trace', icon: Terminal }]
      : [])
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Fleet Identifier */}
        <div className="flex items-center gap-4">
          <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/25">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">
                  RouteRescue
                </span>
                <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-400 border border-indigo-500/30">
                  {isDispatcher ? 'AI Dispatch Copilot' : 'Driver Portal'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-[11px]">
                  Fleet: {fleetId.slice(0, 8)}...
                </span>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <Radio className={`h-3 w-3 ${realtimeConnected ? 'animate-pulse' : ''}`} />
                  {realtimeConnected ? 'Realtime Sync' : 'Live Sync'}
                </span>
              </div>
            </div>
          </NavLink>
        </div>

        {/* Primary Navigation */}
        <nav className="hidden lg:flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold border ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right Controls: Vehicle Box (if Driver), Reset (if Dispatcher), Static Role Box & Sign Out */}
        <div className="flex items-center gap-2.5">
          {agentBusy && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-300">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Agent Re-Planning...</span>
            </div>
          )}

          {/* Normal Static Vehicle Type Box for Driver (No Dropdown) */}
          {!isDispatcher && user && (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200">
              <Truck className="h-3.5 w-3.5 text-cyan-400" />
              <span>{user.vehicleType || 'Van'}</span>
            </div>
          )}

          {/* Reset Demo State (Dispatcher Only) */}
          {isDispatcher && (
            <button
              type="button"
              onClick={handleResetSimulation}
              disabled={agentBusy}
              title="Reset morning routes & clear disruptions"
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:bg-slate-800 transition disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Reset Day</span>
            </button>
          )}

          {/* Static Role Badge (Must Sign Out & Log In to Switch Role) */}
          {user && (
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold select-none ${
                isDispatcher
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {isDispatcher ? (
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              ) : (
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span className="uppercase tracking-wider">{user.role}</span>
            </div>
          )}

          {/* Sign Out Button to return to /login */}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Sign Out to Switch Role or Vehicle"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-rose-500/40 hover:text-rose-400 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="flex lg:hidden items-center justify-around border-t border-slate-800/80 bg-slate-900/90 px-2 py-1.5 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </header>
  );
}
