"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Sparkles } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Email atau password salah");
      } else {
        toast.success("Login berhasil! Mengalihkan...");
        router.push("/");
        router.refresh();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const fillQuickAccount = (email: string, pass: string) => {
    form.setValue("email", email);
    form.setValue("password", pass);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAF8] p-4 relative overflow-hidden font-sans">
      {/* Decorative Grocery Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#B6F53B]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#0B3B2C]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0B3B2C] text-[#B6F53B] text-2xl shadow-lg shadow-[#0B3B2C]/20 mb-1">
            🛒
          </div>
          <h1 className="text-3xl font-extrabold text-[#0B3B2C] tracking-tight">
            Kopify<span className="text-[#B6F53B]">.</span>
          </h1>
          <p className="text-xs text-gray-500 max-w-xs mx-auto font-medium">
            Koperasi For You — Belanja Mandiri & Pengelolaan Toko
          </p>
        </div>

        <Card className="border border-gray-100 shadow-xl rounded-3xl bg-white overflow-hidden">
          <CardHeader className="pb-4 pt-6 text-center">
            <CardTitle className="text-lg font-bold text-[#0B3B2C]">Masuk ke Akun</CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Gunakan email dan password terdaftar Anda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nama@koperasi.id"
                    className="pl-10 rounded-xl h-11 text-sm border-gray-200 focus:border-[#0B3B2C]"
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 rounded-xl h-11 text-sm border-gray-200 focus:border-[#0B3B2C]"
                    {...form.register("password")}
                  />
                </div>
                {form.formState.errors.password && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#0B3B2C] hover:bg-[#134B39] text-[#B6F53B] font-extrabold text-sm shadow-md transition-all mt-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  "Masuk Sekarang"
                )}
              </Button>
            </form>

            {/* Quick Demo Fill Buttons */}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" /> Akun Demo Siap Pakai:
              </p>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => fillQuickAccount("admin@koperasi.id", "admin123")}
                  className="p-2 rounded-xl bg-[#EAF6EE] hover:bg-emerald-100 text-[#0B3B2C] font-semibold text-[11px] transition-colors border border-emerald-200/50 text-center"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickAccount("kasir@koperasi.id", "kasir123")}
                  className="p-2 rounded-xl bg-[#F8FAF8] hover:bg-gray-100 text-gray-700 font-semibold text-[11px] transition-colors border border-gray-200 text-center"
                >
                  💵 Kasir
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickAccount("budi@example.com", "anggota123")}
                  className="p-2 rounded-xl bg-[#F8FAF8] hover:bg-gray-100 text-gray-700 font-semibold text-[11px] transition-colors border border-gray-200 text-center"
                >
                  🛍️ Anggota
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
