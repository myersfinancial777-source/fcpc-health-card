import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { genId } from './utils.js';

var NAVY = '#0B2545';
var TEAL = '#1B8A8C';
var TEAL_LIGHT = '#E0F5F5';
var TEAL_MED = '#A8DCD9';
var DARK_GRAY = '#333333';
var MED_GRAY = '#666666';
var LIGHT_GRAY = '#F0F4F5';
var BORDER_GRAY = '#D0D8DA';
var F = { fontFamily: "'DM Sans', sans-serif" };

var STATUS_COLORS = {
  draft: '#9CA3AF', sent: '#3B82F6', approved: '#22C55E', declined: '#EF4444', expired: '#F59E0B',
  paid: '#22C55E', overdue: '#EF4444', cancelled: '#9CA3AF',
  new: '#3B82F6', reviewed: '#F59E0B', quoted: '#8B5CF6', scheduled: '#1B8A8C', completed: '#22C55E',
};

function StatusBadge(props) {
  var color = STATUS_COLORS[props.status] || MED_GRAY;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: color + '18', color: color, border: '1px solid ' + color + '33', textTransform: 'uppercase', ...F }}>
      {props.status}
    </span>
  );
}

/* ---- Quotes List ---- */
export function QuotesList(props) {
  var [quotes, setQuotes] = useState([]);
  var [loading, setLoading] = useState(true);

  useEffect(function() { loadQuotes(); }, []);

  async function loadQuotes() {
    var resp = await supabase.from('quotes').select('*, clients(first_name, last_name), properties(address)').order('created_at', { ascending: false });
    if (resp.data) setQuotes(resp.data);
    setLoading(false);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: MED_GRAY, ...F }}>Loading quotes...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, ...F }}>Quotes</div>
        <button onClick={function() { props.onNew(); }} style={S.primaryBtn}>+ New Quote</button>
      </div>

      {quotes.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F4DD}'}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, ...F }}>No quotes yet</div>
        </div>
      )}

      {quotes.map(function(q) {
        var clientName = q.clients ? q.clients.first_name + ' ' + q.clients.last_name : 'No client';
        var propAddr = q.properties ? q.properties.address : '';
        return (
          <div key={q.id} style={S.card} onClick={function() { props.onEdit(q.id); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{q.title}</div>
                <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 2, ...F }}>{clientName}{propAddr ? ' \u2022 ' + propAddr : ''}</div>
              </div>
              <StatusBadge status={q.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: TEAL, ...F }}>${Number(q.total_amount || 0).toFixed(2)}</div>
              <div style={{ fontSize: 11, color: MED_GRAY, ...F }}>{q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Quote Form ---- */
export function QuoteForm(props) {
  var [clients, setClients] = useState([]);
  var [properties, setProperties] = useState([]);
  var [form, setForm] = useState({
    id: '', client_id: '', property_id: '', title: '', description: '', status: 'draft',
    valid_until: '', notes: '',
  });
  var [items, setItems] = useState([]);
  var [loading, setLoading] = useState(!!props.quoteId);
  var [saving, setSaving] = useState(false);

  useEffect(function() {
    loadClients();
    if (props.quoteId) loadQuote();
  }, []);

  async function loadClients() {
    var resp = await supabase.from('clients').select('id, first_name, last_name');
    if (resp.data) setClients(resp.data);
  }

  async function loadQuote() {
    var resp = await supabase.from('quotes').select('*').eq('id', props.quoteId).single();
    if (resp.data) {
      setForm(resp.data);
      if (resp.data.client_id) loadProps(resp.data.client_id);
    }
    var itemsResp = await supabase.from('quote_items').select('*').eq('quote_id', props.quoteId).order('sort_order');
    if (itemsResp.data) setItems(itemsResp.data);
    setLoading(false);
  }

  async function loadProps(clientId) {
    var resp = await supabase.from('properties').select('id, address, unit_suite').eq('client_id', clientId);
    if (resp.data) setProperties(resp.data);
  }

  function upd(u) { setForm(function(p) { return Object.assign({}, p, u); }); }

  function addItem() {
    setItems(function(p) { return p.concat([{ id: genId(), description: '', quantity: 1, unit_price: 0, total: 0, sort_order: p.length }]); });
  }

  function updateItem(idx, u) {
    setItems(function(p) {
      var next = p.map(function(item, i) {
        if (i !== idx) return item;
        var updated = Object.assign({}, item, u);
        updated.total = Number(updated.quantity || 0) * Number(updated.unit_price || 0);
        return updated;
      });
      return next;
    });
  }

  function removeItem(idx) {
    setItems(function(p) { return p.filter(function(_, i) { return i !== idx; }); });
  }

  function calcTotal() {
    return items.reduce(function(sum, i) { return sum + Number(i.total || 0); }, 0);
  }

  async function handleSave(newStatus) {
    if (!form.title.trim() || !form.client_id) return;
    setSaving(true);

    var quoteId = form.id || genId();
    var total = calcTotal();
    var status = newStatus || form.status;

    var quoteData = {
      id: quoteId,
      client_id: form.client_id,
      property_id: form.property_id || null,
      title: form.title,
      description: form.description || null,
      status: status,
      total_amount: total,
      valid_until: form.valid_until || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (!form.id) quoteData.created_at = new Date().toISOString();

    await supabase.from('quotes').upsert(quoteData, { onConflict: 'id' });

    // Delete old items and insert new
    await supabase.from('quote_items').delete().eq('quote_id', quoteId);
    if (items.length > 0) {
      var rows = items.map(function(item, idx) {
        return { id: item.id || genId(), quote_id: quoteId, description: item.description, quantity: item.quantity, unit_price: item.unit_price, total: item.total, sort_order: idx };
      });
      await supabase.from('quote_items').insert(rows);
    }

    setSaving(false);
    props.onSave();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: MED_GRAY, ...F }}>Loading...</div>;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16, ...F }}>
        {props.quoteId ? 'Edit Quote' : 'New Quote'}
      </div>

      <div style={S.infoCard}>
        <div style={S.label}>Client *</div>
        <select style={S.input} value={form.client_id} onChange={function(e) { upd({ client_id: e.target.value, property_id: '' }); loadProps(e.target.value); }}>
          <option value="">Select client...</option>
          {clients.map(function(c) { return <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>; })}
        </select>

        {properties.length > 0 && <>
          <div style={S.label}>Property</div>
          <select style={S.input} value={form.property_id || ''} onChange={function(e) { upd({ property_id: e.target.value }); }}>
            <option value="">Select property...</option>
            {properties.map(function(p) { return <option key={p.id} value={p.id}>{p.address}{p.unit_suite ? ' - ' + p.unit_suite : ''}</option>; })}
          </select>
        </>}

        <div style={S.label}>Title *</div>
        <input style={S.input} placeholder="Quote title" value={form.title} onChange={function(e) { upd({ title: e.target.value }); }} />

        <div style={S.label}>Description</div>
        <textarea style={Object.assign({}, S.input, { minHeight: 60, resize: 'vertical' })} placeholder="Description..." value={form.description || ''} onChange={function(e) { upd({ description: e.target.value }); }} />

        <div style={S.label}>Valid Until</div>
        <input style={S.input} type="date" value={form.valid_until || ''} onChange={function(e) { upd({ valid_until: e.target.value }); }} />
      </div>

      <div style={S.infoCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={S.label}>Line Items</div>
          <button onClick={addItem} style={Object.assign({}, S.smallBtn, { background: TEAL, color: '#fff' })}>+ Add Item</button>
        </div>

        {items.length === 0 && <div style={{ fontSize: 12, color: MED_GRAY, ...F, padding: '10px 0' }}>No line items yet</div>}

        {items.map(function(item, idx) {
          return (
            <div key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : LIGHT_GRAY, padding: '10px', borderRadius: 8, marginBottom: 6, border: '1px solid ' + BORDER_GRAY + '44' }}>
              <input style={S.input} placeholder="Description" value={item.description} onChange={function(e) { updateItem(idx, { description: e.target.value }); }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 9, color: MED_GRAY, ...F }}>Qty</div>
                  <input style={S.input} type="number" step="0.5" value={item.quantity} onChange={function(e) { updateItem(idx, { quantity: e.target.value }); }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: MED_GRAY, ...F }}>Price</div>
                  <input style={S.input} type="number" step="0.01" value={item.unit_price} onChange={function(e) { updateItem(idx, { unit_price: e.target.value }); }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: MED_GRAY, ...F }}>Total</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, padding: '10px 0', ...F }}>${Number(item.total || 0).toFixed(2)}</div>
                </div>
                <button onClick={function() { removeItem(idx); }} style={{ background: '#FEF2F2', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', ...F, marginTop: 12 }}>X</button>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0', borderTop: '2px solid ' + NAVY }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, ...F }}>Total: ${calcTotal().toFixed(2)}</div>
        </div>
      </div>

      <div style={S.infoCard}>
        <div style={S.label}>Notes</div>
        <textarea style={Object.assign({}, S.input, { minHeight: 60, resize: 'vertical' })} placeholder="Internal notes..." value={form.notes || ''} onChange={function(e) { upd({ notes: e.target.value }); }} />
      </div>

      <button onClick={function() { handleSave('draft'); }} disabled={saving} style={Object.assign({}, S.primaryBtn, { width: '100%', padding: '14px', fontSize: 14, marginBottom: 8 })}>
        {saving ? 'Saving...' : 'Save as Draft'}
      </button>
      <button onClick={function() { handleSave('sent'); }} disabled={saving} style={Object.assign({}, S.sendBtn, { width: '100%', padding: '14px', fontSize: 14, marginBottom: 8 })}>
        {saving ? 'Saving...' : 'Save & Send to Customer'}
      </button>
      <button onClick={props.onCancel} style={Object.assign({}, S.secBtn, { width: '100%' })}>Cancel</button>
    </div>
  );
}/* ---- Invoices List ---- */
export function InvoicesList(props) {
  var [invoices, setInvoices] = useState([]);
  var [loading, setLoading] = useState(true);

  useEffect(function() { loadInvoices(); }, []);

  async function loadInvoices() {
    var resp = await supabase.from('invoices').select('*, clients(first_name, last_name)').order('created_at', { ascending: false });
    if (resp.data) setInvoices(resp.data);
    setLoading(false);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: MED_GRAY, ...F }}>Loading invoices...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, ...F }}>Invoices</div>
        <button onClick={function() { props.onNew(); }} style={S.primaryBtn}>+ New Invoice</button>
      </div>

      {invoices.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F4B0}'}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, ...F }}>No invoices yet</div>
        </div>
      )}

      {invoices.map(function(inv) {
        var clientName = inv.clients ? inv.clients.first_name + ' ' + inv.clients.last_name : 'No client';
        return (
          <div key={inv.id} style={S.card} onClick={function() { props.onEdit(inv.id); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{inv.invoice_number || 'Draft'} - {inv.title}</div>
                <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 2, ...F }}>{clientName}</div>
              </div>
              <StatusBadge status={inv.status} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: inv.status === 'paid' ? '#22C55E' : NAVY, ...F }}>${Number(inv.total_amount || 0).toFixed(2)}</div>
              <div style={{ fontSize: 11, color: MED_GRAY, ...F }}>
                {inv.due_date ? 'Due: ' + inv.due_date : ''}
                {inv.paid_at ? ' \u2022 Paid ' + new Date(inv.paid_at).toLocaleDateString() : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Invoice Form ---- */
export function InvoiceForm(props) {
  var [clients, setClients] = useState([]);
  var [properties, setProperties] = useState([]);
  var [form, setForm] = useState({
    id: '', client_id: '', property_id: '', title: '', description: '', status: 'draft',
    due_date: '', notes: '',
  });
  var [items, setItems] = useState([]);
  var [loading, setLoading] = useState(!!props.invoiceId);
  var [saving, setSaving] = useState(false);

  useEffect(function() {
    loadClients();
    if (props.invoiceId) loadInvoice();
  }, []);

  async function loadClients() {
    var resp = await supabase.from('clients').select('id, first_name, last_name');
    if (resp.data) setClients(resp.data);
  }

  async function loadInvoice() {
    var resp = await supabase.from('invoices').select('*').eq('id', props.invoiceId).single();
    if (resp.data) {
      setForm(resp.data);
      if (resp.data.client_id) loadProps(resp.data.client_id);
    }
    var itemsResp = await supabase.from('invoice_items').select('*').eq('invoice_id', props.invoiceId).order('sort_order');
    if (itemsResp.data) setItems(itemsResp.data);
    setLoading(false);
  }

  async function loadProps(clientId) {
    var resp = await supabase.from('properties').select('id, address, unit_suite').eq('client_id', clientId);
    if (resp.data) setProperties(resp.data);
  }

  function upd(u) { setForm(function(p) { return Object.assign({}, p, u); }); }

  function addItem() {
    setItems(function(p) { return p.concat([{ id: genId(), description: '', quantity: 1, unit_price: 0, total: 0, sort_order: p.length }]); });
  }

  function updateItem(idx, u) {
    setItems(function(p) {
      return p.map(function(item, i) {
        if (i !== idx) return item;
        var updated = Object.assign({}, item, u);
        updated.total = Number(updated.quantity || 0) * Number(updated.unit_price || 0);
        return updated;
      });
    });
  }

  function removeItem(idx) {
    setItems(function(p) { return p.filter(function(_, i) { return i !== idx; }); });
  }

  function calcTotal() {
    return items.reduce(function(sum, i) { return sum + Number(i.total || 0); }, 0);
  }

  async function handleSave(newStatus) {
    if (!form.title.trim() || !form.client_id) return;
    setSaving(true);

    var invoiceId = form.id || genId();
    var total = calcTotal();

    var invoiceData = {
      id: invoiceId,
      client_id: form.client_id,
      property_id: form.property_id || null,
      title: form.title,
      description: form.description || null,
      status: newStatus || form.status,
      total_amount: total,
      due_date: form.due_date || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };

    if (!form.id) invoiceData.created_at = new Date().toISOString();

    await supabase.from('invoices').upsert(invoiceData, { onConflict: 'id' });

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
    if (items.length > 0) {
      var rows = items.map(function(item, idx) {
        return { id: item.id || genId(), invoice_id: invoiceId, description: item.description, quantity: item.quantity, unit_price: item.unit_price, total: item.total, sort_order: idx };
      });
      await supabase.from('invoice_items').insert(rows);
    }

    setSaving(false);
    props.onSave();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: MED_GRAY, ...F }}>Loading...</div>;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16, ...F }}>
        {props.invoiceId ? 'Edit Invoice' : 'New Invoice'}
      </div>

      <div style={S.infoCard}>
        <div style={S.label}>Client *</div>
        <select style={S.input} value={form.client_id} onChange={function(e) { upd({ client_id: e.target.value, property_id: '' }); loadProps(e.target.value); }}>
          <option value="">Select client...</option>
          {clients.map(function(c) { return <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>; })}
        </select>

        {properties.length > 0 && <>
          <div style={S.label}>Property</div>
          <select style={S.input} value={form.property_id || ''} onChange={function(e) { upd({ property_id: e.target.value }); }}>
            <option value="">Select property...</option>
            {properties.map(function(p) { return <option key={p.id} value={p.id}>{p.address}{p.unit_suite ? ' - ' + p.unit_suite : ''}</option>; })}
          </select>
        </>}

        <div style={S.label}>Title *</div>
        <input style={S.input} placeholder="Invoice title" value={form.title} onChange={function(e) { upd({ title: e.target.value }); }} />

        <div style={S.label}>Description</div>
        <textarea style={Object.assign({}, S.input, { minHeight: 60, resize: 'vertical' })} placeholder="Description..." value={form.description || ''} onChange={function(e) { upd({ description: e.target.value }); }} />

        <div style={S.label}>Due Date</div>
        <input style={S.input} type="date" value={form.due_date || ''} onChange={function(e) { upd({ due_date: e.target.value }); }} />
      </div>

      <div style={S.infoCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={S.label}>Line Items</div>
          <button onClick={addItem} style={Object.assign({}, S.smallBtn, { background: TEAL, color: '#fff' })}>+ Add Item</button>
        </div>

        {items.length === 0 && <div style={{ fontSize: 12, color: MED_GRAY, ...F, padding: '10px 0' }}>No line items yet</div>}

        {items.map(function(item, idx) {
          return (
            <div key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : LIGHT_GRAY, padding: '10px', borderRadius: 8, marginBottom: 6, border: '1px solid ' + BORDER_GRAY + '44' }}>
              <input style={S.input} placeholder="Description" value={item.description} onChange={function(e) { updateItem(idx, { description: e.target.value }); }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 9, color: MED_GRAY, ...F }}>Qty</div>
                  <input style={S.input} type="number" step="0.5" value={item.quantity} onChange={function(e) { updateItem(idx, { quantity: e.target.value }); }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: MED_GRAY, ...F }}>Price</div>
                  <input style={S.input} type="number" step="0.01" value={item.unit_price} onChange={function(e) { updateItem(idx, { unit_price: e.target.value }); }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: MED_GRAY, ...F }}>Total</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, padding: '10px 0', ...F }}>${Number(item.total || 0).toFixed(2)}</div>
                </div>
                <button onClick={function() { removeItem(idx); }} style={{ background: '#FEF2F2', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', ...F, marginTop: 12 }}>X</button>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0', borderTop: '2px solid ' + NAVY }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, ...F }}>Total: ${calcTotal().toFixed(2)}</div>
        </div>
      </div>

      <div style={S.infoCard}>
        <div style={S.label}>Notes</div>
        <textarea style={Object.assign({}, S.input, { minHeight: 60, resize: 'vertical' })} placeholder="Internal notes..." value={form.notes || ''} onChange={function(e) { upd({ notes: e.target.value }); }} />
      </div>

      <button onClick={function() { handleSave('draft'); }} disabled={saving} style={Object.assign({}, S.primaryBtn, { width: '100%', padding: '14px', fontSize: 14, marginBottom: 8 })}>
        {saving ? 'Saving...' : 'Save as Draft'}
      </button>
      <button onClick={function() { handleSave('sent'); }} disabled={saving} style={Object.assign({}, S.sendBtn, { width: '100%', padding: '14px', fontSize: 14, marginBottom: 8 })}>
        {saving ? 'Saving...' : 'Save & Send to Customer'}
      </button>
      <button onClick={props.onCancel} style={Object.assign({}, S.secBtn, { width: '100%' })}>Cancel</button>
    </div>
  );
}/* ---- Work Requests List (Admin View) ---- */
export function WorkRequestsList() {
  var [requests, setRequests] = useState([]);
  var [loading, setLoading] = useState(true);

  useEffect(function() { loadRequests(); }, []);

  async function loadRequests() {
    var resp = await supabase.from('work_requests').select('*, clients(first_name, last_name), properties(address)').order('created_at', { ascending: false });
    if (resp.data) setRequests(resp.data);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    await supabase.from('work_requests').update({ status: status, updated_at: new Date().toISOString() }).eq('id', id);
    loadRequests();
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: MED_GRAY, ...F }}>Loading...</div>;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 12, ...F }}>Work Requests</div>

      {requests.length === 0 && (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u{1F4E9}'}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, ...F }}>No work requests yet</div>
          <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 4, ...F }}>Customers can submit requests from their portal</div>
        </div>
      )}

      {requests.map(function(wr) {
        var clientName = wr.clients ? wr.clients.first_name + ' ' + wr.clients.last_name : 'Unknown';
        var propAddr = wr.properties ? wr.properties.address : '';
        var urgencyColor = wr.urgency === 'emergency' ? '#EF4444' : wr.urgency === 'high' ? '#F59E0B' : TEAL;

        return (
          <div key={wr.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, ...F }}>{wr.title}</div>
                <div style={{ fontSize: 12, color: MED_GRAY, marginTop: 2, ...F }}>{clientName}{propAddr ? ' \u2022 ' + propAddr : ''}</div>
                {wr.description && <div style={{ fontSize: 12, color: DARK_GRAY, marginTop: 6, lineHeight: 1.5, ...F }}>{wr.description}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <StatusBadge status={wr.status} />
                <span style={{ fontSize: 9, fontWeight: 700, color: urgencyColor, textTransform: 'uppercase', ...F }}>{wr.urgency}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {wr.status === 'new' && <button onClick={function() { updateStatus(wr.id, 'reviewed'); }} style={Object.assign({}, S.smallBtn, { background: TEAL, color: '#fff' })}>Mark Reviewed</button>}
              {wr.status === 'reviewed' && <button onClick={function() { updateStatus(wr.id, 'scheduled'); }} style={Object.assign({}, S.smallBtn, { background: TEAL, color: '#fff' })}>Mark Scheduled</button>}
              {(wr.status === 'scheduled' || wr.status === 'reviewed') && <button onClick={function() { updateStatus(wr.id, 'completed'); }} style={Object.assign({}, S.smallBtn, { background: '#22C55E', color: '#fff' })}>Complete</button>}
            </div>
            <div style={{ fontSize: 10, color: MED_GRAY, marginTop: 8, ...F }}>{new Date(wr.created_at).toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}

var S = {
  primaryBtn: { background: 'linear-gradient(135deg, ' + TEAL + ', #1a9e8e)', color: '#fff', border: 'none', borderRadius: 24, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: '0 4px 14px ' + TEAL + '44' },
  sendBtn: { background: 'linear-gradient(135deg, ' + NAVY + ', #153060)', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F, boxShadow: '0 4px 14px ' + NAVY + '44' },
  secBtn: { background: '#fff', color: TEAL, border: '2px solid ' + TEAL, borderRadius: 14, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F },
  smallBtn: { border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...F },
  card: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, border: '1px solid ' + BORDER_GRAY, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.04)' },
  infoCard: { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, border: '1px solid ' + BORDER_GRAY, boxShadow: '0 2px 8px rgba(0,0,0,.04)' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid ' + BORDER_GRAY, fontSize: 13, color: DARK_GRAY, ...F, outline: 'none', boxSizing: 'border-box', background: LIGHT_GRAY, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, ...F },
  empty: { textAlign: 'center', padding: '32px 20px', background: '#fff', borderRadius: 16, border: '1px dashed ' + BORDER_GRAY, marginBottom: 12 },
};