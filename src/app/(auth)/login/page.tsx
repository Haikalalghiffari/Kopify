"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Store, Lock, User as UserIcon, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        identifier,
        password,
      });

      if (result?.error) {
        setErrorMessage("Username atau password salah, atau akun nonaktif.");
      } else {
        router.refresh();
        router.push("/");
      }
    } catch {
      setErrorMessage("Terjadi kesalahan sistem saat mencoba masuk.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Sistem Informasi Koperasi
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Masuk untuk mengakses layanan koperasi
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
          {errorMessage && (
            <div className="mb-5 flex items-center gap-2 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-slate-700"
              >
                Username atau Email
              </label>
              <div className="mt-1 relative">
                <input
                  id="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin atau admin@koperasi.local"
                  className="w-full pl-10 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                "Memverifikasi..."
              ) : (
                <>
                  <span>Masuk ke Akun</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Kotak Info Akun Demo Tim */}
          <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-500 space-y-1.5 bg-slate-50 p-3 rounded-lg">
            <p className="font-semibold text-slate-700">Kredensial Development (Seed):</p>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <div>Admin: <span className="font-mono text-emerald-800">admin</span> / <span className="font-mono text-slate-700">AdminKoperasi2026!</span></div>
              <div>Kasir: <span className="font-mono text-emerald-800">kasir</span> / <span className="font-mono text-slate-700">KasirKoperasi2026!</span></div>
              <div className="col-span-2">Anggota: <span className="font-mono text-emerald-800">budi</span> / <span className="font-mono text-slate-700">AnggotaKoperasi2026!</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
