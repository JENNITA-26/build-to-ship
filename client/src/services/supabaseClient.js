import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isRealSupabaseConfig =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
  supabaseAnonKey !== 'your-supabase-anon-key' &&
  supabaseUrl.startsWith('http');

export const supabase = isRealSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function subscribeToSupabaseRealtime(fleetId, onRealtimeEvent) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`fleet-realtime-${fleetId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'disruption_events' },
      (payload) => onRealtimeEvent('disruption_events', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'decision_traces' },
      (payload) => onRealtimeEvent('decision_traces', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customer_notifications' },
      (payload) => onRealtimeEvent('customer_notifications', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stops' },
      (payload) => onRealtimeEvent('stops', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'vehicles' },
      (payload) => onRealtimeEvent('vehicles', payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

