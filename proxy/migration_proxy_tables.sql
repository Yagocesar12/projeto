-- GHOST Panel — Proxy Integration Tables
-- Run in Supabase SQL Editor

-- Proxy servers (VPS instances)
CREATE TABLE IF NOT EXISTS proxy_servers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'br',
  host TEXT NOT NULL,
  ports JSONB NOT NULL DEFAULT '{"7771": 7771, "7772": 7772, "7773": 7773, "7774": 7774}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proxy sessions (IP bindings per license)
CREATE TABLE IF NOT EXISTS proxy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(license_id, ip_address)
);

-- Add features_enabled to licenses if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'licenses' AND column_name = 'features_enabled'
  ) THEN
    ALTER TABLE licenses ADD COLUMN features_enabled JSONB DEFAULT '{}';
  END IF;
END $$;

-- Index for fast proxy validation
CREATE INDEX IF NOT EXISTS idx_proxy_sessions_ip ON proxy_sessions(ip_address) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_proxy_sessions_license ON proxy_sessions(license_id);
CREATE INDEX IF NOT EXISTS idx_proxy_servers_active ON proxy_servers(is_active) WHERE is_active = true;

-- Seed a default server (replace with your VPS IP)
INSERT INTO proxy_servers (id, name, region, host, ports, sort_order)
VALUES ('br', 'Brazil', 'br', '0.0.0.0', '{"7771": 7771, "7772": 7772, "7773": 7773, "7774": 7774}', 1)
ON CONFLICT (id) DO NOTHING;

-- RLS policies
ALTER TABLE proxy_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read proxy_servers" ON proxy_servers FOR SELECT USING (true);
CREATE POLICY "Admin manage proxy_servers" ON proxy_servers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Service manage proxy_sessions" ON proxy_sessions FOR ALL USING (true);
