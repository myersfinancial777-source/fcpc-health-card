import { supabase } from './supabase.js';

const LS_CLIENTS = 'fcpc-clients';
const LS_PROPERTIES = 'fcpc-properties';

// ── Clients ─────────────────────────────────────────

export async function loadClients() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, properties(*)')
        .order('last_name', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Supabase loadClients failed:', err);
      return loadFromLS(LS_CLIENTS);
    }
  }
  return loadFromLS(LS_CLIENTS);
}

export async function saveClient(client) {
  if (supabase) {
    try {
      const { properties, ...row } = client;
      row.updated_at = new Date().toISOString();
      const { error } = await supabase.from('clients').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Supabase saveClient failed:', err);
      saveToLS(LS_CLIENTS, client);
      return false;
    }
  }
  saveToLS(LS_CLIENTS, client);
  return true;
}

export async function deleteClient(id) {
  if (supabase) {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    } catch (err) { console.error('deleteClient:', err); }
  }
  deleteFromLS(LS_CLIENTS, id);
}

// ── Properties ──────────────────────────────────────

export async function loadProperties(clientId) {
  if (supabase) {
    try {
      let query = supabase.from('properties').select('*').order('address');
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('loadProperties failed:', err);
      const all = loadFromLS(LS_PROPERTIES);
      return clientId ? all.filter(p => p.client_id === clientId) : all;
    }
  }
  const all = loadFromLS(LS_PROPERTIES);
  return clientId ? all.filter(p => p.client_id === clientId) : all;
}

export async function saveProperty(property) {
  if (supabase) {
    try {
      const row = { ...property, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('properties').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('saveProperty failed:', err);
      saveToLS(LS_PROPERTIES, property);
      return false;
    }
  }
  saveToLS(LS_PROPERTIES, property);
  return true;
}

export async function deleteProperty(id) {
  if (supabase) {
    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    } catch (err) { console.error('deleteProperty:', err); }
  }
  deleteFromLS(LS_PROPERTIES, id);
}

// ── Load inspections for a property ─────────────────

export async function loadInspectionsForProperty(propertyId) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('property_id', propertyId)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        client_id: row.client_id || null,
        property_id: row.property_id || null,
        propertyAddress: row.property_address || '',
        unitSuite: row.unit_suite || '',
        ownerManager: row.owner_manager || '',
        planTier: row.plan_tier || '',
        date: row.date || '',
        statuses: row.statuses || {},
        photos: row.photos || {},
        itemNotes: row.item_notes || {},
        notes: row.notes || '',
        overallRating: row.overall_rating || '',
        createdAt: row.created_at || '',
      }));
    } catch (err) { console.error('loadInspectionsForProperty:', err); return []; }
  }
  return [];
}

// ── localStorage fallback helpers ───────────────────

function loadFromLS(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

function saveToLS(key, item) {
  const all = loadFromLS(key);
  const idx = all.findIndex(i => i.id === item.id);
  if (idx >= 0) all[idx] = item; else all.unshift(item);
  localStorage.setItem(key, JSON.stringify(all));
}

function deleteFromLS(key, id) {
  const all = loadFromLS(key).filter(i => i.id !== id);
  localStorage.setItem(key, JSON.stringify(all));
}
