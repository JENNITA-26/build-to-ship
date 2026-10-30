import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PLACEHOLDER_URLS = [
    'https://your-supabase-project.supabase.co',
    'your-supabase-url',
    ''
];

const PLACEHOLDER_KEYS = [
    'your-supabase-service-role-key',
    'your-supabase-anon-key',
    ''
];

let runtimeConfig = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || ''
};

export function isSupabaseConfigured() {
    const url = runtimeConfig.supabaseUrl?.trim();
    const key = (runtimeConfig.supabaseServiceRoleKey || runtimeConfig.supabaseAnonKey)?.trim();
    return Boolean(
        url &&
        key &&
        !PLACEHOLDER_URLS.includes(url) &&
        !PLACEHOLDER_KEYS.includes(key) &&
        url.startsWith('http')
    );
}

export function isGeminiConfigured() {
    const key = runtimeConfig.geminiApiKey?.trim();
    return Boolean(key && key !== 'your-gemini-api-key' && key.length > 10);
}

export function getRuntimeConfig() {
    return {
        ...runtimeConfig,
        supabaseConfigured: isSupabaseConfigured(),
        geminiConfigured: isGeminiConfigured()
    };
}

export function updateRuntimeConfig(updates) {
    if (updates.geminiApiKey !== undefined && updates.geminiApiKey.trim() !== '') {
        runtimeConfig.geminiApiKey = updates.geminiApiKey.trim();
        process.env.GEMINI_API_KEY = runtimeConfig.geminiApiKey;
    }
    if (updates.supabaseUrl !== undefined && updates.supabaseUrl.trim() !== '') {
        runtimeConfig.supabaseUrl = updates.supabaseUrl.trim();
        process.env.SUPABASE_URL = runtimeConfig.supabaseUrl;
    }
    if (updates.supabaseAnonKey !== undefined && updates.supabaseAnonKey.trim() !== '') {
        runtimeConfig.supabaseAnonKey = updates.supabaseAnonKey.trim();
        process.env.SUPABASE_ANON_KEY = runtimeConfig.supabaseAnonKey;
    }
    if (updates.supabaseServiceRoleKey !== undefined && updates.supabaseServiceRoleKey.trim() !== '') {
        runtimeConfig.supabaseServiceRoleKey = updates.supabaseServiceRoleKey.trim();
        process.env.SUPABASE_SERVICE_ROLE_KEY = runtimeConfig.supabaseServiceRoleKey;
    }
    initSupabaseClients();
    return getRuntimeConfig();
}

let supabaseAdmin = null;
let supabaseAnon = null;

function initSupabaseClients() {
    if (isSupabaseConfigured()) {
        try {
            const adminKey = runtimeConfig.supabaseServiceRoleKey && !PLACEHOLDER_KEYS.includes(runtimeConfig.supabaseServiceRoleKey)
                ? runtimeConfig.supabaseServiceRoleKey
                : runtimeConfig.supabaseAnonKey;

            supabaseAdmin = createClient(runtimeConfig.supabaseUrl, adminKey, {
                auth: { persistSession: false, autoRefreshToken: false }
            });

            const anonKey = runtimeConfig.supabaseAnonKey && !PLACEHOLDER_KEYS.includes(runtimeConfig.supabaseAnonKey)
                ? runtimeConfig.supabaseAnonKey
                : adminKey;

            supabaseAnon = createClient(runtimeConfig.supabaseUrl, anonKey, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
        } catch (err) {
            console.error('[Supabase] Error initializing client:', err.message);
            supabaseAdmin = null;
            supabaseAnon = null;
        }
    } else {
        supabaseAdmin = null;
        supabaseAnon = null;
    }
}

initSupabaseClients();

export function getSupabaseAdmin() {
    return supabaseAdmin;
}

export function getSupabaseAnon() {
    return supabaseAnon;
}

