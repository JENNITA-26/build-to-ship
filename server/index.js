import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import apiRouter from './routes/api.js';
import { getRuntimeConfig } from './config/supabase.js';
import { ensureSupabaseSeeded } from './services/dataStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-fleet-id', 'x-user-role']
}));

app.use(express.json({ limit: '2mb' }));

// Root & Health check endpoints for Render deployment
app.get('/', (req, res) => {
    res.json({
        service: 'RouteRescue AI Dispatch Backend (Render Ready)',
        status: 'online',
        docs: '/health'
    });
});

app.get('/health', (req, res) => {
    const cfg = getRuntimeConfig();
    res.json({
        service: 'RouteRescue AI Dispatch Server',
        status: 'operational',
        supabaseConnected: cfg.supabaseConfigured,
        geminiConfigured: cfg.geminiConfigured,
        timestamp: new Date().toISOString()
    });
});

// Mount core API routes
app.use('/api', apiRouter);

app.listen(PORT, '0.0.0.0', async () => {
    const cfg = getRuntimeConfig();
    console.log(`====================================================================`);
    console.log(`🚀 RouteRescue AI Backend Server running on http://localhost:${PORT}`);
    console.log(`   • Supabase PostgreSQL + Realtime : ${cfg.supabaseConfigured ? 'CONNECTED' : 'LOCAL IN-MEMORY + SSE MODE'}`);
    console.log(`   • Google Gemini 2.5 Flash SDK    : ${cfg.geminiConfigured ? 'LIVE (@google/genai)' : 'STRUCTURED AI FALLBACK'}`);
    console.log(`   • Deterministic Optimizer        : Nearest-Neighbor + 2-Opt + OSRM Active`);
    console.log(`====================================================================`);
    await ensureSupabaseSeeded();
});

