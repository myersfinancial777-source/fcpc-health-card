-- ════════════════════════════════════════════════════
-- First Coast Property Care — Phase 1: CRM Tables
-- ════════════════════════════════════════════════════
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- (Safe to run even if inspections table already exists)
-- ════════════════════════════════════════════════════

-- ── Clients table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on clients" ON clients FOR ALL USING (true) WITH CHECK (true);

-- ── Properties table ────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  unit_suite TEXT,
  city TEXT DEFAULT 'Jacksonville',
  state TEXT DEFAULT 'FL',
  zip TEXT,
  property_type TEXT DEFAULT 'vacation_rental',
  plan_tier TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  sqft INTEGER,
  access_notes TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on properties" ON properties FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_properties_client ON properties (client_id);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties (active);

-- ── Add client/property link to inspections ─────────
-- (This adds columns if they don't exist yet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspections' AND column_name='client_id') THEN
    ALTER TABLE inspections ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inspections' AND column_name='property_id') THEN
    ALTER TABLE inspections ADD COLUMN property_id TEXT REFERENCES properties(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inspections_client ON inspections (client_id);
CREATE INDEX IF NOT EXISTS idx_inspections_property ON inspections (property_id);

-- ── Original inspections table (if not yet created) ─
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
  property_address TEXT,
  unit_suite TEXT,
  owner_manager TEXT,
  plan_tier TEXT,
  date TEXT,
  statuses JSONB DEFAULT '{}',
  photos JSONB DEFAULT '{}',
  item_notes JSONB DEFAULT '{}',
  notes TEXT,
  overall_rating TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all on inspections" ON inspections FOR ALL USING (true) WITH CHECK (true);
