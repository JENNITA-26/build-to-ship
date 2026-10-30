import { z } from 'zod';

export const DisruptionEventSchema = z.object({
    fleetId: z.string().uuid(),
    routeId: z.string().uuid().optional().nullable(),
    vehicleId: z.string().uuid().optional().nullable(),
    stopId: z.string().uuid().optional().nullable(),
    eventType: z.enum(['road_closure', 'breakdown', 'failed_delivery', 'customer_absent']),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
    description: z.string().min(5, 'Description must be at least 5 characters long'),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    reportedByRole: z.enum(['dispatcher', 'driver']).optional().default('dispatcher'),
    reportedByName: z.string().optional().nullable(),
    vehicleName: z.string().optional().nullable()
});

export const NotificationApprovalSchema = z.object({
    notificationId: z.string().uuid(),
    approvedMessage: z.string().min(5, 'Approved message must be at least 5 characters long'),
    action: z.enum(['approve', 'reject']).optional().default('approve')
});

export const OptimizerRunSchema = z.object({
    fleetId: z.string().uuid(),
    routeId: z.string().uuid(),
    avoidLat: z.number().optional().nullable(),
    avoidLng: z.number().optional().nullable(),
    avoidRadiusKm: z.number().optional().default(0.8),
    applyChanges: z.boolean().optional().default(true)
});

export const RuntimeConfigSchema = z.object({
    geminiApiKey: z.string().optional(),
    supabaseUrl: z.string().optional(),
    supabaseAnonKey: z.string().optional(),
    supabaseServiceRoleKey: z.string().optional()
});

