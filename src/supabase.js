import { createClient } from '@supabase/supabase-js';

var supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
var supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not found. Falling back to localStorage.');
}

export var supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// -- Database helpers --

export async function loadInspections() {
  if (supabase) {
    try {
      var resp = await supabase
        .from('inspections')
        .select('*')
        .order('created_at', { ascending: false });
      if (resp.error) throw resp.error;
      return resp.data.map(function(row) {
        return {
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
        };
      });
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
      var row = {
        id: inspection.id,
        client_id: inspection.client_id || null,
        property_id: inspection.property_id || null,
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
      var resp = await supabase
        .from('inspections')
        .upsert(row, { onConflict: 'id' });
      if (resp.error) throw resp.error;
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
      var resp = await supabase.from('inspections').delete().eq('id', id);
      if (resp.error) throw resp.error;
    } catch (err) {
      console.error('Supabase delete failed:', err);
    }
  }
  deleteFromLocalStorage(id);
}

// -- Photo upload for emails --

function base64ToBlob(dataUrl) {
  var parts = dataUrl.split(',');
  var mimeMatch = parts[0].match(/:(.*?);/);
  var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  var raw = atob(parts[1]);
  var arr = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

export async function uploadPhotoForEmail(inspectionId, itemName, photoIndex, dataUrl) {
  if (!supabase) return null;
  try {
    var ext = 'jpg';
    if (dataUrl.indexOf('image/png') !== -1) ext = 'png';
    if (dataUrl.indexOf('image/webp') !== -1) ext = 'webp';

    var safeName = itemName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
    var path = inspectionId + '/' + safeName + '_' + photoIndex + '.' + ext;

    var blob = base64ToBlob(dataUrl);

    var resp = await supabase.storage
      .from('inspection-photos')
      .upload(path, blob, {
        contentType: blob.type,
        upsert: true
      });

    if (resp.error) throw resp.error;

    var urlResp = supabase.storage
      .from('inspection-photos')
      .getPublicUrl(path);

    return urlResp.data.publicUrl;
  } catch (err) {
    console.error('Photo upload failed:', err);
    return null;
  }
}

// -- localStorage fallback --

var LS_KEY = 'fcpc-inspections-v2';

function loadFromLocalStorage() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveToLocalStorage(inspection) {
  var all = loadFromLocalStorage();
  var idx = all.findIndex(function(i) { return i.id === inspection.id; });
  if (idx >= 0) all[idx] = inspection;
  else all.unshift(inspection);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

function deleteFromLocalStorage(id) {
  var all = loadFromLocalStorage().filter(function(i) { return i.id !== id; });
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}