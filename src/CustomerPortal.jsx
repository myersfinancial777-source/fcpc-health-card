import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { NAVY, TEAL, TEAL_LIGHT, TEAL_MED, DARK_GRAY, MED_GRAY, LIGHT_GRAY, BORDER_GRAY, STATUS_OPTIONS, SECTIONS } from './constants.js';
import logoUrl from '/logo.png?url';

var F = { fontFamily: "'DM Sans', sans-serif" };

function statusColor(key) {
  if (key === 'good') return '#22C55E';
  if (key === 'fair') return '#F59E0B';
  if (key === 'attention') return '#EF4444';
  return '#9CA3AF';
}

function statusLabel(key) {
  var match = STATUS_OPTIONS.find(function(o) { return o.key === key; });
  return match ? match.label : '\u2014';
}

function getCompInfo(insp) {
  var statuses = insp.statuses || insp.item_notes || {};
  if (insp.statuses) statuses = insp.statuses;
  var t = Object.keys(statuses).length;
  var d = Object.values(statuses).filter(function(v) { return v != null; }).length;
  return { done: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 };
}

function getCounts(insp) {
  var c = { good: 0, fair: 0, attention: 0, na: 0 };
  var statuses = insp.statuses || {};
  Object.values(statuses).forEach(function(v) { if (v && c[v] !== undefined) c[v]++; });
  return c;
}

function getTotalPhotos(insp) {
  var count = 0;
  var photos = insp.photos || {};
  Object.keys(photos).forEach(function(k) { count += (photos[k] || []).length; });
  return count;
}

/* -- Lightbox -- */
function Lightbox(props) {
  if (!props.src) return null;
  return (
    <div onClick={props.onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <img src={props.src} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
      <button onClick={props.onClose} style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u00D7'}</button>
    </div>
  );
}

/* -- Main Portal -- */
export function CustomerPortal(props) {
  var profile = props.profile;
  var onSignOut = props.onSignOut;

  var [client, setClient] = useState(null);
  var [properties, setProperties] = useState([]);
  var [inspections, setInspections] = useState([]);
  var [view, setView] = useState('dashboard');
  var [selectedInsp, setSelectedInsp] = useState(null);
  var [expandedProp, setExpandedProp] = useState(null);
  var [loading, setLoading] = useState(true);
  var [detailLoading, setDetailLoading] = useState(false);
  var [lightbox, setLightbox] = useState(null);
  var [portalTab, setPortalTab] = useState('inspections');
  var [quotes, setQuotes] = useState([]);
  var [invoices, setInvoices] = useState([]);
  var [workRequests, setWorkRequests] = useState([]);
  var [wrForm, setWrForm] = useState(null);

  useEffect(function() { loadData(); }, [profile]);

  async function loadData() {
    if (!profile || !profile.client_id) { setLoading(false); return; }

    var clientResp = await supabase.from('clients').select('*').eq('id', profile.client_id).single();
    if (clientResp.data) setClient(clientResp.data);

    var propsResp = await supabase.from('properties').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false });
    if (propsResp.data) setProperties(propsResp.data);

    var inspsResp = await supabase.from('inspections')
      .select('id, date, statuses, item_notes, overall_rating, notes, property_id, client_id, property_address, owner_manager, plan_tier, unit_suite, created_at')
      .eq('client_id', profile.client_id)
      .order('created_at', { ascending: false });
    if (inspsResp.data) setInspections(inspsResp.data);

    var quotesResp = await supabase.from('quotes').select('*, quote_items(*)').eq('client_id', profile.client_id).in('status', ['sent', 'approved', 'declined']).order('created_at', { ascending: false });
    if (quotesResp.data) setQuotes(quotesResp.data);

    var invoicesResp = await supabase.from('invoices').select('*, invoice_items(*)').eq('client_id', profile.client_id).in('status', ['sent', 'paid', 'overdue']).order('created_at', { ascending: false });
    if (invoicesResp.data) setInvoices(invoicesResp.data);

    var wrResp = await supabase.from('work_requests').select('*, properties(address)').eq('client_id', profile.client_id).order('created_at', { ascending: false });
    if (wrResp.data) setWorkRequests(wrResp.data);

    setLoading(false);
  }

  async function openInspection(inspId) {
    setDetailLoading(true);
    var resp = await supabase.from('inspections').select('*').eq('id', inspId).single();
    if (resp.data) {
      var d = resp.data;
      setSelectedInsp({
        id: d.id,
        propertyAddress: d.property_address || '',
        unitSuite: d.unit_suite || '',
        ownerManager: d.owner_manager || '',
        planTier: d.plan_tier || '',
        date: d.date || '',
        statuses: d.statuses || {},
        photos: d.photos || {},
        itemNotes: d.item_notes || {},
        notes: d.notes || '',
        overallRating: d.overall_rating || '',
      });
      setView('detail');
    }
    setDetailLoading(false);
  }

  async function approveQuote(quoteId) {
    await supabase.from('quotes').update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', quoteId);
    loadData();
  }

  async function declineQuote(quoteId) {
    await supabase.from('quotes').update({ status: 'declined', declined_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', quoteId);
    loadData();
  }

  async function payInvoice(invoiceId) {
    try {
      var resp = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-checkout', invoice_id: invoiceId }),
      });
      var data = await resp.json();
      if (data.url) window.location.href = data.url;
      else alert('Could not create payment session. Please try again.');
    } catch (err) {
      alert('Payment error. Please try again.');
    }
  }

  async function submitWorkRequest(data) {
    var id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    await supabase.from('work_requests').insert({
      id: id, client_id: profile.client_id, property_id: data.property_id || null,
      title: data.title, description: data.description, urgency: data.urgency || 'normal',
      status: 'new', created_at: new Date().toISOString(),
    });
    setWrForm(null);
    loadData();
  }

  /* -- Header -- */
  function Header() {
    return (
      <div style={{ background: 'linear-gradient(135deg, ' + NAVY + ', ' + NAVY + 'ee)', padding: '16px 20px', borderBottom: '3px solid ' + TEAL }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logoUrl} alt="Logo" style={{ height: 36, borderRadius: 6 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'Playfair Display', serif" }}>First Coast</div>
              <div style={{ fontSize: 9, color: TEAL_MED, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', ...F }}>Property Care</div>
            </div>
          </div>
          <button onClick={onSignOut} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 16, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: TEAL_MED, cursor: 'pointer', ...F }}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  /* -- Loading -- */
  if (loading) {
    return (
      <div style={S.app}>
        <Header />
        <div style={{ textAlign: 'center', padding: 60, color: MED_GRAY, ...F }}>Loading your dashboard...</div>
      </div>
    );
  }

  /* -- No linked client -- */
  if (!client) {
    return (
      <div style={S.app}>
        <Header />
        <div style={S.body}>
          <div style={S.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F3E0}'}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: NAVY, ...F }}>No properties linked yet</div>
            <div style={{ fontSize: 13, color: MED_GRAY, marginTop: 6, ...F, lineHeight: 1.5 }}>
              Your account is set up. Contact First Coast Property Care to link your properties.
            </div>
            <div style={{ fontSize: 12, color: TEAL, fontWeight: 600, marginTop: 12, ...F }}>(904) 754-3614</div>
          </div>
        </div>
      </div>
    );
  }

  /* -- Inspection Detail View -- */
  if (view === 'detail' && selectedInsp) {
    var insp = selectedInsp;
    var counts = getCounts(insp);
    var ci = getCompInfo(insp);
    var pc = getTotalPhotos(insp);
    var rating = insp.overallRating || '';
    var rc = rating === 'Excellent' ? '#22C55E' : rating === 'Good' ? TEAL : rating === 'Fair' ? '#F59E0B' : rating === 'Needs Attention' ? '#EF4444' : MED_GRAY;

    var photoEntries = [];
    SECTIONS.forEach(function(sec) {
      sec.items.forEach(function(item) {
        var p = (insp.photos && insp.photos[item]) ? insp.photos[item] : [];
        if (p.length > 0) photoEntries.push({ section: sec.title, item: item, pics: p });
      });
    });

    var attentionItems = [];
    SECTIONS.forEach(function(sec) {
      sec.items.forEach(function(item) {
        if (insp.statuses[item] === 'attention') {
          attentionItems.push({ section: sec.title, item: item, note: (insp.itemNotes && insp.itemNotes[item]) || '' });
        }
      });
    });

    return (
      <div style={S.app}>
        <Lightbox src={lightbox} onClose={function() { setLightbox(null); }} />
        <div style={{ background: NAVY, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid ' + TEAL, position: 'sticky', top: 0, zIndex: 100 }}>
          <button onClick={function() { setView('dashboard'); setSelectedInsp(null); }} style={{ background: 'transparent', border: 'none', color: TEAL_MED, fontSize: 14, fontWeight: 600, cursor: 'pointer', ...F }}>{'\u2190'} Back</button>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, ...F }}>Inspection Report</span>
          <div style={{ width: 48 }} />
        </div>
        <div style={S.body}>

          {/* Property info */}
          <div style={{ background: LIGHT_GRAY, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, ...F }}>{insp.propertyAddress || 'Property'}</div>
            {insp.unitSuite && <div style={{ fontSize: 13, color: MED_GRAY, ...F }}>Unit: {insp.unitSuite}</div>}
            <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4, ...F }}>{insp.date} {'\u2022'} {insp.planTier || '\u2014'} {'\u2022'} {insp.ownerManager || '\u2014'}</div>
          </div>

          {/* Progress */}
          <div style={{ background: 'linear-gradient(135deg, ' + NAVY + ', ' + NAVY + 'dd)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', border: '3px solid ' + (ci.pct === 100 ? '#22C55E' : TEAL), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: ci.pct === 100 ? '#22C55E' : '#fff', fontSize: 18, fontWeight: 800, ...F }}>{ci.pct}%</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, ...F, marginBottom: 6 }}>Inspection Complete</div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
                <div style={{ width: ci.pct + '%', height: '100%', background: ci.pct === 100 ? '#22C55E' : 'linear-gradient(90deg, ' + TEAL + ', ' + TEAL_MED + ')', borderRadius: 3 }} />
              </div>
              <div style={{ color: TEAL_MED, fontSize: 11, marginTop: 4, ...F }}>{ci.done} of {ci.total} items checked</div>
            </div>
          </div>

          {/* Status boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {STATUS_OPTIONS.map(function(o) {
              return (
                <div key={o.key} style={{ background: '#fff', border: '1px solid ' + BORDER_GRAY, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: o.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: o.color }}>{counts[o.key]}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: DARK_GRAY, ...F }}>{o.label}</div>
                </div>
              );
            })}
          </div>

          {/* Overall rating */}
          {rating && (
            <div style={{ background: TEAL_LIGHT, border: '2px solid ' + rc + '44', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, ...F }}>Overall Rating:</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: rc, ...F }}>{rating}</span>
            </div>
          )}

          {/* Attention items */}
          {attentionItems.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 8, ...F }}>{'\u26A0'} Items Needing Attention</div>
              {attentionItems.map(function(a, i) {
                return (
                  <div key={i} style={{ fontSize: 12, color: '#991B1B', padding: '4px 0', borderBottom: '1px solid #FECACA' }}>
                    <span style={{ fontWeight: 600 }}>{a.section}:</span> {a.item}
                    {a.note && <div style={{ fontSize: 11, color: '#92400E', fontStyle: 'italic', marginTop: 2, paddingLeft: 8 }}>{'\u21B3'} {a.note}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Section details */}
          {SECTIONS.map(function(sec) {
            return (
              <div key={sec.title} style={{ marginBottom: 12 }}>
                <div style={{ background: 'linear-gradient(135deg, ' + NAVY + ', ' + NAVY + 'dd)', padding: '8px 14px', borderRadius: '10px 10px 0 0', borderLeft: '4px solid ' + TEAL }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', ...F }}>{sec.icon} {sec.title}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: '0 0 10px 10px', border: '1px solid ' + BORDER_GRAY, borderTop: 'none', overflow: 'hidden' }}>
                  {sec.items.map(function(item, idx) {
                    var s = insp.statuses[item];
                    var sc = statusColor(s);
                    var sl = statusLabel(s);
                    var note = (insp.itemNotes && insp.itemNotes[item]) || '';
                    var itemPhotos = (insp.photos && insp.photos[item]) ? insp.photos[item] : [];
                    var bg = idx % 2 === 0 ? '#fff' : LIGHT_GRAY;

                    return (
                      <div key={item} style={{ padding: '8px 12px', background: bg, borderBottom: idx < sec.items.length - 1 ? '1px solid ' + BORDER_GRAY + '44' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 12, color: DARK_GRAY, ...F, flex: 1 }}>{item}</div>
                          <div style={{ fontWeight: 700, fontSize: 10, padding: '2px 10px', borderRadius: 10, background: sc + '15', color: sc, border: '1px solid ' + sc + '33', minWidth: 60, textAlign: 'center', ...F }}>{sl}</div>
                        </div>
                        {note && (
                          <div style={{ fontSize: 11, color: '#92400E', fontStyle: 'italic', marginTop: 4, background: '#FFF9F0', padding: '4px 8px', borderRadius: 4, borderLeft: '3px solid #F59E0B' }}>Note: {note}</div>
                        )}
                        {itemPhotos.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                            {itemPhotos.map(function(src, j) {
                              return (
                                <img key={j} src={src} alt="" onClick={function() { setLightbox(src); }}
                                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid ' + BORDER_GRAY, cursor: 'pointer' }} />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          {insp.notes && (
            <div style={{ background: '#fff', border: '1px solid ' + BORDER_GRAY, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6, ...F }}>Notes & Observations</div>
              <div style={{ fontSize: 13, color: DARK_GRAY, whiteSpace: 'pre-wrap', lineHeight: 1.6, ...F }}>{insp.notes}</div>
            </div>
          )}

          {/* Photo summary */}
          {pc > 0 && (
            <div style={{ background: TEAL_LIGHT, border: '1px solid ' + TEAL + '44', borderRadius: 12, padding: 14, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, ...F }}>{'\u{1F4F7}'} {pc} photos documented in this inspection</div>
            </div>
          )}

          <div style={{ height: 20 }} />
        </div>
      </div>
    );
  }

  /* -- Dashboard -- */
  var clientName = client ? client.first_name + ' ' + client.last_name : '';

  var STATUS_COLORS = {
    draft: '#9CA3AF', sent: '#3B82F6', approved: '#22C55E', declined: '#EF4444', expired: '#F59E0B',
    paid: '#22C55E', overdue: '#EF4444', cancelled: '#9CA3AF',
    new: '#3B82F6', reviewed: '#F59E0B', quoted: '#8B5CF6', scheduled: TEAL, completed: '#22C55E',
  };

  return (
    <div style={S.app}>
      <Header />
      <div style={S.body}>

        {/* Welcome */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, ...F }}>Welcome, {client ? client.first_name : 'there'}!</div>
          <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 2, ...F }}>Your property dashboard</div>
        </div>

        {/* Portal tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[{ key: 'inspections', label: 'Inspections' }, { key: 'billing', label: 'Billing' }, { key: 'requests', label: 'Requests' }].map(function(t) {
            return (
              <button key={t.key} onClick={function() { setPortalTab(t.key); }}
                style={{ flex: 1, padding: '10px 6px', borderRadius: 10, border: portalTab === t.key ? '2px solid ' + TEAL : '1px solid ' + BORDER_GRAY,
                  background: portalTab === t.key ? TEAL : '#fff', color: portalTab === t.key ? '#fff' : MED_GRAY,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', ...F }}>
                {t.label}
                {t.key === 'billing' && invoices.filter(function(i) { return i.status === 'sent'; }).length > 0 