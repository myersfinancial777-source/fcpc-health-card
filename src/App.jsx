import { useState, useEffect, useRef, useCallback } from 'react';
import { NAVY, TEAL, TEAL_LIGHT, TEAL_MED, DARK_GRAY, MED_GRAY, LIGHT_GRAY, BORDER_GRAY, STATUS_OPTIONS, SECTIONS, PLAN_TIERS, OVERALL_RATINGS } from './constants.js';
import { loadInspections, saveInspection, deleteInspection as dbDelete } from './supabase.js';
import { sendEmail, initEmailJS } from './email.js';
import { compressImage, genId, todayStr, getCompInfo, getCounts, getTotalPhotos } from './utils.js';
import { ClientList, ClientForm, ClientDetail } from './CRM.jsx';
import logoUrl from '/logo.png?url';
import { supabase } from './supabase.js';
import { AuthScreen } from './Auth.jsx';
import { CustomerPortal } from './CustomerPortal.jsx';

const F = { fontFamily: "'DM Sans', sans-serif" };

function createBlank(client, property) {
  const statuses = {}, photos = {}, itemNotes = {};
  SECTIONS.forEach(s => s.items.forEach(i => { statuses[i] = null; photos[i] = []; itemNotes[i] = ''; }));
  return {
    id: genId(),
    client_id: client?.id || null,
    property_id: property?.id || null,
    propertyAddress: property?.address || '',
    unitSuite: property?.unit_suite || '',
    ownerManager: client ? `${client.first_name} ${client.last_name}` : '',
    planTier: property?.plan_tier || '',
    date: todayStr(), statuses, photos, itemNotes,
    notes: '', overallRating: '', createdAt: new Date().toISOString(),
  };
}

/* -- Reusable Components --------------------------- */
function StatusPill({ status, onSelect }) {
  return (<div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{STATUS_OPTIONS.map(o => { const a = status === o.key; return (
    <button key={o.key} onClick={() => onSelect(a ? null : o.key)} style={{ border: `2px solid ${a ? o.color : BORDER_GRAY}`, background: a ? o.color + '18' : '#fff', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: a ? 700 : 500, color: a ? o.color : MED_GRAY, cursor: 'pointer', transition: 'all .15s', ...F, whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent' }}><span style={{ marginRight: 3 }}>{o.icon}</span>{o.label}</button>); })}</div>);
}

function SectionProgress({ section, statuses }) {
  const d = section.items.filter(i => statuses[i] != null).length, t = section.items.length, p = t > 0 ? (d / t) * 100 : 0;
  return (<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
    <div style={{ flex: 1, height: 4, borderRadius: 2, background: BORDER_GRAY, overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: p === 100 ? '#22C55E' : TEAL, borderRadius: 2, transition: 'width .3s' }} /></div>
    <span style={{ fontSize: 11, color: p === 100 ? '#22C55E' : MED_GRAY, fontWeight: 600, minWidth: 36, textAlign: 'right', ...F }}>{d}/{t}</span></div>);
}

function OverallProgress({ statuses }) {
  const t = Object.keys(statuses).length, d = Object.values(statuses).filter(v => v != null).length, p = t > 0 ? Math.round((d / t) * 100) : 0;
  return (<div style={{ background: `linear-gradient(135deg,${NAVY},${NAVY}dd)`, borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 16px' }}>
    <div style={{ width: 52, height: 52, borderRadius: '50%', border: `3px solid ${p === 100 ? '#22C55E' : TEAL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ color: p === 100 ? '#22C55E' : '#fff', fontSize: 18, fontWeight: 800, ...F }}>{p}%</span></div>
    <div style={{ flex: 1 }}><div style={{ color: '#fff', fontSize: 13, fontWeight: 600, ...F, marginBottom: 6 }}>Inspection Progress</div><div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: p === 100 ? '#22C55E' : `linear-gradient(90deg,${TEAL},${TEAL_MED})`, borderRadius: 3, transition: 'width .4s' }} /></div><div style={{ color: TEAL_MED, fontSize: 11, marginTop: 4, ...F }}>{d} of {t} items</div></div></div>);
}

function PhotoRow({ photos, onAdd, onRemove, onTap }) {
  const camRef = useRef(null), fileRef = useRef(null);
  const proc = useCallback(async e => { for (const f of Array.from(e.target.files || [])) { const c = await compressImage(f); if (c) onAdd(c); } e.target.value = ''; }, [onAdd]);
  return (<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
    {photos.map((src, i) => (<div key={i} style={{ position: 'relative', width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER_GRAY}`, flexShrink: 0 }}>
      <img src={src} alt="" onClick={() => onTap?.(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
      <button onClick={e => { e.stopPropagation(); onRemove(i); }} style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1 }}>{'\u00D7'}</button></div>))}
    <button onClick={() => camRef.current?.click()} style={{ width: 56, height: 56, borderRadius: 8, border: `2px dashed ${TEAL}`, background: TEAL_LIGHT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{'\u{1F4F8}'}</span><span style={{ fontSize: 7, color: TEAL, fontWeight: 700, ...F, marginTop: 1 }}>Camera</span></button>
    <button onClick={() => fileRef.current?.click()} style={{ width: 56, height: 56, borderRadius: 8, border: `2px dashed ${BORDER_GRAY}`, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{'\u{1F5BC}\uFE0F'}</span><span style={{ fontSize: 7, color: MED_GRAY, fontWeight: 700, ...F, marginTop: 1 }}>Gallery</span></button>
    <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={proc} style={{ display: 'none' }} />
    <input ref={fileRef} type="file" accept="image/*" multiple onChange={proc} style={{ display: 'none' }} />
  </div>);
}

function Lightbox({ src, onClose }) { if (!src) return null; return (<div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}><img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} /><button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button></div>); }

function ItemNote({ value, onChange }) {
  return (<textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Add a note about this item..."
    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${BORDER_GRAY}`, fontSize: 12, color: DARK_GRAY, ...F, outline: 'none', boxSizing: 'border-box', background: '#FFF9F0', marginTop: 8, minHeight: 44, resize: 'vertical' }} />);
}

function EmailModal({ inspection, onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  async function handleSend() {
    if (!email || !email.includes('@')) { setStatus('error'); setMsg('Enter a valid email.'); return; }
    setStatus('sending'); setMsg('');
    const r = await sendEmail(email, inspection);
    setStatus(r.ok ? 'sent' : 'error'); setMsg(r.msg);
    if (r.ok) setTimeout(onClose, 2000);
  }
  return (<div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 32px', boxShadow: '0 -8px 30px rgba(0,0,0,.15)' }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER_GRAY, margin: '0 auto 16px' }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 4, ...F }}>Send Report to Customer</div>
      <div style={{ fontSize: 12, color: MED_GRAY, marginBottom: 16, ...F, lineHeight: 1.5 }}>Sends a branded inspection report with photos to the customer.</div>
      <input value={email} onChange={e => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }} placeholder="customer@email.com" type="email"
        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `2px solid ${status === 'error' ? '#EF4444' : email ? TEAL : BORDER_GRAY}`, fontSize: 14, ...F, outline: 'none', boxSizing: 'border-box', marginBottom: 8, background: LIGHT_GRAY }} />
      {msg && <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 8, ...F, fontWeight: 600, background: status === 'sent' ? '#22C55E15' : '#EF444415', color: status === 'sent' ? '#22C55E' : '#EF4444' }}>{status === 'sent' ? '\u2713 ' : '\u2717 '}{msg}</div>}
      <button onClick={handleSend} disabled={status === 'sending' || status === 'sent'}
        style={{ width: '100%', background: status === 'sent' ? '#22C55E' : `linear-gradient(135deg,${TEAL},#1a9e8e)`, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: status === 'sending' ? 'wait' : 'pointer', ...F, boxShadow: `0 4px 14px ${TEAL}44`, opacity: status === 'sending' ? .7 : 1, marginBottom: 10 }}>
        {status === 'sending' ? 'Uploading photos & sending...' : status === 'sent' ? '\u2713 Sent!' : '\u2709 Send Email'}</button>
      <button onClick={onClose} style={{ width: '100%', background: 'transparent', border: `2px solid ${BORDER_GRAY}`, borderRadius: 14, padding: '12px', fontSize: 13, fontWeight: 600, color: MED_GRAY, cursor: 'pointer', ...F }}>Cancel</button>
    </div></div>);
}

/* -- PDF Preview ----------------------------------- */
function PdfPreview({ inspection, onClose }) {
  const sL = k => STATUS_OPTIONS.find(o => o.key === k)?.label || '\u2014';
  const sC = k => STATUS_OPTIONS.find(o => o.key === k)?.color || MED_GRAY;
  const counts = getCounts(inspection);
  const { done, total } = getCompInfo(inspection);
  const att = []; SECTIONS.forEach(sec => sec.items.forEach(item => { if (inspection.statuses[item] === 'attention') att.push({ section: sec.title, item, note: inspection.itemNotes?.[item] || '' }); }));
  const photoEntries = []; SECTIONS.forEach(sec => sec.items.forEach(item => { const p = inspection.photos?.[item] || []; if (p.length > 0) photoEntries.push({ section: sec.title, item, pics: p }); }));

  return (<div id="pdf-preview-root">
    <style>{`@media print { body * { visibility: hidden !important; } #pdf-preview-root, #pdf-preview-root * { visibility: visible !important; } #pdf-preview-root { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } .no-break { break-inside: avoid; } .page-break { break-before: page; } }`}</style>
    <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 200, background: NAVY, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `3px solid ${TEAL}` }}>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: TEAL_MED, fontSize: 14, fontWeight: 600, cursor: 'pointer', ...F }}>{'\u2190'} Back</button>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, ...F }}>PDF Preview</span>
      <button onClick={() => window.print()} style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...F }}>{'\u{1F5A8}'} Print / Save</button>
    </div>
    <div style={{ background: '#fff', maxWidth: 800, margin: '0 auto', boxShadow: '0 2px 20px rgba(0,0,0,.1)' }}>
      <div style={{ background: NAVY, color: '#fff', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logoUrl} alt="Logo" style={{ height: 48 }} />
          <div><div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>First Coast Property Care</div><div style={{ fontSize: 9, color: TEAL_MED, letterSpacing: 1.5, textTransform: 'uppercase' }}>Jacksonville, FL</div></div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 16, fontWeight: 700 }}>Property Health Card</div><div style={{ fontSize: 9, color: TEAL_MED, marginTop: 2 }}>Preventative Maintenance Inspection Report</div></div></div>
      <div style={{ height: 3, background: `linear-gradient(90deg,${TEAL},${TEAL_MED})` }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px 20px', padding: '12px 28px', background: LIGHT_GRAY, borderBottom: `1px solid ${BORDER_GRAY}` }}>
        {[{ l: 'Property Address', v: inspection.propertyAddress, span: 2 }, { l: 'Unit / Suite', v: inspection.unitSuite }, { l: 'Owner / Manager', v: inspection.ownerManager }, { l: 'Plan Tier', v: inspection.planTier }, { l: 'Date', v: inspection.date }].map((f, i) => (
          <div key={i} style={f.span ? { gridColumn: 'span 2' } : {}}><div style={{ fontSize: 8, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: .5 }}>{f.l}</div><div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginTop: 1 }}>{f.v || '\u2014'}</div></div>))}</div>
      <div style={{ display: 'flex', gap: 14, padding: '10px 28px', borderBottom: `1px solid ${BORDER_GRAY}`, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: NAVY }}>STATUS:</span>
        {STATUS_OPTIONS.map(o => <div key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}><div style={{ width: 9, height: 9, borderRadius: '50%', background: o.color }} />{o.label}: <strong>{counts[o.key]}</strong></div>)}
        <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: TEAL }}><strong>{done}/{total}</strong> checked</div></div>
      {SECTIONS.map(sec => (<div key={sec.title} className="no-break">
        <div style={{ background: NAVY, color: '#fff', padding: '7px 28px', fontSize: 11, fontWeight: 700, letterSpacing: .5, borderLeft: `4px solid ${TEAL}`, marginTop: 6 }}>{sec.icon} {sec.title.toUpperCase()}</div>
        {sec.items.map((item, idx) => { const s = inspection.statuses[item], sc = sC(s), sl = sL(s), hasP = (inspection.photos?.[item] || []).length > 0, note = inspection.itemNotes?.[item] || ''; return (<div key={item}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 28px', fontSize: 11, borderBottom: `1px solid ${BORDER_GRAY}15`, background: idx % 2 === 0 ? '#fff' : LIGHT_GRAY }}>
            <div style={{ flex: 1 }}>{item}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{hasP && <span style={{ fontSize: 8, color: TEAL, fontWeight: 600 }}>{'\u{1F4F7}'}</span>}<div style={{ fontWeight: 700, fontSize: 10, padding: '2px 10px', borderRadius: 10, background: sc + '15', color: sc, border: `1px solid ${sc}33`, minWidth: 70, textAlign: 'center' }}>{sl}</div></div></div>
          {note && <div style={{ padding: '2px 28px 6px 42px', fontSize: 10, color: '#92400E', background: idx % 2 === 0 ? '#fff' : LIGHT_GRAY, fontStyle: 'italic' }}>Note: {note}</div>}</div>); })}</div>))}
      {inspection.notes && <div className="no-break" style={{ padding: '14px 28px', borderTop: `1px solid ${BORDER_GRAY}` }}><div style={{ fontSize: 10, fontWeight: 700, color: TEAL, textTransform: 'uppercase', marginBottom: 4 }}>Notes & Observations</div><div style={{ fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{inspection.notes}</div></div>}
      {inspection.overallRating && <div className="no-break" style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL}44`, borderRadius: 6, margin: '10px 28px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>OVERALL PROPERTY RATING:</span><span style={{ fontSize: 13, fontWeight: 800, color: TEAL }}>{inspection.overallRating}</span></div>}
      {att.length > 0 && <div className="no-break" style={{ margin: '10px 28px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', marginBottom: 5 }}>{'\u26A0'} Items Requiring Attention</div>
        {att.map((a, i) => <div key={i} style={{ fontSize: 10, color: '#991B1B', padding: '2px 0', borderBottom: '1px solid #FECACA' }}><strong>{a.section}:</strong> {a.item}{a.note ? ` \u2014 ${a.note}` : ''}</div>)}</div>}
      <div className="no-break" style={{ display: 'flex', gap: 28, padding: '24px 28px 12px' }}>
        <div style={{ flex: 1, borderTop: `1px solid ${NAVY}`, paddingTop: 4, fontSize: 8, color: MED_GRAY }}>Inspector Signature</div>
        <div style={{ flex: 1, borderTop: `1px solid ${NAVY}`, paddingTop: 4, fontSize: 8, color: MED_GRAY }}>Date</div></div>
      {photoEntries.length > 0 && <><div className="page-break" /><div style={{ background: NAVY, color: '#fff', padding: '10px 28px', fontSize: 13, fontWeight: 700, borderLeft: `4px solid ${TEAL}`, marginTop: 8 }}>{'\u{1F4F7}'} Photo Documentation</div>
        {photoEntries.map((pe, idx) => <div key={idx} className="no-break" style={{ padding: '10px 28px', borderBottom: `1px solid ${BORDER_GRAY}22` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 1 }}>{pe.item}</div><div style={{ fontSize: 9, color: MED_GRAY, marginBottom: 6 }}>{pe.section}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{pe.pics.map((src, j) => <img key={j} src={src} alt="" style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 4, border: `1px solid ${BORDER_GRAY}` }} />)}</div></div>)}</>}
      <div style={{ background: NAVY, padding: '10px 28px', textAlign: 'center', marginTop: 12, borderTop: `3px solid ${TEAL}` }}><div style={{ fontSize: 8, color: TEAL_MED }}>First Coast Property Care | Jacksonville, FL | "We Handle the Small Things Before They Become Big Problems."</div></div>
    </div></div>);
}

/* -- Main App ------------------------------------ */
export default function App() {
  const [inspections, setInspections] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('inspections');
  const [expanded, setExpanded] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showEmail, setShowEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crmView, setCrmView] = useState('list');
  const [selectedClientId, setSelectedClientId] = useState(null);

  // Auth state
  const [authState, setAuthState] = useState('loading');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!supabase) { setAuthState('admin'); loadInspections().then(d => { setInspections(d); setLoaded(true); }); initEmailJS(); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { handleAuthSession(session.user.id); } else { setAuthState('unauthenticated'); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) { handleAuthSession(session.user.id); }
      else if (event === 'SIGNED_OUT') { setAuthState('unauthenticated'); setProfile(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleAuthSession(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      if (data.role === 'admin') {
        setAuthState('admin');
        loadInspections().then(d => { setInspections(d); setLoaded(true); });
        initEmailJS();
      } else {
        setAuthState('customer');
      }
    } else {
      setAuthState('unauthenticated');
    }
  }

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut();
    setAuthState('unauthenticated');
    setProfile(null);
  }

  const cur = inspections.find(i => i.id === currentId) || null;

  const saveTimer = useRef(null);
  function upd(u) {
    setInspections(p => {
      const next = p.map(i => i.id === currentId ? { ...i, ...u } : i);
      const updated = next.find(i => i.id === currentId);
      if (updated) {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => { setSaving(true); saveInspection(updated).then(() => setSaving(false)); }, 1000);
      }
      return next;
    });
  }

  function startNew(client, property) {
    const f = createBlank(client, property);
    setInspections(p => [f, ...p]);
    saveInspection(f);
    setCurrentId(f.id);
    setView('form');
    setExpanded({});
  }
  function openI(id) { setCurrentId(id); setView('form'); setExpanded({}); }
  function delI(id) { dbDelete(id); setInspections(p => p.filter(i => i.id !== id)); if (currentId === id) { setCurrentId(null); setView('list'); } }
  function togSec(t) { setExpanded(p => ({ ...p, [t]: !p[t] })); }

  function TabBar() {
    return (
      <div style={{ display: 'flex', background: '#fff', borderBottom: `1px solid ${BORDER_GRAY}`, position: 'sticky', top: 0, zIndex: 99 }}>
        {[{ key: 'inspections', label: '\u{1F4CB} Inspections' }, { key: 'clients', label: '\u{1F464} Clients' }].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setView('list'); setCrmView('list'); setCurrentId(null); }}
            style={{ flex: 1, padding: '12px', background: tab === t.key ? '#fff' : LIGHT_GRAY, border: 'none',
              borderBottom: tab === t.key ? `3px solid ${TEAL}` : '3px solid transparent',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? NAVY : MED_GRAY,
              cursor: 'pointer', ...F, transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  // Auth guards
  if (authState === 'loading') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, ' + NAVY + ', #153060)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <img src={logoUrl} alt="Logo" style={{ height: 64, borderRadius: 8, marginBottom: 12 }} />
        <div style={{ color: TEAL_MED, fontSize: 13, ...F }}>Loading...</div>
      </div>
    </div>
  );
  if (authState === 'unauthenticated') return <AuthScreen />;
  if (authState === 'customer') return <CustomerPortal profile={profile} onSignOut={handleSignOut} />;

  if (view === 'pdf' && cur) return <PdfPreview inspection={cur} onClose={() => setView('summary')} />;

  /* -- LIST (with tabs) -- */
  if (view === 'list') return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <img src={logoUrl} alt="Logo" style={{ height: 44, borderRadius: 6 }} />
          <div><div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: "'Playfair Display', serif" }}>First Coast</div>
          <div style={{ fontSize: 11, color: TEAL_MED, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', ...F }}>Property Care</div></div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <div style={{ fontSize: 10, color: TEAL_MED, fontStyle: 'italic', ...F }}>"We Handle the Small Things..."</div>
          {supabase && <button onClick={handleSignOut} style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 14, padding: '4px 12px', fontSize: 10, fontWeight: 600, color: TEAL_MED, cursor: 'pointer', ...F }}>Sign Out</button>}
        </div>
      </div>
      <TabBar />
      <div style={S.body}>
        {/* -- Clients tab -- */}
        {tab === 'clients' && crmView === 'list' && (
          <ClientList
            onSelectClient={(id) => { setSelectedClientId(id); setCrmView('detail'); }}
            onNewClient={() => setCrmView('add')}
          />
        )}
        {tab === 'clients' && crmView === 'add' && (
          <ClientForm
            onSave={() => setCrmView('list')}
            onCancel={() => setCrmView('list')}
          />
        )}
        {tab === 'clients' && crmView === 'detail' && selectedClientId && (
          <ClientDetail
            clientId={selectedClientId}
            onBack={() => { setCrmView('list'); setSelectedClientId(null); }}
            onStartInspection={(client, property) => {
              setTab('inspections');
              startNew(client, property);
            }}
            onOpenInspection={(inspectionId) => {
              setCurrentId(inspectionId);
              setTab('inspections');
              setView('summary');
            }}
          />
        )}

        {/* -- Inspections tab -- */}
        {tab === 'inspections' && <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: NAVY, ...F, fontWeight: 700 }}>Inspections</h2>
          <button onClick={() => startNew()} style={S.primaryBtn}>+ New</button></div>
        {inspections.length === 0 && <div style={S.empty}><div style={{ fontSize: 40, marginBottom: 12 }}>{'\u{1F4CB}'}</div><div style={{ fontSize: 15, fontWeight: 600, color: NAVY, ...F }}>No inspections yet</div><div style={{ fontSize: 13, color: MED_GRAY, marginTop: 4, ...F }}>Tap "+ New" or start one from a client's property</div></div>}
        {inspections.map(insp => { const { pct } = getCompInfo(insp); const c = getCounts(insp); const pc = getTotalPhotos(insp); return (
          <div key={insp.id} style={S.card} onClick={() => openI(insp.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{insp.propertyAddress || 'Untitled Property'}</div>
                {insp.unitSuite && <div style={{ fontSize: 12, color: MED_GRAY, ...F }}>Unit: {insp.unitSuite}</div>}
                <div style={{ fontSize: 11, color: MED_GRAY, marginTop: 2, ...F }}>{insp.date} {'\u2022'} {insp.planTier || 'No plan'}{pc > 0 ? ` \u2022 \u{1F4F7} ${pc}` : ''}</div></div>
              <div style={{ width: 42, height: 42, borderRadius: '50%', border: `3px solid ${pct === 100 ? '#22C55E' : TEAL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? '#22C55E' : TEAL, ...F }}>{pct}%</span></div></div>
            {Object.values(c).some(v => v > 0) && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {c.good > 0 && <span style={{ ...S.tag, background: '#22C55E18', color: '#22C55E' }}>{'\u2713'} {c.good}</span>}
              {c.fair > 0 && <span style={{ ...S.tag, background: '#F59E0B18', color: '#F59E0B' }}>~ {c.fair}</span>}
              {c.attention > 0 && <span style={{ ...S.tag, background: '#EF444418', color: '#EF4444' }}>! {c.attention}</span>}</div>}
            <button onClick={e => { e.stopPropagation(); if (confirm('Delete?')) delI(insp.id); }} style={S.delBtn}>Delete</button></div>); })}
        </>}</div></div>);

  if (!cur) return null;

  /* -- SUMMARY -- */
  if (view === 'summary') {
    const c = getCounts(cur); const pc = getTotalPhotos(cur);
    const pe = []; SECTIONS.forEach(s => s.items.forEach(i => { const p = cur.photos?.[i] || []; if (p.length > 0) pe.push({ section: s.title, item: i, pics: p }); }));
    const notedItems = []; SECTIONS.forEach(s => s.items.forEach(i => { const n = cur.itemNotes?.[i]; if (n) notedItems.push({ section: s.title, item: i, note: n, status: cur.statuses[i] }); }));
    return (<div style={S.app}>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      {showEmail && <EmailModal inspection={cur} onClose={() => setShowEmail(false)} />}
      <div style={S.topBar}><button onClick={() => setView('form')} style={S.backBtn}>{'\u2190'} Back</button><span style={{ color: '#fff', fontWeight: 700, fontSize: 15, ...F }}>Summary</span><div style={{ width: 48 }} /></div>
      <div style={S.body}>
        <div style={{ background: LIGHT_GRAY, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, ...F }}>{cur.propertyAddress || 'Untitled Property'}</div>
          {cur.unitSuite && <div style={{ fontSize: 13, color: MED_GRAY }}>Unit: {cur.unitSuite}</div>}
          <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4 }}>{cur.date} {'\u2022'} {cur.planTier || '\u2014'} {'\u2022'} {cur.ownerManager || '\u2014'}</div></div>
        <OverallProgress statuses={cur.statuses} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {STATUS_OPTIONS.map(o => <div key={o.key} style={{ background: '#fff', border: `1px solid ${BORDER_GRAY}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: o.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: o.color }}>{c[o.key]}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: DARK_GRAY, ...F }}>{o.label}</div></div>)}</div>
        {c.attention > 0 && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 8, ...F }}>{'\u26A0'} Items Needing Attention</div>
          {SECTIONS.map(s => s.items.filter(i => cur.statuses[i] === 'attention').map(i => { const n = cur.itemNotes?.[i]; return <div key={i} style={{ fontSize: 12, color: '#991B1B', padding: '4px 0', borderBottom: '1px solid #FECACA' }}><span style={{ fontWeight: 600 }}>{s.title}:</span> {i}{n && <div style={{ fontSize: 11, color: '#92400E', fontStyle: 'italic', marginTop: 2, paddingLeft: 8 }}>{'\u21B3'} {n}</div>}</div>; }))}</div>}
        {notedItems.length > 0 && <div style={{ background: '#fff', border: `1px solid ${BORDER_GRAY}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8, ...F }}>{'\u{1F4DD}'} Item Notes</div>
          {notedItems.map((ni, idx) => { const sc = STATUS_OPTIONS.find(o => o.key === ni.status)?.color || MED_GRAY; return <div key={idx} style={{ fontSize: 12, padding: '6px 0', borderBottom: idx < notedItems.length - 1 ? `1px solid ${BORDER_GRAY}44` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: sc, flexShrink: 0 }} /><span style={{ fontWeight: 600, color: DARK_GRAY }}>{ni.item}</span></div>
            <div style={{ fontSize: 11, color: '#92400E', fontStyle: 'italic', paddingLeft: 14, marginTop: 2 }}>{ni.note}</div></div>; })}</div>}
        {cur.overallRating && <div style={{ background: TEAL_LIGHT, borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Overall Rating:</span><span style={{ fontSize: 14, fontWeight: 800, color: TEAL }}>{cur.overallRating}</span></div>}
        {cur.notes && <div style={{ background: '#fff', border: `1px solid ${BORDER_GRAY}`, borderRadius: 12, padding: 14, marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Notes</div><div style={{ fontSize: 13, color: DARK_GRAY, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{cur.notes}</div></div>}
        {pe.length > 0 && <div style={{ background: '#fff', border: `1px solid ${BORDER_GRAY}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 10 }}>{'\u{1F4F7}'} Photos ({pc})</div>
          {pe.map((p, idx) => <div key={idx} style={{ marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 600, color: TEAL }}>{p.section}</div><div style={{ fontSize: 12, color: DARK_GRAY, marginBottom: 6 }}>{p.item}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{p.pics.map((src, j) => <img key={j} src={src} alt="" onClick={() => setLightbox(src)} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER_GRAY}`, cursor: 'pointer' }} />)}</div></div>)}</div>}
        <button onClick={() => setView('pdf')} style={{ ...S.exportBtn, width: '100%', marginBottom: 10 }}>{'\u{1F4C4}'} Preview & Print PDF</button>
        <button onClick={() => setShowEmail(true)} style={{ ...S.emailBtn, width: '100%', marginBottom: 10 }}>{'\u2709'} Send to Customer</button>
        <button onClick={() => { setView('list'); setCurrentId(null); }} style={{ ...S.secBtn, width: '100%', marginBottom: 20 }}>Done</button></div></div>);
  }

  /* -- FORM -- */
  return (<div style={S.app}>
    <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    {showEmail && <EmailModal inspection={cur} onClose={() => setShowEmail(false)} />}
    <div style={S.topBar}>
      <button onClick={() => { setView('list'); setCurrentId(null); }} style={S.backBtn}>{'\u2190'} Back</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, ...F }}>Health Card</span>
        {saving && <span style={{ fontSize: 10, color: TEAL_MED, ...F }}>Saving...</span>}
      </div>
      <button onClick={() => setView('summary')} style={S.sumBtn}>Summary</button></div>
    <div style={S.body}>
      <OverallProgress statuses={cur.statuses} />
      <div style={S.infoCard}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Property Details</div>
        <input style={S.input} placeholder="Property Address" value={cur.propertyAddress} onChange={e => upd({ propertyAddress: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input style={S.input} placeholder="Unit / Suite" value={cur.unitSuite} onChange={e => upd({ unitSuite: e.target.value })} />
          <input style={S.input} type="date" value={cur.date} onChange={e => upd({ date: e.target.value })} /></div>
        <input style={S.input} placeholder="Owner / Manager" value={cur.ownerManager} onChange={e => upd({ ownerManager: e.target.value })} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PLAN_TIERS.map(t => <button key={t} onClick={() => upd({ planTier: cur.planTier === t ? '' : t })} style={{ padding: '6px 16px', borderRadius: 20, border: `2px solid ${cur.planTier === t ? TEAL : BORDER_GRAY}`, background: cur.planTier === t ? TEAL : '#fff', color: cur.planTier === t ? '#fff' : MED_GRAY, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...F }}>{t}</button>)}</div></div>

      {SECTIONS.map(sec => { const exp = expanded[sec.title] ?? false; return (
        <div key={sec.title} style={{ marginBottom: 10 }}>
          <button onClick={() => togSec(sec.title)} style={S.secHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}><span style={{ fontSize: 18 }}>{sec.icon}</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: '#fff', ...F, textAlign: 'left' }}>{sec.title}</div><SectionProgress section={sec} statuses={cur.statuses} /></div></div>
            <span style={{ color: TEAL_MED, fontSize: 18, transition: 'transform .2s', transform: exp ? 'rotate(180deg)' : 'rotate(0deg)' }}>{'\u25BE'}</span></button>
          {exp && <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', border: `1px solid ${BORDER_GRAY}`, borderTop: 'none', overflow: 'hidden' }}>
            {sec.items.map((item, idx) => { const ip = cur.photos?.[item] || []; const st = cur.statuses[item]; const showNote = st && st !== 'good'; const noteVal = cur.itemNotes?.[item] || ''; return (
              <div key={item} style={{ padding: '12px 14px', background: idx % 2 === 0 ? '#fff' : LIGHT_GRAY, borderBottom: idx < sec.items.length - 1 ? `1px solid ${BORDER_GRAY}44` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: DARK_GRAY, fontWeight: 500, ...F, flex: 1 }}>{item}</div>
                  {ip.length > 0 && <span style={{ fontSize: 10, color: TEAL, fontWeight: 600, ...F }}>{'\u{1F4F7}'} {ip.length}</span>}</div>
                <StatusPill status={st} onSelect={v => upd({ statuses: { ...cur.statuses, [item]: v } })} />
                {showNote && <ItemNote value={noteVal} onChange={v => upd({ itemNotes: { ...cur.itemNotes, [item]: v } })} />}
                <PhotoRow photos={ip} onAdd={d => upd({ photos: { ...cur.photos, [item]: [...(cur.photos?.[item] || []), d] } })} onRemove={i => { const a = [...(cur.photos?.[item] || [])]; a.splice(i, 1); upd({ photos: { ...cur.photos, [item]: a } }); }} onTap={s => setLightbox(s)} /></div>); })}</div>}</div>); })}

      <div style={S.infoCard}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Notes & Observations</div>
        <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Add notes..." value={cur.notes} onChange={e => upd({ notes: e.target.value })} /></div>
      <div style={S.infoCard}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Overall Property Rating</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {OVERALL_RATINGS.map(r => { const a = cur.overallRating === r; const rc = r === 'Excellent' ? '#22C55E' : r === 'Good' ? TEAL : r === 'Fair' ? '#F59E0B' : '#EF4444'; return (
            <button key={r} onClick={() => upd({ overallRating: a ? '' : r })} style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${a ? rc : BORDER_GRAY}`, background: a ? rc + '15' : '#fff', color: a ? rc : MED_GRAY, fontSize: 12, fontWeight: a ? 700 : 500, cursor: 'pointer', ...F }}>{r}</button>); })}</div></div>
      <button onClick={() => setView('pdf')} style={{ ...S.exportBtn, width: '100%', marginBottom: 10 }}>{'\u{1F4C4}'} Preview & Print PDF</button>
      <button onClick={() => setShowEmail(true)} style={{ ...S.emailBtn, width: '100%', marginBottom: 10 }}>{'\u2709'} Send to Customer</button>
      <button onClick={() => setView('summary')} style={{ ...S.secBtn, width: '100%', marginBottom: 20 }}>View Summary</button></div></div>);
}

const S = {
  app: { maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#F5F7F8', ...F },
  header: { background: `linear-gradient(135deg,${NAVY},${NAVY}ee)`, padding: '20px 20px 16px', borderBottom: `3px solid ${TEAL}` },
  topBar: { background: NAVY, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${TEAL}`, position: 'sticky', top: 0, zIndex: 100 },
  body: { padding: 16 },
  primaryBtn: { background: `linear-gradient(135deg,${TEAL},#1a9e8e)`, color: '#fff', border: 'none', borderRadius: 24, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: `0 4px 14px ${TEAL}44` },
  exportBtn: { background: `linear-gradient(135deg,${NAVY},#153060)`, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: `0 4px 14px ${NAVY}44` },
  emailBtn: { background: `linear-gradient(135deg,${TEAL},#1a9e8e)`, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: `0 4px 14px ${TEAL}44` },
  secBtn: { background: '#fff', color: TEAL, border: `2px solid ${TEAL}`, borderRadius: 14, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F },
  backBtn: { background: 'transparent', border: 'none', color: TEAL_MED, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 8px', ...F },
  sumBtn: { background: TEAL + '33', border: 'none', color: TEAL_MED, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 14px', borderRadius: 16, ...F },
  card: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, border: `1px solid ${BORDER_GRAY}`, cursor: 'pointer', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,.04)' },
  infoCard: { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${BORDER_GRAY}`, boxShadow: '0 2px 8px rgba(0,0,0,.04)' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${BORDER_GRAY}`, fontSize: 13, color: DARK_GRAY, ...F, outline: 'none', boxSizing: 'border-box', background: LIGHT_GRAY, marginBottom: 8 },
  secHead: { width: '100%', background: `linear-gradient(135deg,${NAVY},${NAVY}dd)`, border: 'none', borderRadius: '12px 12px 0 0', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  empty: { textAlign: 'center', padding: '48px 20px', background: '#fff', borderRadius: 16, border: `1px dashed ${BORDER_GRAY}` },
  tag: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, ...F },
  delBtn: { position: 'absolute', bottom: 10, right: 14, background: 'transparent', border: 'none', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...F },
};