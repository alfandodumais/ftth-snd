# FTTH SND GeoStudio 🚀

> **AutoCAD & Google Earth KMZ to Excel HPDB & BoQ Synchronization Platform**  
> *Developed for FTTH Drafters by TOSKA*

Platform otomatisasi dan sinkronisasi komprehensif untuk drafter jaringan FTTH (Fiber to the Home) SND. Mengubah file survey Google Earth (`.kmz` / `.kml`) menjadi:
- **Gambar Kerja AutoCAD DWG & DXF** lengkap dengan layer standar SND, block FAT & Pole, skala metrik UTM WGS84, dan KOP Gambar.
- **Tabel Excel HPDB.xlsx** (58 kolom standar Telkom/MyRepublic).
- **Tabel Excel BOQ.xlsx** (rekapitulasi material tiang, kabel distribusi, sling wire, aksesoris, & OLT).
- **Peta Topologi GIS Interaktif** (Leaflet dengan visualisasi FDT, FAT, rute kabel, tiang, dan homepass).
- **Sistem Langganan Paket Drafter Otomatis** via QRIS DANA Bisnis dengan verifikasi instan OCR / status invoice.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons, Leaflet GIS Map, ExcelJS preview.
- **Backend**: Node.js, Express.js, Multer, fast-xml-parser, JSZip, proj4, `@tarikjabiri/dxf`, Tesseract.js.
- **Database & ORM**: Prisma ORM (SQLite untuk Local, PostgreSQL via Neon / Supabase untuk Production).
- **CAD Engine**: Native AutoCAD Core Console (`accoreconsole.exe`) & Pure JS DXF/DWG Generator.

---

## 🚀 Panduan Menjalankan Sistem di Komputer Lokal

### 1. Prasyarat
- Node.js versi 18+ atau 20+
- Git

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
npx prisma db push
node prisma/seed.js # (Opsional: inisialisasi akun admin dan paket)
npm run dev # atau node src/server.js
```
*Backend berjalan di: `http://localhost:5000`*

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend berjalan di: `http://localhost:5173`*

---

## ☁️ Panduan Deploy ke Vercel & Cloud Database (Step-by-Step)

### Step 1: Buat Database PostgreSQL Gratis di Neon.tech (Paling Direkomendasikan)
1. Kunjungi [https://neon.tech](https://neon.tech) dan klik **Sign Up with GitHub**.
2. Buat project baru dengan nama `ftth-snd-db`.
3. Setelah project dibuat, Anda akan langsung diberikan **Connection String**, contoh:
   ```env
   DATABASE_URL="postgresql://username:password@ep-pool-12345.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
4. Salin URL tersebut.

### Step 2: Update Schema Prisma untuk PostgreSQL
Ubah baris datasource di `backend/prisma/schema.prisma` menjadi:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Lalu jalankan push schema ke database cloud:
```bash
npx prisma db push
```

### Step 3: Deploy Frontend & Backend
#### Opsi A: Deploy Frontend di Vercel + Backend di Render / Railway (Sangat Stabil)
1. **Backend di Render.com**:
   - Login ke [https://render.com](https://render.com) menggunakan GitHub.
   - Buat **New Web Service**, pilih repo `ftth-snd`.
   - Set **Root Directory**: `backend`
   - Set **Build Command**: `npm install && npx prisma generate`
   - Set **Start Command**: `node src/server.js`
   - Tambahkan Environment Variables:
     - `DATABASE_URL`: *(Connection string dari Neon.tech)*
     - `JWT_SECRET`: *(string rahasia acak)*
     - `PORT`: `5000`
   - Setelah deploy, Anda akan mendapatkan URL backend, contoh: `https://ftth-snd-api.onrender.com`.

2. **Frontend di Vercel**:
   - Login ke [https://vercel.com](https://vercel.com) menggunakan GitHub.
   - Klik **Add New Project**, pilih repo `ftth-snd`.
   - Set **Root Directory**: `frontend`
   - Framework Preset otomatis terdeteksi sebagai **Vite**.
   - Tambahkan Environment Variable:
     - `VITE_API_BASE`: `https://ftth-snd-api.onrender.com/api` (URL backend Render Anda)
   - Klik **Deploy**.

---

## 📄 Lisensi & Hak Cipta
Copyright © 2026 TOSKA - Designed by Ndoo-
