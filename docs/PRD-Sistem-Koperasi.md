# PRD — Sistem Informasi Koperasi

| Atribut | Nilai |
|---|---|
| Versi | 1.0 (Draft) |
| Tanggal | 16 November 2026 |
| Status | Siap dieksekusi oleh AI agent / developer |
| Bahasa UI | Bahasa Indonesia |
| Mata uang | Rupiah (IDR), tanpa desimal |
| Zona waktu | Asia/Jakarta (WIB) |

---

## 0. Petunjuk untuk Tim

Dokumen ini adalah sumber kebenaran (source of truth). Saat mengimplementasikan:

1. Kerjakan **per fase** di Bagian 12 secara berurutan. Jangan lompat fase.
2. Setiap fitur wajib memenuhi **Acceptance Criteria** (AC) di Bagian 6.
3. Gunakan **Tech Stack** di Bagian 9 kecuali ada alasan kuat untuk mengganti; catat alasan di `DECISIONS.md`.
4. Semua angka uang disimpan sebagai **integer (rupiah)**, bukan float.
5. Semua operasi yang mengubah stok harus **atomik (dalam transaksi database)**.
6. Setelah tiap fase selesai: jalankan test, buat ringkasan perubahan, lalu tunggu konfirmasi.
7. Jika ada ketentuan yang ambigu, lihat Bagian 14 (Asumsi & Pertanyaan Terbuka) sebelum bertanya.

---

## 1. Ringkasan

Sistem Informasi Koperasi adalah aplikasi web untuk mengelola unit usaha koperasi (toko/simpan pinjam-ringan sesuai cakupan di bawah): data anggota, katalog barang, stok, pesanan anggota, transaksi penjualan, dan pelaporan.

Sistem harus dapat **mengimpor data dari Excel sistem lama** agar koperasi tidak mengetik ulang, mendukung **pemesanan oleh anggota**, menampilkan **analitik barang terlaris dan stok terbanyak**, serta menghasilkan **laporan harian, pekanan, bulanan, dan tahunan**.

## 2. Latar Belakang & Masalah

- Pencatatan lama berbasis Excel: rawan salah input, sulit dicari, tidak real-time.
- Stok tidak terpantau akurat; pengurus sulit tahu barang apa yang laku dan yang menumpuk.
- Anggota harus datang/menghubungi pengurus secara manual untuk memesan barang.
- Laporan periodik disusun manual sehingga memakan waktu.

## 3. Tujuan & Metrik Keberhasilan

| Tujuan | Metrik | Target |
|---|---|---|
| Migrasi data lama cepat | Waktu impor 1.000 baris | < 30 detik |
| Akurasi stok | Selisih stok sistem vs fisik saat opname | < 2% |
| Adopsi pesanan anggota | Persentase pesanan yang masuk via sistem | ≥ 50% dalam 3 bulan |
| Efisiensi pelaporan | Waktu menyusun laporan bulanan | dari jam → < 1 menit |
| Keandalan | Uptime | ≥ 99% |

## 4. Di Luar Cakupan (Non-Goals) v1.0

- Modul simpan pinjam penuh (simpanan pokok/wajib/sukarela, angsuran, SHU) — dapat ditambahkan di v2.
- Integrasi payment gateway otomatis (pembayaran dicatat manual oleh kasir/admin).
- Aplikasi mobile native (cukup web responsif/PWA).
- Integrasi pengiriman/kurir.
- Akuntansi lengkap (jurnal umum, neraca).

## 5. Persona & Peran (Role)

| Role | Deskripsi | Hak Akses Utama |
|---|---|---|
| **Admin** | Pengurus/pengelola sistem | Akses penuh, kelola user, impor data, semua laporan |
| **Kasir/Staf** | Operator harian | Input barang, stok, proses pesanan, transaksi POS, laporan terbatas |
| **Anggota** | Anggota koperasi | Login, lihat katalog, buat & pantau pesanan sendiri, riwayat pesanan |

---

## 6. Kebutuhan Fungsional

### 6.1 Autentikasi & Manajemen Pengguna

- **FR-1.1** Login dengan username/email + password.
- **FR-1.2** Role-based access control (Admin, Kasir, Anggota).
- **FR-1.3** Admin dapat membuat/menonaktifkan akun dan reset password.
- **FR-1.4** Anggota dapat mengubah password dan profil sendiri.

**AC**
- Password disimpan ter-hash (bcrypt/argon2).
- Halaman/endpoint di luar hak role mengembalikan 403.
- Sesi kedaluwarsa setelah 8 jam tidak aktif.

### 6.2 Manajemen Data Master

**a. Anggota**: nomor anggota (unik), nama, NIK (opsional), alamat, no. HP, email, tanggal bergabung, status (aktif/nonaktif).
**b. Barang**: kode/SKU (unik), nama, kategori, satuan, harga beli, harga jual, stok saat ini, stok minimum, status aktif.
**c. Kategori Barang** dan **Satuan**.
**d. Pemasok** (opsional): nama, kontak.

- **FR-2.1** CRUD untuk seluruh data master (hapus = *soft delete*).
- **FR-2.2** Pencarian, filter, sortir, dan paginasi pada semua daftar.
- **FR-2.3** Validasi duplikat pada nomor anggota dan SKU.

**AC**
- Barang yang sudah punya transaksi tidak bisa dihapus permanen, hanya dinonaktifkan.
- Pencarian merespons < 1 detik untuk 10.000 data.

### 6.3 Input Manual & Impor dari Excel (Konversi Sistem Lama)

Dua jalur pemasukan data:

**A. Input manual** — formulir tambah/ubah untuk anggota, barang, dan penyesuaian stok.

**B. Impor Excel** — wizard 4 langkah:

1. **Unggah** file `.xlsx` / `.xls` / `.csv` (maks. 10 MB).
2. **Pemetaan kolom** — sistem menampilkan kolom Excel dan pengguna memetakan ke kolom sistem (auto-suggest berdasarkan kemiripan nama kolom). Pemetaan dapat **disimpan sebagai template** untuk dipakai ulang.
3. **Pratinjau & Validasi** — tampilkan 20 baris pertama, jumlah baris valid/error, dan daftar error per baris (nomor baris, kolom, pesan).
4. **Konfirmasi & Eksekusi** — impor dijalankan; hasil berupa ringkasan (berhasil, dilewati, gagal) dan laporan error yang dapat diunduh (`.xlsx`).

**Jenis data yang dapat diimpor**
- Anggota
- Barang (termasuk stok awal)
- Riwayat transaksi/penjualan (opsional, untuk histori laporan)

**Aturan**
- **FR-3.1** Mode duplikat dipilih pengguna: *lewati*, *perbarui data yang ada*, atau *tandai error*. Kunci pencocokan: nomor anggota (anggota), SKU (barang).
- **FR-3.2** Proses impor bersifat **transaksional per batch**; bila gagal fatal, seluruh batch di-*rollback*.
- **FR-3.3** Setiap impor dicatat di tabel `import_logs` (siapa, kapan, file, jumlah baris, status).
- **FR-3.4** Sediakan **template Excel** yang dapat diunduh untuk tiap jenis data.
- **FR-3.5** Normalisasi otomatis: trim spasi, format angka Indonesia (`1.500.000` / `1,500,000`), format tanggal (`dd/mm/yyyy`, `yyyy-mm-dd`), huruf besar-kecil pada kode.
- **FR-3.6** Stok awal hasil impor tercatat sebagai pergerakan stok bertipe `IMPORT`.

**AC**
- File berisi 1.000 baris diproses < 30 detik.
- Baris dengan data wajib kosong atau format salah ditolak dengan pesan jelas, tanpa menggagalkan baris valid (kecuali mode *strict* dipilih).
- Impor ulang file yang sama dengan mode *lewati* tidak membuat data ganda.

### 6.4 Manajemen Stok

- **FR-4.1** Setiap perubahan stok dicatat di `stock_movements` (tipe: `IMPORT`, `PURCHASE` (barang masuk), `SALE`, `ORDER_FULFILLED`, `ADJUSTMENT`, `RETURN`) beserta jumlah, stok sebelum/sesudah, user, dan waktu.
- **FR-4.2** Form **barang masuk** (restock) dan **penyesuaian stok/opname** dengan alasan wajib.
- **FR-4.3** Peringatan visual untuk barang dengan stok ≤ stok minimum.
- **FR-4.4** Stok tidak boleh negatif.

**AC**
- Stok saat ini = hasil penjumlahan seluruh pergerakan (dapat diaudit).
- Dua transaksi bersamaan atas barang yang sama tidak membuat stok negatif (gunakan row lock/optimistic locking).

### 6.5 Pesanan oleh Anggota

**Alur status pesanan**

```
DIAJUKAN → DIKONFIRMASI → DISIAPKAN → SIAP_DIAMBIL → SELESAI
     │            │
     └────────────┴──→ DIBATALKAN / DITOLAK
```

**Sisi anggota**
- **FR-5.1** Melihat katalog barang aktif (cari, filter kategori, tampilkan harga & ketersediaan stok).
- **FR-5.2** Menambah barang ke keranjang, mengubah jumlah, dan mengirim pesanan beserta catatan.
- **FR-5.3** Melihat riwayat dan status pesanan miliknya; dapat membatalkan selama status `DIAJUKAN`.
- **FR-5.4** Jumlah pesanan tidak boleh melebihi stok tersedia saat diajukan.

**Sisi admin/kasir**
- **FR-5.5** Daftar pesanan masuk dengan filter status/tanggal/anggota; notifikasi (badge) untuk pesanan baru.
- **FR-5.6** Mengonfirmasi, menolak (dengan alasan), mengubah status pesanan.
- **FR-5.7** Saat status menjadi `SELESAI`, sistem otomatis: mengurangi stok, membuat transaksi penjualan, dan mencatat metode pembayaran (tunai/transfer/dicatat/bon) serta status bayar (lunas/belum).
- **FR-5.8** Cetak/unduh struk atau bukti pesanan (PDF).
- **FR-5.9** Kasir dapat membuat pesanan atas nama anggota (misalnya anggota memesan lewat telepon).

**AC**
- Stok **dicadangkan (reserved)** saat pesanan `DIKONFIRMASI` agar tidak terjual ke pihak lain; cadangan dilepas jika dibatalkan/ditolak.
- Anggota hanya bisa melihat pesanan miliknya (uji akses lintas anggota harus mengembalikan 403/404).
- Nomor pesanan unik dan berformat `ORD-YYYYMMDD-XXXX`.

### 6.6 Transaksi Penjualan Langsung (Kasir/POS Sederhana)

- **FR-6.1** Kasir dapat mencatat penjualan langsung (anggota atau umum) tanpa pesanan sebelumnya.
- **FR-6.2** Pilih barang, jumlah, diskon (opsional), metode bayar; stok berkurang otomatis.
- **FR-6.3** Penjualan dari pesanan yang selesai dan penjualan langsung digabung dalam satu tabel `sales` untuk keperluan laporan.

### 6.7 Dasbor & Analitik

Halaman dasbor (Admin/Kasir) menampilkan:

| Widget | Penjelasan |
|---|---|
| **Barang Terlaris** | Top N (default 10) berdasarkan jumlah terjual; filter periode (hari ini, 7 hari, 30 hari, tahun ini, kustom) |
| **Stok Terbanyak** | Top N barang dengan stok tertinggi (opsi tambahan: nilai stok = stok × harga beli) |
| **Stok Menipis** | Barang dengan stok ≤ stok minimum |
| **Ringkasan Penjualan** | Total penjualan & jumlah transaksi hari ini, bulan ini |
| **Pesanan Menunggu** | Jumlah pesanan berstatus `DIAJUKAN` |
| **Grafik Tren** | Penjualan harian 30 hari terakhir |

- **FR-7.1** Barang terlaris dapat diurutkan berdasarkan **kuantitas** atau **omzet**.
- **FR-7.2** Setiap widget dapat diekspor (CSV/Excel).

**AC**
- Data dasbor konsisten dengan laporan untuk periode yang sama.
- Pemuatan dasbor < 2 detik pada 100.000 baris transaksi.

### 6.8 Pelaporan

| Laporan | Periode | Isi Minimum |
|---|---|---|
| **Harian** | Pilih tanggal | Jumlah transaksi, total penjualan, laba kotor, rincian per barang, rincian per metode bayar |
| **Pekanan** | Pilih minggu (Senin–Minggu) | Total per hari dalam minggu itu, total minggu, barang terlaris, perbandingan dengan minggu lalu |
| **Bulanan** | Pilih bulan & tahun | Total per hari/pekan, total bulan, barang terlaris, kategori terlaris, perbandingan bulan lalu, stok menipis |
| **Tahunan** | Pilih tahun | Total per bulan, total tahun, barang terlaris, kategori terlaris, perbandingan tahun lalu |

Laporan tambahan yang disarankan:
- **Laporan stok** (posisi stok, nilai persediaan, pergerakan stok per periode).
- **Laporan pesanan** (jumlah per status, pesanan per anggota).

**Aturan umum**
- **FR-8.1** Setiap laporan dapat **ditampilkan di layar**, **diekspor ke PDF dan Excel**, serta **dicetak**.
- **FR-8.2** Laba kotor = Σ (harga jual − harga beli saat transaksi) × jumlah. Harga beli disalin ke item transaksi (snapshot) agar laporan lama tidak berubah bila harga diubah.
- **FR-8.3** Transaksi berstatus batal tidak dihitung.
- **FR-8.4** Hanya Admin dan Kasir yang dapat mengakses laporan; Kasir dibatasi pada laporan harian & stok (dapat dikonfigurasi Admin).

**AC**
- Total pada laporan harian berjumlah sama dengan total pekanan/bulanan/tahunan yang mencakup tanggal tersebut.
- Hari tanpa transaksi tetap muncul dengan nilai 0 pada grafik/tabel periodik.
- Batas hari ditentukan zona waktu Asia/Jakarta.

### 6.9 Log Aktivitas (Audit)

- **FR-9.1** Catat aksi penting: login, CRUD data master, penyesuaian stok, perubahan status pesanan, impor data.
- **FR-9.2** Admin dapat melihat dan memfilter log.

---

## 7. Kebutuhan Non-Fungsional

| Kategori | Kebutuhan |
|---|---|
| Performa | Halaman utama < 2 detik; query laporan tahunan < 5 detik pada 500.000 baris |
| Keamanan | HTTPS, hash password, proteksi CSRF/XSS/SQL injection, validasi input server-side, rate limit login |
| Keandalan | Backup database otomatis harian; retensi 30 hari |
| Kegunaan | Responsif (mobile-first untuk anggota), kontras & ukuran font yang nyaman, UI sederhana untuk pengguna non-teknis |
| Pemeliharaan | Kode ber-tipe, linting, migrasi database berversi, README & `.env.example` |
| Lokalisasi | Format tanggal `dd MMMM yyyy`, angka `Rp 1.500.000` |
| Skalabilitas | Mendukung ≥ 5.000 anggota, ≥ 10.000 barang, ≥ 500.000 transaksi |

---

## 8. Model Data (Ringkas)

```
users            (id, username, email, password_hash, role, member_id?, is_active, created_at)
members          (id, member_no UNIQUE, name, nik?, address, phone, email, joined_at, status, deleted_at)
categories       (id, name)
units            (id, name)
suppliers        (id, name, phone, address)
products         (id, sku UNIQUE, name, category_id, unit_id, cost_price INT, sell_price INT,
                  stock INT, reserved_stock INT, min_stock INT, is_active, deleted_at)
stock_movements  (id, product_id, type, qty_change, stock_before, stock_after,
                  ref_type, ref_id, note, created_by, created_at)
orders           (id, order_no UNIQUE, member_id, status, note, reject_reason?,
                  total INT, created_by, created_at, updated_at)
order_items      (id, order_id, product_id, qty, unit_price INT)
sales            (id, sale_no UNIQUE, order_id?, member_id?, total INT, discount INT,
                  payment_method, payment_status, status, sold_at, created_by)
sale_items       (id, sale_id, product_id, qty, unit_price INT, cost_price INT)   -- snapshot
import_logs      (id, type, filename, total_rows, success_rows, failed_rows, status,
                  mapping_json, created_by, created_at)
import_templates (id, type, name, mapping_json, created_by)
audit_logs       (id, user_id, action, entity, entity_id, detail_json, created_at)
```

**Indeks penting**: `sales(sold_at)`, `sale_items(product_id)`, `orders(member_id, status)`, `stock_movements(product_id, created_at)`.
