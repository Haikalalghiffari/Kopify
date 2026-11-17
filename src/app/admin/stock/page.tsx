"use client";

import { useState, useEffect, useTransition } from "react";
import { getStockList, getStockMovements, getStockSummary, handleRestock, handleOpname } from "@/actions/stock";
import { formatRupiah } from "@/lib/money";
import { formatDateTime } from "@/lib/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Boxes, PlusCircle, Scale, AlertTriangle, Search, Loader2, ArrowUpRight, ArrowDownRight, History } from "lucide-react";

export default function StockManagementPage() {
  const [summary, setSummary] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("inventory");
  const [isPending, startTransition] = useTransition();

  // Restock Dialog State
  const [restockOpen, setRestockOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockCost, setRestockCost] = useState(0);
  const [restockNote, setRestockNote] = useState("Barang masuk dari pemasok");

  // Opname Dialog State
  const [opnameOpen, setOpnameOpen] = useState(false);
  const [opnamePhysical, setOpnamePhysical] = useState(0);
  const [opnameReason, setOpnameReason] = useState("");

  const loadData = () => {
    startTransition(async () => {
      try {
        const [sumRes, stockRes, movRes] = await Promise.all([
          getStockSummary(),
          getStockList({ page, limit: 10, search, status: statusFilter }),
          getStockMovements({ page: 1, limit: 15 }),
        ]);
        setSummary(sumRes);
        setProducts(stockRes.data);
        setTotal(stockRes.total);
        setMovements(movRes.data);
      } catch (err: any) {
        toast.error("Gagal memuat data stok");
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const openRestockModal = (p: any) => {
    setSelectedProduct(p);
    setRestockQty(10);
    setRestockCost(p.costPrice);
    setRestockNote("Barang masuk dari pemasok");
    setRestockOpen(true);
  };

  const openOpnameModal = (p: any) => {
    setSelectedProduct(p);
    setOpnamePhysical(p.stock);
    setOpnameReason("");
    setOpnameOpen(true);
  };

  const submitRestockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await handleRestock({
        productId: selectedProduct.id,
        qty: Number(restockQty),
        newCostPrice: Number(restockCost) || undefined,
        note: restockNote,
      });
      toast.success(`Berhasil menambah ${restockQty} ${selectedProduct.unit.name} untuk ${selectedProduct.name}`);
      setRestockOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal mencatat barang masuk");
    }
  };

  const submitOpnameAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!opnameReason.trim()) {
      toast.error("Alasan penyesuaian wajib diisi!");
      return;
    }
    try {
      await handleOpname({
        productId: selectedProduct.id,
        actualPhysicalStock: Number(opnamePhysical),
        reason: opnameReason,
      });
      toast.success(`Stok fisik untuk ${selectedProduct.name} berhasil disesuaikan menjadi ${opnamePhysical}`);
      setOpnameOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan opname stok");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-primary" /> Manajemen & Audit Stok
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Pantau stok fisik real-time, pencatatan barang masuk (restock), dan opname stok teraudit
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Item (SKU)</p>
            <p className="text-2xl font-extrabold text-[#0B3B2C] mt-1">{summary?.totalSKU || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Barang aktif terdaftar</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nilai Total Persediaan</p>
            <p className="text-2xl font-extrabold text-[#0B3B2C] mt-1">
              {formatRupiah(summary?.totalInventoryValue || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Berdasarkan harga beli gudang</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Stok Menipis</p>
            <p className="text-2xl font-extrabold text-orange-600 mt-1">{summary?.lowStockCount || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Di bawah batas minimum stok</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Stok Habis</p>
            <p className="text-2xl font-extrabold text-red-600 mt-1">{summary?.outOfStockCount || 0}</p>
            <p className="text-xs text-gray-400 mt-1">Perlu restock segera</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-xl">
          <TabsTrigger value="inventory" className="rounded-lg text-xs font-semibold">
            📦 Daftar Stok Barang
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Riwayat Mutasi Stok (Audit Trail)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Inventory Table */}
        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cari SKU atau nama barang..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    value={statusFilter}
                    onValueChange={(val) => {
                      setStatusFilter(val === "ALL" ? "" : (val ?? ""));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Semua Kondisi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua Kondisi</SelectItem>
                      <SelectItem value="SAFE">Stok Aman</SelectItem>
                      <SelectItem value="LOW">Stok Menipis</SelectItem>
                      <SelectItem value="OUT">Stok Habis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" variant="secondary">Cari</Button>
              </form>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Harga Beli</TableHead>
                      <TableHead className="text-right">Stok Fisik</TableHead>
                      <TableHead className="text-right">Dicadangkan</TableHead>
                      <TableHead className="text-right">Nilai Aset</TableHead>
                      <TableHead className="text-right">Aksi Stok</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isPending ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          Memuat data stok...
                        </TableCell>
                      </TableRow>
                    ) : products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                          Tidak ada data barang yang sesuai.
                        </TableCell>
                      </TableRow>
                    ) : (
                      products.map((p) => {
                        const isOutOfStock = p.stock <= 0;
                        const isLowStock = p.stock > 0 && p.stock <= p.minStock;

                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-semibold text-primary">{p.sku}</TableCell>
                            <TableCell>
                              <p className="font-medium text-gray-900">{p.name}</p>
                              <span className="text-xs text-gray-400">Min. stok: {p.minStock} {p.unit.name}</span>
                            </TableCell>
                            <TableCell className="text-gray-600">{p.category.name}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatRupiah(p.costPrice)}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-bold inline-flex items-center gap-1 ${
                                  isOutOfStock
                                    ? "text-red-600"
                                    : isLowStock
                                    ? "text-orange-600"
                                    : "text-emerald-700"
                                }`}
                              >
                                {(isOutOfStock || isLowStock) && <AlertTriangle className="h-3.5 w-3.5" />}
                                {p.stock} {p.unit.name}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-orange-600 font-semibold">
                              {p.reservedStock > 0 ? `${p.reservedStock} ${p.unit.name}` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium text-gray-900 text-xs">
                              {formatRupiah(p.stock * p.costPrice)}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => openRestockModal(p)}
                              >
                                <PlusCircle className="h-3.5 w-3.5 mr-1" /> Masuk
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                                onClick={() => openOpnameModal(p)}
                              >
                                <Scale className="h-3.5 w-3.5 mr-1" /> Opname
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-500">Total <b>{total}</b> barang</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * 10 >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Audit Trail (Stock Movements) */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Catatan Mutasi Stok Teraudit</CardTitle>
              <p className="text-xs text-gray-500">
                Seluruh riwayat perubahan stok dicatat secara atomik beserta sebelum/sesudah dan nama operator
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Barang</TableHead>
                      <TableHead>Jenis Mutasi</TableHead>
                      <TableHead className="text-right">Perubahan</TableHead>
                      <TableHead className="text-right">Stok Sebelum</TableHead>
                      <TableHead className="text-right">Stok Sesudah</TableHead>
                      <TableHead>Catatan / Alasan</TableHead>
                      <TableHead>Operator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          Belum ada catatan mutasi stok.
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDateTime(m.createdAt)}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-gray-900 block text-xs">{m.product.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{m.product.sku}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                m.type === "PURCHASE" || m.type === "IMPORT"
                                  ? "default"
                                  : m.type === "ADJUSTMENT"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-[10px]"
                            >
                              {m.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-xs font-bold inline-flex items-center gap-0.5 ${
                                m.qtyChange > 0 ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {m.qtyChange > 0 ? (
                                <ArrowUpRight className="h-3 w-3 inline" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 inline" />
                              )}
                              {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange} {m.product.unit.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-gray-500">{m.stockBefore}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-gray-900">{m.stockAfter}</TableCell>
                          <TableCell className="text-xs text-gray-600 max-w-xs truncate">{m.note || "-"}</TableCell>
                          <TableCell className="text-xs text-gray-500 font-medium">
                            {m.createdBy.username} ({m.createdBy.role})
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL BARANG MASUK / RESTOCK */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Input Barang Masuk (Restock)</DialogTitle>
            <DialogDescription>
              Menambah kuantitas stok fisik untuk barang: <b>{selectedProduct?.name}</b>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRestockAction} className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-xl text-xs space-y-1">
              <p>Stok saat ini: <b>{selectedProduct?.stock} {selectedProduct?.unit.name}</b></p>
              <p>Harga beli saat ini: <b>{formatRupiah(selectedProduct?.costPrice || 0)}</b></p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restockQty">Jumlah Masuk ({selectedProduct?.unit.name}) *</Label>
              <Input
                id="restockQty"
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(Math.max(1, Number(e.target.value)))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="restockCost">Perbarui Harga Beli (Rp) — Opsional</Label>
              <Input
                id="restockCost"
                type="number"
                min="0"
                value={restockCost}
                onChange={(e) => setRestockCost(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="restockNote">Catatan / No. Faktur / Pemasok</Label>
              <Input
                id="restockNote"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRestockOpen(false)}>
                Batal
              </Button>
              <Button type="submit">Simpan Barang Masuk</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL OPNAME / PENYESUAIAN STOK FISIK */}
      <Dialog open={opnameOpen} onOpenChange={setOpnameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Penyesuaian Stok Fisik (Opname)</DialogTitle>
            <DialogDescription>
              Menyelaraskan data stok sistem dengan hasil penghitungan fisik untuk: <b>{selectedProduct?.name}</b>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitOpnameAction} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs space-y-1 text-amber-900">
              <p>Stok tercatat sistem: <b>{selectedProduct?.stock} {selectedProduct?.unit.name}</b></p>
              <p>
                Selisih:{" "}
                <b className={opnamePhysical - (selectedProduct?.stock || 0) < 0 ? "text-red-600" : "text-emerald-700"}>
                  {opnamePhysical - (selectedProduct?.stock || 0) > 0 ? "+" : ""}
                  {opnamePhysical - (selectedProduct?.stock || 0)} {selectedProduct?.unit.name}
                </b>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="opnamePhysical">Stok Fisik Sebenarnya (Hasil Hitung) *</Label>
              <Input
                id="opnamePhysical"
                type="number"
                min="0"
                value={opnamePhysical}
                onChange={(e) => setOpnamePhysical(Math.max(0, Number(e.target.value)))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opnameReason">Alasan Penyesuaian (Wajib Sesuai FR-4.2) *</Label>
              <Input
                id="opnameReason"
                placeholder="Contoh: Barang rusak saat display, barang kedaluwarsa, selisih hitung opname"
                value={opnameReason}
                onChange={(e) => setOpnameReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpnameOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="destructive">
                Simpan Penyesuaian Opname
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
