// Gempa bumi — Data Terbuka BMKG (wajib mencantumkan BMKG sebagai sumber).
// Sumber: https://data.bmkg.go.id/gempabumi/
const BASE = 'https://data.bmkg.go.id/DataMKG/TEWS/';
const FEEDS = {
  terbaru: 'autogempa.json',
  besar: 'gempaterkini.json',
  dirasakan: 'gempadirasakan.json',
};

// Kotak wilayah Sulawesi Selatan + Selat Makassar + Teluk Bone + Laut Flores utara.
const SULSEL_BOX = { latMin: -8.5, latMax: -1.0, lonMin: 116.0, lonMax: 124.5 };
const SULSEL_WORDS = /(sulawesi selatan|sulsel|makassar|selat makassar|teluk bone|bone|bulukumba|selayar|jeneponto|bantaeng|takalar|gowa|maros|pangkajene|pangkep|barru|pare-?pare|pinrang|sinjai|soppeng|wajo|luwu|palopo|enrekang|tana toraja|toraja|sidenreng|rappang|majene|mamuju|flores)/i;

function num(value) {
  const n = Number(String(value == null ? '' : value).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseCoordinates(item) {
  const raw = item.Coordinates || item.coordinates || '';
  const parts = String(raw).split(',');
  let lat = num(parts[0]);
  let lon = num(parts[1]);
  if (lat == null && item.Lintang) {
    lat = num(item.Lintang);
    if (/LS/i.test(item.Lintang) && lat != null) lat = -Math.abs(lat);
  }
  if (lon == null && item.Bujur) {
    lon = num(item.Bujur);
    if (/BB/i.test(item.Bujur) && lon != null) lon = -Math.abs(lon);
  }
  return { lat, lon };
}

function nearSulsel(lat, lon, wilayah) {
  if (lat != null && lon != null) {
    if (lat >= SULSEL_BOX.latMin && lat <= SULSEL_BOX.latMax && lon >= SULSEL_BOX.lonMin && lon <= SULSEL_BOX.lonMax) return true;
  }
  return SULSEL_WORDS.test(String(wilayah || ''));
}

function shape(item, kind) {
  const { lat, lon } = parseCoordinates(item);
  const magnitude = num(item.Magnitude);
  const depthKm = num(item.Kedalaman);
  const wilayah = item.Wilayah || '';
  const shakemap = item.Shakemap ? BASE + item.Shakemap : null;
  return {
    kind,
    dateTime: item.DateTime || null,
    date: item.Tanggal || null,
    time: item.Jam || null,
    magnitude,
    depth: item.Kedalaman || null,
    depthKm,
    latitude: lat,
    longitude: lon,
    region: wilayah,
    potential: item.Potensi || null,
    felt: item.Dirasakan || null,
    shakemap,
    sulsel: nearSulsel(lat, lon, wilayah),
  };
}

async function grab(file) {
  const response = await fetch(BASE + file, { headers: { 'User-Agent': 'Portal-Maritim-Sulsel/1.0' } });
  if (!response.ok) throw new Error('BMKG ' + response.status);
  const json = await response.json();
  const box = json && json.Infogempa ? json.Infogempa.gempa : null;
  if (!box) return [];
  return Array.isArray(box) ? box : [box];
}

function severity(quake) {
  const m = quake.magnitude || 0;
  const tsunami = /berpotensi tsunami/i.test(quake.potential || '');
  if (tsunami) return { level: 'bahaya', tone: 'red', note: 'Berpotensi tsunami — ikuti arahan BMKG dan BPBD.' };
  if (m >= 5) return { level: 'waspada', tone: 'amber', note: 'Gempa kuat — waspadai gempa susulan di wilayah pesisir.' };
  if (m >= 3.5) return { level: 'perhatian', tone: 'amber', note: 'Gempa dirasakan — pantau informasi resmi BMKG.' };
  return { level: 'aman', tone: 'green', note: 'Tidak ada potensi tsunami dari kejadian ini.' };
}

module.exports = async (req, res) => {
  try {
    const settled = await Promise.allSettled([grab(FEEDS.terbaru), grab(FEEDS.besar), grab(FEEDS.dirasakan)]);
    const [terbaru, besar, dirasakan] = settled.map((s) => (s.status === 'fulfilled' ? s.value : []));
    if (!terbaru.length && !besar.length && !dirasakan.length) throw new Error('Semua umpan BMKG kosong.');

    const latest = terbaru.length ? shape(terbaru[0], 'terbaru') : null;
    const seen = new Set();
    const all = []
      .concat(besar.map((q) => shape(q, 'besar')), dirasakan.map((q) => shape(q, 'dirasakan')))
      .filter((q) => {
        const key = (q.dateTime || '') + '|' + (q.region || '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0));

    const sulsel = all.filter((q) => q.sulsel).slice(0, 5);
    const alert = [latest].concat(sulsel).find((q) => {
      if (!q || !q.sulsel || !q.dateTime) return false;
      const ageHours = (Date.now() - new Date(q.dateTime).getTime()) / 36e5;
      return ageHours <= 24 && ((q.magnitude || 0) >= 3.5 || /berpotensi tsunami/i.test(q.potential || ''));
    }) || null;

    res.setHeader('Cache-Control', 'public, s-maxage=120, max-age=60');
    return res.status(200).json({
      fetchedAt: new Date().toISOString(),
      source: 'BMKG — Data Gempabumi Terbuka',
      sourceUrl: 'https://data.bmkg.go.id/gempabumi/',
      latest,
      sulsel,
      alert: alert ? Object.assign({}, alert, { severity: severity(alert) }) : null,
    });
  } catch (error) {
    return res.status(502).json({ error: 'Data gempa BMKG sementara belum dapat diambil.' });
  }
};
