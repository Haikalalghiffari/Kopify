/**
 * scripts/generate-dummy-anggota.ts
 * Generate file Excel data dummy anggota untuk diimpor ke Kopify.
 * Jalankan: npx tsx scripts/generate-dummy-anggota.ts
 */

import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// ─── Data dummy anggota ───────────────────────────────────────────────────────
const anggota = [
  { no: "ANG-001", nama: "Budi Santoso",        nik: "3273010101900001", hp: "081234567890", email: "budi.santoso@gmail.com",    alamat: "Jl. Merdeka No. 1, Bandung",         tgl: "01/01/2020" },
  { no: "ANG-002", nama: "Siti Rahayu",          nik: "3273020202910002", hp: "081234567891", email: "siti.rahayu@yahoo.com",      alamat: "Jl. Sudirman No. 12, Bandung",       tgl: "15/02/2020" },
  { no: "ANG-003", nama: "Ahmad Fauzi",           nik: "3273030303850003", hp: "081234567892", email: "ahmad.fauzi@gmail.com",     alamat: "Jl. Pahlawan No. 5, Cimahi",         tgl: "10/03/2020" },
  { no: "ANG-004", nama: "Dewi Lestari",          nik: "3273040404930004", hp: "081334567890", email: "dewi.lestari@outlook.com",  alamat: "Jl. Gatot Subroto No. 8, Bandung",   tgl: "22/04/2020" },
  { no: "ANG-005", nama: "Rudi Hermawan",         nik: "3273050505880005", hp: "081434567890", email: "rudi.hermawan@gmail.com",   alamat: "Jl. Diponegoro No. 20, Bandung",     tgl: "05/05/2020" },
  { no: "ANG-006", nama: "Yuni Kartika",          nik: "3273060606920006", hp: "082234567890", email: "yuni.kartika@gmail.com",    alamat: "Jl. Asia Afrika No. 3, Bandung",     tgl: "17/06/2020" },
  { no: "ANG-007", nama: "Hendra Gunawan",        nik: "3273070707870007", hp: "082334567890", email: "hendra.gunawan@yahoo.com",  alamat: "Jl. Braga No. 45, Bandung",          tgl: "08/07/2020" },
  { no: "ANG-008", nama: "Rina Susanti",          nik: "3273080808960008", hp: "082434567890", email: "rina.susanti@gmail.com",    alamat: "Jl. Cihampelas No. 10, Bandung",     tgl: "30/08/2020" },
  { no: "ANG-009", nama: "Dodi Prasetyo",         nik: "3273090909890009", hp: "083234567890", email: "dodi.prasetyo@gmail.com",   alamat: "Jl. Dago No. 7, Bandung",            tgl: "12/09/2020" },
  { no: "ANG-010", nama: "Fitri Handayani",       nik: "3273101010940010", hp: "083334567890", email: "fitri.handayani@gmail.com", alamat: "Jl. Pasteur No. 22, Bandung",        tgl: "25/10/2020" },
  { no: "ANG-011", nama: "Agus Setiawan",         nik: "3273111111830011", hp: "083434567890", email: "agus.setiawan@outlook.com", alamat: "Jl. Ciumbuleuit No. 15, Bandung",    tgl: "03/11/2020" },
  { no: "ANG-012", nama: "Maya Anggraini",        nik: "3273121212950012", hp: "085234567890", email: "maya.anggraini@gmail.com",  alamat: "Jl. Setiabudi No. 9, Bandung",       tgl: "19/12/2020" },
  { no: "ANG-013", nama: "Bambang Wijaya",        nik: "3273010113860013", hp: "085334567890", email: "bambang.wijaya@gmail.com",  alamat: "Jl. Riau No. 33, Bandung",           tgl: "07/01/2021" },
  { no: "ANG-014", nama: "Sri Wahyuni",           nik: "3273020214910014", hp: "085434567890", email: "sri.wahyuni@yahoo.com",     alamat: "Jl. Aceh No. 11, Bandung",           tgl: "14/02/2021" },
  { no: "ANG-015", nama: "Joko Susilo",           nik: "3273030315840015", hp: "087834567890", email: "joko.susilo@gmail.com",     alamat: "Jl. Flores No. 6, Bandung",          tgl: "28/03/2021" },
  { no: "ANG-016", nama: "Lina Marlina",          nik: "3273040416970016", hp: "087934567890", email: "lina.marlina@gmail.com",    alamat: "Jl. Lombok No. 2, Bandung",          tgl: "09/04/2021" },
  { no: "ANG-017", nama: "Eko Purnomo",           nik: "3273050517800017", hp: "088234567890", email: "eko.purnomo@outlook.com",   alamat: "Jl. Sumatra No. 18, Bandung",        tgl: "21/05/2021" },
  { no: "ANG-018", nama: "Nurul Hidayah",         nik: "3273060618920018", hp: "088334567890", email: "nurul.hidayah@gmail.com",   alamat: "Jl. Kalimantan No. 4, Bandung",      tgl: "06/06/2021" },
  { no: "ANG-019", nama: "Wahyu Santoso",         nik: "3273070719870019", hp: "088434567890", email: "wahyu.santoso@gmail.com",   alamat: "Jl. Sulawesi No. 27, Bandung",       tgl: "18/07/2021" },
  { no: "ANG-020", nama: "Ani Suryani",           nik: "3273080820900020", hp: "089234567890", email: "ani.suryani@yahoo.com",     alamat: "Jl. Papua No. 13, Bandung",          tgl: "02/08/2021" },
  { no: "ANG-021", nama: "Dian Permatasari",      nik: "3273090921930021", hp: "089334567890", email: "dian.permatasari@gmail.com",alamat: "Jl. Malabar No. 25, Bandung",        tgl: "15/09/2021" },
  { no: "ANG-022", nama: "Ridwan Kamil",          nik: "3273101022820022", hp: "089434567890", email: "ridwan.kamil@gmail.com",    alamat: "Jl. Talaga Bodas No. 7, Bandung",    tgl: "27/10/2021" },
  { no: "ANG-023", nama: "Tuti Alawiyah",         nik: "3273111123880023", hp: "081111567890", email: "tuti.alawiyah@gmail.com",   alamat: "Jl. Gardujati No. 16, Bandung",      tgl: "10/11/2021" },
  { no: "ANG-024", nama: "Surya Dharma",          nik: "3273121224750024", hp: "081211567890", email: "surya.dharma@outlook.com",  alamat: "Jl. Pungkur No. 8, Bandung",         tgl: "24/12/2021" },
  { no: "ANG-025", nama: "Kartini Dewi",          nik: "3273010125960025", hp: "081311567890", email: "kartini.dewi@gmail.com",    alamat: "Jl. Otto Iskandar Dinata No. 30, Bandung", tgl: "05/01/2022" },
  { no: "ANG-026", nama: "Firmansyah",            nik: "3273020226910026", hp: "081411567890", email: "firmansyah@gmail.com",      alamat: "Jl. Lengkong Besar No. 42, Bandung", tgl: "16/02/2022" },
  { no: "ANG-027", nama: "Meilia Putri",          nik: "3273030327980027", hp: "082211567890", email: "meilia.putri@yahoo.com",    alamat: "Jl. Balong Gede No. 5, Bandung",     tgl: "29/03/2022" },
  { no: "ANG-028", nama: "Hendro Susanto",        nik: "3273040428790028", hp: "082311567890", email: "hendro.susanto@gmail.com",  alamat: "Jl. Cikapayang No. 11, Bandung",     tgl: "11/04/2022" },
  { no: "ANG-029", nama: "Ratnasari Wulandari",   nik: "3273050529940029", hp: "082411567890", email: "ratnasari.w@gmail.com",     alamat: "Jl. Citarum No. 19, Bandung",        tgl: "23/05/2022" },
  { no: "ANG-030", nama: "Fajar Nugroho",         nik: "3273060630860030", hp: "083211567890", email: "fajar.nugroho@gmail.com",   alamat: "Jl. Cibeunying No. 3, Bandung",      tgl: "07/06/2022" },
  { no: "ANG-031", nama: "Hasanah",               nik: "3273070731920031", hp: "083311567890", email: "hasanah@gmail.com",         alamat: "Jl. Cihapit No. 14, Bandung",        tgl: "19/07/2022" },
  { no: "ANG-032", nama: "Prasetyo Adi",          nik: "3273080832810032", hp: "083411567890", email: "prasetyo.adi@outlook.com",  alamat: "Jl. Sukajadi No. 28, Bandung",       tgl: "31/08/2022" },
  { no: "ANG-033", nama: "Yuliana Sari",          nik: "3273090933950033", hp: "085211567890", email: "yuliana.sari@gmail.com",    alamat: "Jl. Sukagalih No. 6, Bandung",       tgl: "13/09/2022" },
  { no: "ANG-034", nama: "Guntur Wibowo",         nik: "3273101034830034", hp: "085311567890", email: "guntur.wibowo@gmail.com",   alamat: "Jl. Arjuna No. 21, Cimahi",          tgl: "25/10/2022" },
  { no: "ANG-035", nama: "Sulistyowati",          nik: "3273111135890035", hp: "085411567890", email: "sulistyowati@yahoo.com",    alamat: "Jl. Baros No. 9, Cimahi",            tgl: "08/11/2022" },
  { no: "ANG-036", nama: "Irwan Setiadi",         nik: "3273121236760036", hp: "087811567890", email: "irwan.setiadi@gmail.com",   alamat: "Jl. Cibabat No. 17, Cimahi",         tgl: "20/12/2022" },
  { no: "ANG-037", nama: "Mutiara Indah",         nik: "3273010137970037", hp: "087911567890", email: "mutiara.indah@gmail.com",   alamat: "Jl. Cibeureum No. 35, Cimahi",       tgl: "02/01/2023" },
  { no: "ANG-038", nama: "Tri Handoko",           nik: "3273020238840038", hp: "088211567890", email: "tri.handoko@outlook.com",   alamat: "Jl. Cigugur No. 10, Cimahi",         tgl: "14/02/2023" },
  { no: "ANG-039", nama: "Novia Anggraeni",       nik: "3273030339990039", hp: "088311567890", email: "novia.anggraeni@gmail.com", alamat: "Jl. Melong No. 23, Cimahi",          tgl: "26/03/2023" },
  { no: "ANG-040", nama: "Dedy Cahyono",          nik: "3273040440780040", hp: "088411567890", email: "dedy.cahyono@gmail.com",    alamat: "Jl. Leuwigajah No. 4, Cimahi",       tgl: "09/04/2023" },
];

// ─── Generate Excel ─────────────────────────────────────────────────────────
async function generate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kopify — Sistem Informasi Koperasi";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Data Anggota");

  // ── Column definitions ──
  ws.columns = [
    { header: "Nomor Anggota",      key: "no",    width: 14 },
    { header: "Nama Lengkap",       key: "nama",  width: 28 },
    { header: "NIK / KTP",          key: "nik",   width: 20 },
    { header: "No. Handphone",      key: "hp",    width: 16 },
    { header: "Email",              key: "email", width: 30 },
    { header: "Alamat",             key: "alamat",width: 45 },
    { header: "Tanggal Bergabung",  key: "tgl",   width: 18 },
  ];

  // ── Style header row ──
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3B2C" } };
    cell.font   = { bold: true, color: { argb: "FFB6F53B" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF134B39" } },
      left:   { style: "thin", color: { argb: "FF134B39" } },
      bottom: { style: "thin", color: { argb: "FF134B39" } },
      right:  { style: "thin", color: { argb: "FF134B39" } },
    };
  });
  headerRow.height = 28;

  // ── Add data rows ──
  anggota.forEach((a, idx) => {
    const row = ws.addRow({
      no:    a.no,
      nama:  a.nama,
      nik:   a.nik,
      hp:    a.hp,
      email: a.email,
      alamat:a.alamat,
      tgl:   a.tgl,
    });

    // Alternate row color
    const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF2F9F4";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 10 };
      cell.alignment = { vertical: "middle", wrapText: false };
      cell.border = {
        top:    { style: "hair", color: { argb: "FFE5EBE7" } },
        left:   { style: "hair", color: { argb: "FFE5EBE7" } },
        bottom: { style: "hair", color: { argb: "FFE5EBE7" } },
        right:  { style: "hair", color: { argb: "FFE5EBE7" } },
      };
    });
    row.height = 18;
  });

  // ── Freeze header row ──
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // ── Auto filter on header ──
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: ws.columns.length },
  };

  // ── Petunjuk sheet ──
  const wsInfo = workbook.addWorksheet("Petunjuk");
  wsInfo.columns = [{ header: "", key: "info", width: 70 }];

  const info = [
    ["PETUNJUK PENGGUNAAN FILE IMPOR DATA ANGGOTA — KOPIFY"],
    [""],
    ["File ini berisi 40 data anggota dummy siap impor ke Sistem Informasi Koperasi (Kopify)."],
    [""],
    ["CARA IMPOR:"],
    ["1. Login ke Kopify sebagai Admin atau Kasir"],
    ["2. Klik menu 'Impor Excel' di sidebar"],
    ["3. Pilih jenis data: Anggota"],
    ["4. Unggah file ini (.xlsx)"],
    ["5. Sistem akan auto-mapping kolom secara otomatis"],
    ["6. Periksa pratinjau & validasi — pastikan 0 error"],
    ["7. Klik Konfirmasi & Impor"],
    [""],
    ["KETERANGAN KOLOM:"],
    ["Nomor Anggota  : Wajib. Harus unik. Format bebas (ANG-001, dsb)"],
    ["Nama Lengkap   : Wajib."],
    ["NIK / KTP      : Opsional. 16 digit angka."],
    ["No. Handphone  : Opsional. Format: 08xx-xxxx-xxxx"],
    ["Email          : Opsional."],
    ["Alamat         : Opsional."],
    ["Tanggal Bergabung : Opsional. Format: dd/mm/yyyy atau yyyy-mm-dd"],
    [""],
    ["MODE DUPLIKAT:"],
    ["- LEWATI  : Jika nomor anggota sudah ada, baris dilewati (tidak error)"],
    ["- PERBARUI: Jika nomor anggota sudah ada, data diperbarui"],
    ["- ERROR   : Jika nomor anggota sudah ada, ditandai sebagai error"],
  ];

  info.forEach((line, i) => {
    const r = wsInfo.addRow({ info: line[0] });
    if (i === 0) {
      r.getCell(1).font = { bold: true, size: 13, color: { argb: "FF0B3B2C" } };
    } else if (["CARA IMPOR:", "KETERANGAN KOLOM:", "MODE DUPLIKAT:"].includes(line[0])) {
      r.getCell(1).font = { bold: true, size: 11, color: { argb: "FF134B39" } };
    } else {
      r.getCell(1).font = { size: 10 };
    }
  });

  // ── Save file ──
  const outDir = path.resolve(process.cwd(), "dummy-data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "Data_Dummy_Anggota_Kopify.xlsx");
  await workbook.xlsx.writeFile(outPath);

  console.log("\n✅ File berhasil dibuat:");
  console.log(`   ${outPath}`);
  console.log(`\n   📋 Total anggota : ${anggota.length} baris`);
  console.log(`   📄 Sheet         : "Data Anggota" + "Petunjuk"\n`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
