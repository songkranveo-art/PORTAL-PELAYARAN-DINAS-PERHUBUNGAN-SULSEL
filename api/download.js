const SOURCES = {
  'perairan-makassar': {
    url: 'https://maritim.bmkg.go.id/marine2026-data/doc/cuaca/perairan/P.AE.04.pdf',
    filename: 'prakiraan-perairan-makassar-bmkg.pdf',
  },
  bulletin: {
    url: 'https://maritim.bmkg.go.id/marine2026-data/wbfs/wbfs.pdf',
    filename: 'buletin-cuaca-pelayaran-bmkg.pdf',
  },
  gelombang: {
    url: 'https://maritim.bmkg.go.id/marine2026-data/doc/gelombang_7hari_kedepan.pdf',
    filename: 'prakiraan-gelombang-7-hari-bmkg.pdf',
  },
  'rute-makassar': {
    url: 'https://maritim.bmkg.go.id/marine2026-data/rute/pdf/makassar.pdf',
    filename: 'prakiraan-rute-pelayaran-makassar-bmkg.pdf',
  },
};

module.exports = async (req, res) => {
  const file = req.query?.file;
  const source = SOURCES[file];
  if (!source) {
    return res.status(404).send('Dokumen tidak ditemukan.');
  }

  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'Portal-Cuaca-Dishub-Sulsel/1.0' },
    });
    if (!response.ok) {
      return res.status(502).send('Dokumen BMKG sedang tidak dapat diambil.');
    }

    const data = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${source.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(data);
  } catch (error) {
    return res.status(502).send('Terjadi kendala saat mengambil dokumen BMKG.');
  }
};
