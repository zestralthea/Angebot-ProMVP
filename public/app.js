// State
let positionen = [{ bezeichnung: '', menge: 1, einheit: 'Std.', einzelpreis: 0 }];
let lastAngebotResult = null;

// ─── View switching ───────────────────────────────────────────────
function showView(name) {
  ['angebot', 'rechnung', 'profil'].forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== name);
    const nav = document.getElementById(`nav-${v}`);
    if (nav) nav.classList.toggle('active', v === name);
  });
}

// ─── Positionen ───────────────────────────────────────────────────
function renderPositionen() {
  const container = document.getElementById('positionen-container');
  container.innerHTML = positionen.map((p, i) => `
    <div class="pos-row">
      <input type="text" value="${escHtml(p.bezeichnung)}" placeholder="z.B. Konzept & Design"
        oninput="updatePos(${i},'bezeichnung',this.value)">
      <input type="number" value="${p.menge}" min="0.1" step="0.5"
        oninput="updatePos(${i},'menge',parseFloat(this.value)||1); updateLiveSumme()">
      <select onchange="updatePos(${i},'einheit',this.value)">
        ${['Std.','pauschal','Stück','Seite','Tag'].map(u =>
          `<option${p.einheit===u?' selected':''}>${u}</option>`).join('')}
      </select>
      <input type="number" value="${p.einzelpreis}" min="0" step="10"
        oninput="updatePos(${i},'einzelpreis',parseFloat(this.value)||0); updateLiveSumme()">
      <div class="pos-gesamt">${formatEur(p.menge * p.einzelpreis)}</div>
      <button class="btn-icon" onclick="removePosition(${i})" title="Entfernen"
        ${positionen.length===1?'disabled':''}>✕</button>
    </div>
  `).join('');
  updateLiveSumme();
}

function updatePos(i, field, value) {
  positionen[i][field] = value;
  // Update gesamt display live
  const rows = document.querySelectorAll('.pos-row');
  if (rows[i]) {
    const gesamt = rows[i].querySelector('.pos-gesamt');
    if (gesamt) gesamt.textContent = formatEur(positionen[i].menge * positionen[i].einzelpreis);
  }
}

function addPosition() {
  positionen.push({ bezeichnung: '', menge: 1, einheit: 'Std.', einzelpreis: 0 });
  renderPositionen();
}

function removePosition(i) {
  if (positionen.length === 1) return;
  positionen.splice(i, 1);
  renderPositionen();
}

// ─── Live Summe ───────────────────────────────────────────────────
function updateLiveSumme() {
  const klein = document.getElementById('fl-klein')?.checked ?? false;
  const netto = positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0);
  const ust = klein ? 0 : netto * 0.19;
  const total = netto + ust;

  const ustRow = document.getElementById('sum-ust-row');
  if (ustRow) ustRow.style.display = klein ? 'none' : 'flex';
  setText('sum-netto', formatEur(netto));
  setText('sum-ust', formatEur(ust));
  setText('sum-total', formatEur(total));
}

// ─── Read form ────────────────────────────────────────────────────
function readFreelancer() {
  return {
    name: val('fl-name'),
    firma: val('fl-firma') || undefined,
    adresse: val('fl-adresse'),
    plz: val('fl-plz'),
    ort: val('fl-ort'),
    email: val('fl-email'),
    steuernummer: val('fl-steuer') || undefined,
    ustIdNr: val('fl-ust') || undefined,
    kleinunternehmer: document.getElementById('fl-klein').checked,
    beruf: val('fl-beruf'),
    iban: val('fl-iban') || undefined,
    bic: val('fl-bic') || undefined,
  };
}

function readKunde() {
  return {
    name: val('kd-name'),
    firma: val('kd-firma') || undefined,
    adresse: val('kd-adresse'),
    plz: val('kd-plz'),
    ort: val('kd-ort'),
  };
}

function readAngebotInput() {
  return {
    freelancer: readFreelancer(),
    kunde: readKunde(),
    projekt: {
      titel: val('proj-titel'),
      beschreibung: val('proj-beschreibung'),
    },
    positionen: positionen.map(p => ({ ...p })),
    gueltigBisDatum: val('proj-gueltig') || undefined,
    bearbeitungszeit: val('proj-zeit') || undefined,
    zahlungsziel: parseInt(val('proj-zahlung')) || 14,
  };
}

// ─── Generate Angebot ─────────────────────────────────────────────
async function generateAngebot() {
  const input = readAngebotInput();
  const err = validateAngebotInput(input);
  if (err) { showError(err, 'result-area'); return; }

  const btn = document.getElementById('btn-generate');
  const lbl = document.getElementById('btn-generate-label');
  btn.disabled = true;
  lbl.innerHTML = '<span class="spinner"></span> KI schreibt deinen Text...';

  try {
    const res = await fetch('/api/angebot/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.message || 'Fehler', 'result-area'); return; }
    lastAngebotResult = data;
    renderAngebotResult(data, input);
    document.getElementById('btn-pdf').classList.remove('hidden');
    document.getElementById('btn-to-rechnung').classList.remove('hidden');
    document.getElementById('result-area').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch {
    showError('Netzwerkfehler — läuft der Server noch?', 'result-area');
  } finally {
    btn.disabled = false;
    lbl.textContent = '✨ KI-Angebot generieren';
  }
}

function renderAngebotResult(data, input) {
  const klein = input.freelancer.kleinunternehmer;
  document.getElementById('result-area').innerHTML = `
    <div class="result-box">
      <h3>✓ Angebot ${escHtml(data.angebotNummer)} generiert</h3>
      <div class="result-text">${escHtml(data.angebotText)}</div>
      <div class="summen-grid" style="margin-top:20px">
        <span>Nettosumme:</span><span><strong>${formatEur(data.nettoSumme)}</strong></span>
        ${!klein ? `<span>zzgl. ${data.ustSatz}% USt.:</span><span>${formatEur(data.ustBetrag)}</span>` : ''}
        <span class="summen-total">Gesamtbetrag:</span>
        <span class="summen-total">${formatEur(klein ? data.nettoSumme : data.bruttoSumme)}</span>
        ${klein ? '<span style="grid-column:1/-1;font-size:.8rem;color:var(--text-3)">§ 19 UStG — keine USt. ausgewiesen</span>' : ''}
      </div>
    </div>`;
}

// ─── Download Angebot PDF ─────────────────────────────────────────
async function downloadAngebotPDF() {
  const input = readAngebotInput();
  const err = validateAngebotInput(input);
  if (err) { showError(err, 'result-area'); return; }

  const btn = document.getElementById('btn-pdf');
  btn.disabled = true;
  btn.textContent = '⏳ PDF wird erstellt...';

  try {
    const res = await fetch('/api/angebot/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) { showError('PDF-Fehler', 'result-area'); return; }
    const blob = await res.blob();
    const nr = lastAngebotResult?.angebotNummer ?? 'Angebot';
    downloadBlob(blob, `Angebot_${nr}.pdf`);
  } catch {
    showError('Netzwerkfehler beim PDF-Download', 'result-area');
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ PDF herunterladen';
  }
}

// ─── Angebot → Rechnung ───────────────────────────────────────────
function angebotToRechnung() {
  showView('rechnung');
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('re-leistung').value = today;
  if (lastAngebotResult) {
    document.getElementById('re-angebot-nr').value = lastAngebotResult.angebotNummer;
  }
}

async function downloadRechnung() {
  const leistungsdatum = val('re-leistung');
  if (!leistungsdatum) { showError('Bitte Leistungsdatum angeben', 'rechnung-result-area'); return; }

  const freelancer = readFreelancer();
  if (!freelancer.name) { showError('Bitte zuerst das Angebot-Formular ausfüllen', 'rechnung-result-area'); return; }

  const body = {
    userId: freelancer.email || 'demo-user',
    freelancer,
    kunde: readKunde(),
    projekt: { titel: val('proj-titel'), beschreibung: val('proj-beschreibung') || 'Dienstleistung' },
    positionen: positionen.map(p => ({ ...p })),
    leistungsdatum,
    zahlungsziel: parseInt(val('proj-zahlung')) || 14,
    angebotNummer: val('re-angebot-nr') || undefined,
  };

  const btn = document.getElementById('btn-rechnung');
  const lbl = document.getElementById('btn-rechnung-label');
  btn.disabled = true;
  lbl.innerHTML = '<span class="spinner"></span> Rechnung wird erstellt...';

  try {
    const res = await fetch('/api/rechnung/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      showError(data.message || 'Fehler', 'rechnung-result-area'); return;
    }
    const blob = await res.blob();
    const nr = res.headers.get('X-Rechnungs-Nummer') ?? 'Rechnung';
    downloadBlob(blob, `Rechnung_${nr}.pdf`);
    document.getElementById('rechnung-result-area').innerHTML =
      `<div class="result-box"><h3>✓ Rechnung ${escHtml(nr)} erstellt</h3><p style="font-size:.9rem;color:var(--text-3)">PDF-Download gestartet.</p></div>`;
  } catch {
    showError('Netzwerkfehler', 'rechnung-result-area');
  } finally {
    btn.disabled = false;
    lbl.textContent = '🧾 Rechnung als PDF erstellen';
  }
}

// ─── Profile ──────────────────────────────────────────────────────
function saveProfile() {
  localStorage.setItem('angebotpro_profile', JSON.stringify(readFreelancer()));
  showToast('✓ Profil gespeichert!');
}

function loadProfile() {
  const raw = localStorage.getItem('angebotpro_profile');
  if (!raw) { showToast('Kein gespeichertes Profil gefunden.', true); return; }
  const p = JSON.parse(raw);
  setVal('fl-name', p.name); setVal('fl-firma', p.firma);
  setVal('fl-email', p.email); setVal('fl-adresse', p.adresse);
  setVal('fl-plz', p.plz); setVal('fl-ort', p.ort);
  setVal('fl-steuer', p.steuernummer); setVal('fl-ust', p.ustIdNr);
  setVal('fl-iban', p.iban); setVal('fl-bic', p.bic);
  setVal('fl-beruf', p.beruf);
  if (p.kleinunternehmer !== undefined) document.getElementById('fl-klein').checked = p.kleinunternehmer;
  updateLiveSumme();
}

// ─── Validation ───────────────────────────────────────────────────
function validateAngebotInput(input) {
  if (!input.freelancer.name) return 'Bitte deinen Namen eingeben (Schritt 1).';
  if (!input.freelancer.email) return 'Bitte deine E-Mail eingeben (Schritt 1).';
  if (!input.freelancer.adresse) return 'Bitte deine Adresse eingeben (Schritt 1).';
  if (!/^\d{4,5}$/.test(input.freelancer.plz)) return 'Bitte eine gültige PLZ eingeben (Schritt 1).';
  if (!input.freelancer.ort) return 'Bitte deinen Ort eingeben (Schritt 1).';
  if (!input.kunde.name) return 'Bitte Kundenname eingeben (Schritt 2).';
  if (!input.kunde.adresse) return 'Bitte Kundenadresse eingeben (Schritt 2).';
  if (!input.projekt.titel) return 'Bitte Projekttitel eingeben (Schritt 3).';
  if (input.projekt.beschreibung.length < 20) return 'Projektbeschreibung zu kurz — mind. 20 Zeichen (Schritt 3).';
  if (input.positionen.find(p => !p.bezeichnung)) return 'Bitte alle Positionsbezeichnungen ausfüllen (Schritt 4).';
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────
function val(id) { return (document.getElementById(id)?.value ?? '').trim(); }
function setVal(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatEur(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n ?? 0);
}
function showError(msg, containerId) {
  document.getElementById(containerId).innerHTML =
    `<div class="error-box">⚠ ${escHtml(msg)}</div>`;
}
function showToast(msg, warn = false) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-size:.88rem;font-weight:600;color:#fff;background:${warn?'#dc2626':'#16a34a'};box-shadow:0 4px 20px rgba(0,0,0,.2);transition:opacity .3s`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderPositionen();

  // Gültig-bis: 4 Wochen ab heute
  const gueltig = new Date();
  gueltig.setDate(gueltig.getDate() + 28);
  const el = document.getElementById('proj-gueltig');
  if (el) el.value = gueltig.toISOString().slice(0, 10);

  // Kleinunternehmer-Toggle → Live-Summe updaten
  document.getElementById('fl-klein')?.addEventListener('change', updateLiveSumme);

  // Auto-load gespeichertes Profil
  const raw = localStorage.getItem('angebotpro_profile');
  if (raw) {
    try { loadProfile(); } catch {}
  }
});
