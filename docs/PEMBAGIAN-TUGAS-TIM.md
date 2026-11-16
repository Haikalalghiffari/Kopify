# Pembagian Tugas Tim — Sistem Informasi Koperasi

Acuan: `PRD-Sistem-Koperasi.md` (Bagian 6 untuk AC, Bagian 12 untuk fase).
Tim: 5 orang. Estimasi durasi: **10 minggu** (5 sprint × 2 minggu).

---

## 1. Ringkasan Peran

| # | Peran | Fokus Utama | Fase Utama |
|---|---|---|---|
| **P1** | Tech Lead & Fondasi | Arsitektur, database, autentikasi/RBAC, infra, audit log, code review | 1, 5 |
| **P2** | Master Data & Stok | CRUD anggota/barang, layanan stok, restock, opname | 1, 2 |
| **P3** | Impor Excel | Wizard impor, validasi, template, log impor | 2 |
| **P4** | Pesanan & Penjualan | Portal anggota, alur pesanan, POS, struk PDF | 3 |
| **P5** | Dasbor, Laporan & QA | Analitik, 4 laporan periodik, ekspor, pengujian E2E, dokumentasi | 4, 5 |

> Tiap orang bertanggung jawab penuh atas **backend + UI** modulnya sendiri (vertical slice) agar tidak ada ketergantungan antar-lapisan.

---

## 2. Rincian Tugas per Orang

### P1 — Tech Lead & Fondasi
- Inisialisasi repo, struktur folder, lint, formatter, `.env.example`, aturan branch & PR
- Docker Compose (app + PostgreSQL), skrip seed awal
- Prisma schema lengkap (semua tabel di PRD Bagian 8) + migrasi + indeks
- Autentikasi (Auth.js), RBAC (Admin/Kasir/Anggota), middleware proteksi route
- Layout dasar: sidebar admin, layout anggota, komponen UI bersama (tabel, form, toast, modal konfirmasi)
- Util bersama: `money` (integer rupiah, format `Rp`), `date` (WIB), pagination helper

### P2 — Master Data & Stok
- CRUD Anggota, Barang, Kategori, Satuan, Pemasok
- `stockService`: fungsi tunggal pergerakan stok, reservasi stok (`reserve()`, `release()`, `commit()`)
- Form barang masuk & opname stok dengan alasan wajib

### P3 — Impor Excel
- Parser `.xlsx/.xls/.csv`, normalisasi data
- Wizard 4 langkah impor (unggah, pemetaan, validasi, eksekusi)
- Template impor & log impor

### P4 — Pesanan & Penjualan
- Portal belanja anggota (katalog, keranjang, pesanan)
- Manajemen pesanan admin/kasir & alur status
- POS kasir & struk penjualan

### P5 — Dasbor, Laporan & QA
- Dasbor analitik (terlaris, stok terbanyak, stok menipis, tren)
- 4 Laporan periodik: harian, pekanan, bulanan, tahunan (ekspor PDF/Excel)
- QA E2E & dokumentasi akhir
