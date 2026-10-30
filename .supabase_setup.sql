-- ============================================================================
-- RouteRescue: Production PostgreSQL & Supabase Setup Script (.supabase_setup.sql)
-- Includes: Extensions, Enums, Tables, RLS Policies, Realtime Setup & Seed Data
-- ============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enums (Safe creation)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('dispatcher', 'driver');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('active', 'delayed', 'broken_down', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stop_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'rescheduled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_type AS ENUM ('road_closure', 'breakdown', 'failed_delivery', 'customer_absent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tables

-- Profiles Table linked to Supabase Auth
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'driver',
    fleet_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fleet_id UUID NOT NULL,
    name TEXT NOT NULL,
    vehicle_type TEXT DEFAULT 'Van', -- Van, Cargo Truck, Electric Bike
    driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    driver_name TEXT DEFAULT 'Assigned Driver',
    status vehicle_status DEFAULT 'active',
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    capacity_max INT NOT NULL,
    capacity_current INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routes Table
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fleet_id UUID NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'planned',
    total_distance_km DOUBLE PRECISION DEFAULT 0,
    estimated_duration_mins INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stops Table
CREATE TABLE IF NOT EXISTS stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    sequence_order INT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    area_zone TEXT DEFAULT 'Downtown',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    time_window_start TIME NOT NULL,
    time_window_end TIME NOT NULL,
    estimated_arrival TIMESTAMPTZ,
    status stop_status DEFAULT 'pending',
    historical_delay_mins INT DEFAULT 0,
    package_load INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disruption Events Table
CREATE TABLE IF NOT EXISTS disruption_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fleet_id UUID NOT NULL,
    route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    event_type event_type NOT NULL,
    severity TEXT DEFAULT 'high',
    description TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Decision Traces Table
CREATE TABLE IF NOT EXISTS decision_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fleet_id UUID NOT NULL,
    event_id UUID REFERENCES disruption_events(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    thought TEXT NOT NULL,
    tool_called TEXT,
    tool_input JSONB,
    tool_output JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Notifications Queue Table
CREATE TABLE IF NOT EXISTS customer_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fleet_id UUID NOT NULL,
    stop_id UUID REFERENCES stops(id) ON DELETE CASCADE,
    event_id UUID REFERENCES disruption_events(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    original_eta TEXT,
    proposed_eta TEXT,
    status TEXT DEFAULT 'pending_approval', -- pending_approval, approved, sent, rejected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Row Level Security (RLS) / Data Isolation Rules
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE disruption_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's fleet_id
CREATE OR REPLACE FUNCTION get_user_fleet_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT fleet_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own fleet profiles" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Users can manage fleet vehicles" ON vehicles;
DROP POLICY IF EXISTS "Users can manage fleet routes" ON routes;
DROP POLICY IF EXISTS "Users can manage fleet stops" ON stops;
DROP POLICY IF EXISTS "Users can manage fleet events" ON disruption_events;
DROP POLICY IF EXISTS "Users can view fleet traces" ON decision_traces;
DROP POLICY IF EXISTS "Users can manage fleet notifications" ON customer_notifications;

-- RLS Policies
CREATE POLICY "Users can view own fleet profiles" ON profiles FOR SELECT USING (fleet_id = get_user_fleet_id() OR id = auth.uid());
CREATE POLICY "Users can manage own profile" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Users can manage fleet vehicles" ON vehicles FOR ALL USING (fleet_id = get_user_fleet_id());
CREATE POLICY "Users can manage fleet routes" ON routes FOR ALL USING (fleet_id = get_user_fleet_id());
CREATE POLICY "Users can manage fleet stops" ON stops FOR ALL USING (route_id IN (SELECT id FROM routes WHERE fleet_id = get_user_fleet_id()));
CREATE POLICY "Users can manage fleet events" ON disruption_events FOR ALL USING (fleet_id = get_user_fleet_id());
CREATE POLICY "Users can view fleet traces" ON decision_traces FOR ALL USING (fleet_id = get_user_fleet_id());
CREATE POLICY "Users can manage fleet notifications" ON customer_notifications FOR ALL USING (fleet_id = get_user_fleet_id());

-- 5. Enable Supabase Realtime on Operational Tables
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE routes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stops;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE disruption_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE decision_traces;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Initial Seed Data for Default Fleet — Chennai, Tamil Nadu, India (11111111-1111-1111-1111-111111111111)
INSERT INTO vehicles (id, fleet_id, name, vehicle_type, driver_name, status, current_lat, current_lng, capacity_max, capacity_current)
VALUES
    ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Van Alpha-01 (Tata Ace EV)', 'Van', 'Karthik Sundaram', 'active', 13.0620, 80.2610, 120, 75),
    ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Truck Beta-02 (Ashok Leyland)', 'Cargo Truck', 'Anitha Krishnan', 'active', 13.0125, 80.2205, 200, 110),
    ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'E-Bike Gamma-03 (Ather Cargo)', 'Electric Bike', 'Pradeep Kumar', 'active', 13.0365, 80.2675, 45, 25),
    ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111111', 'Van Delta-04 (Mahindra Reserve)', 'Van', 'Divya Natarajan', 'active', 13.0732, 80.2609, 120, 20)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    current_lat = EXCLUDED.current_lat,
    current_lng = EXCLUDED.current_lng;

INSERT INTO routes (id, fleet_id, vehicle_id, name, date, status, total_distance_km, estimated_duration_mins)
VALUES
    ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', 'Route 1 — Anna Salai, T. Nagar & Nungambakkam', CURRENT_DATE, 'in_progress', 12.6, 78),
    ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', 'Route 2 — Guindy, Velachery & OMR IT Corridor', CURRENT_DATE, 'in_progress', 16.4, 105),
    ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222203', 'Route 3 — Mylapore, Adyar & Besant Nagar', CURRENT_DATE, 'planned', 9.2, 58)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name;

INSERT INTO stops (id, route_id, sequence_order, customer_name, customer_phone, address, area_zone, lat, lng, time_window_start, time_window_end, estimated_arrival, status, historical_delay_mins, package_load)
VALUES
    -- Route 1 Stops (Chennai Central)
    ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', 1, 'Apollo Pharmacy Regional Hub', '+91-98401-10101', '21 Greams Road, Thousand Lights, Chennai, TN', 'Anna Salai', 13.0604, 80.2545, '08:30:00', '10:00:00', NOW() - INTERVAL '30 minutes', 'completed', 5, 20),
    ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301', 2, 'Saravana Stores Commercial', '+91-98401-10102', '45 Usman Road, T. Nagar, Chennai, TN', 'T. Nagar', 13.0418, 80.2341, '09:00:00', '11:00:00', NOW() + INTERVAL '15 minutes', 'in_progress', 12, 25),
    ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333301', 3, 'Nalli Silk Heritage Plaza', '+91-98401-10103', '9 Nageswaran Rd, Panagal Park, T. Nagar, Chennai, TN', 'T. Nagar', 13.0402, 80.2312, '10:00:00', '12:00:00', NOW() + INTERVAL '45 minutes', 'pending', 10, 15),
    ('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333301', 4, 'KNK Road Lifestyle Studio', '+91-98401-10104', '14 Khader Nawaz Khan Rd, Nungambakkam, Chennai, TN', 'Nungambakkam', 13.0615, 80.2468, '10:30:00', '12:30:00', NOW() + INTERVAL '75 minutes', 'pending', 7, 15),

    -- Route 2 Stops (Guindy, Velachery & OMR)
    ('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333302', 1, 'Olympia Tech Park Logistics', '+91-98402-20201', '1 SIDCO Industrial Estate, Guindy, Chennai, TN', 'Guindy', 13.0102, 80.2155, '09:00:00', '10:30:00', NOW() - INTERVAL '15 minutes', 'completed', 8, 30),
    ('44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333302', 2, 'Phoenix Marketcity Retail Dock', '+91-98402-20202', '142 Velachery Main Rd, Velachery, Chennai, TN', 'Velachery', 12.9915, 80.2167, '09:30:00', '11:30:00', NOW() + INTERVAL '20 minutes', 'in_progress', 13, 25),
    ('44444444-4444-4444-4444-444444444407', '33333333-3333-3333-3333-333333333302', 3, 'IIT Madras Research Park', '+91-98402-20203', 'Kanagam Rd, Taramani, Chennai, TN', 'OMR Taramani', 12.9902, 80.2429, '10:00:00', '12:00:00', NOW() + INTERVAL '50 minutes', 'pending', 9, 30),
    ('44444444-4444-4444-4444-444444444408', '33333333-3333-3333-3333-333333333302', 4, 'TIDEL Park IT Campus', '+91-98402-20204', '4 Rajiv Gandhi Salai (OMR), Taramani, Chennai, TN', 'OMR Taramani', 12.9896, 80.2486, '10:30:00', '12:30:00', NOW() + INTERVAL '80 minutes', 'pending', 11, 15),
    ('44444444-4444-4444-4444-444444444409', '33333333-3333-3333-3333-333333333302', 5, 'World Trade Center Perungudi', '+91-98402-20205', 'Brigade WTC, OMR Perungudi, Chennai, TN', 'Perungudi', 12.9685, 80.2461, '11:00:00', '13:00:00', NOW() + INTERVAL '110 minutes', 'pending', 7, 10),

    -- Route 3 Stops (Mylapore, Adyar & Besant Nagar)
    ('44444444-4444-4444-4444-444444444410', '33333333-3333-3333-3333-333333333303', 1, 'Mylapore Kapaleeshwarar Mart', '+91-98403-30301', '18 R.K. Mutt Rd, Mylapore, Chennai, TN', 'Mylapore', 13.0334, 80.2687, '09:30:00', '11:00:00', NOW() + INTERVAL '10 minutes', 'in_progress', 8, 10),
    ('44444444-4444-4444-4444-444444444411', '33333333-3333-3333-3333-333333333303', 2, 'Adyar Ananda Bhavan Central', '+91-98403-30302', '53 LB Road, Adyar, Chennai, TN', 'Adyar', 13.0063, 80.2574, '10:00:00', '11:30:00', NOW() + INTERVAL '40 minutes', 'pending', 7, 8),
    ('44444444-4444-4444-4444-444444444412', '33333333-3333-3333-3333-333333333303', 3, 'Elliot''s Beach Organic Cafe', '+91-98403-30303', '4th Main Rd, Besant Nagar, Chennai, TN', 'Besant Nagar', 12.9996, 80.2685, '10:30:00', '12:30:00', NOW() + INTERVAL '70 minutes', 'pending', 5, 7)
ON CONFLICT (id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    address = EXCLUDED.address,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng;

