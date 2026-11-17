# Sistem Informasi Koperasi — Kopify

Aplikasi web manajemen koperasi konsumen berbasis Next.js (App Router), PostgreSQL, dan Prisma ORM.

---

## Fitur Utama

| Modul | Deskripsi |
|---|---|
| **Autentikasi & RBAC** | Login email/password, role Admin / Kasir / Anggota |
| **Data Master** | CRUD anggota, barang, kategori, satuan dengan soft-delete |
| **Stok** | Barang masuk, penyesuaian/opname, audit trail pergerakan stok |
| **Impor Excel** | Wizard 4-langkah impor anggota & barang dari .xlsx/.csv |
| **Pesanan Anggota** | Alur DIAJUKAN → DIKONFIRMASI → SELESAI, reservasi stok |
| **Kasir / POS** | Penjualan langsung, cetak struk termal |
| **Laporan** | Harian, Pekanan, Bulanan, Tahunan; ekspor PDF & Excel |
| **Dasbor** | KPI, grafik tren, barang terlaris, stok menipis |
| **Log Aktivitas** | Audit trail seluruh aksi penting (Admin only) |

---

## Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5
- **Autentikasi**: NextAuth v5 (Auth.js)
- **Excel**: ExcelJS (ekspor) + SheetJS/xlsx (impor)
- **Grafik**: Recharts
- **Validasi**: Zod
- **Testing**: Vitest

---

## Prasyarat

- Node.js 20+
- PostgreSQL 15+
- npm 10+

---

## Instalasi & Setup

### 1. Clone & Install Dependencies

```bash
git clone <repo-url> sistem-koperasi
cd sistem-koperasi
npm install
```

### 2. Konfigurasi Environment

Salin file contoh dan isi variabelnya:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/koperasi_db"

# NextAuth
AUTH_SECRET="ganti-dengan-string-random-panjang-min-32-karakter"
NEXTAUTH_URL="http://localhost:3000"

# (Opsional) Node environment
NODE_ENV="development"
```

### 3. Setup Database

```bash
# Buat database di PostgreSQL terlebih dahulu:
# CREATE DATABASE koperasi_db;

# Jalankan migrasi
npm run db:migrate

# Seed data awal (admin, contoh anggota, barang, transaksi)
npm run db:seed
```

### 4. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Akun Default (Seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@koperasi.id | admin123 |
| Kasir | kasir@koperasi.id | kasir123 |
| Anggota | budi@example.com | anggota123 |

> ⚠️ **Ganti password default setelah pertama kali login di production!**

---

## NPM Scripts

| Script | Keterangan |
|---|---|
| `npm run dev` | Jalankan dev server (port 3000) |
| `npm run build` | Build production |
| `npm start` | Jalankan production build |
| `npm test` | Jalankan unit test (Vitest) |
| `npm run db:migrate` | Jalankan migrasi Prisma |
| `npm run db:seed` | Seed data awal |
| `npm run db:studio` | Buka Prisma Studio (GUI DB) |
| `npm run db:reset` | Reset DB + migrasi ulang (⚠️ hapus semua data) |
| `npm run db:backup` | Backup database ke folder `./backups/` |
| `npm run db:generate` | Regenerate Prisma client |

---

## Backup Database

Jalankan manual:

```bash
npm run db:backup
```

File backup tersimpan di `./backups/backup_koperasi_YYYY-MM-DD_HH-MM-SS.sql.gz`.

**Retensi otomatis**: File lebih lama dari 30 hari dihapus otomatis.

**Penjadwalan otomatis** (Linux/macOS, via cron — setiap hari jam 02:00):

```bash
crontab -e
# Tambahkan:
0 2 * * * cd /path/to/sistem-koperasi && npm run db:backup >> /var/log/koperasi-backup.log 2>&1
```

**Windows (Task Scheduler)**:
- Buat task baru yang menjalankan `npm run db:backup` di direktori proyek setiap hari.

---

## Panduan Pengguna Singkat

### Admin

1. **Login** → masuk ke `/admin/dashboard`
2. **Data Master** → sidebar: Data Anggota, Katalog Barang, Manajemen Stok
3. **Impor Excel** → sidebar: Impor Excel → ikuti wizard 4 langkah
4. **Kelola Pesanan** → sidebar: Pesanan Anggota → konfirmasi/tolak/selesaikan
5. **Laporan** → sidebar: Laporan Keuangan → pilih tab (Harian/Pekanan/Bulanan/Tahunan)
6. **Log Aktivitas** → sidebar: Log Aktivitas → lihat riwayat seluruh aksi

### Kasir

1. Login → masuk ke `/admin/dashboard`
2. **Kasir/POS** → sidebar: Kasir (POS) → pilih barang, proses transaksi, cetak struk
3. **Pesanan** → sidebar: Pesanan Anggota → proses pesanan anggota
4. **Laporan Harian** → sidebar: Laporan Keuangan → tab Laporan Harian

### Anggota

1. Login → masuk ke `/member/catalog`
2. **Belanja** → pilih barang, tambah ke keranjang, kirim pesanan
3. **Riwayat** → sidebar: Pesanan Saya → pantau status pesanan

---

## Struktur Folder

```
sistem-koperasi/
├── prisma/
│   ├── schema.prisma       # Model database
│   ├── migrations/         # Riwayat migrasi
│   └── seed.ts             # Data awal
├── scripts/
│   └── backup-db.ts        # Skrip backup database
├── src/
│   ├── app/
│   │   ├── admin/          # Halaman admin (dashboard, laporan, dll)
│   │   ├── member/         # Halaman anggota (katalog, keranjang, pesanan)
│   │   ├── api/            # API routes
│   │   └── login/          # Halaman login
│   ├── components/         # Komponen UI reusable
│   ├── lib/                # Utilities (db, auth, money, date, audit)
│   └── services/           # Business logic (import, stock, order, report)
├── backups/                # Hasil backup DB (auto-created)
├── .env.example            # Template variabel lingkungan
├── next.config.ts          # Konfigurasi Next.js + security headers
└── README.md               # Dokumentasi ini
```

---

## Security

- Password di-hash dengan **bcrypt** (10 rounds)
- Semua endpoint dilindungi middleware RBAC
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `CSP`, dll.
- Input divalidasi server-side dengan **Zod**
- Soft-delete untuk data anggota & barang (tidak dihapus permanen)
- Audit log untuk seluruh aksi penting

---

## Variabel Lingkungan (.env.example)

```env
# ── DATABASE ──────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/koperasi_db"

# ── NEXTAUTH ──────────────────────────────────────────────
AUTH_SECRET="ubah-ini-dengan-string-acak-panjang"
NEXTAUTH_URL="http://localhost:3000"

# ── NODE ──────────────────────────────────────────────────
NODE_ENV="development"
```

---

## Menjalankan Test

```bash
npm test
# Atau watch mode:
npm run test:watch
```

---

## Deployment (Docker Compose)

```yaml
# docker-compose.yml (contoh)
version: "3.8"
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: koperasi_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:secret@db:5432/koperasi_db
      AUTH_SECRET: ganti-dengan-secret-panjang
      NEXTAUTH_URL: http://localhost:3000
    depends_on:
      - db

volumes:
  pgdata:
```

```bash
docker compose up -d
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

---

## Lisensi

Internal use — Sistem Informasi Koperasi v1.0
