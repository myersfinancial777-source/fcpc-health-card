import emailjs from '@emailjs/browser';
import { SECTIONS, STATUS_OPTIONS } from './constants.js';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export function initEmailJS() {
  // Key is passed directly in each send call
}

function getCompInfo(i) {
  var t = Object.keys(i.statuses).length;
  var d = Object.values(i.statuses).filter(function(v) { return v != null; }).length;
  return { done: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 };
}

function getCounts(i) {
  var c = { good: 0, fair: 0, attention: 0, na: 0 };
  Object.values(i.statuses).forEach(function(v) { if (v && c[v] !== undefined) c[v]++; });
  return c;
}

export function buildEmailBody(insp) {
  var ci = getCompInfo(insp);
  var counts = getCounts(insp);
  var addr = insp.propertyAddress || 'Property';
  var line = '==================================';

  var b = 'PROPERTY HEALTH CARD \u2014 INSPECTION REPORT\n';
  b += line + '\n\n';
  b += 'Property: ' + addr + '\n';
  if (insp.unitSuite) b += 'Unit: ' + insp.unitSuite + '\n';
  b += 'Owner/Manager: ' + (insp.ownerManager || '\u2014') + '\n';
  b += 'Plan Tier: ' + (insp.planTier || '\u2014') + '\n';
  b += 'Date: ' + insp.date + '\n\n';
  b += 'RESULTS: ' + ci.done + '/' + ci.total + ' items (' + ci.pct + '%)\n';
  b += '\u2713 Good: ' + counts.good + '  |  ~ Fair: ' + counts.fair + '  |  ! Attention: ' + counts.attention + '  |  N/A: ' + counts.na + '\n';
  b += 'Overall Rating: ' + (insp.overallRating || 'Not yet rated') + '\n\n';
  b += line + '\nDETAILED RESULTS\n' + line + '\n\n';

  SECTIONS.forEach(function(sec) {
    b += sec.icon + ' ' + sec.title.toUpperCase() + '\n';
    sec.items.forEach(function(item) {
      var s = insp.statuses[item];
      var lbl = (STATUS_OPTIONS.find(function(o) { return o.key === s; }) || {}).label || '\u2014';
      var ic = (STATUS_OPTIONS.find(function(o) { return o.key === s; }) || {}).icon || ' ';
      var pc = (insp.photos && insp.photos[item] ? insp.photos[item].length : 0);
      var note = (insp.itemNotes && insp.itemNotes[item]) || '';
      b += '  ' + ic + ' ' + item + ': ' + lbl;
      if (pc > 0) b += ' (' + pc + ' photo' + (pc > 1 ? 's' : '') + ')';
      if (note) b += '\n    Note: ' + note;
      b += '\n';
    });
    b += '\n';
  });

  var att = [];
  SECTIONS.forEach(function(sec) {
    sec.items.forEach(function(item) {
      if (insp.statuses[item] === 'attention') {
        att.push({ section: sec.title, item: item, note: (insp.itemNotes && insp.itemNotes[item]) || '' });
      }
    });
  });

  if (att.length > 0) {
    b += '\u26A0 ITEMS REQUIRING ATTENTION:\n';
    att.forEach(function(a) {
      b += '  \u2022 ' + a.section + ': ' + a.item;
      if (a.note) b += ' \u2014 ' + a.note;
      b += '\n';
    });
    b += '\n';
  }

  if (insp.notes) b += 'NOTES:\n' + insp.notes + '\n\n';
  b += line + '\nFirst Coast Property Care\nJacksonville, FL\n"We Handle the Small Things Before They Become Big Problems."\n';
  return b;
}

export async function sendEmail(toEmail, insp) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    return { ok: false, msg: 'EmailJS not configured. Check environment variables.' };
  }

  var addr = insp.propertyAddress || 'Property';
  var body = buildEmailBody(insp);

  try {
    var result = await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: toEmail,
      subject: 'Property Health Card \u2014 ' + addr + ' \u2014 ' + insp.date,
      message: body,
      from_name: 'First Coast Property Care',
      property_address: addr,
      inspection_date: insp.date,
    }, PUBLIC_KEY);

    if (result.status === 200) return { ok: true, msg: 'Email sent successfully!' };
    return { ok: false, msg: 'Send failed. Try again.' };
  } catch (err) {
    var errorMsg = (err && err.text) || (err && err.message) || 'Unknown error';
    return { ok: false, msg: errorMsg };
  }
}