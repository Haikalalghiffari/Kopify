import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import MemberNavbar from "@/components/layout/MemberNavbar";
import { CartProvider } from "@/context/CartContext";

export const dynamic = "force-dynamic";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#F8FAF8] flex flex-col font-sans">
        <MemberNavbar user={session.user} />

        {/* Main Content with comfortable padding */}
        <main className="flex-1 w-full pb-16">
          {children}
        </main>

        {/* Modern Grocery Footer */}
        <footer className="bg-white border-t border-gray-100 py-8 text-center text-xs text-gray-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[#0B3B2C] text-sm">🌿 Kopify</span>
              <span>— Koperasi For You (Sistem Informasi & Belanja Mandiri Anggota)</span>
            </div>
            <p>© 2026 Koperasi Konsumen Indonesia. Seluruh hak cipta dilindungi.</p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
