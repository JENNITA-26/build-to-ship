import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, X, Sparkles, Database } from 'lucide-react';
import { updateBackendApiKeys } from '../services/api.js';
import { useFleet } from '../context/FleetContext.jsx';

interface ApiKeyModalProps {
  onClose: () => void;
}

export default function ApiKeyModal({ onClose }: ApiKeyModalProps) {
  const { configStatus, refreshAllData } = useFleet();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateBackendApiKeys({
        geminiApiKey: geminiApiKey.trim() || undefined,
        supabaseUrl: supabaseUrl.trim() || undefined,
        supabaseAnonKey: supabaseAnonKey.trim() || undefined,
        supabaseServiceRoleKey: supabaseServiceRoleKey.trim() || undefined
      });
      await refreshAllData();
      setMessage('Runtime API credentials updated! Live services are now active.');
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: any) {
      setMessage(err.message || 'Failed to update API keys');
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-0 text-slate-100 shadow-2xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Live API Keys & Cloud Configuration
              </h3>
              <p className="text-xs text-slate-400">
                Set credentials in <code className="text-indigo-300">server/.env</code> or apply them live below
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status Pills */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
            <div className="text-xs">
              <div className="font-medium text-slate-300">Gemini 2.5 Flash</div>
              <div className="flex items-center gap-1 mt-0.5">
                {configStatus.geminiConfigured ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Live SDK Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <AlertCircle className="h-3 w-3" /> Local AI Fallback
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <Database className="h-4 w-4 text-cyan-400 shrink-0" />
            <div className="text-xs">
              <div className="font-medium text-slate-300">Supabase PostgreSQL</div>
              <div className="flex items-center gap-1 mt-0.5">
                {configStatus.supabaseConfigured ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3 w-3" /> Cloud DB Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    <AlertCircle className="h-3 w-3" /> In-Memory + SSE Mode
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Google Gemini API Key (<code className="text-indigo-300">GEMINI_API_KEY</code>)
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy... (Leave blank to keep current)"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Supabase Project URL (<code className="text-cyan-300">SUPABASE_URL</code>)
            </label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Supabase Anon Key
              </label>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Supabase Service Role Key
              </label>
              <input
                type="password"
                value={supabaseServiceRoleKey}
                onChange={(e) => setSupabaseServiceRoleKey(e.target.value)}
                placeholder="eyJhbGciOi..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {message && (
            <div className="rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-3 py-2 text-xs text-indigo-200">
              {message}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? 'Applying...' : 'Apply Runtime Keys'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

