# Sistem Informasi Koperasi

Aplikasi web terpadu untuk pengelolaan unit usaha koperasi (toko & unit usaha): data anggota, katalog barang, manajemen stok, impor Excel sistem lama, pemesanan online oleh anggota, transaksi penjualan (POS kasir), dashboard analitik, dan pelaporan periodik.

---

## 🛠 Tech Stack

- **Frontend & Backend Framework:** Next.js 14 LTS (App Router) + TypeScript
- **Styling & UI:** Tailwind CSS + Radix/shadcn-style modular primitives
- **Database:** PostgreSQL 16 (via Docker Compose)
- **ORM:** Prisma 5 (Schema-driven migrations & type-safe queries)
- **Autentikasi & RBAC:** Auth.js (NextAuth) dengan Credentials Provider + bcryptjs
- **Validasi:** Zod
- **Unit Testing:** Vitest
- **Ikonografi:** Lucide React

---

## 📋 Prasyarat Instalasi

Pastikan komputer pengembang telah terpasang:
1. **Node.js** versi `>= 18.x` (Direkomendasikan Node.js LTS v20 atau v22)
2. **npm** versi `>= 9.x`
3. **Docker & Docker Compose** (untuk menjalankan container PostgreSQL secara lokal)

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Clone Repositori
```bash
git clone <URL_REPOSITORY>
cd Kopify
```

### 2. Atur Environment Variables
Salin template konfigurasi `.env.example` ke `.env`:
```bash
cp .env.example .env
```
*Di Windows PowerShell:*
```powershell
Copy-Item .env.example .env
```
Pastikan variabel `DATABASE_URL` dan `NEXTAUTH_SECRET` sudah terisi dengan benar.

### 3. Jalankan Database PostgreSQL via Docker
```bash
docker compose up -d postgres
```
Periksa status kontainer:
```bash
docker compose ps
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Generate Prisma Client & Migrasi Database
```bash
# Generate client
npm run db:generate

# Jalankan migrasi skema ke database PostgreSQL
npm run db:migrate
```

### 6. Jalankan Database Seed (Data Awal Development)
```bash
npm run db:seed
```
Skrip seed akan membuat akun demo, kategori, satuan, anggota, dan barang contoh lengkap dengan audit stok awal.

### 7. Jalankan Server Development
```bash
npm run dev
```
Buka peramban di [http://localhost:3000](http://localhost:3000).

---

## 🔑 Kredensial Akun Development (Hasil Seeding)

| Role | Username / Email | Password Default | Hak Akses Utama |
|---|---|---|---|
| **Admin** | `admin` / `admin@koperasi.local` | `AdminKoperasi2026!` | Akses penuh, manajemen user, impor data, audit log |
| **Kasir** | `kasir` / `kasir@koperasi.local` | `KasirKoperasi2026!` | Input barang/stok, proses pesanan, kasir POS |
| **Anggota** | `budi` / `budi.santoso@anggota.local` | `AnggotaKoperasi2026!` | Portal katalog belanja, keranjang, pesanan saya |

---

## 🧪 Skrip Perintah (Scripts)

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan Next.js development server |
| `npm run build` | Melakukan kompilasi production build |
| `npm run start` | Menjalankan server aplikasi production |
| `npm run lint` | Menjalankan pemeriksaan kode ESLint |
| `npm run type-check` | Memeriksa keabsahan tipe TypeScript (`tsc --noEmit`) |
| `npm test` | Menjalankan seluruh pengujian unit menggunakan Vitest |
| `npm run db:generate` | Menghasilkan TypeScript Prisma Client |
| `npm run db:migrate` | Menerapkan migrasi database Prisma di lingkungan dev |
| `npm run db:seed` | Mengisi database dengan data awal via `prisma/seed.ts` |
| `npm run db:studio` | Membuka UI antarmuka visual data Prisma Studio |
| `npm run docker:up` | Menyalakan seluruh service Docker Compose |
| `npm run docker:down` | Menghentikan container Docker |

---

## 📁 Dokumentasi Arsitektur & Panduan Tim

Dokumentasi lengkap tersimpan di direktori `docs/`:
- [PRD-Sistem-Koperasi.md](file:///d:/POLMAN/Kuliah/Academia/Semester%205/All%20about%20Big%20Data/Minggu2/Kopify/docs/PRD-Sistem-Koperasi.md) — Product Requirements Document resmi.
- [ARCHITECTURE.md](file:///d:/POLMAN/Kuliah/Academia/Semester%205/All%20about%20Big%20Data/Minggu2/Kopify/docs/ARCHITECTURE.md) — Arsitektur teknis, service pattern, dan komunikasi sistem.
- [DATABASE-DESIGN.md](file:///d:/POLMAN/Kuliah/Academia/Semester%205/All%20about%20Big%20Data/Minggu2/Kopify/docs/DATABASE-DESIGN.md) — Kamus data, ERD, indeks performa, dan aturan skema.
- [DECISIONS.md](file:///d:/POLMAN/Kuliah/Academia/Semester%205/All%20about%20Big%20Data/Minggu2/Kopify/docs/DECISIONS.md) — Architecture Decision Records (ADR).
- [TEAM-DEVELOPMENT-GUIDE.md](file:///d:/POLMAN/Kuliah/Academia/Semester%205/All%20about%20Big%20Data/Minggu2/Kopify/docs/TEAM-DEVELOPMENT-GUIDE.md) — Panduan branching, commit convention, PR, dan pembagian tugas modul.

---

## 👥 Tim Pengembang

- **P1 (Tech Lead & Fondasi):** Arsitektur, database schema, autentikasi, layout & shared utils.
- **P2 (Master Data & Stok):** CRUD master data & `stockService`.
- **P3 (Impor Excel):** Wizard parser impor data Excel & template.
- **P4 (Pesanan & Penjualan):** Portal belanja anggota & POS kasir.
- **P5 (Dasbor, Laporan & QA):** Dasbor analitik, pelaporan periodik & pengujian E2E.
