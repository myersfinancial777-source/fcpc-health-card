export function compressImage(file, maxW = 800, quality = 0.7) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxW) { h = (maxW / w) * h; w = maxW; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function getCompInfo(insp) {
  const t = Object.keys(insp.statuses).length;
  const d = Object.values(insp.statuses).filter(v => v != null).length;
  return { done: d, total: t, pct: t > 0 ? Math.round((d / t) * 100) : 0 };
}

export function getCounts(insp) {
  const c = { good: 0, fair: 0, attention: 0, na: 0 };
  Object.values(insp.statuses).forEach(v => { if (v && c[v] !== undefined) c[v]++; });
  return c;
}

export function getTotalPhotos(insp) {
  if (!insp.photos) return 0;
  return Object.values(insp.photos).reduce((s, a) => s + (a?.length || 0), 0);
}

export function createBlankInspection() {
  const statuses = {}, photos = {}, itemNotes = {};
  const { SECTIONS } = require('./constants.js');
  SECTIONS.forEach(s => s.items.forEach(i => {
    statuses[i] = null; photos[i] = []; itemNotes[i] = '';
  }));
  return {
    id: genId(), propertyAddress: '', unitSuite: '', ownerManager: '',
    planTier: '', date: todayStr(), statuses, photos, itemNotes,
    notes: '', overallRating: '', createdAt: new Date().toISOString(),
  };
}
