import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ShoppingBag, Search, Sparkles } from "lucide-react";

export default async function MemberCatalogPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="space-y-6">
      {/* Member Banner */}
      <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Portal Anggota Koperasi
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            Halo, {session?.user?.name || session?.user?.username}!
          </h1>
          <p className="text-sm text-emerald-100/90 mt-1 max-w-xl">
            Selamat datang di katalog belanja Sistem Informasi Koperasi. Pesan kebutuhan Anda
            secara mudah dan ambil di koperasi.
          </p>
        </div>
      </div>

      {/* Placeholder Fondasi Katalog untuk P4 */}
      <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Katalog Belanja Anggota</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Fondasi autentikasi dan layout anggota telah siap. Modul katalog, keranjang belanja,
          dan checkout pesanan akan diimplementasikan oleh PIC P4 pada Sprint 3.
        </p>
      </div>
    </div>
  );
}
