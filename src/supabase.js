import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not found. Falling back to localStorage.');
}

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ── Database helpers ─────────────────────────────

export async function loadInspections() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(row => ({
        ...row,
        statuses: row.statuses || {},
        photos: row.photos || {},
        itemNotes: row.item_notes || {},
      }));
    } catch (err) {
      console.error('Supabase load failed, falling back to localStorage:', err);
      return loadFromLocalStorage();
    }
  }
  return loadFromLocalStorage();
}

export async function saveInspection(inspection) {
  if (supabase) {
    try {
      const row = {
        id: inspection.id,
        property_address: inspection.propertyAddress,
        unit_suite: inspection.unitSuite,
        owner_manager: inspection.ownerManager,
        plan_tier: inspection.planTier,
        date: inspection.date,
        statuses: inspection.statuses,
        photos: inspection.photos,
        item_notes: inspection.itemNotes,
        notes: inspection.notes,
        overall_rating: inspection.overallRating,
        created_at: inspection.createdAt,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('inspections')
        .upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase save failed, using localStorage:', err);
      saveToLocalStorage(inspection);
      return false;
    }
  }
  saveToLocalStorage(inspection);
  return true;
}

export async function deleteInspection(id) {
  if (supabase) {
    try {
      const { error } = await supabase.from('inspections').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Supabase delete failed:', err);
    }
  }
  deleteFromLocalStorage(id);
}

// ── localStorage fallback ───────────────────────

const LS_KEY = 'fcpc-inspections-v2';

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToLocalStorage(inspection) {
  const all = loadFromLocalStorage();
  const idx = all.findIndex(i => i.id === inspection.id);
  if (idx >= 0) all[idx] = inspection;
  else all.unshift(inspection);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function deleteFromLocalStorage(id) {
  const all = loadFromLocalStorage().filter(i => i.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}
