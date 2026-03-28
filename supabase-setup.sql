-- ════════════════════════════════════════════════════
-- First Coast Property Care — Supabase Setup
-- ════════════════════════════════════════════════════
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ════════════════════════════════════════════════════

-- Create the inspections table
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
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

-- Enable Row Level Security (recommended)
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations with the anon key
-- (you can tighten this later with auth)
CREATE POLICY "Allow all operations" ON inspections
  FOR ALL USING (true) WITH CHECK (true);

-- Create an index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (date DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_created ON inspections (created_at DESC);
