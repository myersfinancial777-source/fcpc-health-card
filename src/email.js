import emailjs from '@emailjs/browser';
import { SECTIONS, STATUS_OPTIONS } from './constants.js';

var SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
var TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
var PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export function initEmailJS() {}

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

function statusIcon(key) {
  var match = STATUS_OPTIONS.find(function(o) { return o.key === key; });
  return match ? match.icon : ' ';
}

function photoCount(insp, item) {
  return (insp.photos && insp.photos[item]) ? insp.photos[item].length : 0;
}

function totalPhotos(insp) {
  var count = 0;
  Object.keys(insp.photos || {}).forEach(function(k) {
    count += (insp.photos[k] || []).length;
  });
  return count;
}

function ratingColor(rating) {
  if (rating === 'Excellent') return '#22C55E';
  if (rating === 'Good') return '#1B8A8C';
  if (rating === 'Fair') return '#F59E0B';
  if (rating === 'Needs Attention') return '#EF4444';
  return '#666666';
}

function esc(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildEmailBody(insp) {
  var ci = getCompInfo(insp);
  var counts = getCounts(insp);
  var addr = esc(insp.propertyAddress || 'Property');
  var unit = esc(insp.unitSuite || '');
  var owner = esc(insp.ownerManager || '\u2014');
  var plan = esc(insp.planTier || '\u2014');
  var date = esc(insp.date || '');
  var rating = insp.overallRating || 'Not yet rated';
  var rc = ratingColor(rating);
  var pc = totalPhotos(insp);

  var att = [];
  SECTIONS.forEach(function(sec) {
    sec.items.forEach(function(item) {
      if (insp.statuses[item] === 'attention') {
        att.push({
          section: sec.title,
          item: item,
          note: (insp.itemNotes && insp.itemNotes[item]) || ''
        });
      }
    });
  });

  var h = '';

  // Email wrapper
  h += '<div style="background-color:#F0F4F5;padding:20px 0;font-family:Arial,Helvetica,sans-serif;">';
  h += '<div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">';

  // Header
  h += '<div style="background-color:#0B2545;padding:28px 32px;text-align:center;">';
  h += '<div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">First Coast Property Care</div>';
  h += '<div style="font-size:11px;color:#A8DCD9;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Jacksonville &amp; St. Augustine, FL</div>';
  h += '</div>';

  // Teal accent bar
  h += '<div style="height:4px;background:linear-gradient(90deg,#1B8A8C,#A8DCD9);"></div>';

  // Title
  h += '<div style="padding:24px 32px 16px;text-align:center;">';
  h += '<div style="font-size:20px;font-weight:700;color:#0B2545;">Property Health Card</div>';
  h += '<div style="font-size:12px;color:#666666;margin-top:4px;">Preventative Maintenance Inspection Report</div>';
  h += '</div>';

  // Property details card
  h += '<div style="margin:0 24px 20px;background-color:#F0F4F5;border-radius:10px;padding:18px 20px;">';
  h += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
  h += '<tr><td style="color:#1B8A8C;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;">Property Address</td>';
  h += '<td style="color:#1B8A8C;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;">Date</td></tr>';
  h += '<tr><td style="color:#0B2545;font-weight:600;padding-bottom:10px;">' + addr + (unit ? ' \u2014 Unit ' + unit : '') + '</td>';
  h += '<td style="color:#0B2545;font-weight:600;padding-bottom:10px;">' + date + '</td></tr>';
  h += '<tr><td style="color:#1B8A8C;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;">Owner / Manager</td>';
  h += '<td style="color:#1B8A8C;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;">Plan Tier</td></tr>';
  h += '<tr><td style="color:#0B2545;font-weight:600;">' + owner + '</td>';
  h += '<td style="color:#0B2545;font-weight:600;">' + plan + '</td></tr>';
  h += '</table></div>';

  // Status summary boxes
  h += '<div style="margin:0 24px 20px;">';
  h += '<table style="width:100%;border-collapse:separate;border-spacing:8px 0;">';
  h += '<tr>';
  h += '<td style="background-color:#22C55E15;border:1px solid #22C55E33;border-radius:8px;padding:12px;text-align:center;width:25%;">';
  h += '<div style="font-size:22px;font-weight:800;color:#22C55E;">' + counts.good + '</div>';
  h += '<div style="font-size:10px;font-weight:600;color:#22C55E;text-transform:uppercase;">Good</div></td>';
  h += '<td style="background-color:#F59E0B15;border:1px solid #F59E0B33;border-radius:8px;padding:12px;text-align:center;width:25%;">';
  h += '<div style="font-size:22px;font-weight:800;color:#F59E0B;">' + counts.fair + '</div>';
  h += '<div style="font-size:10px;font-weight:600;color:#F59E0B;text-transform:uppercase;">Fair</div></td>';
  h += '<td style="background-color:#EF444415;border:1px solid #EF444433;border-radius:8px;padding:12px;text-align:center;width:25%;">';
  h += '<div style="font-size:22px;font-weight:800;color:#EF4444;">' + counts.attention + '</div>';
  h += '<div style="font-size:10px;font-weight:600;color:#EF4444;text-transform:uppercase;">Attention</div></td>';
  h += '<td style="background-color:#9CA3AF15;border:1px solid #9CA3AF33;border-radius:8px;padding:12px;text-align:center;width:25%;">';
  h += '<div style="font-size:22px;font-weight:800;color:#9CA3AF;">' + counts.na + '</div>';
  h += '<div style="font-size:10px;font-weight:600;color:#9CA3AF;text-transform:uppercase;">N/A</div></td>';
  h += '</tr></table></div>';

  // Completion bar
  h += '<div style="margin:0 24px 20px;background-color:#F0F4F5;border-radius:8px;padding:14px 18px;">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
  h += '<span style="font-size:12px;font-weight:600;color:#0B2545;">Inspection Progress</span>';
  h += '<span style="font-size:12px;font-weight:700;color:' + (ci.pct === 100 ? '#22C55E' : '#1B8A8C') + ';">' + ci.done + '/' + ci.total + ' (' + ci.pct + '%)</span></div>';
  h += '<div style="height:8px;background-color:#D0D8DA;border-radius:4px;overflow:hidden;">';
  h += '<div style="width:' + ci.pct + '%;height:100%;background-color:' + (ci.pct === 100 ? '#22C55E' : '#1B8A8C') + ';border-radius:4px;"></div></div></div>';

  // Overall rating
  if (insp.overallRating) {
    h += '<div style="margin:0 24px 20px;background-color:' + rc + '12;border:2px solid ' + rc + '33;border-radius:10px;padding:14px 18px;text-align:center;">';
    h += '<div style="font-size:11px;font-weight:700;color:#0B2545;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Overall Property Rating</div>';
    h += '<div style="font-size:20px;font-weight:800;color:' + rc + ';">' + esc(rating) + '</div></div>';
  }

  // Attention items
  if (att.length > 0) {
    h += '<div style="margin:0 24px 20px;background-color:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:16px 18px;">';
    h += '<div style="font-size:13px;font-weight:700;color:#DC2626;margin-bottom:10px;">\u26A0 Items Requiring Attention</div>';
    att.forEach(function(a) {
      h += '<div style="font-size:12px;color:#991B1B;padding:6px 0;border-bottom:1px solid #FECACA;">';
      h += '<strong>' + esc(a.section) + ':</strong> ' + esc(a.item);
      if (a.note) h += '<div style="font-size:11px;color:#92400E;font-style:italic;margin-top:2px;padding-left:8px;">\u21B3 ' + esc(a.note) + '</div>';
      h += '</div>';
    });
    h += '</div>';
  }

  // Detailed results
  h += '<div style="margin:0 24px 20px;">';
  h += '<div style="font-size:14px;font-weight:700;color:#0B2545;margin-bottom:12px;">Detailed Results</div>';

  SECTIONS.forEach(function(sec) {
    h += '<div style="margin-bottom:16px;">';
    h += '<div style="background-color:#0B2545;color:#ffffff;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:0.5px;border-radius:6px 6px 0 0;border-left:4px solid #1B8A8C;">';
    h += sec.icon + ' ' + sec.title.toUpperCase() + '</div>';
    h += '<div style="border:1px solid #D0D8DA;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;">';

    sec.items.forEach(function(item, idx) {
      var s = insp.statuses[item];
      var sc = statusColor(s);
      var sl = statusLabel(s);
      var pc = photoCount(insp, item);
      var note = (insp.itemNotes && insp.itemNotes[item]) || '';
      var bg = idx % 2 === 0 ? '#ffffff' : '#F0F4F5';

      h += '<div style="padding:8px 14px;background-color:' + bg + ';font-size:12px;">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      h += '<span style="color:#333333;">' + esc(item) + '</span>';
      h += '<span style="display:inline-block;font-weight:700;font-size:10px;padding:2px 10px;border-radius:10px;background-color:' + sc + '18;color:' + sc + ';border:1px solid ' + sc + '33;min-width:60px;text-align:center;">';
      h += sl + '</span></div>';
      if (pc > 0) {
        h += '<div style="font-size:10px;color:#1B8A8C;margin-top:2px;">\u{1F4F7} ' + pc + ' photo' + (pc > 1 ? 's' : '') + ' (see PDF report)</div>';
      }
      if (note) {
        h += '<div style="font-size:11px;color:#92400E;font-style:italic;margin-top:4px;padding-left:8px;background-color:#FFF9F0;padding:4px 8px;border-radius:4px;">Note: ' + esc(note) + '</div>';
      }
      h += '</div>';
    });

    h += '</div></div>';
  });
  h += '</div>';

  // Notes
  if (insp.notes) {
    h += '<div style="margin:0 24px 20px;background-color:#F0F4F5;border-radius:10px;padding:16px 18px;">';
    h += '<div style="font-size:12px;font-weight:700;color:#1B8A8C;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Notes &amp; Observations</div>';
    h += '<div style="font-size:13px;color:#333333;line-height:1.6;white-space:pre-wrap;">' + esc(insp.notes) + '</div>';
    h += '</div>';
  }

  // Photo notice
  if (pc > 0) {
    h += '<div style="margin:0 24px 20px;background-color:#E0F5F5;border:1px solid #1B8A8C44;border-radius:10px;padding:14px 18px;text-align:center;">';
    h += '<div style="font-size:12px;font-weight:600;color:#0B2545;">\u{1F4F7} ' + pc + ' photos captured during this inspection</div>';
    h += '<div style="font-size:11px;color:#666666;margin-top:4px;">Full photo documentation is available in the PDF report</div>';
    h += '</div>';
  }

  // Footer
  h += '<div style="background-color:#0B2545;padding:20px 32px;text-align:center;border-top:3px solid #1B8A8C;">';
  h += '<div style="font-size:14px;font-weight:700;color:#ffffff;">First Coast Property Care LLC</div>';
  h += '<div style="font-size:11px;color:#A8DCD9;margin-top:4px;">Jacksonville &amp; St. Augustine, FL</div>';
  h += '<div style="font-size:11px;color:#A8DCD9;margin-top:2px;">(904) 754-3614 | firstcoastpropertycare@gmail.com</div>';
  h += '<div style="font-size:10px;color:#A8DCD9;font-style:italic;margin-top:8px;">"We Handle the Small Things Before They Become Big Problems."</div>';
  h += '</div>';

  h += '</div></div>';

  return h;
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