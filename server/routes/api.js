import express from 'express';
import {
    DisruptionEventSchema,
    NotificationApprovalSchema,
    OptimizerRunSchema,
    RuntimeConfigSchema
} from '../schemas/validation.js';
import { verifyAuthToken, requireDispatcher } from '../middleware/auth.js';
import {
    DEFAULT_FLEET_ID,
    getFleetRoutesAndStops,
    createDisruptionEvent,
    recordDecisionTrace,
    updateRouteAndStopsAfterOptimization,
    createCustomerNotification,
    getNotificationsForFleet,
    approveOrRejectNotification,
    getDecisionTracesForFleet,
    resolveDisruptionEvent,
    resetMemoryStore,
    addSseClient,
    removeSseClient
} from '../services/dataStore.js';
import {
    optimizeRouteStops,
    findBackupVehicleForStrandedStops,
    formatReadableTime
} from '../services/optimizer.js';
import { analyzeDisruptionEvent, generateCustomerMessage } from '../services/gemini.js';
import { predictStopDelay, getAreaHeuristicsSummary } from '../services/delayPredictor.js';
import { getRuntimeConfig, updateRuntimeConfig } from '../config/supabase.js';

const router = express.Router();

/**
 * Real-time SSE Stream for live updates across Map, Decision Trace, and Approval Queue
 */
router.get('/stream/:fleetId', (req, res) => {
    const fleetId = req.params.fleetId || DEFAULT_FLEET_ID;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ event: 'connected', fleetId, timestamp: new Date().toISOString() })}\n\n`);
    addSseClient(fleetId, res);

    req.on('close', () => {
        removeSseClient(fleetId, res);
    });
});

/**
 * GET /api/config/status — Check backend integration status (Gemini & Supabase)
 */
router.get('/config/status', (req, res) => {
    const cfg = getRuntimeConfig();
    res.json({
        supabaseConfigured: cfg.supabaseConfigured,
        geminiConfigured: cfg.geminiConfigured,
        supabaseUrl: cfg.supabaseConfigured ? cfg.supabaseUrl : '',
        defaultFleetId: DEFAULT_FLEET_ID
    });
});

/**
 * POST /api/config/keys — Dynamically set API keys at runtime without server restart
 */
router.post('/config/keys', verifyAuthToken, (req, res) => {
    const parsed = RuntimeConfigSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid configuration payload', issues: parsed.error.issues });
    }
    const updated = updateRuntimeConfig(parsed.data);
    res.json({
        message: 'Runtime API keys updated successfully',
        supabaseConfigured: updated.supabaseConfigured,
        geminiConfigured: updated.geminiConfigured
    });
});

/**
 * GET /api/heuristics — Area & Hourly Delay Heuristics Reference
 */
router.get('/heuristics', verifyAuthToken, (req, res) => {
    res.json({ heuristics: getAreaHeuristicsSummary() });
});

/**
 * GET /api/routes/:fleetId — Retrieves active routes and stops with current delay predictions
 */
router.get('/routes/:fleetId', verifyAuthToken, async (req, res) => {
    try {
        const fleetId = req.params.fleetId || DEFAULT_FLEET_ID;
        const snapshot = await getFleetRoutesAndStops(fleetId);
        res.json(snapshot);
    } catch (err) {
        console.error('[GET /api/routes/:fleetId] Error:', err);
        res.status(500).json({ error: 'Failed to retrieve fleet routes', details: err.message });
    }
});

/**
 * GET /api/traces/:fleetId — Retrieves live decision trace logs for the fleet
 */
router.get('/traces/:fleetId', verifyAuthToken, async (req, res) => {
    try {
        const fleetId = req.params.fleetId || DEFAULT_FLEET_ID;
        const traces = await getDecisionTracesForFleet(fleetId);
        res.json({ traces });
    } catch (err) {
        console.error('[GET /api/traces/:fleetId] Error:', err);
        res.status(500).json({ error: 'Failed to retrieve decision traces', details: err.message });
    }
});

/**
 * GET /api/events/:fleetId — Retrieves disruption events
 */
router.get('/events/:fleetId', verifyAuthToken, async (req, res) => {
    try {
        const fleetId = req.params.fleetId || DEFAULT_FLEET_ID;
        const snapshot = await getFleetRoutesAndStops(fleetId);
        res.json({ events: snapshot.events });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch disruption events', details: err.message });
    }
});

/**
 * POST /api/events/:id/resolve — Marks a disruption event as resolved
 */
router.post('/events/:id/resolve', verifyAuthToken, async (req, res) => {
    try {
        const resolved = await resolveDisruptionEvent(req.params.id);
        const snapshot = await getFleetRoutesAndStops(resolved?.fleet_id || DEFAULT_FLEET_ID);
        res.json({ event: resolved, snapshot });
    } catch (err) {
        res.status(500).json({ error: 'Failed to resolve event', details: err.message });
    }
});

/**
 * POST /api/reset/:fleetId — Resets simulation data to clean morning state
 */
router.post('/reset/:fleetId', verifyAuthToken, requireDispatcher, async (req, res) => {
    try {
        const fleetId = req.params.fleetId || DEFAULT_FLEET_ID;
        resetMemoryStore(fleetId);
        const snapshot = await getFleetRoutesAndStops(fleetId);
        res.json({ message: 'Fleet state reset to morning baseline', snapshot });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reset fleet state', details: err.message });
    }
});

/**
 * POST /api/events — Injects a disruption event, triggers agent reasoning loop,
 * runs deterministic optimizer, drafts Gemini customer notifications, and creates decision traces.
 */
router.post('/events', verifyAuthToken, async (req, res) => {
    try {
        const validation = DisruptionEventSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed for disruption event payload',
                issues: validation.error.issues
            });
        }

        const payload = validation.data;
        const fleetId = payload.fleetId || DEFAULT_FLEET_ID;
        const snapshot = await getFleetRoutesAndStops(fleetId);

        // Identify target route & vehicle
        const targetRoute =
            snapshot.routes.find(r => r.id === payload.routeId) ||
            snapshot.routes.find(r => r.vehicle_id === payload.vehicleId) ||
            snapshot.routes[1] ||
            snapshot.routes[0];

        const targetVehicle =
            snapshot.vehicles.find(v => v.id === (payload.vehicleId || targetRoute?.vehicle_id)) ||
            targetRoute?.vehicle;

        const targetStops = targetRoute ? targetRoute.stops : [];
        const fallbackCoord = targetStops.find(s => s.status !== 'completed') || targetStops[0] || {
            lat: 12.9915,
            lng: 80.2167
        };

        // Create the disruption event record
        const createdEvent = await createDisruptionEvent({
            ...payload,
            routeId: targetRoute?.id,
            vehicleId: targetVehicle?.id,
            lat: payload.lat ?? fallbackCoord.lat,
            lng: payload.lng ?? fallbackCoord.lng
        });

        const generatedTraces = [];

        // ====================================================================
        // AGENT STEP 1: Event Ingestion & AI Impact Analysis (Gemini 2.5 Flash)
        // ====================================================================
        const aiAnalysis = await analyzeDisruptionEvent({
            eventId: createdEvent.id,
            eventType: createdEvent.event_type,
            description: createdEvent.description,
            routeStops: targetStops
        });

        const sourcePrefix =
            createdEvent.reported_by_role === 'driver'
                ? `[LIVE DRIVER FIELD REPORT — ${createdEvent.reported_by_name || 'Fleet Driver'}]`
                : `[Event Detection & Impact Triage]`;

        const traceStep1 = await recordDecisionTrace({
            fleetId,
            eventId: createdEvent.id,
            stepNumber: 1,
            thought: `${sourcePrefix} ${aiAnalysis.reasoning}`,
            toolCalled: 'analyze_disruption_event (gemini-2.5-flash)',
            toolInput: {
                eventId: createdEvent.id,
                reportedBy: createdEvent.reported_by_name || req.user?.full_name || 'Dispatcher',
                reportedByRole: createdEvent.reported_by_role || req.user?.role || 'dispatcher',
                eventType: createdEvent.event_type,
                routeName: targetRoute?.name,
                description: createdEvent.description
            },
            toolOutput: {
                affectedStopIds: aiAnalysis.affectedStopIds,
                affectedStopsCount: aiAnalysis.affectedStopIds.length,
                requiresResequencing: aiAnalysis.requiresResequencing,
                recommendedAction: aiAnalysis.recommendedAction,
                model: aiAnalysis.modelUsed
            }
        });
        generatedTraces.push(traceStep1);

        // ====================================================================
        // AGENT STEP 2: Historical + Area/Hour Delay Prediction Engine
        // ====================================================================
        const activeEventsWithNew = [createdEvent, ...snapshot.events];
        const delayAssessments = targetStops
            .filter(s => s.status !== 'completed')
            .map(s => {
                const pred = predictStopDelay(s, activeEventsWithNew);
                return {
                    stopId: s.id,
                    customerName: s.customer_name,
                    areaZone: pred.areaZone,
                    predictedDelayMins: pred.totalPredictedDelayMins,
                    slaStatus: pred.slaStatus
                };
            });

        const avgCascadingDelay = delayAssessments.length > 0
            ? Math.round(delayAssessments.reduce((acc, d) => acc + d.predictedDelayMins, 0) / delayAssessments.length)
            : 15;

        const traceStep2 = await recordDecisionTrace({
            fleetId,
            eventId: createdEvent.id,
            stepNumber: 2,
            thought: `[Delay Prediction Heuristics] Computed cascading delay across ${delayAssessments.length} active stops on ${targetRoute?.name}. Average projected delay: +${avgCascadingDelay} mins based on Chennai zone congestion and ${createdEvent.event_type} severity.`,
            toolCalled: 'predict_cascading_delays',
            toolInput: {
                routeId: targetRoute?.id,
                activeStopsCount: delayAssessments.length,
                disruptionType: createdEvent.event_type
            },
            toolOutput: {
                averageProjectedDelayMins: avgCascadingDelay,
                stopAssessments: delayAssessments
            }
        });
        generatedTraces.push(traceStep2);

        // ====================================================================
        // AGENT STEP 3: Vehicle Re-Assignment Check (if Breakdown)
        // ====================================================================
        let assignedVehicle = targetVehicle;
        let brokenVehicleId = null;

        if (createdEvent.event_type === 'breakdown' && targetVehicle) {
            brokenVehicleId = targetVehicle.id;
            const pendingStops = targetStops.filter(s => s.status !== 'completed');
            const backupMatch = findBackupVehicleForStrandedStops(
                targetVehicle.id,
                pendingStops,
                snapshot.vehicles
            );

            if (backupMatch?.vehicle) {
                assignedVehicle = backupMatch.vehicle;
                const traceStep3a = await recordDecisionTrace({
                    fleetId,
                    eventId: createdEvent.id,
                    stepNumber: 3,
                    thought: `[Fleet Rescue Re-Assignment] ${targetVehicle.name} is immobilized. Selected reserve vehicle ${assignedVehicle.name} (Driver: ${assignedVehicle.driver_name}, ${backupMatch.distToCentroidKm} km away, spare capacity: ${backupMatch.spareCapacity} units) to take over ${pendingStops.length} remaining stops.`,
                    toolCalled: 'assign_rescue_vehicle',
                    toolInput: {
                        immobilizedVehicle: targetVehicle.name,
                        strandedStopsCount: pendingStops.length
                    },
                    toolOutput: {
                        rescueVehicleId: assignedVehicle.id,
                        rescueVehicleName: assignedVehicle.name,
                        driverName: assignedVehicle.driver_name,
                        distanceToRouteCentroidKm: backupMatch.distToCentroidKm,
                        spareCapacityUnits: backupMatch.spareCapacity,
                        capacityCheckPassed: backupMatch.canFitAll
                    }
                });
                generatedTraces.push(traceStep3a);
            }
        }

        // ====================================================================
        // AGENT STEP 4: Deterministic Optimizer (Nearest-Neighbor + 2-Opt + OSRM)
        // ====================================================================
        const closures = activeEventsWithNew
            .filter(e => !e.resolved && e.event_type === 'road_closure' && e.lat != null && e.lng != null)
            .map(e => ({ lat: e.lat, lng: e.lng, radiusKm: 0.75 }));

        const optimizationResult = await optimizeRouteStops({
            vehicle: assignedVehicle,
            stops: targetStops,
            closures,
            disruptionDelayMins: avgCascadingDelay
        });

        const nextStepNum = generatedTraces.length + 1;
        const traceOptimizer = await recordDecisionTrace({
            fleetId,
            eventId: createdEvent.id,
            stepNumber: nextStepNum,
            thought: `[Deterministic Route Re-Optimization] Executed Nearest-Neighbor + 2-Opt (${optimizationResult.iterations} iterations, ${optimizationResult.swapsPerformed} edge swaps) with OSRM road network routing. Validated vehicle capacity (${optimizationResult.capacityCheck.requiredLoad}/${optimizationResult.capacityCheck.vehicleMaxCapacity} units, ${optimizationResult.capacityCheck.utilizationPct}%) and time windows.`,
            toolCalled: 'run_deterministic_optimizer (NN + 2-Opt + OSRM)',
            toolInput: {
                routeId: targetRoute?.id,
                stopsToOptimize: targetStops.filter(s => s.status !== 'completed').length,
                avoidZonesCount: closures.length
            },
            toolOutput: {
                algorithm: optimizationResult.algorithmUsed,
                twoOptIterations: optimizationResult.iterations,
                swapsPerformed: optimizationResult.swapsPerformed,
                totalRouteDistanceKm: optimizationResult.totalRouteDistanceKm,
                totalRouteDurationMins: optimizationResult.totalRouteDurationMins,
                capacityCheck: optimizationResult.capacityCheck,
                newStopOrder: optimizationResult.optimizedStops.map(s => ({
                    seq: s.sequence_order,
                    prevSeq: s.previous_sequence_order,
                    customer: s.customer_name,
                    newEta: formatReadableTime(s.estimated_arrival)
                }))
            }
        });
        generatedTraces.push(traceOptimizer);

        // Persist updated stops & route
        await updateRouteAndStopsAfterOptimization({
            fleetId,
            routeId: targetRoute.id,
            updatedStops: optimizationResult.optimizedStops,
            newVehicleId: assignedVehicle?.id,
            brokenVehicleId,
            totalDistanceKm: optimizationResult.totalRouteDistanceKm,
            estimatedDurationMins: optimizationResult.totalRouteDurationMins
        });

        // ====================================================================
        // AGENT STEP 5: Draft Customer ETA Notifications via Gemini & Queue for Approval
        // ====================================================================
        const affectedStopsForComms = optimizationResult.optimizedStops.filter(
            s => s.status !== 'completed'
        );

        const draftedNotifications = [];
        for (const stop of affectedStopsForComms) {
            const originalStop = targetStops.find(orig => orig.id === stop.id);
            const originalReadableEta = formatReadableTime(originalStop?.estimated_arrival);
            const newReadableEta = formatReadableTime(stop.estimated_arrival);

            const llmDraft = await generateCustomerMessage(
                stop,
                newReadableEta,
                createdEvent.event_type
            );

            const queuedNotif = await createCustomerNotification({
                fleetId,
                stopId: stop.id,
                eventId: createdEvent.id,
                message: llmDraft.message,
                originalEta: originalReadableEta,
                proposedEta: newReadableEta,
                routeChangeSummary: {
                    routeName: targetRoute.name,
                    vehicleName: assignedVehicle?.name || 'Fleet Van',
                    previousSequence: stop.previous_sequence_order,
                    newSequence: stop.sequence_order,
                    disruptionType: createdEvent.event_type,
                    originalSequenceList: optimizationResult.originalSequence,
                    proposedSequenceList: optimizationResult.optimizedStops.map(s => ({
                        id: s.id,
                        sequence_order: s.sequence_order,
                        previous_sequence_order: s.previous_sequence_order,
                        customer_name: s.customer_name,
                        address: s.address,
                        estimated_arrival: s.estimated_arrival
                    }))
                }
            });
            draftedNotifications.push(queuedNotif);
        }

        const traceComms = await recordDecisionTrace({
            fleetId,
            eventId: createdEvent.id,
            stepNumber: generatedTraces.length + 1,
            thought: `[Customer ETA Comms & Human-in-the-Loop Gate] Drafted ${draftedNotifications.length} personalized customer SMS notifications via Gemini 2.5 Flash. Placed all drafts into Dispatcher Approval Queue (/approvals) awaiting human sign-off.`,
            toolCalled: 'queue_customer_notifications (gemini-2.5-flash)',
            toolInput: {
                affectedCustomers: affectedStopsForComms.map(s => s.customer_name)
            },
            toolOutput: {
                queuedNotificationsCount: draftedNotifications.length,
                approvalStatus: 'pending_approval',
                sampleDraft: draftedNotifications[0]?.message || ''
            }
        });
        generatedTraces.push(traceComms);

        const updatedSnapshot = await getFleetRoutesAndStops(fleetId);

        res.status(201).json({
            event: createdEvent,
            aiAnalysis,
            optimizationResult,
            draftedNotifications,
            decisionTraces: generatedTraces,
            snapshot: updatedSnapshot
        });
    } catch (err) {
        console.error('[POST /api/events] Error:', err);
        res.status(500).json({ error: 'Failed to process disruption event', details: err.message });
    }
});

/**
 * POST /api/optimizer/run — Executes deterministic nearest-neighbor and 2-opt route re-sequencing
 */
router.post('/optimizer/run', verifyAuthToken, async (req, res) => {
    try {
        const parsed = OptimizerRunSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid optimizer payload', issues: parsed.error.issues });
        }

        const { fleetId, routeId, avoidLat, avoidLng, avoidRadiusKm, applyChanges } = parsed.data;
        const snapshot = await getFleetRoutesAndStops(fleetId);
        const route = snapshot.routes.find(r => r.id === routeId) || snapshot.routes[0];

        if (!route) {
            return res.status(404).json({ error: 'Target route not found' });
        }

        const closures = [
            ...snapshot.events
                .filter(e => !e.resolved && e.event_type === 'road_closure' && e.lat != null && e.lng != null)
                .map(e => ({ lat: e.lat, lng: e.lng, radiusKm: 0.75 })),
            ...(avoidLat != null && avoidLng != null
                ? [{ lat: avoidLat, lng: avoidLng, radiusKm: avoidRadiusKm || 0.8 }]
                : [])
        ];

        const result = await optimizeRouteStops({
            vehicle: route.vehicle,
            stops: route.stops,
            closures,
            disruptionDelayMins: 8
        });

        if (applyChanges) {
            await updateRouteAndStopsAfterOptimization({
                fleetId,
                routeId: route.id,
                updatedStops: result.optimizedStops,
                totalDistanceKm: result.totalRouteDistanceKm,
                estimatedDurationMins: result.totalRouteDurationMins
            });

            await recordDecisionTrace({
                fleetId,
                eventId: snapshot.events[0]?.id || null,
                stepNumber: 1,
                thought: `[Manual Dispatcher Optimizer Run] Executed Nearest-Neighbor + 2-Opt on ${route.name}. Completed ${result.iterations} iterations (${result.swapsPerformed} swaps), total distance ${result.totalRouteDistanceKm} km.`,
                toolCalled: 'run_deterministic_optimizer',
                toolInput: { routeId: route.id, routeName: route.name },
                toolOutput: {
                    totalDistanceKm: result.totalRouteDistanceKm,
                    totalDurationMins: result.totalRouteDurationMins,
                    capacityCheck: result.capacityCheck
                }
            });
        }

        const updatedSnapshot = await getFleetRoutesAndStops(fleetId);
        res.json({
            optimizationResult: result,
            snapshot: updatedSnapshot
        });
    } catch (err) {
        console.error('[POST /api/optimizer/run] Error:', err);
        res.status(500).json({ error: 'Failed to run deterministic optimizer', details: err.message });
    }
});

/**
 * GET /api/notifications/pending/:fleetId — Fetches customer notification drafts awaiting dispatcher approval
 */
router.get('/notifications/pending/:fleetId', verifyAuthToken, async (req, res) => {
    try {
        const fleetId = req.params.fleetId || DEFAULT_FLEET_ID;
        const allNotifications = await getNotificationsForFleet(fleetId);
        const pending = allNotifications.filter(n => n.status === 'pending_approval');
        res.json({
            pending,
            all: allNotifications
        });
    } catch (err) {
        console.error('[GET /api/notifications/pending/:fleetId] Error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
    }
});

/**
 * POST /api/notifications/:id/approve — Approves and dispatches the customer notification
 */
router.post('/notifications/:id/approve', verifyAuthToken, requireDispatcher, async (req, res) => {
    try {
        const payload = {
            notificationId: req.params.id,
            approvedMessage: req.body.approvedMessage || req.body.message || '',
            action: req.body.action || 'approve'
        };

        const validation = NotificationApprovalSchema.safeParse(payload);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Invalid notification approval payload',
                issues: validation.error.issues
            });
        }

        const updated = await approveOrRejectNotification(validation.data);
        if (!updated) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await recordDecisionTrace({
            fleetId: updated.fleet_id || DEFAULT_FLEET_ID,
            eventId: updated.event_id || null,
            stepNumber: 99,
            thought: `[Dispatcher Sign-Off] Dispatcher ${req.user?.full_name || 'Operator'} ${validation.data.action === 'reject' ? 'rejected' : 'approved & dispatched'} customer ETA notification for ${updated.stop?.customer_name || 'Stop'}.`,
            toolCalled: 'dispatch_customer_sms',
            toolInput: {
                notificationId: updated.id,
                customerName: updated.stop?.customer_name,
                customerPhone: updated.stop?.customer_phone,
                action: validation.data.action
            },
            toolOutput: {
                status: updated.status,
                dispatchedMessage: updated.message,
                dispatchedAt: updated.dispatched_at
            }
        });

        res.json({ notification: updated });
    } catch (err) {
        console.error('[POST /api/notifications/:id/approve] Error:', err);
        res.status(500).json({ error: 'Failed to approve notification', details: err.message });
    }
});

export default router;

