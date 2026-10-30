import crypto from 'crypto';
import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase.js';
import { predictStopDelay } from './delayPredictor.js';
import { fetchOsrmRouteGeometry } from './optimizer.js';

export const DEFAULT_FLEET_ID = process.env.DEFAULT_FLEET_ID || '11111111-1111-1111-1111-111111111111';

// SSE clients subscribed per fleetId for real-time updates
const sseClients = new Map();

export function addSseClient(fleetId, res) {
    if (!sseClients.has(fleetId)) {
        sseClients.set(fleetId, new Set());
    }
    sseClients.get(fleetId).add(res);
}

export function removeSseClient(fleetId, res) {
    if (sseClients.has(fleetId)) {
        sseClients.get(fleetId).delete(res);
    }
}

export function broadcastRealtimeEvent(fleetId, eventName, payload) {
    const clients = sseClients.get(fleetId);
    if (!clients) return;
    const message = `data: ${JSON.stringify({ event: eventName, payload, timestamp: new Date().toISOString() })}\n\n`;
    for (const res of clients) {
        try {
            res.write(message);
        } catch {
            clients.delete(res);
        }
    }
}

function createInitialSeedState(fleetId = DEFAULT_FLEET_ID) {
    const now = Date.now();
    const minMs = 60 * 1000;
    const todayStr = new Date().toISOString().split('T')[0];

    const vehicles = [
        {
            id: '22222222-2222-2222-2222-222222222201',
            fleet_id: fleetId,
            name: 'Van Alpha-01 (Tata Ace EV)',
            vehicle_type: 'Van',
            driver_id: '00000000-0000-0000-0000-000000000002',
            driver_name: 'Karthik Sundaram',
            status: 'active',
            current_lat: 13.0620,
            current_lng: 80.2610,
            capacity_max: 120,
            capacity_current: 75,
            created_at: new Date(now - 120 * minMs).toISOString()
        },
        {
            id: '22222222-2222-2222-2222-222222222202',
            fleet_id: fleetId,
            name: 'Truck Beta-02 (Ashok Leyland)',
            vehicle_type: 'Cargo Truck',
            driver_id: null,
            driver_name: 'Anitha Krishnan',
            status: 'active',
            current_lat: 13.0125,
            current_lng: 80.2205,
            capacity_max: 200,
            capacity_current: 110,
            created_at: new Date(now - 120 * minMs).toISOString()
        },
        {
            id: '22222222-2222-2222-2222-222222222203',
            fleet_id: fleetId,
            name: 'E-Bike Gamma-03 (Ather Cargo)',
            vehicle_type: 'Electric Bike',
            driver_id: null,
            driver_name: 'Pradeep Kumar',
            status: 'active',
            current_lat: 13.0365,
            current_lng: 80.2675,
            capacity_max: 45,
            capacity_current: 25,
            created_at: new Date(now - 120 * minMs).toISOString()
        },
        {
            id: '22222222-2222-2222-2222-222222222204',
            fleet_id: fleetId,
            name: 'Van Delta-04 (Mahindra Reserve)',
            vehicle_type: 'Van',
            driver_id: null,
            driver_name: 'Divya Natarajan',
            status: 'active',
            current_lat: 13.0732,
            current_lng: 80.2609,
            capacity_max: 120,
            capacity_current: 20,
            created_at: new Date(now - 120 * minMs).toISOString()
        }
    ];

    const routes = [
        {
            id: '33333333-3333-3333-3333-333333333301',
            fleet_id: fleetId,
            vehicle_id: '22222222-2222-2222-2222-222222222201',
            name: 'Route 1 — Anna Salai, T. Nagar & Nungambakkam',
            date: todayStr,
            status: 'in_progress',
            total_distance_km: 12.6,
            estimated_duration_mins: 78,
            created_at: new Date(now - 100 * minMs).toISOString()
        },
        {
            id: '33333333-3333-3333-3333-333333333302',
            fleet_id: fleetId,
            vehicle_id: '22222222-2222-2222-2222-222222222202',
            name: 'Route 2 — Guindy, Velachery & OMR IT Corridor',
            date: todayStr,
            status: 'in_progress',
            total_distance_km: 16.4,
            estimated_duration_mins: 105,
            created_at: new Date(now - 100 * minMs).toISOString()
        },
        {
            id: '33333333-3333-3333-3333-333333333303',
            fleet_id: fleetId,
            vehicle_id: '22222222-2222-2222-2222-222222222203',
            name: 'Route 3 — Mylapore, Adyar & Besant Nagar',
            date: todayStr,
            status: 'planned',
            total_distance_km: 9.2,
            estimated_duration_mins: 58,
            created_at: new Date(now - 100 * minMs).toISOString()
        }
    ];

    const stops = [
        // Route 1 Stops (Central Chennai: Anna Salai -> T. Nagar -> Nungambakkam)
        {
            id: '44444444-4444-4444-4444-444444444401',
            route_id: '33333333-3333-3333-3333-333333333301',
            sequence_order: 1,
            customer_name: 'Apollo Pharmacy Regional Hub',
            customer_phone: '+91-98401-10101',
            address: '21 Greams Road, Thousand Lights, Chennai, TN',
            area_zone: 'Anna Salai',
            lat: 13.0604,
            lng: 80.2545,
            time_window_start: '08:30:00',
            time_window_end: '10:00:00',
            estimated_arrival: new Date(now - 25 * minMs).toISOString(),
            status: 'completed',
            historical_delay_mins: 5,
            package_load: 20,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444402',
            route_id: '33333333-3333-3333-3333-333333333301',
            sequence_order: 2,
            customer_name: 'Saravana Stores Commercial',
            customer_phone: '+91-98401-10102',
            address: '45 Usman Road, T. Nagar, Chennai, TN',
            area_zone: 'T. Nagar',
            lat: 13.0418,
            lng: 80.2341,
            time_window_start: '09:00:00',
            time_window_end: '11:00:00',
            estimated_arrival: new Date(now + 14 * minMs).toISOString(),
            status: 'in_progress',
            historical_delay_mins: 12,
            package_load: 25,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444403',
            route_id: '33333333-3333-3333-3333-333333333301',
            sequence_order: 3,
            customer_name: 'Nalli Silk Heritage Plaza',
            customer_phone: '+91-98401-10103',
            address: '9 Nageswaran Rd, Panagal Park, T. Nagar, Chennai, TN',
            area_zone: 'T. Nagar',
            lat: 13.0402,
            lng: 80.2312,
            time_window_start: '10:00:00',
            time_window_end: '12:00:00',
            estimated_arrival: new Date(now + 42 * minMs).toISOString(),
            status: 'pending',
            historical_delay_mins: 10,
            package_load: 15,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444404',
            route_id: '33333333-3333-3333-3333-333333333301',
            sequence_order: 4,
            customer_name: 'KNK Road Lifestyle Studio',
            customer_phone: '+91-98401-10104',
            address: '14 Khader Nawaz Khan Rd, Nungambakkam, Chennai, TN',
            area_zone: 'Nungambakkam',
            lat: 13.0615,
            lng: 80.2468,
            time_window_start: '10:30:00',
            time_window_end: '12:30:00',
            estimated_arrival: new Date(now + 72 * minMs).toISOString(),
            status: 'pending',
            historical_delay_mins: 7,
            package_load: 15,
            created_at: new Date(now - 90 * minMs).toISOString()
        },

        // Route 2 Stops (South-West & OMR IT Corridor: Guindy -> Velachery -> Taramani -> Perungudi)
        {
            id: '44444444-4444-4444-4444-444444444405',
            route_id: '33333333-3333-3333-3333-333333333302',
            sequence_order: 1,
            customer_name: 'Olympia Tech Park Logistics',
            customer_phone: '+91-98402-20201',
            address: '1 SIDCO Industrial Estate, Guindy, Chennai, TN',
            area_zone: 'Guindy',
            lat: 13.0102,
            lng: 80.2155,
            time_window_start: '09:00:00',
            time_window_end: '10:30:00',
            estimated_arrival: new Date(now - 15 * minMs).toISOString(),
            status: 'completed',
            historical_delay_mins: 8,
            package_load: 30,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444406',
            route_id: '33333333-3333-3333-3333-333333333302',
            sequence_order: 2,
            customer_name: 'Phoenix Marketcity Retail Dock',
            customer_phone: '+91-98402-20202',
            address: '142 Velachery Main Rd, Velachery, Chennai, TN',
            area_zone: 'Velachery',
            lat: 12.9915,
            lng: 80.2167,
            time_window_start: '09:30:00',
            time_window_end: '11:30:00',
            estimated_arrival: new Date(now + 18 * minMs).toISOString(),
            status: 'in_progress',
            historical_delay_mins: 13,
            package_load: 25,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444407',
            route_id: '33333333-3333-3333-3333-333333333302',
            sequence_order: 3,
            customer_name: 'IIT Madras Research Park',
            customer_phone: '+91-98402-20203',
            address: 'Kanagam Rd, Taramani, Chennai, TN',
            area_zone: 'OMR Taramani',
            lat: 12.9902,
            lng: 80.2429,
            time_window_start: '10:00:00',
            time_window_end: '12:00:00',
            estimated_arrival: new Date(now + 46 * minMs).toISOString(),
            status: 'pending',
            historical_delay_mins: 9,
            package_load: 30,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444408',
            route_id: '33333333-3333-3333-3333-333333333302',
            sequence_order: 4,
            customer_name: 'TIDEL Park IT Campus',
            customer_phone: '+91-98402-20204',
            address: '4 Rajiv Gandhi Salai (OMR), Taramani, Chennai, TN',
            area_zone: 'OMR Taramani',
            lat: 12.9896,
            lng: 80.2486,
            time_window_start: '10:30:00',
            time_window_end: '12:30:00',
            estimated_arrival: new Date(now + 75 * minMs).toISOString(),
            status: 'pending',
            historical_delay_mins: 11,
            package_load: 15,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444409',
            route_id: '33333333-3333-3333-3333-333333333302',
            sequence_order: 5,
            customer_name: 'World Trade Center Perungudi',
            customer_phone: '+91-98402-20205',
            address: 'Brigade WTC, OMR Perungudi, Chennai, TN',
            area_zone: 'Perungudi',
            lat: 12.9685,
            lng: 80.2461,
            time_window_start: '11:00:00',
            time_window_end: '13:00:00',
            estimated_arrival: new Date(now + 105 * minMs).toISOString(),
            status: 'pending',
            historical_delay_mins: 7,
            package_load: 10,
            created_at: new Date(now - 90 * minMs).toISOString()
        },

        // Route 3 Stops (Coastal South Chennai: Mylapore -> Adyar -> Besant Nagar)
        {
            id: '44444444-4444-4444-4444-444444444410',
            route_id: '33333333-3333-3333-3333-333333333303',
            sequence_order: 1,
            customer_name: 'Mylapore Kapaleeshwarar Mart',
            customer_phone: '+91-98403-30301',
            address: '18 R.K. Mutt Rd, Mylapore, Chennai, TN',
            area_zone: 'Mylapore',
            lat: 13.0334,
            lng: 80.2687,
            time_window_start: '09:30:00',
            time_window_end: '11:00:00',
            estimated_arrival: new Date(now + 10 * minMs).toISOString(),
            status: 'in_progress',
            historical_delay_mins: 8,
            package_load: 10,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444411',
            route_id: '33333333-3333-3333-3333-333333333303',
            sequence_order: 2,
            customer_name: 'Adyar Ananda Bhavan Central',
            customer_phone: '+91-98403-30302',
            address: '53 LB Road, Adyar, Chennai, TN',
            area_zone: 'Adyar',
            lat: 13.0063,
            lng: 80.2574,
            time_window_start: '10:00:00',
            time_window_end: '11:30:00',
            estimated_arrival: new Date(now + 38 * minMs).toISOString(),
            status: 'pending',
            historical_delay_mins: 7,
            package_load: 8,
            created_at: new Date(now - 90 * minMs).toISOString()
        },
        {
            id: '44444444-4444-4444-4444-444444444412',
            route_id: '33333333-3333-3333-3333-333333333303',
            sequence_order: 3,
            customer_name: "Elliot's Beach Organic Cafe",
            customer_phone: '+91-98403-30303',
            address: '4th Main Rd, Besant Nagar, Chennai, TN',
            area_zone: 'Besant Nagar',
            lat: 12.9996,
            lng: 80.2685,
            time_window_start: '10:30:00',
            time_window_end: '12:30:00',
            estimated_arrival: new Date(now + 68 * minMs).toISOString(),
            status: 'pending',
            historical_delay_mins: 5,
            package_load: 7,
            created_at: new Date(now - 90 * minMs).toISOString()
        }
    ];

    const disruption_events = [
        {
            id: '55555555-5555-5555-5555-555555555501',
            fleet_id: fleetId,
            route_id: '33333333-3333-3333-3333-333333333301',
            vehicle_id: '22222222-2222-2222-2222-222222222201',
            event_type: 'road_closure',
            severity: 'medium',
            description: 'Morning CMRL Metro Phase-II barricade adjustment near Gemini Flyover (Anna Salai) — cleared at 08:45 AM.',
            lat: 13.0542,
            lng: 80.2512,
            resolved: true,
            created_at: new Date(now - 60 * minMs).toISOString()
        }
    ];

    const decision_traces = [
        {
            id: '66666666-6666-6666-6666-666666666601',
            fleet_id: fleetId,
            event_id: '55555555-5555-5555-5555-555555555501',
            step_number: 1,
            thought: 'Morning Chennai fleet initialization complete. Loaded 3 active routes, 4 vehicles, and 12 scheduled delivery stops across Chennai, Tamil Nadu.',
            tool_called: 'fleet_telemetry_sync',
            tool_input: { fleet_id: fleetId, region: 'Chennai, Tamil Nadu', active_routes: 3, total_stops: 12 },
            tool_output: { status: 'healthy', sla_compliance_rate: '100%', osrm_engine: 'ready' },
            created_at: new Date(now - 58 * minMs).toISOString()
        }
    ];

    const customer_notifications = [];

    return {
        vehicles,
        routes,
        stops,
        disruption_events,
        decision_traces,
        customer_notifications,
        routeGeometries: new Map()
    };
}

const memoryStore = createInitialSeedState(DEFAULT_FLEET_ID);

export async function ensureSupabaseSeeded(fleetId = DEFAULT_FLEET_ID) {
    if (!isSupabaseConfigured()) return;
    try {
        const supabase = getSupabaseAdmin();
        const { error: checkErr } = await supabase
            .from('vehicles')
            .select('id')
            .eq('fleet_id', fleetId)
            .limit(1);

        if (checkErr) {
            console.log(`[Supabase] Note: Tables not yet created (${checkErr.message}). Using hybrid Chennai store.`);
            return;
        }

        // Upsert Chennai, Tamil Nadu fleet vehicles, routes, and stops so Supabase matches Chennai coordinates
        await supabase.from('vehicles').upsert(
            memoryStore.vehicles.map(v => ({
                id: v.id,
                fleet_id: v.fleet_id,
                name: v.name,
                status: v.status,
                current_lat: v.current_lat,
                current_lng: v.current_lng,
                capacity_max: v.capacity_max,
                capacity_current: v.capacity_current
            }))
        );
        await supabase.from('routes').upsert(
            memoryStore.routes.map(r => ({
                id: r.id,
                fleet_id: r.fleet_id,
                vehicle_id: r.vehicle_id,
                name: r.name,
                date: r.date,
                status: r.status
            }))
        );
        await supabase.from('stops').upsert(
            memoryStore.stops.map(s => ({
                id: s.id,
                route_id: s.route_id,
                sequence_order: s.sequence_order,
                customer_name: s.customer_name,
                customer_phone: s.customer_phone,
                address: s.address,
                lat: s.lat,
                lng: s.lng,
                time_window_start: s.time_window_start,
                time_window_end: s.time_window_end,
                estimated_arrival: s.estimated_arrival,
                status: s.status,
                historical_delay_mins: s.historical_delay_mins
            }))
        );
        console.log('[Supabase] Synced Chennai, Tamil Nadu fleet routes & stops in PostgreSQL!');
    } catch (err) {
        console.warn('[Supabase] Seed sync warning:', err.message);
    }
}

export async function resetMemoryStore(fleetId = DEFAULT_FLEET_ID) {
    const fresh = createInitialSeedState(fleetId);
    memoryStore.vehicles = fresh.vehicles;
    memoryStore.routes = fresh.routes;
    memoryStore.stops = fresh.stops;
    memoryStore.disruption_events = fresh.disruption_events;
    memoryStore.decision_traces = fresh.decision_traces;
    memoryStore.customer_notifications = fresh.customer_notifications;
    memoryStore.routeGeometries.clear();
    await ensureSupabaseSeeded(fleetId);
    broadcastRealtimeEvent(fleetId, 'fleet_reset', { fleetId });
    return fresh;
}

/**
 * Fetch complete fleet operational snapshot (routes, stops with delay predictions & polylines, vehicles, events)
 */
export async function getFleetRoutesAndStops(fleetId = DEFAULT_FLEET_ID) {
    let vehicles = memoryStore.vehicles;
    let routes = memoryStore.routes;
    let stops = memoryStore.stops;
    let events = memoryStore.disruption_events;

    if (isSupabaseConfigured()) {
        try {
            const supabase = getSupabaseAdmin();
            const [vRes, rRes, eRes] = await Promise.all([
                supabase.from('vehicles').select('*').eq('fleet_id', fleetId),
                supabase.from('routes').select('*').eq('fleet_id', fleetId),
                supabase.from('disruption_events').select('*').eq('fleet_id', fleetId).order('created_at', { ascending: false })
            ]);

            if (!vRes.error && vRes.data?.length > 0) {
                // Enrich with driver_name & vehicle_type from memoryStore if columns aren't in DB
                vehicles = vRes.data.map(v => {
                    const localMatch = memoryStore.vehicles.find(mv => mv.id === v.id);
                    return {
                        ...localMatch,
                        ...v,
                        driver_name: v.driver_name || localMatch?.driver_name || 'Assigned Driver',
                        vehicle_type: v.vehicle_type || localMatch?.vehicle_type || 'Van'
                    };
                });
            }
            if (!rRes.error && rRes.data?.length > 0) {
                routes = rRes.data;
                const routeIds = routes.map(r => r.id);
                const sRes = await supabase
                    .from('stops')
                    .select('*')
                    .in('route_id', routeIds)
                    .order('sequence_order', { ascending: true });
                if (!sRes.error && sRes.data?.length > 0) {
                    stops = sRes.data.map(s => {
                        const localStop = memoryStore.stops.find(ms => ms.id === s.id);
                        return {
                            ...localStop,
                            ...s,
                            previous_sequence_order: localStop?.previous_sequence_order
                        };
                    });
                }
            }
            if (!eRes.error && eRes.data && eRes.data.length > 0) {
                events = eRes.data.map(ev => {
                    const localEv = memoryStore.disruption_events.find(me => me.id === ev.id);
                    return {
                        ...localEv,
                        ...ev,
                        reported_by_role: localEv?.reported_by_role || 'dispatcher',
                        reported_by_name: localEv?.reported_by_name || null,
                        vehicle_name: localEv?.vehicle_name || null
                    };
                });
            }
        } catch (err) {
            console.warn('[DataStore] Using local store fallback for getFleetRoutesAndStops:', err.message);
        }
    }

    const activeClosures = events
        .filter(e => !e.resolved && e.event_type === 'road_closure' && e.lat != null && e.lng != null)
        .map(e => ({ lat: e.lat, lng: e.lng, radiusKm: 0.75, routeId: e.route_id }));

    const enrichedRoutes = await Promise.all(
        routes.map(async route => {
            const vehicle = vehicles.find(v => v.id === route.vehicle_id) || null;
            const routeStops = stops
                .filter(s => s.route_id === route.id)
                .sort((a, b) => a.sequence_order - b.sequence_order)
                .map(stop => {
                    const delayPrediction = predictStopDelay(stop, events);
                    return {
                        ...stop,
                        delayPrediction
                    };
                });

            const routeClosures = activeClosures.filter(c => !c.routeId || c.routeId === route.id);
            const cacheKey = `${route.id}:${routeStops.map(s => `${s.id}-${s.sequence_order}-${s.lat}`).join(',')}:${routeClosures.length}`;

            let geometryData = memoryStore.routeGeometries.get(cacheKey);
            if (!geometryData) {
                const waypoints = [
                    ...(vehicle?.current_lat && vehicle?.current_lng
                        ? [{ lat: vehicle.current_lat, lng: vehicle.current_lng }]
                        : []),
                    ...routeStops.map(s => ({ lat: s.lat, lng: s.lng }))
                ];
                geometryData = await fetchOsrmRouteGeometry(waypoints, routeClosures);
                memoryStore.routeGeometries.set(cacheKey, geometryData);
            }

            const totalLoad = routeStops
                .filter(s => s.status !== 'completed')
                .reduce((sum, s) => sum + (Number(s.package_load) || 15), 0);

            return {
                ...route,
                vehicle,
                stops: routeStops,
                polyline: geometryData.geometry,
                total_distance_km: route.total_distance_km || geometryData.distanceKm,
                estimated_duration_mins: route.estimated_duration_mins || geometryData.durationMins,
                osrm_source: geometryData.source,
                active_package_load: totalLoad
            };
        })
    );

    return {
        fleetId,
        vehicles,
        routes: enrichedRoutes,
        events
    };
}

/**
 * Create a new disruption event
 */
export async function createDisruptionEvent(eventPayload) {
    const newEvent = {
        id: crypto.randomUUID(),
        fleet_id: eventPayload.fleetId || DEFAULT_FLEET_ID,
        route_id: eventPayload.routeId || null,
        vehicle_id: eventPayload.vehicleId || null,
        event_type: eventPayload.eventType,
        severity: eventPayload.severity || 'high',
        description: eventPayload.description,
        lat: eventPayload.lat ?? 12.9915,
        lng: eventPayload.lng ?? 80.2310,
        reported_by_role: eventPayload.reportedByRole || 'dispatcher',
        reported_by_name: eventPayload.reportedByName || null,
        vehicle_name: eventPayload.vehicleName || null,
        resolved: false,
        created_at: new Date().toISOString()
    };

    memoryStore.disruption_events.unshift(newEvent);

    if (isSupabaseConfigured()) {
        try {
            const supabase = getSupabaseAdmin();
            await supabase.from('disruption_events').insert({
                id: newEvent.id,
                fleet_id: newEvent.fleet_id,
                route_id: newEvent.route_id,
                vehicle_id: newEvent.vehicle_id,
                event_type: newEvent.event_type,
                description: newEvent.description,
                lat: newEvent.lat,
                lng: newEvent.lng,
                resolved: newEvent.resolved
            });
        } catch (err) {
            console.warn('[DataStore] Supabase insert disruption_event fallback:', err.message);
        }
    }

    broadcastRealtimeEvent(newEvent.fleet_id, 'disruption_created', newEvent);
    return newEvent;
}

/**
 * Record an agent decision trace step
 */
export async function recordDecisionTrace({
    fleetId = DEFAULT_FLEET_ID,
    eventId,
    stepNumber,
    thought,
    toolCalled,
    toolInput,
    toolOutput
}) {
    const trace = {
        id: crypto.randomUUID(),
        fleet_id: fleetId,
        event_id: eventId,
        step_number: stepNumber,
        thought,
        tool_called: toolCalled || null,
        tool_input: toolInput || {},
        tool_output: toolOutput || {},
        created_at: new Date().toISOString()
    };

    memoryStore.decision_traces.push(trace);

    if (isSupabaseConfigured()) {
        try {
            const supabase = getSupabaseAdmin();
            await supabase.from('decision_traces').insert(trace);
        } catch (err) {
            console.warn('[DataStore] Supabase insert decision_trace fallback:', err.message);
        }
    }

    broadcastRealtimeEvent(fleetId, 'decision_trace_added', trace);
    return trace;
}

/**
 * Persist updated route stops, vehicle statuses, and route metadata after optimization
 */
export async function updateRouteAndStopsAfterOptimization({
    fleetId = DEFAULT_FLEET_ID,
    routeId,
    updatedStops,
    newVehicleId,
    brokenVehicleId,
    totalDistanceKm,
    estimatedDurationMins
}) {
    for (const uStop of updatedStops) {
        const idx = memoryStore.stops.findIndex(s => s.id === uStop.id);
        if (idx !== -1) {
            memoryStore.stops[idx] = {
                ...memoryStore.stops[idx],
                sequence_order: uStop.sequence_order,
                previous_sequence_order: uStop.previous_sequence_order,
                estimated_arrival: uStop.estimated_arrival,
                status: uStop.status,
                route_id: uStop.route_id || routeId
            };
        }
    }

    const rIdx = memoryStore.routes.findIndex(r => r.id === routeId);
    if (rIdx !== -1) {
        memoryStore.routes[rIdx] = {
            ...memoryStore.routes[rIdx],
            vehicle_id: newVehicleId || memoryStore.routes[rIdx].vehicle_id,
            status: 'reoptimized',
            total_distance_km: totalDistanceKm ?? memoryStore.routes[rIdx].total_distance_km,
            estimated_duration_mins: estimatedDurationMins ?? memoryStore.routes[rIdx].estimated_duration_mins
        };
    }

    if (brokenVehicleId) {
        const vIdx = memoryStore.vehicles.findIndex(v => v.id === brokenVehicleId);
        if (vIdx !== -1) {
            memoryStore.vehicles[vIdx].status = 'broken_down';
        }
    }

    memoryStore.routeGeometries.clear();

    if (isSupabaseConfigured()) {
        try {
            const supabase = getSupabaseAdmin();
            for (const uStop of updatedStops) {
                await supabase
                    .from('stops')
                    .update({
                        sequence_order: uStop.sequence_order,
                        estimated_arrival: uStop.estimated_arrival,
                        status: uStop.status
                    })
                    .eq('id', uStop.id);
            }
            if (newVehicleId) {
                await supabase.from('routes').update({ vehicle_id: newVehicleId, status: 'reoptimized' }).eq('id', routeId);
            }
            if (brokenVehicleId) {
                await supabase.from('vehicles').update({ status: 'broken_down' }).eq('id', brokenVehicleId);
            }
        } catch (err) {
            console.warn('[DataStore] Supabase update stops/routes fallback:', err.message);
        }
    }

    broadcastRealtimeEvent(fleetId, 'routes_updated', { routeId, updatedStopsCount: updatedStops.length });
}

/**
 * Queue a customer notification draft awaiting dispatcher approval
 */
export async function createCustomerNotification({
    fleetId = DEFAULT_FLEET_ID,
    stopId,
    eventId,
    message,
    originalEta,
    proposedEta,
    routeChangeSummary
}) {
    const stop = memoryStore.stops.find(s => s.id === stopId) || null;
    const route = stop ? memoryStore.routes.find(r => r.id === stop.route_id) : null;

    const notification = {
        id: crypto.randomUUID(),
        fleet_id: fleetId,
        stop_id: stopId,
        event_id: eventId || null,
        message,
        status: 'pending_approval',
        original_eta: originalEta || stop?.estimated_arrival,
        proposed_eta: proposedEta || stop?.estimated_arrival,
        route_change_summary: routeChangeSummary || null,
        stop: stop
            ? {
                  id: stop.id,
                  customer_name: stop.customer_name,
                  customer_phone: stop.customer_phone,
                  address: stop.address,
                  sequence_order: stop.sequence_order,
                  previous_sequence_order: stop.previous_sequence_order,
                  time_window_start: stop.time_window_start,
                  time_window_end: stop.time_window_end,
                  estimated_arrival: stop.estimated_arrival
              }
            : null,
        route_name: route?.name || 'Active Chennai Route',
        created_at: new Date().toISOString()
    };

    memoryStore.customer_notifications.unshift(notification);

    if (isSupabaseConfigured()) {
        try {
            const supabase = getSupabaseAdmin();
            await supabase.from('customer_notifications').insert({
                id: notification.id,
                fleet_id: notification.fleet_id,
                stop_id: notification.stop_id,
                message: notification.message,
                status: notification.status
            });
        } catch (err) {
            console.warn('[DataStore] Supabase insert customer_notification fallback:', err.message);
        }
    }

    broadcastRealtimeEvent(fleetId, 'notification_created', notification);
    return notification;
}

/**
 * Get pending (and recent historical) customer notifications for a fleet
 */
export async function getNotificationsForFleet(fleetId = DEFAULT_FLEET_ID) {
    let list = memoryStore.customer_notifications.filter(n => n.fleet_id === fleetId);

    if (isSupabaseConfigured() && list.length === 0) {
        try {
            const supabase = getSupabaseAdmin();
            const { data, error } = await supabase
                .from('customer_notifications')
                .select('*, stops(*)')
                .eq('fleet_id', fleetId)
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                list = data.map(row => ({
                    ...row,
                    stop: row.stops || memoryStore.stops.find(s => s.id === row.stop_id) || null
                }));
            }
        } catch (err) {
            console.warn('[DataStore] Using local store for getNotificationsForFleet:', err.message);
        }
    }

    return list;
}

/**
 * Approve or reject a customer notification
 */
export async function approveOrRejectNotification({ notificationId, approvedMessage, action = 'approve' }) {
    const newStatus = action === 'reject' ? 'rejected' : 'sent';
    let updated = null;

    const idx = memoryStore.customer_notifications.findIndex(n => n.id === notificationId);
    if (idx !== -1) {
        memoryStore.customer_notifications[idx] = {
            ...memoryStore.customer_notifications[idx],
            message: approvedMessage || memoryStore.customer_notifications[idx].message,
            status: newStatus,
            dispatched_at: new Date().toISOString()
        };
        updated = memoryStore.customer_notifications[idx];
    }

    if (isSupabaseConfigured()) {
        try {
            const supabase = getSupabaseAdmin();
            const { data, error } = await supabase
                .from('customer_notifications')
                .update({
                    message: approvedMessage,
                    status: newStatus
                })
                .eq('id', notificationId)
                .select()
                .single();

            if (!error && data && !updated) {
                updated = data;
            }
        } catch (err) {
            console.warn('[DataStore] Supabase update customer_notification fallback:', err.message);
        }
    }

    if (updated) {
        broadcastRealtimeEvent(updated.fleet_id || DEFAULT_FLEET_ID, 'notification_updated', updated);
    }

    return updated;
}

/**
 * Fetch decision traces for a fleet
 */
export async function getDecisionTracesForFleet(fleetId = DEFAULT_FLEET_ID) {
    let traces = memoryStore.decision_traces
        .filter(t => t.fleet_id === fleetId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.step_number - a.step_number);

    if (isSupabaseConfigured() && traces.length <= 1) {
        try {
            const supabase = getSupabaseAdmin();
            const { data, error } = await supabase
                .from('decision_traces')
                .select('*')
                .eq('fleet_id', fleetId)
                .order('created_at', { ascending: false });

            if (!error && data && data.length > 0) {
                traces = data;
            }
        } catch (err) {
            console.warn('[DataStore] Using local store for getDecisionTracesForFleet:', err.message);
        }
    }

    return traces;
}

/**
 * Resolve a disruption event
 */
export async function resolveDisruptionEvent(eventId) {
    const idx = memoryStore.disruption_events.findIndex(e => e.id === eventId);
    let event = null;
    if (idx !== -1) {
        memoryStore.disruption_events[idx].resolved = true;
        event = memoryStore.disruption_events[idx];
        memoryStore.routeGeometries.clear();
    }

    if (isSupabaseConfigured()) {
        try {
            const supabase = getSupabaseAdmin();
            await supabase.from('disruption_events').update({ resolved: true }).eq('id', eventId);
        } catch (err) {
            console.warn('[DataStore] Supabase resolveDisruptionEvent fallback:', err.message);
        }
    }

    if (event) {
        broadcastRealtimeEvent(event.fleet_id, 'disruption_resolved', event);
    }
    return event;
}
