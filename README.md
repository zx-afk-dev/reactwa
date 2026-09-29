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
- **Antrean global** (`lib/queue.js`) disimpan di Firestore (`queueTasks`) dengan dokumen lock (`queue/lock`). Request publik hanya memasukkan task ke antrean dan tidak menunggu upstream. Worker dipanggil oleh GitHub Actions melalui `/api/cron/queue`, sedangkan Vercel Cron dipakai khusus untuk cleanup data lama.
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
   - `FIREBASE_PRIVATE_KEY_BASE64` = base64 seluruh `private_key` (disarankan untuk Vercel).
   - `FIREBASE_PRIVATE_KEY` = `private_key` sebagai fallback.
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
UPSTREAM_REACT_URL=<URL endpoint reaction upstream>
UPSTREAM_REFRESH_TOKEN=<refresh token upstream>
UPSTREAM_TIMEOUT=30000
```

Refresh token ini **hanya** dipakai di server (`lib/upstream.js`), tidak pernah dikirim ke browser.

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
2. Import repository ke Vercel.
3. Isi environment variables dari `.env.example` di Vercel.
4. Pastikan `CRON_SECRET` juga tersedia di Vercel karena dipakai endpoint cron.
5. Deploy. Setelah selesai, buka `/admin/login`.

### Worker queue

Worker queue dijalankan melalui GitHub Actions pada `.github/workflows/queue-worker.yml`.
Tambahkan repository secret GitHub Actions:

```
CRON_SECRET=<nilai yang sama dengan CRON_SECRET di Vercel>
```

Workflow dapat dijalankan manual melalui **GitHub → Actions → Queue Worker → Run workflow** untuk pengujian.

### Cleanup Firestore

Vercel Cron memanggil `/api/cron/cleanup` setiap hari. Cleanup hanya menghapus:
- `queueTasks` dengan status `success` yang lebih dari 7 hari.
- `queueTasks` dengan status `failed` yang lebih dari 14 hari.
- `logs` yang lebih dari 30 hari.

Task `waiting` dan `processing` tidak disentuh oleh cleanup.

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
styles/globals.css  → design system (mobile-first, scrapbook/notebook theme)
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

### Upstream reliability
- `UPSTREAM_TIMEOUT` default 30 detik dan dibatasi 5–120 detik.
- HTTP non-2xx dari upstream diklasifikasikan sebagai `UPSTREAM_HTTP_<status>`.
- Response upstream yang ditulis ke log disanitasi; identifier/account/business fields tidak disimpan.
