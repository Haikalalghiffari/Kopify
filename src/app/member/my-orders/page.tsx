import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import MemberOrderCard from "./MemberOrderCard";
import Link from "next/link";
import { ClipboardList, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const userId = (session.user as any).id;
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { member: true },
  });

  if (!user || !user.memberId) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <ClipboardList className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Akun Belum Tertaut Anggota</h2>
        <p className="text-sm text-gray-500">
          Akun login Anda belum terhubung ke nomor anggota koperasi. Hubungi pengurus koperasi untuk menautkan akun Anda.
        </p>
      </div>
    );
  }

  // PRD AC 6.5: Anggota hanya bisa melihat pesanan miliknya
  const orders = await db.order.findMany({
    where: { memberId: user.memberId },
    include: {
      items: {
        include: {
          product: {
            include: { unit: true },
          },
        },
      },
      member: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/member/catalog"
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#0B3B2C] hover:bg-emerald-50 transition-colors"
              title="Kembali ke Katalog"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B3B2C] tracking-tight">
              Riwayat Pesanan Mandiri
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 pl-8">
            Pantau status pesanan, persiapan barang, dan pengambilan di gerai kasir koperasi.
          </p>
        </div>

        <Link href="/member/catalog">
          <Button className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-bold text-xs rounded-xl px-4 py-2">
            + Pesan Barang Lagi
          </Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#EAF6EE] text-[#0B3B2C] flex items-center justify-center mx-auto">
            <ClipboardList className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Belum Ada Pesanan</h3>
          <p className="text-xs text-gray-500">
            Anda belum pernah membuat pesanan barang. Pesanan yang Anda ajukan akan muncul di sini beserta status prosesnya.
          </p>
          <Link href="/member/catalog">
            <Button className="bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-bold text-xs rounded-xl mt-2">
              Jelajahi Katalog Toko
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <MemberOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
