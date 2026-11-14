/**
 * ARC Lab Dashboard – Google Apps Script web app
 * Reads the ARC-LAB sheet (and each machine's linked sheet) and serves a private dashboard.
 * Deploy as: Execute as "Me", Who has access "Only myself".
 */

const ARC_ID = '1u6DMDzM4Eo1PhQVgsTo8Pn0CEsAwHfprqXgc8gu6GKw';
const TAB = 'ARC';
const LOG_START = 48;            // first row of usage log data (header is row 47)
const OLD_NAMES = { 'A1 3D PRINTER (E-YANTRA)': 'E-YANTRA A1' };

// Card title cells (row, col) – value column is col + 1
const CARDS = [
  [6, 3], [6, 6], [6, 9], [6, 12], [6, 15],
  [16, 3], [16, 6], [16, 9], [16, 12], [16, 15],
  [26, 3], [26, 6], [26, 9], [26, 12], [26, 15]
];

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('ARC Lab Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- helpers ----------
const key = s => String(s || '').toUpperCase().replace(/3D/g, '').replace(/[^A-Z0-9]/g, '');
const tz = () => Session.getScriptTimeZone();
const nice = s => String(s).trim().split(/\s+/).map(w => w.split('-').map(p =>
  /\d/.test(p) || ['VMC', 'CNC', 'FPV'].includes(p.toUpperCase()) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
).join('-')).join(' ');
const fmt = d => d ? Utilities.formatDate(d, tz(), 'dd/MM/yyyy') : '';

/** Log dates are typed DD/MM/YYYY. Sheets parses some as M/D dates (swapped) and leaves others as text. */
function realDate(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getDate() - 1, v.getMonth() + 1);
  const m = String(v || '').trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

function status(idle, statusText, hasSummary) {
  const s = String(statusText || '').toLowerCase();
  if (s.includes('not w')) return 'red';
  if (!hasSummary && s.includes('outdated')) return 'red';
  if (idle === null || idle === '') return 'green';
  if (idle >= 14) return 'orange';
  if (idle >= 7) return 'blue';
  return 'green';
}

function readLog(sh) {
  const last = sh.getLastRow();
  if (last < LOG_START) return [];
  return sh.getRange(LOG_START, 1, last - LOG_START + 1, 11).getValues()
    .filter(r => r[0] !== '' && r[4] !== '')
    .map(r => {
      let a = String(r[4]).trim().toUpperCase();
      a = OLD_NAMES[a] || a;
      return { date: realDate(r[0]), name: String(r[1]).trim(), asset: a, purpose: String(r[5]).trim(),
               min: Number(r[7]) || 0, rev: Number(r[8]) || 0, tech: String(r[9]).trim(), stu: Number(r[10]) || 0 };
    });
}

function readCards(sh) {
  const out = [];
  CARDS.forEach(([r, c]) => {
    const t = sh.getRange(r, c);
    const title = String(t.getValue()).trim();
    if (!title) return;
    const v = sh.getRange(r - 2, c + 1, 9, 1).getDisplayValues().map(x => x[0]);
    let link = '';
    try { link = t.getRichTextValue().getLinkUrl() || ''; } catch (e) {}
    out.push({ title, purchase: v[0], cost: v[1], student: v[3], phone: v[4], vendor: v[5], vendorNo: v[6],
               statusText: v[7], service: v[8], link });
  });
  return out;
}

// ---------- API for the page ----------
function getDashboard() {
  const sh = SpreadsheetApp.openById(ARC_ID).getSheetByName(TAB);
  const sum = sh.getRange('W5:AC14').getValues();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const log = readLog(sh);
  const cards = readCards(sh);

  const machines = cards.map(cd => {
    const row = sum.find(s => key(s[0]) === key(cd.title));
    const k = row ? String(row[0]).toUpperCase() : null;
    // last used & idle from log (falls back to summary columns)
    let last = null;
    if (k) log.forEach(e => { if (e.asset === k && e.date && e.date <= today && (!last || e.date > last)) last = e.date; });
    const idle = last ? Math.round((today - last) / 86400000) : null;
    return {
      id: key(cd.title), title: nice(row ? row[0] : cd.title),
      minutes: row ? Number(row[1]) || 0 : 0, revenue: row ? Number(row[2]) || 0 : 0, students: row ? Number(row[3]) || 0 : 0,
      lastUsed: fmt(last), idle, status: status(idle, cd.statusText, !!row), statusText: cd.statusText, vendor: cd.vendor
    };
  });
  return { updated: Utilities.formatDate(new Date(), tz(), 'dd/MM/yyyy HH:mm'), machines };
}

function getMachine(id) {
  const sh = SpreadsheetApp.openById(ARC_ID).getSheetByName(TAB);
  const dash = getDashboard();
  const m = dash.machines.find(x => x.id === id);
  if (!m) throw new Error('Machine not found');
  const card = readCards(sh).find(c => key(c.title) === id);
  const loc = sh.getRange('T12').getDisplayValue();

  // usage log for this machine
  const sum = sh.getRange('W5:W14').getValues().map(r => String(r[0]).toUpperCase());
  const k = sum.find(s => key(s) === id);
  const log = k ? readLog(sh).filter(e => e.asset === k) : [];
  const recent = log.filter(e => e.date).sort((a, b) => b.date - a.date).slice(0, 10)
    .map(e => ({ date: fmt(e.date), name: e.name, purpose: e.purpose, min: e.min, tech: e.tech, stu: e.stu }));

  // monthly hours, last 12 months
  const now = new Date(), months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: Utilities.formatDate(d, tz(), 'MMM'), y: d.getFullYear(), m: d.getMonth(), min: 0 });
  }
  log.forEach(e => { if (!e.date) return; const b = months.find(x => x.y === e.date.getFullYear() && x.m === e.date.getMonth()); if (b) b.min += e.min; });

  // machine's own sheet: details + maintenance
  let details = null, maint = [], sheetErr = '';
  if (card && card.link) {
    try {
      const ms = SpreadsheetApp.openByUrl(card.link).getSheets()[0];
      const d = ms.getRange('A3:F3').getDisplayValues()[0];
      details = { company: d[1], address: d[2], purchase: d[3], spec: d[4] };
      const last = ms.getLastRow();
      if (last >= 8) maint = ms.getRange(8, 1, last - 7, 9).getDisplayValues()
        .filter(r => r.slice(1).some(x => x !== ''))
        .map(r => ({ date: r[1], problem: r[2], action: r[3], status: r[4], solved: r[5], days: r[6], service: r[7], contact: r[8] }));
    } catch (e) { sheetErr = 'Could not open machine sheet'; }
  }

  return {
    machine: m, card, location: loc, details, maint, sheetErr, recent,
    monthly: months.map(x => ({ label: x.label, hours: Math.round(x.min / 6) / 10 })),
    lastBy: recent[0] ? `${recent[0].name} – ${recent[0].purpose}` : ''
  };
}
