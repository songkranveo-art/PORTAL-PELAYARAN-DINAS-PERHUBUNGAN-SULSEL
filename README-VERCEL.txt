DEPLOY KE VERCEL — PORTAL CUACA SULSEL

Paket ini sudah dikonversi dari Netlify ke Vercel.

CARA DEPLOY
1. Buat repository GitHub baru, lalu unggah SELURUH isi folder ini.
2. Di Vercel, pilih Add New > Project lalu impor repository tersebut.
3. Framework Preset: Other. Tidak perlu Build Command atau Output Directory.
4. Tekan Deploy.
5. Setelah URL Vercel tersedia, ganti domain pada meta og:image dan og:url di index.html bila ingin preview WhatsApp memakai domain baru, kemudian deploy ulang.

CATATAN
- Endpoint data cuaca kini memakai /api/weather.
- Endpoint unduh PDF kini memakai /api/download.
- Vercel akan mendeteksi folder api/ sebagai Serverless Functions.
- Tidak diperlukan netlify.toml atau folder netlify/.
