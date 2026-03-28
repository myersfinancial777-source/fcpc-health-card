import emailjs from '@emailjs/browser';
import { SECTIONS, STATUS_OPTIONS } from './constants.js';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// Initialize EmailJS with public key at module load
let initialized = false;
export function initEmailJS() {
  if (initialized || !PUBLIC_KEY) return;
  try {
    // Debug: show the key being used (first 6 and last 4 chars only for security)
    const keyPreview = PUBLIC_KEY.length > 10 
      ? PUBLIC_KEY.slice(0, 6) + '...' + PUBLIC_KEY.slice(-4) 
      : '(too short!)';
    console.log('EmailJS init with key:', keyPreview, 'length:', PUBLIC_KEY.length);
    emailjs.init({ publicKey: PUBLIC_KEY });
    initialized = true;
    console.log('EmailJS initialized successfully');
  } catch (err) {
    console.error('EmailJS init failed:', err);
  }
}

function getCompInfo(i) {
  const t = Object.keys(i.statuses).length;
  const d = Object.values(i.statuses).filter(v => v != null).length;
  return { done: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 };
}
function getCounts(i) {
  const c = { good: 0, fair: 0, attention: 0, na: 0 };
  Object.values(i.statuses).forEach(v => { if (v && c[v] !== undefined) c[v]++; });
  return c;
}

export function buildEmailBody(insp) {
  const { done, total, pct } = getCompInfo(insp);
  const counts = getCounts(insp);
  const addr = insp.propertyAddress || 'Property';

  let b = `PROPERTY HEALTH CARD — INSPECTION REPORT\n`;
  b += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  b += `Property: ${addr}\n`;
  if (insp.unitSuite) b += `Unit: ${insp.unitSuite}\n`;
  b += `Owner/Manager: ${insp.ownerManager || '—'}\n`;
  b += `Plan Tier: ${insp.planTier || '—'}\nDate: ${insp.date}\n\n`;
  b += `RESULTS: ${done}/${total} items (${pct}%)\n`;
  b += `✓ Good: ${counts.good}  |  ~ Fair: ${counts.fair}  |  ! Attention: ${counts.attention}  |  N/A: ${counts.na}\n`;
  b += `Overall Rating: ${insp.overallRating || 'Not yet rated'}\n\n`;
  b += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nDETAILED RESULTS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  SECTIONS.forEach(sec => {
    b += `${sec.icon} ${sec.title.toUpperCase()}\n`;
    sec.items.forEach(item => {
      const s = insp.statuses[item];
      const lbl = STATUS_OPTIONS.find(o => o.key === s)?.label || '—';
      const ic = STATUS_OPTIONS.find(o => o.key === s)?.icon || ' ';
      const pc = (insp.photos?.[item] || []).length;
      const note = insp.itemNotes?.[item] || '';
      b += `  ${ic} ${item}: ${lbl}${pc > 0 ? ` (${pc} photo${pc > 1 ? 's' : ''})` : ''}${note ? `\n    Note: ${note}` : ''}\n`;
    });
    b += `\n`;
  });

  const att = [];
  SECTIONS.forEach(sec => sec.items.forEach(item => {
    if (insp.statuses[item] === 'attention') att.push({ section: sec.title, item, note: insp.itemNotes?.[item] || '' });
  }));
  if (att.length > 0) {
    b += `⚠ ITEMS REQUIRING ATTENTION:\n`;
    att.forEach(a => { b += `  • ${a.section}: ${a.item}${a.note ? ` — ${a.note}` : ''}\n`; });
    b += `\n`;
  }
  if (insp.notes) b += `NOTES:\n${insp.notes}\n\n`;
  b += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFirst Coast Property Care\nJacksonville, FL\n"We Handle the Small Things Before They Become Big Problems."\n`;
  return b;
}

export async function sendEmail(toEmail, insp) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.error('EmailJS config missing:', { SERVICE_ID: !!SERVICE_ID, TEMPLATE_ID: !!TEMPLATE_ID, PUBLIC_KEY: !!PUBLIC_KEY });
    return { ok: false, msg: 'EmailJS not configured. Check environment variables.' };
  }

  // Ensure initialized
  initEmailJS();

  const addr = insp.propertyAddress || 'Property';
  const body = buildEmailBody(insp);

  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: toEmail,
      subject: `Property Health Card — ${addr} — ${insp.date}`,
      message: body,
      from_name: 'First Coast Property Care',
      property_address: addr,
      inspection_date: insp.date,
    });

    if (result.status === 200) return { ok: true, msg: 'Email sent successfully!' };
    return { ok: false, msg: 'Send failed. Try again.' };
  } catch (err) {
    console.error('EmailJS error full object:', JSON.stringify(err, null, 2));
    console.error('EmailJS error status:', err?.status);
    console.error('EmailJS error text:', err?.text);
    console.error('EmailJS error message:', err?.message);
    console.error('EmailJS SERVICE_ID:', SERVICE_ID);
    console.error('EmailJS TEMPLATE_ID:', TEMPLATE_ID);
    const errorMsg = err?.text || err?.message || JSON.stringify(err) || 'Unknown error';
    return { ok: false, msg: errorMsg };
  }
}
