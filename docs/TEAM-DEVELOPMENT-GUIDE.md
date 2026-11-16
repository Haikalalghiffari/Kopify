# Panduan Pengembangan Tim — Sistem Informasi Koperasi

Panduan ini wajib dibaca dan diikuti oleh seluruh pengembang modul (P2, P3, P4, dan P5) agar proses integrasi berjalan lancar tanpa konflik arsitektur.

---

## 1. Standar Branching & Alur Git

Sistem menggunakan alur branch terstruktur:

```text
main (branch produksi stabil)
  └── develop (branch integrasi utama)
        ├── feature/p2-master-data
        ├── feature/p3-excel-import
        ├── feature/p4-orders-sales
        └── feature/p5-dashboard-reports
```

### Aturan Branch:
1. **Dilarang Commit Langsung ke `main` atau `develop`.**
2. Setiap pengembang membuat feature branch masing-masing yang dicabangkan dari `develop`:
   - P2: `git checkout develop && git checkout -b feature/p2-master-data`
   - P3: `git checkout develop && git checkout -b feature/p3-excel-import`
   - P4: `git checkout develop && git checkout -b feature/p4-orders-sales`
   - P5: `git checkout develop && git checkout -b feature/p5-dashboard-reports`
3. Lakukan `git pull origin develop --rebase` secara berkala agar branch Anda selalu mutakhir.

---

## 2. Standar Pesan Commit (Conventional Commits)

Format commit yang wajib digunakan:
`<tipe>(<cakupan>): <deskripsi singkat>`

Contoh tipe:
- `feat`: Menambahkan fitur baru (contoh: `feat(stock): implementasi form restock barang`)
- `fix`: Memperbaiki bug (contoh: `fix(orders): perbaiki perhitungan reservasi stok`)
- `docs`: Dokumentasi (contoh: `docs(api): perbarui panduan impor excel`)
- `refactor`: Perubahan kode tanpa mengubah fungsionalitas
- `test`: Menambahkan atau memperbaiki pengujian

---

## 3. Aturan Pengajuan Pull Request (PR)

1. Target PR selalu mengarah ke branch `develop`.
2. Syarat PR disetujui (Merge Requirements):
   - Seluruh unit test lulus (`npm test`).
   - Type-check TypeScript bersih tanpa error (`npm run type-check`).
   - Linter bersih (`npm run lint`).
   - Minimal **1 reviewer** menyetujui.
   - PR yang menyentuh direktori `prisma/`, `src/lib/auth.ts`, atau `src/middleware.ts` **wajib mendapatkan approval dari P1 (Tech Lead)**.

---

## 4. Panduan Penggunaan Utilitas Bersama

### A. Uang & Rupiah
Gunakan utilitas di `@/lib/money`:
```ts
import { formatRupiah, parseRupiah } from "@/lib/money";

const display = formatRupiah(1500000); // "Rp 1.500.000"
const value = parseRupiah("1.500.000"); // 1500000
```
> **Penting:** Semua nilai harga dan total dihitung dalam integer rupiah, jangan gunakan float.

### B. Tanggal & Zona Waktu WIB
Gunakan utilitas di `@/lib/date`:
```ts
import { startOfDayWIB, startOfWeekWIB, startOfMonthWIB, formatDateWIB } from "@/lib/date";

const todayStart = startOfDayWIB(); // 00:00:00 WIB
const weekStart = startOfWeekWIB();   // Senin 00:00:00 WIB
const label = formatDateWIB(new Date()); // "16 November 2026"
```

### C. Komponen UI Bersama
Manfaatkan komponen yang sudah disediakan P1 di `@/components/shared`:
- `<DataTable columns={...} data={...} pagination={...} />`
- `<FormField label="Nama Barang" error={...}><Input ... /></FormField>`
- `<ConfirmDialog isOpen={...} onConfirm={...} />`
- `<StatusBadge status="DIKONFIRMASI" />`
- `const { success, error } = useToast()`

### D. Kontrak StockService untuk P2, P3, dan P4
Lihat definisi antarmuka di `src/services/contracts.ts`.
- **P2** bertanggung jawab membuat implementasi di `src/services/stockService.ts` yang mengimplementasikan `IStockService`.
- **P3** dan **P4** memanggil fungsi `adjustStock`, `reserve`, `release`, dan `commitReservation` sesuai kontrak tersebut.
