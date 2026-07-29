const FEED = 'https://makassar.basarnas.go.id/feed';
const MARITIME = /kapal|perairan|laut|nelayan|pelabuhan|tenggelam|pelayaran|perahu|boat|selayar|penyeberangan/i;
const STANDBY = /siaga|posko|pelabuhan|arus mudik|nataru/i;
function clean(value='') { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#?[a-z0-9]+;/gi,' ').replace(/\s+/g,' ').trim(); }
function tag(item, name) { const match=item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i')); return clean(match?.[1]||''); }
module.exports = async (req,res) => {
  try {
    const response=await fetch(FEED,{headers:{'User-Agent':'Portal-Pelayaran-Sulsel/1.0'}});
    if(!response.ok) throw new Error('Feed unavailable');
    const xml=await response.text();
    const all=[...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m=>m[0]).map(item=>({title:tag(item,'title'),url:tag(item,'link'),date:tag(item,'pubDate'),summary:tag(item,'description')}));
    const maritime=all.filter(item=>MARITIME.test(`${item.title} ${item.summary}`)).slice(0,5);
    const standby=all.filter(item=>STANDBY.test(`${item.title} ${item.summary}`)).slice(0,3);
    res.setHeader('Cache-Control','public, s-maxage=900, max-age=300');
    return res.status(200).json({maritime,standby,fetchedAt:new Date().toISOString(),source:FEED});
  } catch(error) { return res.status(502).json({error:'Info SAR Makassar sementara belum dapat dimuat.'}); }
};
