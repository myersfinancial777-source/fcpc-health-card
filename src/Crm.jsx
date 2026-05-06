import { useState, useEffect } from 'react';
import { NAVY, TEAL, TEAL_LIGHT, TEAL_MED, DARK_GRAY, MED_GRAY, LIGHT_GRAY, BORDER_GRAY, PLAN_TIERS, STATUS_OPTIONS } from './constants.js';
import {
  loadClients as _loadClients,
  saveClient as _saveClient,
  deleteClient as _deleteClient,
  loadProperties as _loadProperties,
  saveProperty as _saveProperty,
  deleteProperty as _deleteProperty,
  loadInspectionsForProperty as _loadInspectionsForProperty,
} from './db-crm.js';
import { genId, getCompInfo, getCounts, getTotalPhotos } from './utils.js';

const F = { fontFamily: "'DM Sans', sans-serif" };

// =====================================================
// PERSISTENT CACHE — uses localStorage so data survives
// page refreshes AND tab switches AND PWA reopens.
// Cache version: v3 (bumped to invalidate stale entries)
// =====================================================
const CACHE_PREFIX = 'fcpc_cache_v3_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.t || Date.now() - parsed.t > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.d;
  } catch (e) {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
  } catch (e) {
    // Quota exceeded or storage disabled — silently ignore
  }
}

function cacheDelete(key) {
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {}
}

function cacheClearPrefix(prefix) {
  try {
    const fullPrefix = CACHE_PREFIX + prefix;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(fullPrefix)) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

// Cached load wrappers
async function loadClients() {
  const data = await _loadClients();
  cacheSet('clients', data);
  return data;
}
async function loadProperties(clientId) {
  const data = await _loadProperties(clientId);
  cacheSet('props_' + clientId, data);
  return data;
}
async function loadInspectionsForProperty(propId) {
  const data = await _loadInspectionsForProperty(propId);
  cacheSet('insps_' + propId, data);
  return data;
}

// Mutating wrappers that invalidate cache
async function saveClient(client) {
  const result = await _saveClient(client);
  cacheDelete('clients');
  return result;
}
async function deleteClient(id) {
  const result = await _deleteClient(id);
  cacheDelete('clients');
  cacheDelete('props_' + id);
  return result;
}
async function saveProperty(property) {
  const result = await _saveProperty(property);
  cacheDelete('props_' + property.client_id);
  return result;
}
async function deleteProperty(propId) {
  const result = await _deleteProperty(propId);
  cacheClearPrefix('props_');
  cacheDelete('insps_' + propId);
  return result;
}

// -- Client list -------------------------------------
export function ClientList({ onSelectClient, onNewClient }) {
  // Hydrate from cache instantly
  const [clients, setClients] = useState(() => cacheGet('clients') || []);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(() => cacheGet('clients') === null);

  useEffect(() => {
    // Background refresh every mount to keep data current
    loadClients().then(d => { setClients(d); setLoading(false); });
  }, []);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''} ${c.company || ''}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: NAVY, ...F, fontWeight: 700 }}>Clients (Fast)</h2>
        <button onClick={onNewClient} style={S.primaryBtn}>+ Add Client</button>
      </div>
      <input style={S.searchInput} placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />

      {loading && clients.length === 0 && <div style={S.loadingText}>Loading...</div>}

      {!loading && filtered.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F464}'}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: NAVY, ...F }}>{search ? 'No clients match' : 'No clients yet'}</div>
          <div style={{ fontSize: 13, color: MED_GRAY, marginTop: 4, ...F }}>Tap "+ Add Client" to get started</div>
        </div>
      )}

      {filtered.map(client => {
        const propCount = client.properties?.length || 0;
        return (
          <div key={client.id} style={S.card} onClick={() => onSelectClient(client.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, ...F }}>
                  {client.first_name} {client.last_name}
                </div>
                {client.company && <div style={{ fontSize: 12, color: TEAL, fontWeight: 600, ...F }}>{client.company}</div>}
                <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4, ...F }}>
                  {client.email && <span>{client.email}</span>}
                  {client.email && client.phone && <span> {'\u00B7'} </span>}
                  {client.phone && <span>{client.phone}</span>}
                </div>
              </div>
              <div style={{ background: TEAL_LIGHT, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: TEAL, ...F, flexShrink: 0 }}>
                {propCount} {propCount === 1 ? 'property' : 'properties'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- Client form (add/edit) --------------------------
export function ClientForm({ clientId, onSave, onCancel }) {
  const [form, setForm] = useState({
    id: '', first_name: '', last_name: '', email: '', phone: '', company: '', notes: '',
  });
  const [loading, setLoading] = useState(!!clientId);

  useEffect(() => {
    if (clientId) {
      const cached = cacheGet('clients');
      if (cached) {
        const found = cached.find(c => c.id === clientId);
        if (found) { setForm(found); setLoading(false); return; }
      }
      loadClients().then(clients => {
        const found = clients.find(c => c.id === clientId);
        if (found) setForm(found);
        setLoading(false);
      });
    }
  }, [clientId]);

  function upd(u) { setForm(p => ({ ...p, ...u })); }

  async function handleSave() {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    const toSave = {
      ...form,
      id: form.id || genId(),
      created_at: form.created_at || new Date().toISOString(),
    };
    await saveClient(toSave);
    onSave(toSave);
  }

  if (loading) return <div style={S.loadingText}>Loading...</div>;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16, ...F }}>
        {clientId ? 'Edit client' : 'New client'}
      </div>
      <div style={S.infoCard}>
        <div style={S.sectionLabel}>Contact information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input style={S.input} placeholder="First name *" value={form.first_name} onChange={e => upd({ first_name: e.target.value })} />
          <input style={S.input} placeholder="Last name *" value={form.last_name} onChange={e => upd({ last_name: e.target.value })} />
        </div>
        <input style={S.input} placeholder="Email" type="email" value={form.email || ''} onChange={e => upd({ email: e.target.value })} />
        <input style={S.input} placeholder="Phone" type="tel" value={form.phone || ''} onChange={e => upd({ phone: e.target.value })} />
        <input style={S.input} placeholder="Company (optional)" value={form.company || ''} onChange={e => upd({ company: e.target.value })} />
      </div>
      <div style={S.infoCard}>
        <div style={S.sectionLabel}>Notes</div>
        <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} placeholder="Any notes about this client..."
          value={form.notes || ''} onChange={e => upd({ notes: e.target.value })} />
      </div>
      <button onClick={handleSave} style={{ ...S.primaryBtn, width: '100%', padding: '14px', fontSize: 14, marginBottom: 10 }}>
        {clientId ? 'Save changes' : 'Add client'}
      </button>
      <button onClick={onCancel} style={{ ...S.secBtn, width: '100%' }}>Cancel</button>
    </div>
  );
}

// -- Client detail (with properties & inspection history) ------------
export function ClientDetail({ clientId, onBack, onStartInspection, onOpenInspection }) {
  // Hydrate everything from cache instantly
  const [client, setClient] = useState(() => {
    const cached = cacheGet('clients');
    return cached ? cached.find(c => c.id === clientId) || null : null;
  });
  const [properties, setProperties] = useState(() => cacheGet('props_' + clientId) || []);
  const [editing, setEditing] = useState(false);
  const [addingProp, setAddingProp] = useState(false);
  const [editingPropId, setEditingPropId] = useState(null);
  const [expandedProp, setExpandedProp] = useState(null);
  const [propInspections, setPropInspections] = useState(() => {
    // Hydrate inspections from cache for ALL properties
    const initial = {};
    const cachedProps = cacheGet('props_' + clientId);
    if (cachedProps) {
      cachedProps.forEach(p => {
        const cachedInsps = cacheGet('insps_' + p.id);
        if (cachedInsps) initial[p.id] = cachedInsps;
      });
    }
    return initial;
  });

  useEffect(() => { refresh(); }, [clientId]);

  async function refresh() {
    const clients = await loadClients();
    const found = clients.find(c => c.id === clientId);
    if (found) setClient(found);
    const props = await loadProperties(clientId);
    setProperties(props);
    // Refresh inspection cache in background for properties we have cached data for
    props.forEach(p => {
      if (cacheGet('insps_' + p.id) !== null) {
        loadInspectionsForProperty(p.id).then(insps => {
          setPropInspections(prev => ({ ...prev, [p.id]: insps }));
        });
      }
    });
  }

  async function handleDeleteClient() {
    if (!confirm(`Delete ${client.first_name} ${client.last_name} and all their properties?`)) return;
    await deleteClient(clientId);
    onBack();
  }

  async function handleDeleteProperty(propId) {
    if (!confirm('Delete this property?')) return;
    await deleteProperty(propId);
    refresh();
  }

  async function togglePropExpand(propId) {
    if (expandedProp === propId) { setExpandedProp(null); return; }
    setExpandedProp(propId);

    // Show cached inspections immediately if available
    const cached = cacheGet('insps_' + propId);
    if (cached) {
      setPropInspections(prev => ({ ...prev, [propId]: cached }));
    }

    // Fetch fresh in background
    const insps = await loadInspectionsForProperty(propId);
    setPropInspections(prev => ({ ...prev, [propId]: insps }));
  }

  if (editing) return <ClientForm clientId={clientId} onSave={() => { setEditing(false); refresh(); }} onCancel={() => setEditing(false)} />;
  if (addingProp) return <PropertyForm clientId={clientId} onSave={() => { setAddingProp(false); refresh(); }} onCancel={() => setAddingProp(false)} />;
  if (editingPropId) return <PropertyForm clientId={clientId} propertyId={editingPropId} onSave={() => { setEditingPropId(null); refresh(); }} onCancel={() => setEditingPropId(null)} />;

  if (!client) return <div style={S.loadingText}>Loading...</div>;

  return (
    <div>
      {/* Client header card */}
      <div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY}dd)`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', ...F }}>{client.first_name} {client.last_name}</div>
        {client.company && <div style={{ fontSize: 13, color: TEAL_MED, fontWeight: 600, marginTop: 2, ...F }}>{client.company}</div>}
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {client.email && <div style={{ fontSize: 12, color: TEAL_MED, ...F }}>{'\u2709'} {client.email}</div>}
          {client.phone && <div style={{ fontSize: 12, color: TEAL_MED, ...F }}>{'\u{1F4F1}'} {client.phone}</div>}
        </div>
        {client.notes && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 8, fontStyle: 'italic', ...F }}>{client.notes}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => setEditing(true)} style={{ ...S.smallBtn, background: 'rgba(255,255,255,.15)', color: '#fff' }}>Edit</button>
          <button onClick={handleDeleteClient} style={{ ...S.smallBtn, background: 'rgba(239,68,68,.2)', color: '#FCA5A5' }}>Delete</button>
        </div>
      </div>

      {/* Properties */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, ...F }}>Properties ({properties.length})</div>
        <button onClick={() => setAddingProp(true)} style={{ ...S.smallBtn, background: TEAL, color: '#fff' }}>+ Add Property</button>
      </div>

      {properties.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F3E0}'}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, ...F }}>No properties yet</div>
          <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4, ...F }}>Add a property to start tracking inspections</div>
        </div>
      )}

      {properties.map(prop => {
        const expanded = expandedProp === prop.id;
        const insps = propInspections[prop.id] || [];
        return (
          <div key={prop.id} style={{ marginBottom: 10 }}>
            <div style={S.card} onClick={() => togglePropExpand(prop.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{prop.address}</div>
                  {prop.unit_suite && <div style={{ fontSize: 12, color: MED_GRAY, ...F }}>Unit: {prop.unit_suite}</div>}
                  <div style={{ fontSize: 11, color: MED_GRAY, marginTop: 2, ...F }}>
                    {prop.city}, {prop.state} {prop.zip || ''}
                    {prop.plan_tier && <span> {'\u00B7'} {prop.plan_tier} plan</span>}
                  </div>
                  {(prop.bedrooms || prop.bathrooms || prop.sqft) && (
                    <div style={{ fontSize: 11, color: MED_GRAY, marginTop: 2, ...F }}>
                      {prop.bedrooms && <span>{prop.bedrooms} bed</span>}
                      {prop.bathrooms && <span> {'\u00B7'} {prop.bathrooms} bath</span>}
                      {prop.sqft && <span> {'\u00B7'} {prop.sqft} sqft</span>}
                    </div>
                  )}
                </div>
                <span style={{ color: TEAL_MED, fontSize: 18, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>{'\u25BE'}</span>
              </div>
            </div>

            {expanded && (
              <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', border: `1px solid ${BORDER_GRAY}`, borderTop: 'none', padding: 14, marginTop: -10 }}>
                {prop.access_notes && <div style={{ fontSize: 12, color: MED_GRAY, marginBottom: 10, ...F }}>{'\u{1F511}'} {prop.access_notes}</div>}
                {prop.notes && <div style={{ fontSize: 12, color: MED_GRAY, marginBottom: 10, fontStyle: 'italic', ...F }}>{prop.notes}</div>}

                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button onClick={(e) => { e.stopPropagation(); onStartInspection(client, prop); }} style={{ ...S.smallBtn, background: TEAL, color: '#fff' }}>
                    {'\u{1F4CB}'} New inspection
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingPropId(prop.id); }} style={{ ...S.smallBtn, background: LIGHT_GRAY, color: DARK_GRAY }}>
                    Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteProperty(prop.id); }} style={{ ...S.smallBtn, background: '#FEF2F2', color: '#EF4444' }}>
                    Delete
                  </button>
                </div>

                {/* -- Inspection history (tappable) -- */}
                <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8, ...F }}>
                  Inspection history
                  {insps.length > 0 && <span style={{ fontWeight: 500, color: MED_GRAY }}> ({insps.length})</span>}
                </div>
                {insps.length === 0 && <div style={{ fontSize: 12, color: MED_GRAY, ...F }}>No inspections yet for this property</div>}
                {insps.map(insp => {
                  const inspId = insp.id;
                  const { pct } = getCompInfo(insp);
                  const counts = getCounts(insp);
                  const rating = insp.overall_rating || insp.overallRating || '';
                  const photoCount = getTotalPhotos(insp);
                  const ratingColor = rating === 'Excellent' ? '#22C55E' : rating === 'Good' ? TEAL : rating === 'Fair' ? '#F59E0B' : rating === 'Needs Attention' ? '#EF4444' : MED_GRAY;
                  return (
                    <div
                      key={inspId}
                      onClick={(e) => { e.stopPropagation(); onOpenInspection(inspId); }}
                      style={{
                        padding: '10px 12px',
                        marginBottom: 6,
                        background: LIGHT_GRAY,
                        borderRadius: 10,
                        border: `1px solid ${BORDER_GRAY}`,
                        cursor: 'pointer',
                        transition: 'all .15s',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: DARK_GRAY, ...F }}>{insp.date || 'No date'}</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                            {rating && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                                background: ratingColor + '15', color: ratingColor, ...F,
                              }}>{rating}</span>
                            )}
                            {counts.good > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#22C55E', ...F }}>{'\u2713'}{counts.good}</span>}
                            {counts.fair > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B', ...F }}>~{counts.fair}</span>}
                            {counts.attention > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#EF4444', ...F }}>!{counts.attention}</span>}
                            {photoCount > 0 && <span style={{ fontSize: 10, color: MED_GRAY, ...F }}>{'\u{1F4F7}'}{photoCount}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            border: `2.5px solid ${pct === 100 ? '#22C55E' : TEAL}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: pct === 100 ? '#22C55E' : TEAL, ...F }}>{pct}%</span>
                          </div>
                          <span style={{ fontSize: 14, color: TEAL_MED }}>{'\u203A'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- Property form (add/edit) ------------------------
export function PropertyForm({ clientId, propertyId, onSave, onCancel }) {
  const [form, setForm] = useState({
    id: '', client_id: clientId, address: '', unit_suite: '', city: 'Jacksonville', state: 'FL', zip: '',
    property_type: 'vacation_rental', plan_tier: '', bedrooms: '', bathrooms: '', sqft: '',
    access_notes: '', notes: '', active: true,
  });
  const [loading, setLoading] = useState(!!propertyId);

  useEffect(() => {
    if (propertyId) {
      const cached = cacheGet('props_' + clientId);
      if (cached) {
        const found = cached.find(p => p.id === propertyId);
        if (found) {
          setForm({ ...found, bedrooms: found.bedrooms || '', bathrooms: found.bathrooms || '', sqft: found.sqft || '' });
          setLoading(false);
          return;
        }
      }
      loadProperties(clientId).then(props => {
        const found = props.find(p => p.id === propertyId);
        if (found) setForm({ ...found, bedrooms: found.bedrooms || '', bathrooms: found.bathrooms || '', sqft: found.sqft || '' });
        setLoading(false);
      });
    }
  }, [propertyId]);

  function upd(u) { setForm(p => ({ ...p, ...u })); }

  async function handleSave() {
    if (!form.address.trim()) return;
    const toSave = {
      ...form,
      id: form.id || genId(),
      client_id: clientId,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
      sqft: form.sqft ? parseInt(form.sqft) : null,
      created_at: form.created_at || new Date().toISOString(),
    };
    await saveProperty(toSave);
    onSave(toSave);
  }

  if (loading) return <div style={S.loadingText}>Loading...</div>;

  const PROP_TYPES = [
    { key: 'vacation_rental', label: 'Vacation Rental' },
    { key: 'long_term_rental', label: 'Long-Term Rental' },
    { key: 'owner_occupied', label: 'Owner Occupied' },
    { key: 'commercial', label: 'Commercial' },
  ];

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16, ...F }}>
        {propertyId ? 'Edit property' : 'Add property'}
      </div>
      <div style={S.infoCard}>
        <div style={S.sectionLabel}>Address</div>
        <input style={S.input} placeholder="Street address *" value={form.address} onChange={e => upd({ address: e.target.value })} />
        <input style={S.input} placeholder="Unit / Suite" value={form.unit_suite || ''} onChange={e => upd({ unit_suite: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
          <input style={S.input} placeholder="City" value={form.city || ''} onChange={e => upd({ city: e.target.value })} />
          <input style={S.input} placeholder="State" value={form.state || ''} onChange={e => upd({ state: e.target.value })} />
          <input style={S.input} placeholder="ZIP" value={form.zip || ''} onChange={e => upd({ zip: e.target.value })} />
        </div>
      </div>
      <div style={S.infoCard}>
        <div style={S.sectionLabel}>Property details</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {PROP_TYPES.map(t => (
            <button key={t.key} onClick={() => upd({ property_type: t.key })} style={{
              padding: '6px 14px', borderRadius: 20, border: `2px solid ${form.property_type === t.key ? TEAL : BORDER_GRAY}`,
              background: form.property_type === t.key ? TEAL : '#fff', color: form.property_type === t.key ? '#fff' : MED_GRAY,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', ...F
            }}>{t.label}</button>
          ))}
        </div>
        <div style={S.sectionLabel}>Plan tier</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {PLAN_TIERS.map(t => (
            <button key={t} onClick={() => upd({ plan_tier: form.plan_tier === t ? '' : t })} style={{
              padding: '6px 14px', borderRadius: 20, border: `2px solid ${form.plan_tier === t ? TEAL : BORDER_GRAY}`,
              background: form.plan_tier === t ? TEAL : '#fff', color: form.plan_tier === t ? '#fff' : MED_GRAY,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', ...F
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input style={S.input} placeholder="Beds" type="number" value={form.bedrooms} onChange={e => upd({ bedrooms: e.target.value })} />
          <input style={S.input} placeholder="Baths" type="number" step="0.5" value={form.bathrooms} onChange={e => upd({ bathrooms: e.target.value })} />
          <input style={S.input} placeholder="Sqft" type="number" value={form.sqft} onChange={e => upd({ sqft: e.target.value })} />
        </div>
      </div>
      <div style={S.infoCard}>
        <div style={S.sectionLabel}>Access & notes</div>
        <input style={S.input} placeholder="Access notes (lockbox code, gate code, etc.)" value={form.access_notes || ''} onChange={e => upd({ access_notes: e.target.value })} />
        <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} placeholder="General notes..."
          value={form.notes || ''} onChange={e => upd({ notes: e.target.value })} />
      </div>
      <button onClick={handleSave} style={{ ...S.primaryBtn, width: '100%', padding: '14px', fontSize: 14, marginBottom: 10 }}>
        {propertyId ? 'Save changes' : 'Add property'}
      </button>
      <button onClick={onCancel} style={{ ...S.secBtn, width: '100%' }}>Cancel</button>
    </div>
  );
}

// -- Shared styles -----------------------------------
const S = {
  primaryBtn: { background: `linear-gradient(135deg,${TEAL},#1a9e8e)`, color: '#fff', border: 'none', borderRadius: 24, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: `0 4px 14px ${TEAL}44` },
  secBtn: { background: '#fff', color: TEAL, border: `2px solid ${TEAL}`, borderRadius: 14, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F },
  smallBtn: { border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...F },
  card: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, border: `1px solid ${BORDER_GRAY}`, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.04)' },
  infoCard: { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${BORDER_GRAY}`, boxShadow: '0 2px 8px rgba(0,0,0,.04)' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${BORDER_GRAY}`, fontSize: 13, color: DARK_GRAY, ...F, outline: 'none', boxSizing: 'border-box', background: LIGHT_GRAY, marginBottom: 8 },
  searchInput: { width: '100%', padding: '12px 14px', borderRadius: 12, border: `2px solid ${BORDER_GRAY}`, fontSize: 14, ...F, outline: 'none', boxSizing: 'border-box', background: '#fff', marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, ...F },
  empty: { textAlign: 'center', padding: '32px 20px', background: '#fff', borderRadius: 16, border: `1px dashed ${BORDER_GRAY}`, marginBottom: 12 },
  loadingText: { textAlign: 'center', padding: 40, color: MED_GRAY, ...F },
};
