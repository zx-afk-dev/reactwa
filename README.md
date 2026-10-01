# ReactionWA

Website sederhana untuk memberikan reaction ke postingan Saluran WhatsApp.

- **Framework:** Next.js (Pages Router, JavaScript)
- **Hosting:** Vercel
- **Reaction service:** `https://react.zfile.web.id/api/send-reaction`

---

## 1. Arsitektur

Alurnya sekarang langsung:

```
Browser
  ↓
POST /api/react
  ↓
Validasi server
  ↓
Reaction service
  ↓
Response
```

Tidak ada lagi:

- global queue
- Firebase Realtime Database untuk queue
- queue worker
- GitHub Actions queue worker
- endpoint reaction-status
- polling status di browser

Browser tetap tidak memanggil reaction service secara langsung. Request diteruskan oleh server-side API route.

---

## 2. Instalasi Lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`.

---

## 3. Environment

Minimal:

```env
REACTION_API_URL=https://react.zfile.web.id/api/send-reaction
UPSTREAM_TIMEOUT=10000
NEXT_PUBLIC_SITE_URL=
```

`REACTION_API_URL` hanya digunakan server-side. Jangan menggunakan prefix `NEXT_PUBLIC_` untuk endpoint upstream.

---

## 4. API

### POST /api/react

Request:

```json
{
  "url": "https://whatsapp.com/channel/xxxxxxxx/123",
  "emojis": "🥳,👍"
}
```

Response sukses mengikuti response dari reaction service:

```json
{
  "success": true,
  "code": "SENT",
  "message": "Reaction berhasil dikirim.",
  "data": {}
}
```

Request dibatasi maksimal 5 reaction unik.

---

## 5. Deploy ke Vercel

1. Push repository ke GitHub.
2. Import repository ke Vercel.
3. Tambahkan environment variables dari `.env.example`.
4. Deploy.

Tidak diperlukan `CRON_SECRET`, GitHub Actions worker, atau Firebase Realtime Database untuk alur reaction direct.

---

## 6. Struktur utama

```
pages/
  index.js
  docs.js
  faq.js
  changelog.js
  privacy.js
  api/
    react.js

components/
  ReactionForm.js
  Layout.js
  Navbar.js
  Footer.js

styles/
  globals.css
```
