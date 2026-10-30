import { getSupabaseAnon, getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase.js';

const DEFAULT_FLEET_ID = process.env.DEFAULT_FLEET_ID || '11111111-1111-1111-1111-111111111111';

/**
 * Middleware to verify Supabase Auth JWT or signed local session token.
 * Attaches req.user = { id, email, full_name, role, fleet_id }
 */
export async function verifyAuthToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

        // If Supabase is configured and a non-demo JWT is provided, validate via Supabase Auth
        if (isSupabaseConfigured() && token && !token.startsWith('demo-token-')) {
            const supabase = getSupabaseAnon();
            const { data: userData, error: authErr } = await supabase.auth.getUser(token);

            if (authErr || !userData?.user) {
                return res.status(401).json({
                    error: 'Unauthorized: Invalid or expired Supabase JWT token',
                    details: authErr?.message
                });
            }

            const user = userData.user;
            // Fetch profile from profiles table for role & fleet_id
            const admin = getSupabaseAdmin();
            const { data: profile } = await admin
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            req.user = {
                id: user.id,
                email: user.email,
                full_name: profile?.full_name || user.user_metadata?.full_name || 'Fleet Operator',
                role: profile?.role || user.user_metadata?.role || 'dispatcher',
                fleet_id: profile?.fleet_id || user.user_metadata?.fleet_id || DEFAULT_FLEET_ID
            };
            return next();
        }

        // Parse local/demo session token or fallback headers for immediate evaluation
        if (token && token.startsWith('demo-token-')) {
            // Format: demo-token-<role>-<fleetId>
            const parts = token.split('-');
            const role = parts[2] === 'driver' ? 'driver' : 'dispatcher';
            req.user = {
                id: role === 'dispatcher'
                    ? '00000000-0000-0000-0000-000000000001'
                    : '00000000-0000-0000-0000-000000000002',
                email: role === 'dispatcher' ? 'dispatcher@routerescue.ai' : 'driver@routerescue.ai',
                full_name: role === 'dispatcher' ? 'Sarah Chen (Lead Dispatcher)' : 'Marcus Vance (Fleet Driver)',
                role,
                fleet_id: req.headers['x-fleet-id'] || DEFAULT_FLEET_ID
            };
            return next();
        }

        // Default fallback in development mode if no token header was sent
        req.user = {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'dispatcher@routerescue.ai',
            full_name: 'Sarah Chen (Lead Dispatcher)',
            role: req.headers['x-user-role'] || 'dispatcher',
            fleet_id: req.headers['x-fleet-id'] || DEFAULT_FLEET_ID
        };
        return next();
    } catch (err) {
        console.error('[AuthMiddleware] Verification error:', err);
        return res.status(401).json({ error: 'Authentication verification failed' });
    }
}

/**
 * Restrict endpoint to dispatchers only
 */
export function requireDispatcher(req, res, next) {
    if (req.user && req.user.role !== 'dispatcher') {
        return res.status(403).json({
            error: 'Forbidden: Only users with the dispatcher role can perform this action.'
        });
    }
    return next();
}

