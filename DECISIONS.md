# Architecture Decisions Log — Sistem Informasi Koperasi

## Decision 1: Next.js 16 + Turbopack + Prisma ORM v5
- **Konteks**: PRD merekomendasikan Next.js App Router + Prisma.
- **Keputusan**: Menggunakan Next.js 16 dengan Turbopack untuk kompilasi ultra-cepat, Tailwind CSS v4, dan Prisma ORM v5.22 untuk stabilitas koneksi PostgreSQL lokal.
- **Dampak**: Waktu build production di bawah 8 detik, full type-safety.

## Decision 2: Auth.js (NextAuth v5 beta) dengan JWT Session & RBAC
- **Konteks**: Sesuai FR-1.1 & FR-1.2, autentikasi mendukung 3 role (ADMIN, KASIR, ANGGOTA) dengan batas sesi 8 jam tanpa aktivitas (AC 6.1).
- **Keputusan**: Menggunakan NextAuth v5 dengan credential provider, bcrypt password hashing, dan JWT strategy dengan `maxAge: 28800` (8 jam). Middleware melindungi route `/admin/*` untuk Admin & Kasir, dan `/member/*` khusus untuk Anggota.

## Decision 3: Currency & Stock Safety
- **Konteks**: Sesuai Bagian 0 rule 4 & 5, seluruh uang disimpan sebagai integer rupiah (tanpa desimal) dan mutasi stok wajib atomik / transaksional.
- **Keputusan**: 
  - Seluruh field nominal (`costPrice`, `sellPrice`, `total`, `discount`, `unitPrice`) bertipe `Int` di PostgreSQL.
  - Helper `formatRupiah` dan `parseRupiah` menangani normalisasi string ribuan Indonesia (`1.500.000` maupun `1,500,000`).
  - Pembuatan barang dengan stok awal otomatis membungkus operasi dalam `db.$transaction` dan membuat entri `StockMovement` bertipe `IMPORT`.

## Decision 4: Soft Delete Data Master
- **Konteks**: Sesuai FR-2.1 dan AC 6.2, data master yang dihapus menggunakan soft-delete (`deletedAt`), dan barang yang sudah memiliki riwayat transaksi dinonaktifkan (`isActive: false`) tanpa menghapus catatan historis.

## Decision 5: Fase 3 — State Machine Pesanan Anggota & Point of Sale (POS) Kasir
- **Konteks**: Memenuhi kebutuhan FR-5.1 hingga FR-6.3 serta kriteria penerimaan AC 6.5 dan AC 6.6.
- **Keputusan**:
  - Keranjang belanja anggota menggunakan `CartContext` yang tersinkronisasi dengan `localStorage` dan menampilkan badge live di navbar.
  - Alur status pesanan: `DIAJUKAN` → `DIKONFIRMASI` (alokasi atomik `reservedStock`) → `DISIAPKAN` → `SIAP_DIAMBIL` → `SELESAI` (potong fisik stok, kurangi `reservedStock`, catat mutasi `ORDER_FULFILLED`, dan buat `Sale`).
  - Pembatalan oleh anggota hanya diizinkan saat status `DIAJUKAN`. Penolakan oleh kasir melepas `reservedStock` dan mewajibkan `rejectReason`.
  - Format nomor pesanan `ORD-YYYYMMDD-XXXX` dan penjualan kasir `SLS-YYYYMMDD-XXXX`.
  - Halaman `/admin/sales` menyediakan antarmuka POS kasir lengkap dengan pencarian produk, pemilihan anggota/umum, diskon, kalkulator kembalian uang tunai, dan cetak struk termal.

## Decision 6: Fase 4 — Dasbor Analitik & Pelaporan Keuangan Komprehensif
- **Konteks**: Memenuhi PRD 6.7, 6.8, AC 6.7, dan AC 6.8 (Pelaporan Harian, Pekanan, Bulanan, Tahunan, Valuasi Stok, dan Dasbor Analitik).
- **Keputusan**:
  - `reportService.ts` menghitung laba kotor menggunakan formula $\sum (\text{harga jual} - \text{snapshot harga beli}) \times \text{kuantitas}$ pada transaksi aktif.
  - Menghitung rentang tanggal menggunakan zona waktu Asia/Jakarta (WIB) dan mengisi nilai 0 untuk hari tanpa transaksi.
  - Ekspor laporan ke format Excel spreadsheet `.xlsx` menggunakan `exceljs` via `/api/reports/export`.
  - Dasbor dilengkapi grafik tren penjualan 30 hari menggunakan Recharts, widget interaktif barang terlaris (bisa diurutkan berdasarkan omzet atau kuantitas), dan valuasi stok persediaan.
