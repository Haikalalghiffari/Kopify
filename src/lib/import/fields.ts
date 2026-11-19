import type { FieldDefinition, ImportDataType, MemberFieldKey, ProductFieldKey } from "./types";

export const MEMBER_FIELDS: FieldDefinition<MemberFieldKey>[] = [
  {
    key: "memberNo",
    label: "Nomor Anggota",
    required: true,
    synonyms: [
      "nomor anggota",
      "no anggota",
      "no. anggota",
      "member no",
      "member_no",
      "kode anggota",
    ],
  },
  {
    key: "name",
    label: "Nama",
    required: true,
    synonyms: ["nama", "nama anggota", "name", "full name", "nama lengkap"],
  },
  {
    key: "nik",
    label: "NIK",
    required: false,
    synonyms: ["nik", "no ktp", "ktp"],
  },
  {
    key: "address",
    label: "Alamat",
    required: false,
    synonyms: ["alamat", "address", "domisili"],
  },
  {
    key: "phone",
    label: "No. HP",
    required: false,
    synonyms: ["no hp", "hp", "telepon", "phone", "no. telepon", "whatsapp", "wa"],
  },
  {
    key: "email",
    label: "Email",
    required: false,
    synonyms: ["email", "e-mail", "surel"],
  },
  {
    key: "joinedAt",
    label: "Tanggal Bergabung",
    required: false,
    synonyms: [
      "tanggal bergabung",
      "tgl bergabung",
      "joined at",
      "joined_at",
      "tanggal masuk",
    ],
  },
  {
    key: "status",
    label: "Status Keanggotaan",
    required: false,
    synonyms: ["status", "status anggota", "member status"],
  },
];

export const PRODUCT_FIELDS: FieldDefinition<ProductFieldKey>[] = [
  {
    key: "sku",
    label: "SKU / Kode Barang",
    required: true,
    synonyms: ["sku", "kode", "kode barang", "kode_barang", "product code"],
  },
  {
    key: "name",
    label: "Nama Barang",
    required: true,
    synonyms: ["nama barang", "nama", "product name", "nama produk"],
  },
  {
    key: "categoryName",
    label: "Kategori",
    required: true,
    synonyms: ["kategori", "category", "jenis", "kelompok barang"],
  },
  {
    key: "unitName",
    label: "Satuan",
    required: true,
    synonyms: ["satuan", "unit", "uom", "satuan ukur"],
  },
  {
    key: "costPrice",
    label: "Harga Beli",
    required: true,
    synonyms: ["harga beli", "harga modal", "cost", "cost price", "hpp"],
  },
  {
    key: "sellPrice",
    label: "Harga Jual",
    required: true,
    synonyms: ["harga jual", "harga", "sell price", "harga eceran"],
  },
  {
    key: "openingStock",
    label: "Stok Awal",
    required: false,
    synonyms: ["stok awal", "stok", "opening stock", "stock", "qty", "jumlah stok"],
  },
  {
    key: "minStock",
    label: "Stok Minimum",
    required: false,
    synonyms: ["stok minimum", "min stock", "stok min", "minimum stok"],
  },
  {
    key: "isActive",
    label: "Status Aktif",
    required: false,
    synonyms: ["aktif", "status", "is active", "status aktif"],
  },
];

export function fieldsForImportType(type: ImportDataType): FieldDefinition[] {
  return type === "MEMBERS" ? MEMBER_FIELDS : PRODUCT_FIELDS;
}

export function requiredFieldKeys(type: ImportDataType): string[] {
  return fieldsForImportType(type)
    .filter((f) => f.required)
    .map((f) => f.key);
}