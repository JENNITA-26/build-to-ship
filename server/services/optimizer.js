/**
 * Deterministic Routing & Optimization Engine
 * Implements:
 * 1. Nearest-Neighbor (NN) Constructive Heuristic with Time-Window Urgency
 * 2. 2-Opt Local Search Meta-Heuristic
 * 3. Free OSRM (Open Source Routing Machine) Road Geometry & Distance Integration
 * 4. Time-Window & Vehicle Capacity Validation + Cross-Vehicle Rescue Assignment
 */

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

/**
 * Haversine distance between two lat/lng coordinates in kilometers
 */
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Minimum distance from a line segment AB to a point P (e.g. a road closure) in km
 */
export function segmentToPointDistanceKm(latA, lngA, latB, lngB, latP, lngP) {
    const dx = lngB - lngA;
    const dy = latB - latA;
    if (dx === 0 && dy === 0) {
        return haversineDistanceKm(latA, lngA, latP, lngP);
    }
    const t = Math.max(0, Math.min(1, ((lngP - lngA) * dx + (latP - latA) * dy) / (dx * dx + dy * dy)));
    const projLat = latA + t * dy;
    const projLng = lngA + t * dx;
    return haversineDistanceKm(projLat, projLng, latP, lngP);
}

/**
 * Effective road distance between two points, accounting for urban Manhattan grid factor
 * and any active road closure avoidance zone.
 */
export function effectiveRoadDistanceKm(pointA, pointB, closures = []) {
    const rawKm = haversineDistanceKm(pointA.lat, pointA.lng, pointB.lat, pointB.lng);
    let roadKm = rawKm * 1.28; // Urban street network tortuosity factor

    for (const closure of closures) {
        if (closure.lat != null && closure.lng != null) {
            const distToClosure = segmentToPointDistanceKm(
                pointA.lat,
                pointA.lng,
                pointB.lat,
                pointB.lng,
                closure.lat,
                closure.lng
            );
            const radiusKm = closure.radiusKm || 0.65;
            if (distToClosure < radiusKm) {
                // Segment intersects road closure zone -> add detour penalty
                roadKm += (radiusKm - distToClosure) * 3.2 + 1.4;
            }
        }
    }
    return roadKm;
}

/**
 * Parse "HH:MM:SS" or "HH:MM" into minutes since midnight
 */
export function parseTimeWindowToMins(timeStr, fallbackMins = 540) {
    if (!timeStr || typeof timeStr !== 'string') return fallbackMins;
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return fallbackMins;
    return parts[0] * 60 + parts[1];
}

/**
 * Format minutes since midnight into an ISO timestamp for today
 */
export function minsToTodayIso(totalMinutes) {
    const now = new Date();
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = Math.round(totalMinutes % 60);
    const result = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        mins,
        0
    );
    return result.toISOString();
}

/**
 * Format ISO or minutes to readable "HH:MM AM/PM"
 */
export function formatReadableTime(isoString) {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '10:30 AM';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Step 1: Nearest-Neighbor Constructive Heuristic with Time-Window Urgency Weighting
 */
export function nearestNeighborSequence(startCoord, stops, closures = []) {
    if (!stops || stops.length <= 1) return [...(stops || [])];

    const unvisited = [...stops];
    const ordered = [];
    let currentPos = {
        lat: startCoord?.lat ?? stops[0].lat,
        lng: startCoord?.lng ?? stops[0].lng
    };

    while (unvisited.length > 0) {
        let bestIdx = 0;
        let bestScore = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const candidate = unvisited[i];
            const distKm = effectiveRoadDistanceKm(currentPos, candidate, closures);
            const windowEndMins = parseTimeWindowToMins(candidate.time_window_end, 720);
            const windowStartMins = parseTimeWindowToMins(candidate.time_window_start, 540);

            // Composite score: physical road distance + time window urgency weight
            const urgencyHours = (windowStartMins + windowEndMins) / 120;
            const compositeScore = distKm + urgencyHours * 0.38;

            if (compositeScore < bestScore) {
                bestScore = compositeScore;
                bestIdx = i;
            }
        }

        const chosen = unvisited.splice(bestIdx, 1)[0];
        ordered.push(chosen);
        currentPos = { lat: chosen.lat, lng: chosen.lng };
    }

    return ordered;
}

/**
 * Evaluate objective cost of a sequence of stops:
 * Total road distance + heavy penalty for any time-window violation
 */
export function evaluateSequenceCost(startCoord, sequence, closures = [], startClockMins = 570) {
    let totalDistanceKm = 0;
    let totalDurationMins = 0;
    let slaPenalty = 0;
    let violationsCount = 0;
    let currentPos = {
        lat: startCoord?.lat ?? (sequence[0]?.lat || 13.0604),
        lng: startCoord?.lng ?? (sequence[0]?.lng || 80.2545)
    };
    let currentClockMins = startClockMins;

    for (let i = 0; i < sequence.length; i++) {
        const stop = sequence[i];
        const legKm = effectiveRoadDistanceKm(currentPos, stop, closures);
        // Average urban speed ~24 km/h -> 2.5 mins per km + stop service time (6 mins)
        const legDriveMins = legKm * 2.5;
        const histDelay = Number(stop.historical_delay_mins || 5);
        const arrivalMins = currentClockMins + legDriveMins + histDelay * 0.35;

        const winStart = parseTimeWindowToMins(stop.time_window_start, 540);
        const winEnd = parseTimeWindowToMins(stop.time_window_end, 780);

        if (arrivalMins > winEnd) {
            const lateness = arrivalMins - winEnd;
            slaPenalty += lateness * 0.45;
            violationsCount += 1;
        } else if (arrivalMins < winStart) {
            // Early arrival waiting slack (small cost)
            slaPenalty += (winStart - arrivalMins) * 0.05;
        }

        totalDistanceKm += legKm;
        totalDurationMins += legDriveMins + 6;
        currentClockMins = Math.max(arrivalMins, winStart) + 6;
        currentPos = { lat: stop.lat, lng: stop.lng };
    }

    return {
        totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
        totalDurationMins: Math.round(totalDurationMins),
        slaPenalty: Number(slaPenalty.toFixed(2)),
        violationsCount,
        totalCost: Number((totalDistanceKm + slaPenalty).toFixed(3))
    };
}

/**
 * Step 2: 2-Opt Deterministic Local Search Optimization
 * Iteratively reverses sub-segments to eliminate crossovers and reduce total cost
 */
export function twoOptOptimize(startCoord, initialSequence, closures = [], startClockMins = 570) {
    if (!initialSequence || initialSequence.length <= 2) {
        return {
            sequence: [...(initialSequence || [])],
            iterations: 1,
            swapsPerformed: 0
        };
    }

    let bestSequence = [...initialSequence];
    let bestEval = evaluateSequenceCost(startCoord, bestSequence, closures, startClockMins);
    let improved = true;
    let iterations = 0;
    let swapsPerformed = 0;
    const maxIterations = 50;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 0; i < bestSequence.length - 1; i++) {
            for (let k = i + 1; k < bestSequence.length; k++) {
                const candidate = [
                    ...bestSequence.slice(0, i),
                    ...bestSequence.slice(i, k + 1).reverse(),
                    ...bestSequence.slice(k + 1)
                ];

                const candidateEval = evaluateSequenceCost(startCoord, candidate, closures, startClockMins);
                if (candidateEval.totalCost + 0.01 < bestEval.totalCost) {
                    bestSequence = candidate;
                    bestEval = candidateEval;
                    improved = true;
                    swapsPerformed++;
                }
            }
        }
    }

    return {
        sequence: bestSequence,
        iterations,
        swapsPerformed,
        metrics: bestEval
    };
}

/**
 * Fetch real street-level polyline & driving metrics from free OSRM service,
 * with a deterministic urban street-grid fallback if offline or rate-limited.
 */
export async function fetchOsrmRouteGeometry(waypoints, closures = []) {
    if (!waypoints || waypoints.length < 2) {
        return {
            geometry: waypoints ? waypoints.map(w => [w.lat, w.lng]) : [],
            distanceKm: 0,
            durationMins: 0,
            source: 'none'
        };
    }

    // Inject detour control point if a segment passes directly through an active road closure
    const adjustedWaypoints = [];
    for (let i = 0; i < waypoints.length; i++) {
        const curr = waypoints[i];
        adjustedWaypoints.push(curr);
        if (i < waypoints.length - 1) {
            const next = waypoints[i + 1];
            for (const c of closures) {
                if (c.lat != null && c.lng != null) {
                    const d = segmentToPointDistanceKm(curr.lat, curr.lng, next.lat, next.lng, c.lat, c.lng);
                    if (d < (c.radiusKm || 0.65)) {
                        // Add a perpendicular detour waypoint around the road closure
                        const midLat = (curr.lat + next.lat) / 2;
                        const midLng = (curr.lng + next.lng) / 2;
                        const offsetLat = midLat + (curr.lng - next.lng) * 0.35 + 0.0045;
                        const offsetLng = midLng + (next.lat - curr.lat) * 0.35 - 0.0045;
                        adjustedWaypoints.push({ lat: offsetLat, lng: offsetLng, isDetour: true });
                    }
                }
            }
        }
    }

    try {
        const coordsString = adjustedWaypoints
            .map(w => `${Number(w.lng).toFixed(5)},${Number(w.lat).toFixed(5)}`)
            .join(';');
        const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3200);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
                const leafletCoords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                return {
                    geometry: leafletCoords,
                    distanceKm: Number((route.distance / 1000).toFixed(2)),
                    durationMins: Math.round(route.duration / 60),
                    source: 'osrm_live'
                };
            }
        }
    } catch {
        // Fall through to deterministic street-grid geometry interpolation
    }

    // Deterministic street-grid interpolation fallback
    const gridPolyline = [];
    let totalKm = 0;

    for (let i = 0; i < adjustedWaypoints.length - 1; i++) {
        const a = adjustedWaypoints[i];
        const b = adjustedWaypoints[i + 1];
        gridPolyline.push([a.lat, a.lng]);

        // Create realistic L-shaped / dog-leg urban street turns between stops
        const midLat = a.lat + (b.lat - a.lat) * 0.55;
        const midLng = a.lng + (b.lng - a.lng) * 0.45;
        gridPolyline.push([midLat, a.lng + (b.lng - a.lng) * 0.15]);
        gridPolyline.push([midLat, midLng]);
        gridPolyline.push([a.lat + (b.lat - a.lat) * 0.85, midLng]);

        totalKm += effectiveRoadDistanceKm(a, b, closures);
    }
    const last = adjustedWaypoints[adjustedWaypoints.length - 1];
    gridPolyline.push([last.lat, last.lng]);

    return {
        geometry: gridPolyline,
        distanceKm: Number(totalKm.toFixed(2)),
        durationMins: Math.round(totalKm * 2.6 + waypoints.length * 5),
        source: 'deterministic_urban_grid'
    };
}

/**
 * Full Route Optimization Pipeline (Nearest-Neighbor + 2-Opt + ETA Recalculation + Capacity/SLA Check)
 */
export async function optimizeRouteStops({
    vehicle,
    stops,
    closures = [],
    disruptionDelayMins = 0
}) {
    const sortedOriginal = [...stops].sort((a, b) => a.sequence_order - b.sequence_order);

    // Keep completed stops locked at the start of the route sequence
    const completedStops = sortedOriginal.filter(s => s.status === 'completed');
    const activeStops = sortedOriginal.filter(s => s.status !== 'completed');

    const startAnchor = completedStops.length > 0
        ? { lat: completedStops[completedStops.length - 1].lat, lng: completedStops[completedStops.length - 1].lng }
        : {
              lat: vehicle?.current_lat ?? (sortedOriginal[0]?.lat || 13.0604),
              lng: vehicle?.current_lng ?? (sortedOriginal[0]?.lng || 80.2545)
          };

    const beforeMetrics = evaluateSequenceCost(startAnchor, activeStops, closures, 570 + disruptionDelayMins);

    // 1. Construct initial solution with Nearest-Neighbor + Time-Window Urgency
    const nnCandidate = nearestNeighborSequence(startAnchor, activeStops, closures);

    // 2. Refine with 2-Opt local search
    const twoOptResult = twoOptOptimize(startAnchor, nnCandidate, closures, 570 + disruptionDelayMins);

    // Choose the best sequence between original, NN, and 2-Opt
    const optimizedActive = twoOptResult.metrics.totalCost <= beforeMetrics.totalCost
        ? twoOptResult.sequence
        : activeStops;

    // 3. Recompute sequence_order and updated ETAs for all stops
    const nowMs = Date.now();
    let cumulativeMins = 12 + Math.round(disruptionDelayMins * 0.45);
    let prevCoord = startAnchor;

    const finalStops = [
        ...completedStops.map((s, idx) => ({
            ...s,
            sequence_order: idx + 1,
            previous_sequence_order: s.sequence_order
        })),
        ...optimizedActive.map((s, idx) => {
            const seqNum = completedStops.length + idx + 1;
            const legKm = effectiveRoadDistanceKm(prevCoord, s, closures);
            const driveMins = Math.max(6, Math.round(legKm * 2.5));
            const areaDelay = Math.round((s.historical_delay_mins || 6) * 0.5);
            cumulativeMins += driveMins + areaDelay;

            const newEtaIso = new Date(nowMs + cumulativeMins * 60 * 1000).toISOString();
            prevCoord = { lat: s.lat, lng: s.lng };
            cumulativeMins += 6; // service time at stop

            return {
                ...s,
                previous_sequence_order: s.sequence_order,
                sequence_order: seqNum,
                estimated_arrival: newEtaIso,
                status: s.status === 'failed' ? 'rescheduled' : s.status
            };
        })
    ];

    // 4. Validate vehicle capacity
    const totalLoad = finalStops
        .filter(s => s.status !== 'completed')
        .reduce((acc, s) => acc + (Number(s.package_load) || 15), 0);
    const maxCap = Number(vehicle?.capacity_max || 120);
    const capacityValid = totalLoad <= maxCap;

    // 5. Fetch OSRM route geometry
    const waypoints = [
        { lat: vehicle?.current_lat ?? startAnchor.lat, lng: vehicle?.current_lng ?? startAnchor.lng },
        ...finalStops.map(s => ({ lat: s.lat, lng: s.lng }))
    ];
    const osrmData = await fetchOsrmRouteGeometry(waypoints, closures);

    const distanceSavedKm = Number(
        Math.max(0, beforeMetrics.totalDistanceKm - twoOptResult.metrics.totalDistanceKm).toFixed(2)
    );
    const timeSavedMins = Math.max(
        0,
        beforeMetrics.totalDurationMins - twoOptResult.metrics.totalDurationMins
    );

    return {
        originalSequence: sortedOriginal.map(s => ({
            id: s.id,
            sequence_order: s.sequence_order,
            customer_name: s.customer_name,
            address: s.address,
            estimated_arrival: s.estimated_arrival
        })),
        optimizedStops: finalStops,
        algorithmUsed: 'Nearest-Neighbor + 2-Opt Local Search + OSRM Street Routing',
        iterations: twoOptResult.iterations,
        swapsPerformed: twoOptResult.swapsPerformed,
        beforeMetrics,
        afterMetrics: twoOptResult.metrics,
        distanceSavedKm,
        timeSavedMins,
        capacityCheck: {
            requiredLoad: totalLoad,
            vehicleMaxCapacity: maxCap,
            utilizationPct: Math.min(100, Math.round((totalLoad / maxCap) * 100)),
            valid: capacityValid
        },
        osrmGeometry: osrmData.geometry,
        osrmSource: osrmData.source,
        totalRouteDistanceKm: osrmData.distanceKm || twoOptResult.metrics.totalDistanceKm,
        totalRouteDurationMins: osrmData.durationMins || twoOptResult.metrics.totalDurationMins
    };
}

/**
 * Find the best backup vehicle to rescue stops when a vehicle breaks down
 */
export function findBackupVehicleForStrandedStops(brokenVehicleId, strandedStops, allVehicles) {
    const requiredLoad = strandedStops.reduce((sum, s) => sum + (Number(s.package_load) || 15), 0);
    const centroid = strandedStops.length > 0
        ? {
              lat: strandedStops.reduce((s, x) => s + x.lat, 0) / strandedStops.length,
              lng: strandedStops.reduce((s, x) => s + x.lng, 0) / strandedStops.length
          }
        : { lat: 13.0418, lng: 80.2341 };

    const candidates = allVehicles
        .filter(v => v.id !== brokenVehicleId && v.status === 'active')
        .map(v => {
            const spareCapacity = (v.capacity_max || 120) - (v.capacity_current || 0);
            const distToCentroidKm = haversineDistanceKm(
                v.current_lat || 13.0418,
                v.current_lng || 80.2341,
                centroid.lat,
                centroid.lng
            );
            return {
                vehicle: v,
                spareCapacity,
                canFitAll: spareCapacity >= requiredLoad,
                distToCentroidKm: Number(distToCentroidKm.toFixed(2))
            };
        })
        .sort((a, b) => {
            if (a.canFitAll !== b.canFitAll) return a.canFitAll ? -1 : 1;
            return a.distToCentroidKm - b.distToCentroidKm;
        });

    return candidates[0] || null;
}

