# Arsitektur Aplikasi — Sistem Informasi Koperasi

Dokumen ini menjelaskan rancangan arsitektur perangkat lunak Sistem Informasi Koperasi, pola desain, serta konvensi pengembangan bagi seluruh tim pengembang (P1 - P5).

---

## 1. Ikhtisar Arsitektur

Aplikasi dibangun menggunakan model **Modular Monolith** dengan Next.js 14 App Router, di mana setiap anggota tim mengelola *vertical slice* (Frontend UI + Backend Service) pada modul masing-masing.

```text
[ Browser / Client ]
         │
         ▼
[ Next.js Middleware (Auth.js & RBAC) ]
         │
    ┌────┴───────────────────────────┐
    ▼                                ▼
[ App Router Pages ]         [ Route Handlers / Actions ]
(Server/Client UI)           (API Endpoints)
    │                                │
    └────────────────┬───────────────┘
                     ▼
           [ Service Layer ]
     (stockService, reportService, etc.)
                     │
                     ▼
           [ Prisma ORM (db.ts) ]
                     │
                     ▼
           [ PostgreSQL 16 ]
```

---

## 2. Struktur Direktori Proyek

```text
koperasi-system/
├── docs/                      # Dokumentasi resmi proyek (PRD, Arsitektur, Desain DB, dll)
├── prisma/
│   ├── schema.prisma          # Definisi model data PostgreSQL
│   ├── migrations/            # Riwayat migrasi database
│   └── seed.ts                # Skrip data awal development
├── public/                    # Aset statis publik
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/login/      # Halaman Login
│   │   ├── (admin)/           # Panel Admin & Kasir (dashboard, master data, POS, reports)
│   │   ├── (member)/          # Portal Anggota (catalog, cart, orders, profile)
│   │   ├── api/auth/          # Auth.js route handler
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Smart redirect root
│   ├── components/
│   │   ├── shared/            # Komponen UI bersama (DataTable, Modal, FormField, Toast, dll)
│   │   └── providers.tsx      # Client context providers
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── auth.ts            # Konfigurasi Auth.js & server helper
│   │   ├── rbac.ts            # Matriks izin rute & peran
│   │   ├── money.ts           # Format rupiah & kalkulasi integer
│   │   ├── date.ts            # Penanganan zona waktu Asia/Jakarta (WIB)
│   │   ├── pagination.ts      # Helper paginasi standar
│   │   └── utils.ts           # Utility class styling (cn)
│   ├── services/
│   │   └── contracts.ts       # Kontrak interface teknis antarmodul (IStockService)
│   ├── types/                 # Definisi tipe global TypeScript
│   └── middleware.ts          # Proteksi rute & otorisasi RBAC
├── .env.example               # Template variabel lingkungan
├── docker-compose.yml         # Konfigurasi container PostgreSQL & App
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Pola Komunikasi & Service Layer

1. **Pemisahan Logika Bisnis:**
   - Dilarang menempatkan logika transaksi database yang kompleks langsung di dalam komponen UI.
   - Gunakan folder `src/services/` untuk menulis service class/fungsi (contoh: `stockService.ts`, `reportService.ts`, `orderService.ts`).
2. **Pola Transaksi Database:**
   - Semua operasi yang mengubah stok barang atau menghasilkan transaksi penjualan **wajib** dibungkus dalam `db.$transaction(async (tx) => { ... })`.
   - Gunakan snapshot harga beli (`costPrice`) saat mencatat item penjualan (`sale_items`).
3. **Pola Penggunaan Prisma:**
   - Selalu impor singleton client dari `@/lib/db`. Jangan melakukan `new PrismaClient()` di file modul Anda.

---

## 4. Keamanan & RBAC (Role-Based Access Control)

1. **Pemeriksaan Dua Lapis (Defense in Depth):**
   - **Lapis 1 (Routing):** `src/middleware.ts` memeriksa token JWT session dan memastikan role pengguna sesuai dengan matriks di `src/lib/rbac.ts`. Jika tidak berhak, permintaan diblokir sebelum mencapai halaman.
   - **Lapis 2 (Server-Side Execution):** Pada Route Handler atau Server Action, selalu panggil helper:
     ```ts
     import { requireRole } from "@/lib/auth";

     // Memastikan hanya role ADMIN atau KASIR yang dapat mengeksekusi
     const user = await requireRole(["ADMIN", "KASIR"]);
     ```
2. **Isolasi Data Anggota (Multi-Member Isolation):**
   - Anggota hanya boleh mengakses data miliknya sendiri. Pada modul pesanan anggota (P4), query pesanan wajib menyertakan filter `where: { memberId: session.user.memberId }`.
