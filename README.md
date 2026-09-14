# Pasport ma'lumotlarini qabul qiluvchi landing sahifa → Bitrix24 + Admin panel

Foydalanuvchi pasport/shaxsiy ma'lumotlarini kiritadigan xavfsiz forma. Ma'lumotlar serverga
yuborilgach, avtomatik ravishda **ikkala manzilga ham** — **Bitrix24 CRM**'ga (lead sifatida)
va **sizning admin panelingizga** (API orqali) — mustaqil ravishda uzatiladi. Har biri o'zicha
kuzatiladi: biri muvaffaqiyatsiz bo'lsa, ikkinchisiga ta'sir qilmaydi. Parallel ravishda
mahalliy bazada **shifrlangan holda** zaxiralanadi — ikkalasi ham vaqtincha ishlamay qolsa
ham ariza yo'qolmaydi, fon jarayoni har birini alohida keyinroq qayta yuboradi.

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
- Ma'lumotlar bazasi uchun Node'ning o'zida mavjud **`node:sqlite`** ishlatiladi (Node 22.5+
  talab qilinadi) — hech qanday tashqi kompilyatsiya (Python/Visual Studio) shart emas.
- **Multer 2.x** — yuklangan fayllar (rasm/PDF) xotirada qayta ishlanadi, turi va hajmi
  serverda tekshiriladi, so'ng **AES-256-GCM** bilan shifrlangan holda diskka yoziladi.

## Muhim: joylashtirish talabi

Bu ilova **doimiy diskga yozadigan** (shifrlangan zaxira baza + yuklangan fayllar) va
**fon jarayonida ishlaydigan** (qayta urinish navbati) xizmat. Shu sababli u faqat an'anaviy
Node.js hostingiga (Railway, Render, VPS va h.k.) mos keladi — **Vercel kabi serverless
platformalarga mos emas** (ular har bir so'rovni vaqtinchalik muhitda ishga tushiradi,
diskka yozilgan hech narsani saqlab qolmaydi).

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
   webhook* orqali yarating. Format: `https://<domen>.bitrix24.uz/rest/<user_id>/<kod>/`.
   (Ixtiyoriy) Lead'ga pasport/ota-ona ma'lumotlari uchun maxsus maydonlar qo'shsangiz,
   kodlarini `BITRIX_FIELD_*` qatorlariga yozing — bo'lmasa hammasi "Izoh" maydonida ko'rinadi.
3. **`ADMIN_API_URL`** va **`ADMIN_API_KEY`** — admin panelingiz arizalarni qabul qiladigan
   API manzili va maxfiy kaliti (masalan `https://sizning-admin-panel/api/submissions`).
4. (Ixtiyoriy) `ADMIN_API_FILE_FIELD_*` — admin panelingiz multipart so'rovda fayllarni qanday
   maydon nomlari bilan kutishiga qarab moslang. Standart qiymatlar: `photo`, `passport_scan`,
   `diploma`, `transcript`.

Ikkalasi ham mustaqil ishlaydi — faqat `BITRIX_WEBHOOK_URL` to'ldirilsa, faqat Bitrix24'ga;
faqat `ADMIN_API_URL`/`ADMIN_API_KEY` to'ldirilsa, faqat admin panelga; ikkalasi to'ldirilsa,
har bir arizaga ikkalasiga ham yuboriladi.

Admin panel API'siga yuboriladigan asosiy maydonlar: `full_name`, `birth_date`,
`passport_series`, `passport_number`, `pinfl`, `phone`, `address`, `comment`. Bulardan tashqari
`citizenship`, `telegram`, `father_full_name`, `father_phone`, `mother_full_name`,
`mother_phone` kabi qo'shimcha maydonlar ham yuboriladi.

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
- Sayt **faqat HTTPS** orqali ochilishi kerak (Railway/Render kabi xizmatlar buni avtomatik
  ta'minlaydi).
- `data/` papkasi **doimiy diskka (volume)** ulangan bo'lishi shart — aks holda har bir
  qayta ishga tushishda zaxira baza va yuklangan fayllar yo'qoladi.

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
  services/adminPanel.ts — admin panel API bilan ishlash (matn + fayl maydonlari)
  services/bitrix.ts     — Bitrix24 REST API bilan ishlash (matn + fayl maydonlari)
  services/crypto.ts     — AES-256-GCM shifrlash (matn va fayllar uchun)
  services/retryWorker.ts — ikkala manzil vaqtincha ishlamasa, fon jarayonda mustaqil qayta urinish
public/
  index.html, styles.css, app.js — bitta uzun forma (frontend)
```

## Forma bo'limlari

1. **Shaxsiy Ma'lumotlar** — ism, familiya, otasining ismi, tug'ilgan sana, fuqarolik
   (davlatlar ro'yxatidan tanlanadi: O'zbekiston, Qozog'iston, Qirg'iziston, Tojikiston,
   Turkmaniston, Turkiya), rasmiy manzil.
2. **Aloqa Ma'lumotlari** — telefon raqami (bir nechtasini qo'shish mumkin, xohlagan
   mamlakat kodi bilan), Telegram nickname.
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
| Telefon | Ixtiyoriy `+` va 7-15 ta raqam, vergul bilan ajratib bir nechtasi kiritilishi mumkin |
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
- Admin panelingizga kirish uchun kuchli parol va ikki bosqichli autentifikatsiya qo'llang.
- Mahalliy O'zbekiston qonunchiligidagi shaxsiy ma'lumotlarni himoya qilish talablariga
  (ma'lumotlarni O'zbekiston hududidagi serverlarda saqlash kabi) rioya qiling.
