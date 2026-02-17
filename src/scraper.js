const cheerio = require('cheerio');

function text(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseGermanDate(value) {
  if (!value) return null;
  const m = value.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return null;

  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  let year = m[3];
  if (year.length === 2) year = `20${year}`;

  return `${year}-${month}-${day}`;
}

function inferLevelFromText(...parts) {
  const combined = parts.join(' ').toUpperCase();
  const m =
    combined.match(/\bLEVEL\s*([1-5])\b/) ||
    combined.match(/\bL\s*([1-5])\b/) ||
    combined.match(/\b([1-5])\b/);
  return m ? `Level ${m[1]}` : 'Unbekannt';
}

function normalizeLocation(...parts) {
  const combined = text(parts.join(' | '));
  return combined || 'Unbekannt';
}

function normalizeName(...parts) {
  const combined = text(parts.join(' - '));
  return combined || 'Ohne Titel';
}

function uniqueByKey(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function parseFromTables($, baseUrl) {
  const rows = [];

  $('table').each((_, table) => {
    const $table = $(table);
    // try to locate the header row (contains known column names)
    const headerRow = $table
      .find('tr')
      .filter((__, r) => {
        const txt = $(r)
          .find('th, td')
          .map((__, c) => text($(c).text()).toLowerCase())
          .get()
          .join(' ');
        return /disziplin|veranstalt|datum|auslastung|ort/i.test(txt);
      })
      .first();
    if (!headerRow || headerRow.length === 0) return;

    const headerCells = headerRow
      .find('th, td')
      .map((__, cell) => text($(cell).text()).toLowerCase())
      .get();

    if (!headerCells || headerCells.length === 0) return;

    const idx = {
      disziplin: headerCells.findIndex((h) => /disziplin|discipline/i.test(h)),
      lv: headerCells.findIndex((h) => /lv\.?|lv\b|level/i.test(h)),
      veranstaltung: headerCells.findIndex((h) => /veranstaltung|veranstal|veranstalt/i.test(h)),
      ort: headerCells.findIndex((h) => /ort|location|venue/i.test(h)),
      datum: headerCells.findIndex((h) => /datum|date/i.test(h)),
      auslastung: headerCells.findIndex((h) => /auslastung|capacity|fill/i.test(h)),
    };

    $table.find('tr').slice(1).each((_, tr) => {
      const cells = $(tr)
        .find('td, th')
        .map((__, cell) => text($(cell).text()))
        .get();

      if (!cells || cells.length < 2) return;

      let discipline = idx.disziplin >= 0 ? cells[idx.disziplin] : '';
      let level = idx.lv >= 0 ? inferLevelFromText(cells[idx.lv]) : inferLevelFromText(cells.join(' '));
      let name = idx.veranstaltung >= 0 ? normalizeName(cells[idx.veranstaltung]) : normalizeName(cells[1]);
      let location = idx.ort >= 0 ? normalizeLocation(cells[idx.ort]) : normalizeLocation(cells.slice(2).join(' '));
      let dateLabel = idx.datum >= 0 ? cells[idx.datum] : cells.find((c) => /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(c)) || '';
      let dateIso = parseGermanDate(dateLabel) || parseGermanDate(cells.join(' '));
      let auslastung = idx.auslastung >= 0 ? cells[idx.auslastung] : '';

      // Fallback: many ipscmatch tables use the column order
      // Disziplin | Lv. | Reg. | Veranstaltung | Ort | Datum | Status | Auslastung
      // If header mapping failed, try this positional fallback when the first cell looks like a discipline code.
      const disciplinePattern = /^(HG|PCC|MR|SG|RF|KK|\.22LR|Long Range|RF and PCC|HG, PCC|SG, RF)/i;
      if (!discipline && cells[0] && disciplinePattern.test(cells[0])) {
        discipline = cells[0];
        level = inferLevelFromText(cells[1]);
        name = normalizeName(cells[3] || cells[2] || '');
        location = normalizeLocation(cells[4] || cells[3] || '');
        dateLabel = cells[5] || dateLabel;
        dateIso = parseGermanDate(dateLabel) || dateIso;
        auslastung = cells[7] || cells[6] || auslastung || '';
      }

      if (!dateIso) return;

      // try to capture a link from the Veranstaltung cell first,
      // then prefer anchors containing `match=` and finally any anchor.
      let href = null;
      let rawHref = null;

      if (idx.veranstaltung >= 0) {
        const cell = $(tr).find('td, th').eq(idx.veranstaltung);
        const aInCell = cell.find('a[href]').first();
        if (aInCell && aInCell.attr('href')) rawHref = aInCell.attr('href');
      }

      if (!rawHref) {
        const matchAnchor = $(tr)
          .find('a[href]')
          .filter((__, el) => (String($(el).attr('href') || '').includes('match=')))
          .first();
        if (matchAnchor && matchAnchor.attr('href')) rawHref = matchAnchor.attr('href');
      }

      if (!rawHref) {
        const firstA = $(tr).find('a[href]').first();
        if (firstA && firstA.attr('href')) rawHref = firstA.attr('href');
      }

      if (rawHref) {
        try {
          href = new URL(rawHref, baseUrl).toString();
        } catch (e) {
          href = rawHref;
        }
      }

      rows.push({
        id: `${dateIso}:${name}:${location}`,
        source: 'table',
        discipline: discipline || '',
        dateIso,
        dateLabel: dateLabel || '',
        name,
        level,
        location: location || 'Unbekannt',
        auslastung: auslastung || '',
        url: href,
      });
    });
  });

  return rows;
}

function parseFromCards($, baseUrl) {
  const cards = [];
  const selectors = ['article', '.event', '.match', '.calendar-item', '.card'];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const root = $(el);
      const wholeText = text(root.text());
      const dateIso = parseGermanDate(wholeText);
      if (!dateIso) return;

      const title =
        text(root.find('h1, h2, h3, h4, .title').first().text()) || wholeText.split('|')[0];
      const level = inferLevelFromText(wholeText, title);
      const location =
        text(root.find('.location, .ort, .venue').first().text()) ||
        text(wholeText.match(/(?:Ort|Location)\s*:?\s*([^|\n]+)/i)?.[1]);

      let href = root.find('a[href]').first().attr('href') || null;
      if (href && baseUrl) {
        try {
          href = new URL(href, baseUrl).toString();
        } catch (e) {
          // keep raw href
        }
      }

      cards.push({
        id: `${dateIso}:${title}:${location}`,
        source: selector,
        dateIso,
        dateLabel: wholeText.match(/\d{1,2}\.\d{1,2}\.\d{2,4}/)?.[0] || dateIso,
        name: normalizeName(title),
        level,
        location: location || 'Unbekannt',
        url: href,
      });
    });
  });

  return cards;
}

async function scrapeMatches(scanUrl, userAgent) {
  const res = await fetch(scanUrl, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) {
    throw new Error(`Konnte ${scanUrl} nicht laden: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const byTable = parseFromTables($, scanUrl);
  const byCards = parseFromCards($, scanUrl);

  const items = uniqueByKey([...byTable, ...byCards], (item) => item.id).map((item) => ({
    ...item,
    scrapedAt: new Date().toISOString(),
  }));

  return items;
}

module.exports = {
  scrapeMatches,
};
