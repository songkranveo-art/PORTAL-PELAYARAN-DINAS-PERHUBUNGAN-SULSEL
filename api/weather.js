const SOURCES = {
  'Perairan Makassar': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-makassar',
  'Perairan Barru': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-barru',
  'Perairan Pangkep': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-pangkep',
  'Selat Makassar bagian selatan': 'https://maritim.bmkg.go.id/cuaca/perairan/selat-makassar-bagian-selatan',
  'Teluk Bone': 'https://maritim.bmkg.go.id/cuaca/perairan/teluk-bone',
  'Perairan Bulukumba': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-bulukumba',
  'Perairan Laut Jeneponto': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-jeneponto',
  'Perairan Bone': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-bone',
  'Perairan Luwu (Luwu Timur)': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-luwu',
  'Perairan Kep. Selayar': 'https://maritim.bmkg.go.id/cuaca/perairan/perairan-kep-selayar',
  'Pelabuhan Soekarno Hatta - Makassar': 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-soekarno-hatta-makassar',
  'Pelabuhan Garongkong - Barru': 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-garongkong-barru',
  'Pelabuhan Nusantara - Pare Pare': 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-nusantara-pare-pare',
  'Pelabuhan Bajoe - Bone': 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-bajoe-bone',
  'Pelabuhan Bira - Bulukumba': 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-bira-bulukumba',
  'Pelabuhan Pamatata - Selayar': 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-pamatata-selayar',
  'Pelabuhan Maccini Baji - Pangkep': 'https://maritim.bmkg.go.id/cuaca/pelabuhan/pelabuhan-maccini-baji-pangkajene-kepulauan',
};

function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function category(meters) {
  if (meters > 6) return 'EKSTREM';
  if (meters >= 4) return 'SANGAT TINGGI';
  if (meters >= 2.5) return 'TINGGI';
  if (meters >= 1.25) return 'SEDANG';
  if (meters >= 0.5) return 'RENDAH';
  return 'TENANG';
}

function statusFor(meters) {
  if (meters >= 2.5) return { label: 'TUNDA', tone: 'red', note: 'Gelombang tinggi — periksa arahan otoritas.' };
  if (meters >= 1.25) return { label: 'WASPADA', tone: 'amber', note: 'Gelombang sedang — pantau pembaruan BMKG.' };
  return { label: 'AMAN', tone: 'green', note: 'Kondisi rendah/tenang — tetap pantau pembaruan.' };
}

module.exports = async (req, res) => {
  const location = req.query?.location || 'Perairan Makassar';
  const sourceUrl = SOURCES[location];
  if (!sourceUrl) return res.status(400).json({ error: 'Lokasi tidak didukung.' });

  try {
    const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'Portal-Cuaca-Sulsel/1.0' } });
    if (!response.ok) throw new Error(`BMKG returned ${response.status}`);
    const text = cleanHtml(await response.text());
    const waveMatch = text.match(/Gelombang\s+([0-9]+(?:[.,][0-9]+)?)\s*m\s*(Tenang|Rendah|Sedang|Tinggi|Sangat Tinggi|Ekstrem)?/i);
    const windMatch = text.match(/Angin dari\s+([A-Za-z ]+?)\s+([0-9]+)\s*kt/i);
    const weatherMatch = text.match(/\b(Cerah Berawan|Berawan Tebal|Hujan Ringan|Hujan Sedang|Hujan Lebat|Cerah|Berawan|Petir)\b/i);
    const tempMatch = text.match(/([0-9]{2})\s*°C\s*([0-9]{2,3})%\s*RH/i);
    const periodMatch = text.match(/Periode Valid:\s*(.{0,120}?)(?:Download PDF|Suhu & Kelembaban|Angin dari)/i);
    const gustMatch = text.match(/Hembusan:\s*([0-9]+)\s*kt/i);
    const currentMatch = text.match(/Arus ke\s+([A-Za-z ]+?)\s+([0-9]+(?:[.,][0-9]+)?)\s*Knots/i);
    const warningMatch = text.match(/Terdapat potensi[\s\S]*?(?:otoritas setempat|arahan dari[^.]*)\./i);

    if (!waveMatch || !windMatch) throw new Error('Format data BMKG berubah atau data belum tersedia.');
    const waveMeters = Number(waveMatch[1].replace(',', '.'));
    const status = statusFor(waveMeters);
    res.setHeader('Cache-Control', 'public, s-maxage=900, max-age=300');
    return res.status(200).json({
      location, sourceUrl, fetchedAt: new Date().toISOString(),
      wave: { meters: waveMeters, category: waveMatch[2]?.toUpperCase() || category(waveMeters) },
      wind: { direction: windMatch[1].trim(), knots: Number(windMatch[2]) },
      weather: weatherMatch?.[1] || 'Lihat sumber BMKG',
      temperature: tempMatch ? Number(tempMatch[1]) : null,
      humidity: tempMatch ? Number(tempMatch[2]) : null,
      period: periodMatch?.[1]?.trim() || null,
      gust: gustMatch ? Number(gustMatch[1]) : null,
      current: currentMatch ? { direction: currentMatch[1].trim(), knots: Number(currentMatch[2].replace(',', '.')) } : null,
      warning: warningMatch ? warningMatch[0].replace(/\s+/g, ' ').trim() : null,
      status,
    });
  } catch (error) {
    return res.status(502).json({ error: 'Data BMKG sementara belum dapat diperbarui.' });
  }
};
