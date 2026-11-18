"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
    >
      Cetak / Simpan PDF
    </button>
  );
}