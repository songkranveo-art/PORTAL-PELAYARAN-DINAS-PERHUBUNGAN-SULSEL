const SOURCE = 'https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SARANA_PRASARANA/MapServer/1/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson&resultRecordCount=5000';

function textValue(properties = {}) {
  return Object.values(properties).filter(v => v !== null && v !== undefined).join(' ').toUpperCase();
}
function firstProperty(properties = {}, patterns) {
  const entry = Object.entries(properties).find(([key, value]) => value && patterns.some(pattern => pattern.test(key)));
  return entry?.[1] ? String(entry[1]) : null;
}

module.exports = async (req, res) => {
  try {
    const upstream = await fetch(SOURCE, { headers: { 'User-Agent': 'Portal-Cuaca-Sulsel/1.0' } });
    if (!upstream.ok) throw new Error(`Source returned ${upstream.status}`);
    const payload = await upstream.json();
    const ports = (payload.features || [])
      .filter(feature => feature?.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates))
      .filter(feature => /SULAWESI\s+SELATAN|\bSULSEL\b/.test(textValue(feature.properties)))
      .map(feature => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const properties = feature.properties || {};
        return {
          name: firstProperty(properties, [/nama.*pelabuhan/i, /^nama$/i, /namobj/i, /name/i]) || 'Pelabuhan',
          latitude, longitude,
          district: firstProperty(properties, [/kabupaten/i, /kota/i, /wilayah/i, /kecamatan/i]),
          source: 'Peta Sebaran Pelabuhan Umum — Kemenhub/BIG',
        };
      })
      .filter(port => Number.isFinite(port.latitude) && Number.isFinite(port.longitude));
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
    return res.status(200).json({ ports, source: 'Kemenhub/BIG', fetchedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ error: 'Data titik pelabuhan resmi sementara belum dapat dimuat.' });
  }
};
