// Peringatan Dini Cuaca (nowcast) BMKG — standar Common Alerting Protocol (CAP).
// Sumber: https://data.bmkg.go.id/peringatan-dini-cuaca/
// Daftar provinsi aktif : https://www.bmkg.go.id/alerts/nowcast/id  (RSS XML)
// Detail per provinsi   : https://www.bmkg.go.id/alerts/nowcast/id/<kode>_alert.xml (CAP XML)
// Wajib mencantumkan BMKG sebagai sumber data.

const RSS = 'https://www.bmkg.go.id/alerts/nowcast/id'
const PROVINSI = /sulawesi\s*selatan|sulsel/i
const UA = { 'User-Agent': 'PortalMaritimSulsel/1.0 (+https://dishubsulsel.web.id)' }
const TIMEOUT = 8000

async function ambil(url) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), TIMEOUT)
  try {
    const r = await fetch(url, { headers: UA, signal: ac.signal })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return await r.text()
  } finally { clearTimeout(t) }
}

function bersih(s) {
  if (!s) return ''
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(xml, nama) {
  const m = xml.match(new RegExp('<' + nama + '[^>]*>([\\s\\S]*?)</' + nama + '>', 'i'))
  return m ? bersih(m[1]) : ''
}

function semuaTag(xml, nama) {
  const out = []
  const re = new RegExp('<' + nama + '[^>]*>([\\s\\S]*?)</' + nama + '>', 'gi')
  let m
  while ((m = re.exec(xml))) out.push(m[1])
  return out
}

// Ambil <item> RSS milik Sulawesi Selatan
function itemSulsel(rss) {
  for (const item of semuaTag(rss, 'item')) {
    const judul = tag(item, 'title')
    const deskripsi = tag(item, 'description')
    if (PROVINSI.test(judul) || PROVINSI.test(deskripsi)) {
      const linkMentah = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
      return {
        judul,
        deskripsi,
        link: linkMentah ? bersih(linkMentah[1]) : '',
        pubDate: tag(item, 'pubDate'),
      }
    }
  }
  return null
}

// Terjemahkan tingkat keparahan CAP ke bahasa yang dimengerti pelaut
const TINGKAT = {
  Extreme: { label: 'AWAS', nilai: 4 },
  Severe: { label: 'SIAGA', nilai: 3 },
  Moderate: { label: 'WASPADA', nilai: 2 },
  Minor: { label: 'INFO', nilai: 1 },
  Unknown: { label: 'INFO', nilai: 1 },
}

function bacaCap(xml) {
  const info = semuaTag(xml, 'info')
  const blok = info.length ? '<info>' + info[0] + '</info>' : xml
  const severity = tag(blok, 'severity') || 'Unknown'
  const t = TINGKAT[severity] || TINGKAT.Unknown

  // area terdampak: <area><areaDesc>Kecamatan A, Kecamatan B</areaDesc></area>
  const wilayah = []
  for (const a of semuaTag(blok, 'area')) {
    const desc = tag('<x>' + a + '</x>', 'areaDesc')
    if (desc) wilayah.push(desc)
  }

  return {
    kejadian: tag(blok, 'event'),
    keparahan: severity,
    tingkat: t.label,
    bobot: t.nilai,
    kepastian: tag(blok, 'certainty'),
    urgensi: tag(blok, 'urgency'),
    mulai: tag(blok, 'effective') || tag(blok, 'onset'),
    berakhir: tag(blok, 'expires'),
    judul: tag(blok, 'headline'),
    keterangan: tag(blok, 'description'),
    saran: tag(blok, 'instruction'),
    infografik: tag(blok, 'web'),
    pengirim: tag(blok, 'senderName') || 'BMKG',
    wilayah: wilayah.slice(0, 40),
  }
}

function masihBerlaku(iso) {
  if (!iso) return true
  const t = Date.parse(iso)
  return isNaN(t) ? true : t > Date.now()
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
  try {
    const rss = await ambil(RSS)
    const item = itemSulsel(rss)

    if (!item || !item.link) {
      return res.status(200).json({
        fetchedAt: new Date().toISOString(),
        source: 'BMKG — Peringatan Dini Cuaca (CAP)',
        sourceUrl: 'https://data.bmkg.go.id/peringatan-dini-cuaca/',
        aktif: false,
        pesan: 'Tidak ada peringatan dini cuaca aktif untuk Sulawesi Selatan.',
      })
    }

    let detail = null
    try {
      detail = bacaCap(await ambil(item.link))
    } catch (e) { detail = null }

    const berlaku = detail ? masihBerlaku(detail.berakhir) : true

    return res.status(200).json({
      fetchedAt: new Date().toISOString(),
      source: 'BMKG — Peringatan Dini Cuaca (CAP)',
      sourceUrl: 'https://data.bmkg.go.id/peringatan-dini-cuaca/',
      aktif: berlaku,
      terbit: item.pubDate || '',
      tautanCap: item.link,
      ringkas: item.deskripsi || item.judul,
      peringatan: detail,
    })
  } catch (err) {
    return res.status(502).json({
      error: 'Gagal mengambil peringatan dini cuaca BMKG.',
      detail: String((err && err.message) || err),
      sourceUrl: 'https://data.bmkg.go.id/peringatan-dini-cuaca/',
    })
  }
}
