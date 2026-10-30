/**
 * Delay Prediction Engine — Chennai, Tamil Nadu, India Edition
 * Estimates expected delays per stop using historical averages categorized by
 * Chennai urban zone, hour of day, commercial loading heuristics, and active route disruptions.
 */

const AREA_HEURISTICS = {
    'T. Nagar': {
        baseDelayMins: 12,
        parkingDifficultyFactor: 1.55,
        hourlyMultipliers: {
            8: 1.25, 9: 1.45, 10: 1.5, 11: 1.55, 12: 1.45, 13: 1.35, 14: 1.3, 15: 1.4, 16: 1.65, 17: 1.8
        },
        riskNote: 'High commercial footfall & narrow unloading bays along Usman Road and Panagal Park'
    },
    'Anna Salai': {
        baseDelayMins: 9,
        parkingDifficultyFactor: 1.4,
        hourlyMultipliers: {
            8: 1.5, 9: 1.7, 10: 1.45, 11: 1.3, 12: 1.25, 13: 1.2, 14: 1.25, 15: 1.35, 16: 1.65, 17: 1.75
        },
        riskNote: 'Arterial Mount Road signal bottlenecks & Thousand Lights commercial traffic'
    },
    'Nungambakkam': {
        baseDelayMins: 8,
        parkingDifficultyFactor: 1.35,
        hourlyMultipliers: {
            8: 1.3, 9: 1.5, 10: 1.35, 11: 1.25, 12: 1.3, 13: 1.25, 14: 1.2, 15: 1.3, 16: 1.5, 17: 1.65
        },
        riskNote: 'One-way loop restrictions around Khader Nawaz Khan Rd & Valluvar Kottam'
    },
    'Guindy': {
        baseDelayMins: 10,
        parkingDifficultyFactor: 1.3,
        hourlyMultipliers: {
            8: 1.55, 9: 1.75, 10: 1.45, 11: 1.25, 12: 1.2, 13: 1.2, 14: 1.25, 15: 1.4, 16: 1.7, 17: 1.85
        },
        riskNote: 'Kathipara Junction merging traffic & SIDCO industrial estate freight gate checks'
    },
    'Velachery': {
        baseDelayMins: 11,
        parkingDifficultyFactor: 1.4,
        hourlyMultipliers: {
            8: 1.5, 9: 1.65, 10: 1.4, 11: 1.3, 12: 1.35, 13: 1.3, 14: 1.25, 15: 1.35, 16: 1.6, 17: 1.75
        },
        riskNote: 'Velachery Main Road flyover approaches & mall commercial dock queues'
    },
    'OMR Taramani': {
        baseDelayMins: 10,
        parkingDifficultyFactor: 1.25,
        hourlyMultipliers: {
            8: 1.65, 9: 1.8, 10: 1.5, 11: 1.2, 12: 1.15, 13: 1.15, 14: 1.2, 15: 1.35, 16: 1.65, 17: 1.8
        },
        riskNote: 'IT Corridor peak commuter waves & CMRL Phase-II metro construction diversions'
    },
    'Perungudi': {
        baseDelayMins: 8,
        parkingDifficultyFactor: 1.2,
        hourlyMultipliers: {
            8: 1.5, 9: 1.65, 10: 1.35, 11: 1.2, 12: 1.2, 13: 1.15, 14: 1.15, 15: 1.3, 16: 1.55, 17: 1.7
        },
        riskNote: 'OMR service lane congestion & tech park security pass verification'
    },
    'Mylapore': {
        baseDelayMins: 9,
        parkingDifficultyFactor: 1.45,
        hourlyMultipliers: {
            8: 1.35, 9: 1.45, 10: 1.4, 11: 1.35, 12: 1.3, 13: 1.2, 14: 1.2, 15: 1.3, 16: 1.5, 17: 1.65
        },
        riskNote: 'Narrow heritage temple streets around Luz Corner and R.K. Mutt Road'
    },
    'Adyar': {
        baseDelayMins: 7,
        parkingDifficultyFactor: 1.3,
        hourlyMultipliers: {
            8: 1.4, 9: 1.55, 10: 1.35, 11: 1.25, 12: 1.25, 13: 1.2, 14: 1.15, 15: 1.25, 16: 1.45, 17: 1.6
        },
        riskNote: 'Adyar Bridge bottleneck & LB Road signal queue'
    },
    'Besant Nagar': {
        baseDelayMins: 5,
        parkingDifficultyFactor: 1.1,
        hourlyMultipliers: {
            8: 1.1, 9: 1.2, 10: 1.15, 11: 1.15, 12: 1.2, 13: 1.15, 14: 1.1, 15: 1.2, 16: 1.35, 17: 1.45
        },
        riskNote: 'Coastal residential avenues with smooth access outside evening beach hours'
    }
};

function inferAreaZone(address = '', existingZone = '') {
    if (existingZone && AREA_HEURISTICS[existingZone]) return existingZone;
    const lower = address.toLowerCase();
    if (lower.includes('t. nagar') || lower.includes('usman') || lower.includes('panagal')) return 'T. Nagar';
    if (lower.includes('anna salai') || lower.includes('greams') || lower.includes('thousand lights') || lower.includes('mount')) return 'Anna Salai';
    if (lower.includes('nungambakkam') || lower.includes('khader')) return 'Nungambakkam';
    if (lower.includes('guindy') || lower.includes('sidco')) return 'Guindy';
    if (lower.includes('velachery')) return 'Velachery';
    if (lower.includes('taramani') || lower.includes('tidel')) return 'OMR Taramani';
    if (lower.includes('perungudi')) return 'Perungudi';
    if (lower.includes('mylapore') || lower.includes('mutt')) return 'Mylapore';
    if (lower.includes('adyar') || lower.includes('lb road')) return 'Adyar';
    if (lower.includes('besant')) return 'Besant Nagar';
    return 'Anna Salai';
}

function parseHourFromTimeWindow(timeStr, etaIso) {
    if (etaIso) {
        const d = new Date(etaIso);
        if (!Number.isNaN(d.getTime())) {
            return d.getHours();
        }
    }
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
        const hr = parseInt(timeStr.split(':')[0], 10);
        if (!Number.isNaN(hr)) return hr;
    }
    return 10;
}

/**
 * Predicts delay for a single stop based on Chennai zone, hour, historical baseline, and active disruptions
 */
export function predictStopDelay(stop, activeDisruptions = []) {
    const areaZone = inferAreaZone(stop.address, stop.area_zone);
    const profile = AREA_HEURISTICS[areaZone] || AREA_HEURISTICS['Anna Salai'];
    const arrivalHour = parseHourFromTimeWindow(stop.time_window_start, stop.estimated_arrival);
    const hourlyMultiplier = profile.hourlyMultipliers[arrivalHour] || 1.2;

    const historicalBase = typeof stop.historical_delay_mins === 'number' && stop.historical_delay_mins > 0
        ? stop.historical_delay_mins
        : profile.baseDelayMins;

    let predictedDelayMins = Math.round(
        (historicalBase * 0.6 + profile.baseDelayMins * 0.4) * hourlyMultiplier
    );

    let disruptionPenaltyMins = 0;
    const matchingDisruptions = activeDisruptions.filter(d => !d.resolved && d.route_id === stop.route_id);

    for (const d of matchingDisruptions) {
        if (d.event_type === 'road_closure') {
            disruptionPenaltyMins += 14;
        } else if (d.event_type === 'breakdown') {
            disruptionPenaltyMins += 25;
        } else if (d.event_type === 'failed_delivery' || d.event_type === 'customer_absent') {
            disruptionPenaltyMins += 8;
        }
    }

    const totalPredictedDelayMins = stop.status === 'completed'
        ? historicalBase
        : predictedDelayMins + disruptionPenaltyMins;

    const slaStatus = evaluateTimeWindowSla(stop, totalPredictedDelayMins);

    return {
        areaZone,
        arrivalHour,
        historicalBaseMins: historicalBase,
        areaHourlyPredictedMins: predictedDelayMins,
        disruptionPenaltyMins,
        totalPredictedDelayMins,
        hourlyMultiplier,
        parkingDifficultyFactor: profile.parkingDifficultyFactor,
        riskNote: profile.riskNote,
        slaStatus
    };
}

function evaluateTimeWindowSla(stop, totalDelayMins) {
    if (stop.status === 'completed') return 'completed';
    if (stop.status === 'failed') return 'violated';

    const parseTimeToMinutes = (tStr) => {
        if (!tStr) return 600;
        const [h, m] = tStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const windowStartMins = parseTimeToMinutes(stop.time_window_start);
    const windowEndMins = parseTimeToMinutes(stop.time_window_end);
    const windowSpan = Math.max(30, windowEndMins - windowStartMins);

    const baseOffsetWithinWindow = Math.min(windowSpan * 0.55, 45 + (stop.sequence_order || 1) * 14);
    const projectedArrivalMins = windowStartMins + baseOffsetWithinWindow + totalDelayMins;

    if (projectedArrivalMins > windowEndMins) {
        return 'violated';
    }
    if (windowEndMins - projectedArrivalMins <= 18 || totalDelayMins >= 18) {
        return 'at_risk';
    }
    return 'on_time';
}

export function getAreaHeuristicsSummary() {
    return Object.entries(AREA_HEURISTICS).map(([area, data]) => ({
        area,
        baseDelayMins: data.baseDelayMins,
        parkingDifficultyFactor: data.parkingDifficultyFactor,
        peakHourMultiplier: Math.max(...Object.values(data.hourlyMultipliers)),
        riskNote: data.riskNote
    }));
}
