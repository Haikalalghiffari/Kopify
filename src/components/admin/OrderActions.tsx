"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { orderId: string; status: string };

type PayMethod = "TUNAI" | "TRANSFER" | "BON" | "LAINNYA";
type PayStatus = "LUNAS" | "BELUM_LUNAS";

export default function OrderActions({ orderId, status }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("TUNAI");
  const [paymentStatus, setPaymentStatus] = useState<PayStatus>("LUNAS");
  const busyRef = useRef(false);

  useEffect(() => {
    if (paymentMethod === "BON") {
      setPaymentStatus("BELUM_LUNAS");
    }
  }, [paymentMethod]);

  async function run(
    action: string,
    extra?: { reason?: string; paymentMethod?: PayMethod; paymentStatus?: PayStatus }
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
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
      busyRef.current = false;
    }
  }

  function reject() {
    if (loading) return;
    const reason = window.prompt("Alasan penolakan:");
    if (reason && reason.trim()) run("reject", { reason: reason.trim() });
  }

  function complete() {
    if (loading) return;
    if (
      !window.confirm(
        `Selesaikan pesanan dengan pembayaran ${paymentMethod} (${paymentStatus === "LUNAS" ? "Lunas" : "Belum lunas"})?`
      )
    ) {
      return;
    }
    run("complete", { paymentMethod, paymentStatus });
  }

  function confirmAction(label: string, action: string, extra?: { reason?: string }) {
    if (loading) return;
    if (window.confirm(`${label}?`)) run(action, extra);
  }

  const primary =
    "px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none";
  const danger =
    "px-3 py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none";
  const field =
    "px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DIAJUKAN" && (
          <>
            <button
              disabled={loading}
              onClick={() => confirmAction("Konfirmasi pesanan ini", "confirm")}
              className={primary}
            >
              {loading ? "Memproses..." : "Konfirmasi"}
            </button>
            <button disabled={loading} onClick={reject} className={danger}>
              Tolak
            </button>
          </>
        )}
        {status === "DIKONFIRMASI" && (
          <>
            <button
              disabled={loading}
              onClick={() => confirmAction("Mulai menyiapkan pesanan", "prepare")}
              className={primary}
            >
              {loading ? "Memproses..." : "Mulai siapkan"}
            </button>
            <button disabled={loading} onClick={reject} className={danger}>
              Tolak
            </button>
          </>
        )}
        {status === "DISIAPKAN" && (
          <button
            disabled={loading}
            onClick={() => confirmAction("Tandai siap diambil", "ready")}
            className={primary}
          >
            {loading ? "Memproses..." : "Siap diambil"}
          </button>
        )}
        {status === "SIAP_DIAMBIL" && (
          <div className="flex flex-wrap items-end gap-2 w-full">
            <div>
              <label className="text-xs text-slate-500 block">Metode bayar</label>
              <select
                className={field}
                value={paymentMethod}
                disabled={loading}
                onChange={(e) => setPaymentMethod(e.target.value as PayMethod)}
              >
                <option value="TUNAI">Tunai</option>
                <option value="TRANSFER">Transfer</option>
                <option value="BON">Bon (anggota)</option>
                <option value="LAINNYA">Lainnya</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block">Status bayar</label>
              <select
                className={field}
                value={paymentStatus}
                disabled={loading || paymentMethod === "BON"}
                onChange={(e) => setPaymentStatus(e.target.value as PayStatus)}
              >
                <option value="LUNAS">Lunas</option>
                <option value="BELUM_LUNAS">Belum lunas</option>
              </select>
            </div>
            <button disabled={loading} onClick={complete} className={primary}>
              {loading ? "Memproses..." : "Selesaikan"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}