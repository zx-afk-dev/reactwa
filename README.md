# ReactionWA

Website untuk memberikan reaction ke postingan Saluran WhatsApp, dengan sistem
coin (Free), VIP, DEV, redeem code, antrean global, dan Admin Panel lengkap.

- **Framework:** Next.js (Pages Router, JavaScript)
- **Database:** Firebase Admin SDK (Firestore) — server-side only
- **Hosting:** Vercel

---

## 1. Arsitektur singkat

- Semua akses Firestore lewat **Firebase Admin SDK di API routes** saja.
  Browser tidak pernah bicara langsung ke Firestore (lihat `firestore.rules`,
  yang menolak semua akses client langsung sebagai lapisan keamanan tambahan).
- **Antrean global** (`lib/queue.js`) memakai dokumen lock (`queue/lock`)
  dengan TTL (`QUEUE_LOCK_TTL`) yang diambil/lepas lewat Firestore transaction,
  supaya aman meski Vercel menjalankan banyak instance function bersamaan.
  Karena hosting serverless tidak punya worker proses yang hidup terus,
  pemrosesan antrean dipicu secara oportunistik: langsung setelah request
  masuk, dan lagi setiap kali browser melakukan polling status
  (`/api/queue-status`). Untuk trafik tinggi, tambahkan Vercel Cron yang
  memanggil sebuah endpoint pemroses antrean setiap menit sebagai jaring
  pengaman (lihat bagian "Opsional: Cron" di bawah).
- **Coin** disimpan per-identitas (hash IP untuk Free, atau `plan:keyId`
  untuk VIP/DEV) dan diubah lewat Firestore transaction (`lib/coin.js`),
  sehingga aman dari race condition saat banyak request bersamaan.
- IP pengguna diambil browser langsung dari `https://api.ipify.org` (sesuai
  requirement, tanpa proxy server tambahan) untuk ditampilkan di UI. Namun
  untuk keperluan kuota/keamanan, backend tetap mendeteksi IP sendiri dari
  header request (`x-forwarded-for`) dan **hash** sebelum disimpan — IP
  mentah tidak pernah disimpan permanen.

---

## 2. Instalasi Lokal

```bash
npm install
cp .env.example .env.local
# isi semua variabel di .env.local (lihat bagian 4 & 5)
npm run dev
```

Buka `http://localhost:3000`.

---

## 3. Setup Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com).
2. Aktifkan **Firestore Database** (mode production).
3. Buka **Project Settings → Service Accounts → Generate new private key**,
   unduh file JSON-nya.
4. Dari file JSON tersebut, isi ke `.env.local`:
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_PRIVATE_KEY` = `private_key` (biarkan `\n` apa adanya, jangan diubah jadi newline asli saat paste ke .env)
5. (Opsional tapi disarankan) Deploy `firestore.rules` yang sudah disediakan:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # pilih project yang sama, gunakan firestore.rules yang sudah ada
   firebase deploy --only firestore:rules
   ```
   File ini sengaja **menolak semua akses client langsung**, karena semua
   baca/tulis di project ini lewat Admin SDK di server (yang otomatis bypass
   rules ini).

Collection yang dipakai (dibuat otomatis saat dipakai, tidak perlu dibuat manual):
`users`, `vipKeys`, `devKeys`, `redeemCodes`, `redeemHistory`, `queueTasks`,
`queue` (dokumen lock), `stats`, `settings`, `promotions`, `logs`.

---

## 4. Setup Admin Panel

Admin Panel **tidak** memakai collection Firestore untuk kredensial owner —
cukup 2 env var:

```bash
# Generate hash password (contoh password: "supersecret123"):
node -e "console.log(require('crypto').createHash('sha256').update('supersecret123').digest('hex'))"

# Generate session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Isi ke `.env.local`:
```
ADMIN_USERNAME=owner
ADMIN_PASSWORD_HASH=<hasil hash di atas>
ADMIN_SESSION_SECRET=<hasil random di atas>
IP_HASH_SALT=<string acak lain, boleh pakai generator yang sama>
```

Login di `/admin/login`.

---

## 5. Setup Upstream Reaction API

```
UPSTREAM_REACT_URL=https://apiv2.reactionwa.online/api/v2/react
UPSTREAM_REACT_KEY=<API key dari penyedia layanan reaction>
```

Key ini **hanya** dipakai di server (`lib/upstream.js`), tidak pernah dikirim
ke browser.

---

## 6. Cara membuat VIP Key / DEV Key / Redeem Code

Semua dilakukan lewat Admin Panel setelah login:

- **VIP Key:** `/admin/vip` → isi coin, rate limit/menit, expiry (opsional) → "Buat Key".
  Key otomatis berformat `VIP-XXXXXXXXXXXX`. Bagikan ke user setelah mereka
  membeli plan VIP (lihat alur pembelian di bagian 8).
- **DEV Key:** `/admin/dev` → isi rate limit/menit, allowed host/origin
  (opsional, kosongkan untuk bebas), expiry (opsional) → "Buat Key". Key
  berformat `DEV-XXXXXXXXXXXX`, dipakai lewat header `x-api-key` di
  `/api/v1/react` (lihat `/docs`).
- **Redeem Code:** `/admin/redeem` → isi coin, maksimal penggunaan, expiry
  (opsional) → "Buat Kode". Kode berformat `RDM-XXXXXXXX`, ditukar user di
  halaman `/redeem`.

Semua key/kode bisa di-**disable**, di-**enable** kembali, atau **dihapus**
langsung dari tabel di Admin Panel.

---

## 7. Deploy ke Vercel

1. Push project ini ke GitHub/GitLab/Bitbucket.
2. Buka [vercel.com](https://vercel.com) → **New Project** → import repo ini.
3. Di **Environment Variables**, masukkan seluruh isi `.env.example` dengan
   nilai aslinya (termasuk `NEXT_PUBLIC_SITE_URL` = domain Vercel kamu).
4. Deploy. Setelah selesai, buka `/admin/login` untuk login sebagai Owner.

### Opsional: Vercel Cron sebagai jaring pengaman antrean
Untuk trafik tinggi/sepi pengunjung, tambahkan `vercel.json`:
```json
{
  "crons": [{ "path": "/api/admin/queue?process=1", "schedule": "*/1 * * * *" }]
}
```
lalu tambahkan pemrosesan otomatis di endpoint terkait (memanggil
`tryProcessNext()` dari `lib/queue.js`). Vercel Cron minimal interval
tergantung plan (Hobby: 1x/hari, Pro: per menit) — sesuaikan strategi dengan
kebutuhan trafik nyata.

---

## 8. Alur pembelian VIP / Dev

Belum ada payment gateway (sesuai requirement). Halaman `/pricing`
menampilkan tombol **"Beli VIP" / "Beli Dev"** yang mengarahkan ke WhatsApp
Owner (`https://wa.me/<nomor>`) dengan pesan otomatis. Setelah pembayaran
manual dikonfirmasi, Owner membuatkan VIP/DEV key lewat Admin Panel dan
mengirimkannya ke pembeli.

Nomor WhatsApp Owner, harga, durasi, coin, dan benefit tiap plan semuanya
bisa diubah dari `/admin/pricing` dan `/admin/settings` — tidak ada yang
hardcode di kode.

---

## 9. Struktur folder

```
pages/            → routing (Pages Router)
  api/             → semua API routes (react, redeem, status, admin/*, v1/react)
  admin/           → halaman-halaman Admin Panel
components/        → UI components
  admin/           → komponen khusus Admin Panel
lib/                → semua logic inti (queue, coin, keys, redeem, stats, dst)
styles/globals.css  → design system (mobile-first, dark theme)
firestore.rules     → security rules (menolak akses client langsung)
```

---

## 10. Catatan penting

- **Jangan** commit `.env.local` — sudah ada di `.gitignore`.
- Semua kode error (`INVALID_URL`, `NO_COIN`, `RATE_LIMIT`, dst) konsisten di
  seluruh API — lihat `lib/errors.js`.
- Reset coin harian dan penambahan coin/redeem semuanya atomic lewat
  Firestore transaction — lihat komentar di `lib/coin.js` dan `lib/redeem.js`.
- Karena tidak ada worker persisten di serverless, "real-time"-nya antrean
  bergantung pada polling browser (setiap 1.5 detik selama status masih
  `waiting`/`processing`) — ini sudah didesain sehingga pengalaman pengguna
  tetap terasa langsung dalam kondisi trafik normal.
