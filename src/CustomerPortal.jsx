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
                {t.key === 'billing' && invoices.filter(function(i) { return i.status === 'sent'; }).length > 0 && (
                  <span style={{ marginLeft: 4, background: '#EF4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 9 }}>
                    {invoices.filter(function(i) { return i.status === 'sent'; }).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ---- Billing Tab ---- */}
        {portalTab === 'billing' && (
          <div>
            {/* Pending Quotes */}
            {quotes.filter(function(q) { return q.status === 'sent'; }).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 8, ...F }}>Quotes Awaiting Approval</div>
                {quotes.filter(function(q) { return q.status === 'sent'; }).map(function(q) {
                  var qItems = q.quote_items || [];
                  return (
                    <div key={q.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, border: '1px solid ' + BORDER_GRAY, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{q.title}</div>
                      {q.description && <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4, ...F }}>{q.description}</div>}
                      {qItems.length > 0 && (
                        <div style={{ marginTop: 10, borderTop: '1px solid ' + BORDER_GRAY + '44', paddingTop: 8 }}>
                          {qItems.map(function(item) {
                            return (
                              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', ...F }}>
                                <span style={{ color: DARK_GRAY }}>{item.description}{item.quantity > 1 ? ' x' + item.quantity : ''}</span>
                                <span style={{ fontWeight: 700, color: NAVY }}>${Number(item.total || 0).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '2px solid ' + NAVY }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, ...F }}>Total: ${Number(q.total_amount || 0).toFixed(2)}</div>
                        {q.valid_until && <div style={{ fontSize: 10, color: MED_GRAY, ...F }}>Valid until {q.valid_until}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={function() { approveQuote(q.id); }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...F }}>Approve</button>
                        <button onClick={function() { declineQuote(q.id); }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '2px solid #EF4444', background: '#fff', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...F }}>Decline</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invoices */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 8, ...F }}>Invoices</div>
              {invoices.length === 0 && <div style={{ fontSize: 12, color: MED_GRAY, ...F }}>No invoices yet</div>}
              {invoices.map(function(inv) {
                var sc = STATUS_COLORS[inv.status] || MED_GRAY;
                var invItems = inv.invoice_items || [];
                return (
                  <div key={inv.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, border: '1px solid ' + BORDER_GRAY, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{inv.invoice_number || 'Invoice'} - {inv.title}</div>
                        {inv.due_date && <div style={{ fontSize: 11, color: MED_GRAY, marginTop: 2, ...F }}>Due: {inv.due_date}</div>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: sc + '18', color: sc, textTransform: 'uppercase', ...F }}>{inv.status}</span>
                    </div>
                    {invItems.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px solid ' + BORDER_GRAY + '44', paddingTop: 8 }}>
                        {invItems.map(function(item) {
                          return (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', ...F }}>
                              <span style={{ color: DARK_GRAY }}>{item.description}{item.quantity > 1 ? ' x' + item.quantity : ''}</span>
                              <span style={{ fontWeight: 700, color: NAVY }}>${Number(item.total || 0).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '2px solid ' + NAVY }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: inv.status === 'paid' ? '#22C55E' : NAVY, ...F }}>${Number(inv.total_amount || 0).toFixed(2)}</div>
                      {inv.paid_at && <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, ...F }}>{'\u2713'} Paid {new Date(inv.paid_at).toLocaleDateString()}</div>}
                    </div>
                    {inv.status === 'sent' && (
                      <button onClick={function() { payInvoice(inv.id); }} style={{ width: '100%', marginTop: 12, padding: '14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, ' + TEAL + ', #1a9e8e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: '0 4px 14px ' + TEAL + '44' }}>
                        Pay Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Past quotes */}
            {quotes.filter(function(q) { return q.status !== 'sent'; }).length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 8, ...F }}>Past Quotes</div>
                {quotes.filter(function(q) { return q.status !== 'sent'; }).map(function(q) {
                  var qsc = STATUS_COLORS[q.status] || MED_GRAY;
                  return (
                    <div key={q.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', marginBottom: 8, border: '1px solid ' + BORDER_GRAY }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, ...F }}>{q.title}</div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: qsc + '18', color: qsc, textTransform: 'uppercase', ...F }}>{q.status}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEAL, marginTop: 4, ...F }}>${Number(q.total_amount || 0).toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---- Work Requests Tab ---- */}
        {portalTab === 'requests' && (
          <div>
            {!wrForm && (
              <div>
                <button onClick={function() { setWrForm({ title: '', description: '', property_id: '', urgency: 'normal' }); }}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, ' + TEAL + ', #1a9e8e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: '0 4px 14px ' + TEAL + '44', marginBottom: 16 }}>
                  + Request New Work
                </button>

                {workRequests.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 20px', background: '#fff', borderRadius: 16, border: '1px dashed ' + BORDER_GRAY }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, ...F }}>No work requests yet</div>
                    <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4, ...F }}>Tap above to submit a request</div>
                  </div>
                )}

                {workRequests.map(function(wr) {
                  var wrsc = STATUS_COLORS[wr.status] || MED_GRAY;
                  return (
                    <div key={wr.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, border: '1px solid ' + BORDER_GRAY }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{wr.title}</div>
                          {wr.properties && <div style={{ fontSize: 11, color: MED_GRAY, marginTop: 2, ...F }}>{wr.properties.address}</div>}
                          {wr.description && <div style={{ fontSize: 12, color: DARK_GRAY, marginTop: 6, lineHeight: 1.5, ...F }}>{wr.description}</div>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: wrsc + '18', color: wrsc, textTransform: 'uppercase', ...F }}>{wr.status}</span>
                      </div>
                      <div style={{ fontSize: 10, color: MED_GRAY, marginTop: 8, ...F }}>{new Date(wr.created_at).toLocaleDateString()}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {wrForm && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16, ...F }}>New Work Request</div>
                <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, border: '1px solid ' + BORDER_GRAY }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Title *</div>
                  <input style={S2.input} placeholder="What do you need?" value={wrForm.title} onChange={function(e) { setWrForm(Object.assign({}, wrForm, { title: e.target.value })); }} />

                  {properties.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Property</div>
                      <select style={S2.input} value={wrForm.property_id} onChange={function(e) { setWrForm(Object.assign({}, wrForm, { property_id: e.target.value })); }}>
                        <option value="">Select property...</option>
                        {properties.map(function(p) { return <option key={p.id} value={p.id}>{p.address}</option>; })}
                      </select>
                    </div>
                  )}

                  <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Description</div>
                  <textarea style={Object.assign({}, S2.input, { minHeight: 80, resize: 'vertical' })} placeholder="Describe what you need done..." value={wrForm.description} onChange={function(e) { setWrForm(Object.assign({}, wrForm, { description: e.target.value })); }} />

                  <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Urgency</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['low', 'normal', 'high', 'emergency'].map(function(u) {
                      var uc = u === 'emergency' ? '#EF4444' : u === 'high' ? '#F59E0B' : u === 'normal' ? TEAL : '#9CA3AF';
                      return (
                        <button key={u} onClick={function() { setWrForm(Object.assign({}, wrForm, { urgency: u })); }}
                          style={{ flex: 1, padding: '8px', borderRadius: 10, border: wrForm.urgency === u ? '2px solid ' + uc : '1px solid ' + BORDER_GRAY,
                            background: wrForm.urgency === u ? uc + '15' : '#fff', color: wrForm.urgency === u ? uc : MED_GRAY,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'DM Sans', sans-serif" }}>
                          {u}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={function() { if (wrForm.title.trim()) submitWorkRequest(wrForm); }}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, ' + TEAL + ', #1a9e8e)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
                  Submit Request
                </button>
                <button onClick={function() { setWrForm(null); }}
                  style={{ width: '100%', padding: '12px', borderRadius: 12, border: '2px solid ' + TEAL, background: '#fff', color: TEAL, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---- Inspections Tab ---- */}
        {portalTab === 'inspections' && <>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid ' + BORDER_GRAY, borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: TEAL, ...F }}>{properties.length}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: MED_GRAY, textTransform: 'uppercase', ...F }}>{properties.length === 1 ? 'Property' : 'Properties'}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid ' + BORDER_GRAY, borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, ...F }}>{inspections.length}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: MED_GRAY, textTransform: 'uppercase', ...F }}>{inspections.length === 1 ? 'Inspection' : 'Inspections'}</div>
          </div>
        </div>

        {/* Properties */}
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 12, ...F }}>Your Properties</div>

        {properties.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F3E0}'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, ...F }}>No properties yet</div>
            <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4, ...F }}>Contact us to get started with inspections</div>
          </div>
        )}

        {properties.map(function(prop) {
          var isExpanded = expandedProp === prop.id;
          var propInsps = inspections.filter(function(i) { return i.property_id === prop.id; });
          var latestInsp = propInsps[0];
          var latestRating = latestInsp ? (latestInsp.overall_rating || '') : '';
          var latestRc = latestRating === 'Excellent' ? '#22C55E' : latestRating === 'Good' ? TEAL : latestRating === 'Fair' ? '#F59E0B' : latestRating === 'Needs Attention' ? '#EF4444' : MED_GRAY;

          return (
            <div key={prop.id} style={{ marginBottom: 10 }}>
              <div onClick={function() { setExpandedProp(isExpanded ? null : prop.id); }}
                style={{ background: '#fff', borderRadius: isExpanded ? '14px 14px 0 0' : 14, padding: '14px 16px', border: '1px solid ' + BORDER_GRAY, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{prop.address}</div>
                    {prop.unit_suite && <div style={{ fontSize: 12, color: MED_GRAY, ...F }}>Unit: {prop.unit_suite}</div>}
                    <div style={{ fontSize: 11, color: MED_GRAY, marginTop: 2, ...F }}>
                      {prop.city || ''}, {prop.state || ''} {prop.zip || ''}
                      {prop.plan_tier && <span> {'\u2022'} {prop.plan_tier} plan</span>}
                    </div>
                    {latestInsp && (
                      <div style={{ fontSize: 11, color: MED_GRAY, marginTop: 4, ...F }}>
                        Last inspection: {latestInsp.date}
                        {latestRating && <span style={{ color: latestRc, fontWeight: 700 }}> {'\u2022'} {latestRating}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: TEAL_LIGHT, borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: TEAL, ...F }}>
                      {propInsps.length} {propInsps.length === 1 ? 'visit' : 'visits'}
                    </div>
                    <span style={{ color: TEAL_MED, fontSize: 18, transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>{'\u25BE'}</span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', border: '1px solid ' + BORDER_GRAY, borderTop: 'none', padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 10, ...F }}>
                    Inspection History
                    <span style={{ fontWeight: 500, color: MED_GRAY }}> ({propInsps.length})</span>
                  </div>

                  {propInsps.length === 0 && (
                    <div style={{ fontSize: 12, color: MED_GRAY, ...F }}>No inspections yet for this property</div>
                  )}

                  {propInsps.map(function(ins) {
                    var ci2 = getCompInfo(ins);
                    var counts2 = getCounts(ins);
                    var r = ins.overall_rating || '';
                    var r2c = r === 'Excellent' ? '#22C55E' : r === 'Good' ? TEAL : r === 'Fair' ? '#F59E0B' : r === 'Needs Attention' ? '#EF4444' : MED_GRAY;

                    return (
                      <div key={ins.id}
                        onClick={function() { openInspection(ins.id); }}
                        style={{ padding: '10px 12px', marginBottom: 6, background: LIGHT_GRAY, borderRadius: 10, border: '1px solid ' + BORDER_GRAY, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: DARK_GRAY, ...F }}>{ins.date || 'No date'}</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                              {r && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: r2c + '15', color: r2c, ...F }}>{r}</span>}
                              {counts2.good > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#22C55E', ...F }}>{'\u2713'}{counts2.good}</span>}
                              {counts2.fair > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#F59E0B', ...F }}>~{counts2.fair}</span>}
                              {counts2.attention > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#EF4444', ...F }}>!{counts2.attention}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2.5px solid ' + (ci2.pct === 100 ? '#22C55E' : TEAL), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: ci2.pct === 100 ? '#22C55E' : TEAL, ...F }}>{ci2.pct}%</span>
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

        </>}

        {/* Contact footer */}
        <div style={{ marginTop: 24, background: 'linear-gradient(135deg, ' + NAVY + ', ' + NAVY + 'dd)', borderRadius: 14, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', ...F }}>Need Assistance?</div>
          <div style={{ fontSize: 12, color: TEAL_MED, marginTop: 6, ...F }}>(904) 754-3614</div>
          <div style={{ fontSize: 11, color: TEAL_MED, marginTop: 2, ...F }}>firstcoastpropertycare@gmail.com</div>
        </div>

        <div style={{ height: 20 }} />
      </div>

      {detailLoading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 32px', textAlign: 'center', ...F }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>Loading inspection...</div>
          </div>
        </div>
      )}
    </div>
  );
}

var S2 = {
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid ' + BORDER_GRAY, fontSize: 13, color: DARK_GRAY, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box', background: LIGHT_GRAY, marginBottom: 8 },
};

var S = {
  app: { maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#F5F7F8', fontFamily: "'DM Sans', sans-serif" },
  body: { padding: 16 },
  empty: { textAlign: 'center', padding: '32px 20px', background: '#fff', borderRadius: 16, border: '1px dashed ' + BORDER_GRAY, marginBottom: 12 },
};