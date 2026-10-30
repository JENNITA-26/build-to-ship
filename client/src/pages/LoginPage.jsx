import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  ShieldCheck,
  UserCheck,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  Bike,
  Car,
  AlertCircle
} from 'lucide-react';
import { useFleet, DRIVER_VEHICLE_OPTIONS } from '../context/FleetContext.jsx';
import { supabase } from '../services/supabaseClient.js';

export default function LoginPage() {
  const { loginWithRole } = useFleet();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState('dispatcher');
  const [selectedVehicleType, setSelectedVehicleType] = useState('Van');
  const [email, setEmail] = useState('dispatcher@gmail.com');
  const [password, setPassword] = useState('1234567');
  const [fullName, setFullName] = useState('Sarah Chen');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const handleRoleSwitch = (role) => {
    setSelectedRole(role);
    setAuthError(null);
    if (role === 'dispatcher') {
      setEmail('dispatcher@gmail.com');
      setFullName('Sarah Chen (Lead Dispatcher)');
    } else {
      const preset =
        DRIVER_VEHICLE_OPTIONS.find((v) => v.vehicleType === selectedVehicleType) ||
        DRIVER_VEHICLE_OPTIONS[0];
      setEmail(preset.driverEmail);
      setFullName(`${preset.driverName} (${preset.label} Driver)`);
    }
  };

  const handleVehicleSelect = (vehicleOption) => {
    setSelectedVehicleType(vehicleOption.vehicleType);
    setEmail(vehicleOption.driverEmail);
    setFullName(`${vehicleOption.driverName} (${vehicleOption.label} Driver)`);
    setAuthError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // 1. Validate that email contains @gmail.com and has a username prefix before @gmail.com
    if (!trimmedEmail.endsWith('@gmail.com') || trimmedEmail.length <= '@gmail.com'.length) {
      setAuthError('Invalid email: Please enter a valid Gmail address ending with @gmail.com');
      return;
    }

    // 2. Validate that password is more than 6 digits/characters
    if (trimmedPassword.length <= 6) {
      setAuthError('Invalid password: Password must be more than 6 digits long (at least 7 characters).');
      return;
    }

    setLoading(true);

    try {
      if (supabase && trimmedPassword !== '1234567') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword
        });
        if (!error && data?.session) {
          loginWithRole(
            selectedRole,
            data.user.email,
            data.user.user_metadata?.full_name || fullName,
            data.session.access_token,
            selectedVehicleType
          );
          navigate('/dashboard');
          return;
        }
      }

      loginWithRole(selectedRole, trimmedEmail, fullName, undefined, selectedVehicleType);
      navigate('/dashboard');
    } catch (err) {
      setAuthError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full bg-indigo-600/15 blur-3xl" />

      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/30 mb-4">
            <Truck className="h-7 w-7 text-white" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-0.5 text-[11px] font-semibold text-indigo-300 mb-2">
            <Sparkles className="h-3 w-3" /> Powered by Gemini 2.5 Flash & 2-Opt Routing
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            RouteRescue Command
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            AI-Powered Fleet Disruption & Autonomous Re-Planning Dispatcher Agent
          </p>
        </div>

        {/* Role Selector Cards */}
        <div className="mt-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Select Operational Role
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleRoleSwitch('dispatcher')}
              className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
                selectedRole === 'dispatcher'
                  ? 'border-indigo-500 bg-indigo-500/15 text-white shadow-lg shadow-indigo-500/10'
                  : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
              }`}
            >
              <ShieldCheck
                className={`h-5 w-5 mb-1.5 ${
                  selectedRole === 'dispatcher' ? 'text-indigo-400' : 'text-slate-500'
                }`}
              />
              <div className="text-xs font-bold">Dispatcher</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Full control: inject events, run optimizer & approve SMS
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSwitch('driver')}
              className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
                selectedRole === 'driver'
                  ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-lg shadow-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
              }`}
            >
              <UserCheck
                className={`h-5 w-5 mb-1.5 ${
                  selectedRole === 'driver' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              />
              <div className="text-xs font-bold">Fleet Driver</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Field view: see your assigned vehicle route & stop messages
              </div>
            </button>
          </div>
        </div>

        {/* Driver Vehicle Type Selector (Shown when Driver role is selected) */}
        {selectedRole === 'driver' && (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-3.5">
            <label className="block text-xs font-bold text-emerald-300 mb-2">
              Which type of vehicle are you driving today?
            </label>
            <div className="grid grid-cols-1 gap-2">
              {DRIVER_VEHICLE_OPTIONS.map((vOpt) => {
                const isSelected = selectedVehicleType === vOpt.vehicleType;
                const VIcon =
                  vOpt.vehicleType === 'Electric Bike'
                    ? Bike
                    : vOpt.vehicleType === 'Cargo Truck'
                    ? Truck
                    : Car;

                return (
                  <button
                    key={vOpt.vehicleType}
                    type="button"
                    onClick={() => handleVehicleSelect(vOpt)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/20 text-white'
                        : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <VIcon
                        className={`h-4 w-4 ${
                          isSelected ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {vOpt.label} — <span className="text-emerald-300">{vOpt.vehicleName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {vOpt.routeName}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`h-3 w-3 rounded-full border ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-400'
                          : 'border-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Gmail Address <span className="text-slate-500">(must contain @gmail.com)</span>
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="yourname@gmail.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password <span className="text-slate-500">(more than 6 digits)</span>
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="Enter > 6 digits"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {authError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-cyan-500 transition"
          >
            <span>
              {loading
                ? 'Authenticating...'
                : selectedRole === 'dispatcher'
                ? 'Enter Command Center as Dispatcher'
                : `Start Route as ${selectedVehicleType} Driver`}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
