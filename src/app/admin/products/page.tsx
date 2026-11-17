"use client";

import { useState, useEffect, useTransition } from "react";
import { getProducts, createProduct, updateProduct, deleteProduct } from "@/actions/products";
import { getCategories, getUnits, createCategory, createUnit } from "@/actions/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, Loader2, Package, AlertTriangle } from "lucide-react";
import { formatRupiah } from "@/lib/money";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isPending, startTransition] = useTransition();

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    categoryId: "",
    unitId: "",
    costPrice: 0,
    sellPrice: 0,
    stock: 0,
    minStock: 5,
    isActive: true,
  });

  // Quick category/unit dialog
  const [quickCatOpen, setQuickCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [quickUnitOpen, setQuickUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  const loadData = () => {
    startTransition(async () => {
      try {
        const [prodRes, catRes, unitRes] = await Promise.all([
          getProducts({ page, limit: 10, search, categoryId: selectedCategory }),
          getCategories(),
          getUnits(),
        ]);
        setProducts(prodRes.data);
        setTotal(prodRes.total);
        setCategories(catRes);
        setUnits(unitRes);
      } catch (err: any) {
        toast.error("Gagal memuat data produk");
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [page, selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData({
      sku: `BRG-${String(total + 1).padStart(4, "0")}`,
      name: "",
      categoryId: categories[0]?.id || "",
      unitId: units[0]?.id || "",
      costPrice: 0,
      sellPrice: 0,
      stock: 0,
      minStock: 5,
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (p: any) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      name: p.name,
      categoryId: p.categoryId,
      unitId: p.unitId,
      costPrice: p.costPrice,
      sellPrice: p.sellPrice,
      stock: p.stock,
      minStock: p.minStock,
      isActive: p.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          sku: formData.sku,
          name: formData.name,
          categoryId: formData.categoryId,
          unitId: formData.unitId,
          costPrice: Number(formData.costPrice),
          sellPrice: Number(formData.sellPrice),
          minStock: Number(formData.minStock),
          isActive: formData.isActive,
        });
        toast.success("Barang berhasil diperbarui");
      } else {
        await createProduct({
          ...formData,
          costPrice: Number(formData.costPrice),
          sellPrice: Number(formData.sellPrice),
          stock: Number(formData.stock),
          minStock: Number(formData.minStock),
        });
        toast.success("Barang baru berhasil ditambahkan");
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data barang");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus/nonaktifkan barang ${name}?`)) return;
    try {
      await deleteProduct(id);
      toast.success("Barang berhasil dinonaktifkan");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menonaktifkan barang");
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const c = await createCategory(newCatName.trim());
      setCategories([...categories, c]);
      setFormData({ ...formData, categoryId: c.id });
      setNewCatName("");
      setQuickCatOpen(false);
      toast.success("Kategori berhasil dibuat");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      const u = await createUnit(newUnitName.trim());
      setUnits([...units, u]);
      setFormData({ ...formData, unitId: u.id });
      setNewUnitName("");
      setQuickUnitOpen(false);
      toast.success("Satuan berhasil dibuat");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Katalog Barang
          </h1>
          <p className="text-gray-500 text-sm mt-1">Daftar produk, harga jual/beli, dan pantauan sisa stok</p>
        </div>
        <Button onClick={openCreateDialog} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Tambah Barang
        </Button>
      </div>

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
            <div className="w-full sm:w-56">
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  setSelectedCategory(val === "ALL" ? "" : (val ?? ""));
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Kategori</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" variant="secondary">Cari</Button>
          </form>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nama Barang</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Harga Beli</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-right">Stok Fisik</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Memuat daftar barang...
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Tidak ada barang ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((p) => {
                    const isLowStock = p.stock <= p.minStock;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-primary">{p.sku}</TableCell>
                        <TableCell>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          {p.reservedStock > 0 && (
                            <span className="text-xs text-orange-600 bg-orange-50 px-1 rounded">
                              {p.reservedStock} dicadangkan pesanan
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{p.category?.name}</TableCell>
                        <TableCell className="text-right text-gray-600">{formatRupiah(p.costPrice)}</TableCell>
                        <TableCell className="text-right font-medium text-gray-900">{formatRupiah(p.sellPrice)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${isLowStock ? "text-red-600 flex items-center justify-end gap-1" : "text-gray-900"}`}>
                            {isLowStock && <AlertTriangle className="h-3.5 w-3.5 inline text-red-500" />}
                            {p.stock} {p.unit?.name}
                          </span>
                          <span className="text-xs text-gray-400 block">Min: {p.minStock}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.isActive ? "default" : "secondary"}>
                            {p.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(p)}>
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id, p.name)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Total <b>{total}</b> barang</p>
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

      {/* Dialog Add/Edit Product */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Ubah Data Barang" : "Tambah Barang Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Kode Barang *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nama Barang *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Kategori *</Label>
                  <button
                    type="button"
                    onClick={() => setQuickCatOpen(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Baru
                  </button>
                </div>
                <Select
                  value={formData.categoryId}
                  onValueChange={(val) => setFormData({ ...formData, categoryId: val ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Satuan *</Label>
                  <button
                    type="button"
                    onClick={() => setQuickUnitOpen(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    + Baru
                  </button>
                </div>
                <Select
                  value={formData.unitId}
                  onValueChange={(val) => setFormData({ ...formData, unitId: val ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih Satuan" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Harga Beli (Rp) *</Label>
                <Input
                  id="costPrice"
                  type="number"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellPrice">Harga Jual (Rp) *</Label>
                <Input
                  id="sellPrice"
                  type="number"
                  min="0"
                  value={formData.sellPrice}
                  onChange={(e) => setFormData({ ...formData, sellPrice: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {!editingProduct && (
                <div className="space-y-2">
                  <Label htmlFor="stock">Stok Awal</Label>
                  <Input
                    id="stock"
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="minStock">Batas Minimum Stok</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit">
                {editingProduct ? "Simpan Perubahan" : "Tambah Barang"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Add Category Modal */}
      <Dialog open={quickCatOpen} onOpenChange={setQuickCatOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Kategori Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nama Kategori</Label>
            <Input
              placeholder="Misal: Elektronik"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCatOpen(false)}>Batal</Button>
            <Button onClick={handleAddCategory}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Unit Modal */}
      <Dialog open={quickUnitOpen} onOpenChange={setQuickUnitOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Satuan Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nama Satuan</Label>
            <Input
              placeholder="Misal: botol, rim, pack"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickUnitOpen(false)}>Batal</Button>
            <Button onClick={handleAddUnit}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
