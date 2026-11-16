"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { orderId: string; status: string };

export default function OrderActions({ orderId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(action: string, reason?: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memproses pesanan.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  function reject() {
    const reason = window.prompt("Alasan penolakan:");
    if (reason && reason.trim()) run("reject", reason);
  }

  const primary =
    "px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50";
  const danger =
    "px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DIAJUKAN" && (
          <>
            <button disabled={loading} onClick={() => run("confirm")} className={primary}>
              Konfirmasi
            </button>
            <button disabled={loading} onClick={reject} className={danger}>
              Tolak
            </button>
          </>
        )}
        {status === "DIKONFIRMASI" && (
          <>
            <button disabled={loading} onClick={() => run("prepare")} className={primary}>
              Mulai siapkan
            </button>
            <button disabled={loading} onClick={reject} className={danger}>
              Tolak
            </button>
          </>
        )}
        {status === "DISIAPKAN" && (
          <button disabled={loading} onClick={() => run("ready")} className={primary}>
            Siap diambil
          </button>
        )}
        {status === "SIAP_DIAMBIL" && (
          <button disabled={loading} onClick={() => run("complete")} className={primary}>
            Selesaikan
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}