# Architecture Decision Records (ADR) — Sistem Informasi Koperasi

Dokumen ini mencatat seluruh keputusan arsitektur dan teknis penting yang diambil oleh Tech Lead (P1) beserta konteks dan konsekuensinya.

---

## ADR-001: Next.js 14 App Router sebagai Framework Utama
- **Status:** Diterima (Accepted)
- **Konteks:** Sistem membutuhkan aplikasi web full-stack modern dengan rendering cepat, SSR/Server Actions, integrasi API Route Handlers, dan dukungan TypeScript penuh.
- **Keputusan:** Menggunakan Next.js 14 LTS dengan App Router.
- **Konsekuensi:** Struktur folder terorganisir dalam route groups `(auth)`, `(admin)`, `(member)` dengan pemisahan layout yang jelas antara panel admin/kasir dan portal anggota.

---

## ADR-002: Integer Rupiah (Bukan Float) untuk Seluruh Nilai Uang
- **Status:** Diterima (Accepted)
- **Konteks:** Floating-point arithmetic di komputer (IEEE 754) rentan terhadap pembulatan mikro (`0.1 + 0.2 = 0.30000000000000004`). Dalam konteks aplikasi keuangan koperasi, ketidakakuratan satu rupiah pun tidak dapat ditoleransi.
- **Keputusan:** Semua kolom uang (`cost_price`, `sell_price`, `total`, `discount`, `unit_price`) di Prisma schema dan seluruh utility komputasi didefinisikan sebagai `Int` (Rupiah murni tanpa sen/desimal).
- **Konsekuensi:** Semua input dari user diformat dan di-parse melalui `src/lib/money.ts`. Tidak ada desimal float di database.

---

## ADR-003: Single-Tenant Sesuai Batasan PRD
- **Status:** Diterima (Accepted)
- **Konteks:** PRD Bagian 1 dan Bagian 14 menegaskan bahwa sistem koperasi ini dibangun untuk satu entitas koperasi tunggal. Menambahkan multi-tenant (`tenant_id`, subdomain router) akan menambah kompleksitas yang tidak diminta (*overengineering*).
- **Keputusan:** Database dan skema relasional didesain khusus untuk satu koperasi.
- **Konsekuensi:** Pengembang tidak perlu menyertakan `tenant_id` pada setiap query Prisma.

---

## ADR-004: Kriptografi Password Menggunakan `bcryptjs`
- **Status:** Diterima (Accepted)
- **Konteks:** Library `bcrypt` atau `argon2` native memerlukan build tools C++ (Python, Visual Studio Build Tools, node-gyp) yang sering kali mengalami error kompilasi pada workstation Windows anggota tim.
- **Keputusan:** Menggunakan `bcryptjs` (pure JavaScript implementation) dengan salt rounds 10.
- **Konsekuensi:** Proses instalasi dependencies bebas dari build-error di semua sistem operasi (Windows, Linux, macOS), dengan keamanan hashing password satu arah yang tetap memenuhi standar industri.

---

## ADR-005: Penanganan Zona Waktu Asia/Jakarta (WIB = UTC+7)
- **Status:** Diterima (Accepted)
- **Konteks:** Koperasi beroperasi di Indonesia Barat. Laporan harian, pergantian hari transaksi, dan grafik analitik harus mematuhi batas tengah malam WIB (bukan UTC server). Pekan dimulai pada hari Senin.
- **Keputusan:** Disediakan `src/lib/date.ts` dengan helper `startOfDayWIB`, `endOfDayWIB`, `startOfWeekWIB` (Senin), `startOfMonthWIB`, dan `startOfYearWIB`.
- **Konsekuensi:** Seluruh modul (terutama P4 Penjualan dan P5 Laporan) wajib menggunakan fungsi-fungsi ini untuk mengagregasi data transaksi berdasar rentang tanggal.

---

## ADR-006: Kontrak Stub `IStockService` di Sprint 1
- **Status:** Diterima (Accepted)
- **Konteks:** Modul stok dimiliki P2 pada Sprint 2, namun modul P3 (Impor Excel) dan P4 (Pesanan Anggota) membutuhkan fungsi `stockService` (`adjustStock`, `reserve`, `release`, `commitReservation`).
- **Keputusan:** P1 mendefinisikan antarmuka TypeScript `IStockService` di `src/services/contracts.ts` pada Sprint 1. P2 akan mengisi implementasi transaksional database dengan row lock pada Sprint 2 tanpa mengubah interface.
- **Konsekuensi:** Tim dapat bekerja paralel tanpa ketergantungan blokade antarlapisan.

---

## ADR-007: Font System-Stack untuk Kestabilan Offline & Docker Build
- **Status:** Diterima (Accepted)
- **Konteks:** Mengunduh font Google di waktu build (`next/font/google`) akan menggagalkan kompilasi container atau lingkungan jaringan tertutup/offline.
- **Keputusan:** Menggunakan modern system sans-serif font stack di Tailwind CSS.
- **Konsekuensi:** Build production dan container image selalu berhasil di compile dalam kondisi air-gapped sekalipun.
