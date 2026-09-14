# Pasport ma'lumotlarini qabul qiluvchi landing sahifa → Bitrix24

Foydalanuvchi pasport/shaxsiy ma'lumotlarini kiritadigan xavfsiz forma. Ma'lumotlar serverga
yuborilgach, avtomatik ravishda **Bitrix24 CRM**'ga lead sifatida tushadi va parallel ravishda
mahalliy bazada **shifrlangan holda** zaxiralanadi (Bitrix vaqtincha ishlamay qolsa ham ariza
yo'qolmaydi — fon jarayoni uni keyinroq avtomatik qayta yuboradi).

## Texnologiyalar va xavfsizlik

- **Node.js + TypeScript + Express** — qattiq tiplashtirilgan, ishonchli backend.
- **Zod** orqali har bir maydon serverda qayta tekshiriladi (frontenddagi tekshiruvga
  ishonib qolinmaydi).
- **Helmet** — qattiq Content-Security-Policy, HSTS, clickjacking'dan himoya va boshqa
  xavfsizlik header'lari.
- **Double-submit-cookie CSRF himoyasi** — har bir yuborishda tokenlar solishtiriladi.
- **express-rate-limit** — bir IP manzildan spam/bruteforce urinishlarining oldini oladi.
- **AES-256-GCM** — mahalliy bazadagi barcha shaxsiy ma'lumotlar shifrlangan holda saqlanadi,
  loglarda esa hech qachon ochiq ko'rinishda chiqmaydi (pasport raqami, JSHSHIR avtomatik
  yashiriladi).
- **Honeypot maydon** — oddiy botlarni ushlab, ularning arizasi hech qayerga yuborilmaydi.
- Ma'lumotlar bazasi uchun Node'ning o'zida mavjud **`node:sqlite`** ishlatiladi — hech qanday
  tashqi kompilyatsiya (Python/Visual Studio) shart emas.
- **Multer 2.x** — yuklangan fayllar (rasm/PDF) xotirada qayta ishlanadi, turi va hajmi
  serverda tekshiriladi, so'ng **AES-256-GCM** bilan shifrlangan holda diskka yoziladi.

## O'rnatish

```bash
npm install
cp .env.example .env
```

`.env` faylini oching va quyidagilarni to'ldiring:

1. **`DATA_ENCRYPTION_KEY`** — quyidagi buyruq bilan yarating va shu qiymatni qo'ying:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **`BITRIX_WEBHOOK_URL`** — Bitrix24 > *Sozlamalar → Ilovalar → Webhook'lar → Kiruvchi
   webhook* orqali yarating (kamida `crm` ruxsatiga ega bo'lishi kerak). Format:
   `https://<kompaniya>.bitrix24.uz/rest/<user_id>/<kod>/`
3. (Ixtiyoriy, tavsiya etiladi) Bitrix24 CRM'da **Lead** bo'limiga maxsus matnli maydonlar
   (pasport, JSHSHIR, ota-ona ma'lumotlari va h.k.) hamda **Fayl** turidagi maydonlar (3x4
   rasm, pasport skani, diplom, transkript uchun) qo'shing va ularning kodini `.env`
   faylidagi `BITRIX_FIELD_*` qatorlariga yozing. Bu qilinmasa, ma'lumot baribir yo'qolmaydi —
   matnli ma'lumotlar lead "Izoh" maydonida ko'rinadi, fayllar esa serverning mahalliy
   bazasida shifrlangan holda saqlanib qoladi.

## Ishga tushirish

```bash
# Development (avtomatik qayta yuklash bilan)
npm run dev

# Production
npm run build
npm start
```

Production'da albatta:

- `NODE_ENV=production` va haqiqiy `DATA_ENCRYPTION_KEY` qo'ying.
- Sayt **faqat HTTPS** orqali ochilishi kerak — Nginx/Caddy kabi teskari-proksi orqali SSL
  sertifikat (masalan, Let's Encrypt/Certbot) o'rnating.
- Ilovani `pm2` yoki `systemd` orqali doimiy ishlaydigan jarayon sifatida ishga tushiring.
- `data/` papkasini (baza + yuklangan fayllar) muntazam zaxiralab boring (u shifrlangan holda
  saqlanadi, lekin zaxira nusxasi ham xavfsiz joyda turishi kerak).

## Loyihaning tuzilishi

```
src/
  server.ts           — Express ilovasi, xavfsizlik middleware'lari
  config.ts           — muhit o'zgaruvchilarini o'qish va tekshirish
  validation.ts       — Zod sxemalari (pasport, JSHSHIR, telefon, fayl qoidalari)
  db.ts                — shifrlangan mahalliy baza va fayl saqlash (node:sqlite)
  logger.ts            — maxfiy maydonlarni avtomatik yashiruvchi logger
  middleware/csrf.ts    — CSRF himoyasi
  routes/apply.ts       — ariza va fayllarni qabul qilish endpoint'i (multer)
  services/bitrix.ts     — Bitrix24 REST API bilan ishlash (matn + fayl maydonlari)
  services/crypto.ts     — AES-256-GCM shifrlash (matn va fayllar uchun)
  services/retryWorker.ts — Bitrix vaqtincha ishlamasa, fon jarayonda qayta urinish
public/
  index.html, styles.css, app.js — bitta uzun forma (frontend)
```

## Forma bo'limlari

1. **Shaxsiy Ma'lumotlar** — ism, familiya, otasining ismi, tug'ilgan sana, fuqarolik
   (davlatlar ro'yxatidan tanlanadi, O'zbekiston standart bo'yicha tanlangan), rasmiy manzil.
2. **Aloqa Ma'lumotlari** — telefon raqami (bir nechtasini qo'shish mumkin), Telegram nickname.
3. **Pasport Ma'lumotlari** — oddiy pasport raqami + JSHSHIR (majburiy), Zagran pasport
   raqami + JSHSHIR (ixtiyoriy).
4. **Ota-Ona Ma'lumotlari** — otaning va onaning to'liq F.I.Sh (raqam kiritib bo'lmaydi) va
   telefon raqamlari (har biriga bir nechtasini qo'shish mumkin).
5. **Elektron Hujjatlar (PDF)** — 3x4 rasm, pasport skani, diplom, transkript; har bir hujjat
   turiga bir nechta fayl (masalan diplomning barcha sahifalari) biriktirish mumkin.

Har bir maydon shu formatlarda tekshiriladi:

| Maydon | Format |
|---|---|
| Ism, familiya, otasining ismi, ota-ona F.I.Sh | Faqat harflar — raqam kiritilishi bloklanadi |
| Pasport raqami | `AA1234567` (2 lotin harf + 7 raqam) |
| JSHSHIR (PINFL) | 14 ta raqam |
| Telefon | `+998XXXXXXXXX`, vergul bilan ajratib bir nechtasi kiritilishi mumkin |
| Telegram | `@username` (5-32 belgi) |

Fayl talablari (har bir hujjat turiga bittadan beshtagacha fayl biriktirish mumkin):

| Hujjat | Ruxsat etilgan turi | Maks. hajm (har bir fayl) |
|---|---|---|
| 3x4 rasm | JPG, PNG yoki PDF | 5 MB |
| Pasport skani, diplom, transkript | Faqat PDF | 10 MB |

## Muhim eslatma

Bu tizim pasport kabi juda nozik shaxsiy ma'lumotlarni yig'adi. Uni ishga tushirishdan oldin:

- Domeningizga SSL sertifikat o'rnating (HTTPS majburiy).
- `.env` faylini hech qachon Git'ga qo'shmang (`.gitignore`da allaqachon istisno qilingan).
- Bitrix24 hisobingizda ikki bosqichli autentifikatsiyani yoqing.
- Mahalliy O'zbekiston qonunchiligidagi shaxsiy ma'lumotlarni himoya qilish talablariga
  (ma'lumotlarni O'zbekiston hududidagi serverlarda saqlash kabi) rioya qiling.
