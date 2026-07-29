// Prakiraan cuaca darat per wilayah pelabuhan — Data Terbuka BMKG.
// Sumber: https://data.bmkg.go.id/prakiraan-cuaca/ (wajib mencantumkan BMKG).
const ENDPOINT = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';

// adm2 = kode kabupaten/kota (Kepmendagri 100.1.1-6117/2022). kec = penyaring opsional
// agar titik prakiraan yang dipilih sedekat mungkin dengan lokasi pelabuhan.
// Kode wilayah mengikuti Kepmendagri 100.1.1-6117/2022 (dipakai BMKG),
// BUKAN kode BPS — keduanya berbeda untuk beberapa kabupaten Sulsel.
// adm4 = kode kelurahan/desa (paling presisi, titik prakiraan tepat di pelabuhan).
// adm2 = kode kabupaten/kota sebagai cadangan; desa/kec = penyaring baris.
const AREAS = {
  'Perairan Makassar': { adm4: '73.71.08.1003', adm2: '73.71', label: 'Kota Makassar', kec: 'Ujung Tanah', desa: 'Pattingalloang' },
  'Perairan Barru': { adm4: '73.11.03.1003', adm2: '73.11', label: 'Kabupaten Barru', kec: 'Barru', desa: 'Sumpang Binangae' },
  'Perairan Pangkep': { adm2: '73.10', label: 'Kabupaten Pangkajene dan Kepulauan', kec: 'Labakkang' },
  'Selat Makassar bagian selatan': { adm4: '73.05.09.2004', adm2: '73.05', label: 'Kabupaten Takalar', kec: 'Galesong', desa: 'Boddia' },
  'Teluk Bone': { adm4: '73.08.23.1001', adm2: '73.08', label: 'Kabupaten Bone', kec: 'Tanete Riattang Timur', desa: 'Bajoe' },
  'Perairan Bulukumba': { adm4: '73.02.02.1003', adm2: '73.02', label: 'Kabupaten Bulukumba', kec: 'Ujung Bulu', desa: 'Terang-Terang' },
  'Perairan Laut Jeneponto': { adm2: '73.04', label: 'Kabupaten Jeneponto', kec: 'Binamu' },
  'Perairan Bone': { adm4: '73.08.23.1001', adm2: '73.08', label: 'Kabupaten Bone', kec: 'Tanete Riattang Timur', desa: 'Bajoe' },
  'Perairan Luwu (Luwu Timur)': { adm2: '73.24', label: 'Kabupaten Luwu Timur', kec: 'Malili', desa: 'Malili' },
  'Perairan Kep. Selayar': { adm4: '73.01.01.1002', adm2: '73.01', label: 'Kabupaten Kepulauan Selayar', kec: 'Benteng', desa: 'Benteng' },
  'Pelabuhan Soekarno Hatta - Makassar': { adm4: '73.71.08.1003', adm2: '73.71', label: 'Kota Makassar', kec: 'Ujung Tanah', desa: 'Pattingalloang' },
  'Pelabuhan Garongkong - Barru': { adm2: '73.11', label: 'Kabupaten Barru', kec: 'Balusu', desa: 'Garongkong' },
  'Pelabuhan Nusantara - Pare Pare': { adm2: '73.72', label: 'Kota Pare-Pare', kec: 'Ujung', desa: 'Labukkang' },
  'Pelabuhan Bajoe - Bone': { adm4: '73.08.23.1001', adm2: '73.08', label: 'Kabupaten Bone', kec: 'Tanete Riattang Timur', desa: 'Bajoe' },
  'Pelabuhan Bira - Bulukumba': { adm2: '73.02', label: 'Kabupaten Bulukumba', kec: 'Bonto Bahari', desa: 'Bira' },
  'Pelabuhan Pamatata - Selayar': { adm2: '73.01', label: 'Kabupaten Kepulauan Selayar', kec: 'Bontomatene', desa: 'Pamatata' },
  'Pelabuhan Maccini Baji - Pangkep': { adm2: '73.10', label: 'Kabupaten Pangkajene dan Kepulauan', kec: 'Labakkang', desa: 'Maccini Baji' },
};

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function ask(params) {
  const url = ENDPOINT + '?' + params;
  const response = await fetch(url, { headers: { 'User-Agent': 'Portal-Maritim-Sulsel/1.0' } });
  if (!response.ok) throw new Error('BMKG ' + response.status);
  const json = await response.json();
  const rows = json && Array.isArray(json.data) ? json.data : [];
  if (!rows.length) throw new Error('Data prakiraan kosong.');
  return rows;
}

function cocok(rows, field, value) {
  if (!value) return null;
  const want = normalize(value);
  return rows.find((row) => normalize(row && row.lokasi && row.lokasi[field]) === want)
    || rows.find((row) => normalize(row && row.lokasi && row.lokasi[field]).indexOf(want) !== -1)
    || null;
}

// Urutan penyaring: desa/kelurahan dulu (paling dekat pelabuhan), lalu kecamatan.
function pickRow(rows, kecamatan, desa) {
  if (!rows.length) return null;
  return cocok(rows, 'desa', desa) || cocok(rows, 'kecamatan', kecamatan) || rows[0];
}

function flatten(row) {
  const groups = Array.isArray(row.cuaca) ? row.cuaca : [];
  const out = [];
  groups.forEach((group) => {
    (Array.isArray(group) ? group : []).forEach((slot) => {
      if (!slot) return;
      out.push({
        time: slot.local_datetime || slot.datetime || null,
        utc: slot.utc_datetime || null,
        weather: slot.weather_desc || null,
        temperature: typeof slot.t === 'number' ? slot.t : null,
        humidity: typeof slot.hu === 'number' ? slot.hu : null,
        windSpeed: typeof slot.ws === 'number' ? slot.ws : null,
        windFrom: slot.wd || null,
        visibility: slot.vs_text || null,
      });
    });
  });
  return out;
}

function groupByDay(slots) {
  const days = [];
  const index = {};
  slots.forEach((slot) => {
    const key = String(slot.time || '').slice(0, 10);
    if (!key) return;
    if (!index[key]) {
      index[key] = { date: key, slots: [] };
      days.push(index[key]);
    }
    index[key].slots.push(slot);
  });
  return days.slice(0, 3);
}

module.exports = async (req, res) => {
  const query = req.query || {};
  const location = query.location || 'Perairan Makassar';
  const area = AREAS[location];
  const adm4 = query.adm4 || (area && area.adm4) || null;
  const adm2 = query.adm2 || (area && area.adm2) || null;
  if (!adm4 && !adm2) return res.status(400).json({ error: 'Lokasi tidak didukung.' });

  try {
    let rows = null;
    if (adm4) {
      try {
        rows = await ask('adm4=' + encodeURIComponent(adm4));
      } catch (ignored) {
        rows = null;
      }
    }
    if (!rows && adm2) rows = await ask('adm2=' + encodeURIComponent(adm2));
    if (!rows) throw new Error('Tidak ada data.');

    const row = pickRow(rows, query.kecamatan || (area && area.kec), query.desa || (area && area.desa));
    const place = (row && row.lokasi) || {};
    const days = groupByDay(flatten(row || {}));
    if (!days.length) throw new Error('Format prakiraan berubah.');

    res.setHeader('Cache-Control', 'public, s-maxage=1800, max-age=900');
    return res.status(200).json({
      location,
      area: (area && area.label) || place.kotkab || null,
      place: {
        desa: place.desa || null,
        kecamatan: place.kecamatan || null,
        kotkab: place.kotkab || null,
        provinsi: place.provinsi || 'Sulawesi Selatan',
        lat: place.lat != null ? place.lat : null,
        lon: place.lon != null ? place.lon : null,
      },
      presisi: adm4 ? 'kelurahan' : 'kabupaten',
      fetchedAt: new Date().toISOString(),
      source: 'BMKG — Data Prakiraan Cuaca Terbuka',
      sourceUrl: 'https://data.bmkg.go.id/prakiraan-cuaca/',
      days,
    });
  } catch (error) {
    return res.status(502).json({ error: 'Prakiraan cuaca BMKG sementara belum dapat diambil.' });
  }
};
