const levelsInput = document.getElementById('levels');
const originInput = document.getElementById('origin');
const sortSelect = document.getElementById('sort');
const loadBtn = document.getElementById('loadBtn');
const scanBtn = document.getElementById('scanBtn');
const meta = document.getElementById('meta');
const body = document.getElementById('resultBody');

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setMeta(message) {
  meta.textContent = message;
}

function renderMatches(matches) {
  body.innerHTML = '';
  if (!matches.length) {
    body.innerHTML = '<tr><td colspan="7">Keine Treffer.</td></tr>';
    return;
  }

  body.innerHTML = matches
    .map((m) => {
      const discipline = m.discipline || '';
      // normalize level to a single digit if possible
      let lvl = '-';
      const lv = String(m.level || '');
      const mm = lv.match(/([1-5])/);
      if (mm) lvl = mm[1];

      const veranstaltung = (m.name && m.name !== 'Unbekannt') ? m.name : '';
      const ort = m.location || '';
      const datum = m.dateLabel || m.dateIso || '';
      const rawAus = String(m.auslastung || '').trim();
      let auslastungDisplay = '-';
      if (!rawAus) {
        auslastungDisplay = '-';
      } else {
        const p = rawAus.match(/(\d{1,3})\s*%/);
        if (p) {
          auslastungDisplay = `${p[1]}%`;
        } else if (/neu/i.test(rawAus)) {
          auslastungDisplay = 'Neu!';
        } else if (/\d{4}/.test(rawAus) || /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(rawAus)) {
          auslastungDisplay = rawAus;
        } else {
          const p2 = rawAus.match(/(\d{1,3})%/);
          if (p2) auslastungDisplay = `${p2[1]}%`;
          else auslastungDisplay = rawAus.length > 25 ? rawAus.slice(0, 25) + '…' : rawAus;
        }
      }

      const entfernung = m.distanceKm == null ? '-' : esc(m.distanceKm);

      // auslastung class
      let ausClass = 'auslastung-muted';
      const pct = (auslastungDisplay.match(/(\d{1,3})%/) || [])[1];
      if (pct) {
        const v = Number(pct);
        if (v > 100) ausClass = 'auslastung-red';
        else if (v >= 80) ausClass = 'auslastung-yellow';
        else ausClass = 'auslastung-green';
      } else if (auslastungDisplay === 'Neu!') {
        ausClass = 'auslastung-new';
      } else if (auslastungDisplay === '-' || /announc/i.test(String(rawAus))) {
        ausClass = 'auslastung-muted';
      }

      // event link if available (include small external icon)
      const titleText = esc(veranstaltung || ort || datum);
      const linkHtml = m.url
        ? `<a class="match-link" href="${esc(m.url)}" target="_blank" rel="noopener">${titleText}<span class="ext-icon">↗</span></a>`
        : titleText;

      return `<tr>
          <td>${esc(discipline)}</td>
          <td>${esc(lvl)}</td>
          <td>${linkHtml}</td>
          <td>${esc(ort)}</td>
          <td>${esc(datum)}</td>
          <td class="${ausClass}">${esc(auslastungDisplay)}</td>
          <td>${entfernung}</td>
        </tr>`;
    })
    .join('');
}

async function loadMatches() {
  const params = new URLSearchParams();
  if (levelsInput.value.trim()) params.set('level', levelsInput.value.trim());
  if (originInput.value.trim()) {
    // treat origin input as postal code if it looks like 5 digits, else send as free-text origin
    const val = originInput.value.trim();
    if (/^\d{5}$/.test(val)) params.set('originPlz', val);
    else params.set('origin', val);
  }
  params.set('sort', sortSelect.value);

  setMeta('Lade Treffer ...');

  const res = await fetch(`/api/matches?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Abruf fehlgeschlagen');
  }

  renderMatches(data.matches || []);

  const pieces = [];
  pieces.push(`Treffer: ${data.total ?? 0}`);
  if (data.lastScan) pieces.push(`Letzter Scan: ${new Date(data.lastScan).toLocaleString()}`);
  if (data.origin?.resolved) pieces.push(`Ort: ${data.origin.resolved}`);
  setMeta(pieces.join(' | '));
}

async function triggerScan() {
  setMeta('Scanne ipscmatch.de ...');
  const res = await fetch('/api/scan', { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Scan fehlgeschlagen');
  }
  await loadMatches();
}

loadBtn.addEventListener('click', async () => {
  try {
    await loadMatches();
  } catch (error) {
    setMeta(`Fehler: ${error.message}`);
  }
});

scanBtn.addEventListener('click', async () => {
  try {
    await triggerScan();
  } catch (error) {
    setMeta(`Fehler: ${error.message}`);
  }
});

loadMatches().catch((error) => setMeta(`Fehler: ${error.message}`));
