// src/brandPhoto.js
// Burns branding (logo, timestamp, property info) into photos at capture time
// Returns a base64 dataURL compatible with the existing photos[] storage

import logoUrl from '/logo.png?url';

// Cache the loaded logo image so we only fetch it once per session
var _cachedLogo = null;

function loadLogo() {
  if (_cachedLogo) return Promise.resolve(_cachedLogo);
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() { _cachedLogo = img; resolve(img); };
    img.onerror = function() { resolve(null); }; // graceful: no logo if it fails
    img.src = logoUrl;
  });
}

function dataUrlToImage(dataUrl) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = function(e) { reject(new Error('Failed to load image for branding')); };
    img.src = dataUrl;
  });
}

function formatTimestamp(d) {
  var date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  var time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return date + '  \u2022  ' + time;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Brands a photo with logo, timestamp, and property info.
 * @param {string} dataUrl - base64 image (output of compressImage)
 * @param {object} opts
 * @param {string} opts.propertyAddress - Address shown on bottom-left
 * @param {Date|string} opts.timestamp - Defaults to now
 * @returns {Promise<string>} Branded base64 JPEG dataURL
 */
export async function brandPhoto(dataUrl, opts) {
  opts = opts || {};
  var propertyAddress = opts.propertyAddress || '';
  var inspector = opts.inspector || 'First Coast Property Care';
  var timestamp = opts.timestamp ? new Date(opts.timestamp) : new Date();

  try {
    var img = await dataUrlToImage(dataUrl);
    var canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    var ctx = canvas.getContext('2d');

    // Draw the original photo
    ctx.drawImage(img, 0, 0);

    // Scale overlays based on image size (works at any resolution)
    var s = Math.min(canvas.width, canvas.height) / 1080;
    if (s < 0.5) s = 0.5; // floor for very small images
    var pad = Math.round(20 * s);
    var fontMain = Math.round(24 * s);
    var fontSub = Math.round(18 * s);

    // ── Bottom gradient bar for readability ──
    var barH = Math.round((fontMain + fontSub + pad * 2) * 1.2);
    var grad = ctx.createLinearGradient(0, canvas.height - barH * 1.4, 0, canvas.height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(11,37,69,0.85)'); // matches NAVY
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvas.height - barH * 1.4, canvas.width, barH * 1.4);

    // ── Left text: inspector + property ──
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 ' + fontMain + 'px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(inspector, pad, canvas.height - pad - fontSub - Math.round(6 * s));

    if (propertyAddress) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '500 ' + fontSub + 'px -apple-system, "Segoe UI", Roboto, sans-serif';
      // Truncate long addresses
      var maxAddrWidth = canvas.width * 0.55;
      var displayAddr = propertyAddress;
      if (ctx.measureText(displayAddr).width > maxAddrWidth) {
        while (displayAddr.length > 10 && ctx.measureText(displayAddr + '...').width > maxAddrWidth) {
          displayAddr = displayAddr.slice(0, -1);
        }
        displayAddr = displayAddr + '...';
      }
      ctx.fillText(displayAddr, pad, canvas.height - pad);
    }

    // ── Right text: timestamp ──
    var ts = formatTimestamp(timestamp);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = '600 ' + fontSub + 'px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(ts, canvas.width - pad, canvas.height - pad);

    // ── Top-left logo pill ──
    var logo = await loadLogo();
    if (logo) {
      var logoH = Math.round(56 * s);
      var logoW = Math.round(logoH * (logo.width / logo.height));
      var pillPad = Math.round(10 * s);
      var pillR = Math.round(8 * s);

      drawRoundRect(ctx, pad, pad, logoW + pillPad * 2, logoH + pillPad, pillR);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();

      ctx.drawImage(logo, pad + pillPad, pad + pillPad / 2, logoW, logoH);
    }

    return canvas.toDataURL('image/jpeg', 0.88);
  } catch (err) {
    console.warn('[brandPhoto] failed, returning unbranded:', err);
    return dataUrl; // fail-safe: return original photo unbranded
  }
}

