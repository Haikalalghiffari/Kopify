"use client";

import { formatRupiah } from "@/lib/money";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";

export interface ProductItemProps {
  id: string;
  name: string;
  sku: string;
  categoryName?: string;
  origin?: string;
  unit: string;
  price: number;
  image: string;
  stock: number;
  reservedStock?: number;
  minStock?: number;
}

export default function ProductCard({ product }: { product: ProductItemProps }) {
  const { items, addItem, updateQty } = useCart();
  const cartItem = items.find((i) => i.product.id === product.id);
  const qty = cartItem ? cartItem.qty : 0;

  const availableStock = Math.max(0, product.stock - (product.reservedStock || 0));
  const isOutOfStock = availableStock <= 0;
  const isLowStock = availableStock > 0 && availableStock <= (product.minStock || 5);

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(product, 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateQty(product.id, qty - 1);
  };

  const formattedPrice = formatRupiah(product.price);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-gray-100/90 hover:shadow-lg hover:border-gray-200 transition-all duration-200 flex flex-col justify-between group relative">
      {/* Stock status badge on top-left */}
      <div className="absolute top-3 left-3 z-10">
        {isOutOfStock ? (
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            Stok Habis
          </span>
        ) : isLowStock ? (
          <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            Sisa {availableStock}
          </span>
        ) : (
          <span className="bg-[#EAF6EE] text-[#0B3B2C] text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Stok: {availableStock} {product.unit}
          </span>
        )}
      </div>

      {/* Top Image Canvas */}
      <div className="relative w-full aspect-square max-h-40 rounded-xl mb-3 flex items-center justify-center p-2 overflow-hidden bg-transparent">
        <img
          src={product.image}
          alt={product.name}
          className={`w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm ${
            isOutOfStock ? "grayscale opacity-50" : ""
          }`}
          loading="lazy"
        />
      </div>

      {/* Middle: Title, Origin, Unit & Price - ALL CENTER ALIGNED like Gromuse */}
      <div className="text-center space-y-1 my-1">
        <h3 className="font-bold text-sm text-[#0B3B2C] leading-snug line-clamp-1 hover:text-[#134B39]">
          {product.name}
        </h3>
        <p className="text-xs text-[#0B3B2C]/70 font-medium">
          {product.categoryName || "(Kopify Mart)"}
        </p>
        <p className="text-xs text-gray-400 font-normal">
          {product.unit} • SKU: {product.sku}
        </p>

        {/* Gromuse Price Display: Bold integer */}
        <div className="pt-1.5 flex items-center justify-center">
          <span className="text-xl sm:text-2xl font-extrabold text-[#0B3B2C] tracking-tight">
            {formattedPrice}
          </span>
        </div>
      </div>

      {/* Bottom: Action Button (Mint pill or Active Lime Stepper) */}
      <div className="pt-3 mt-1">
        {isOutOfStock ? (
          <button
            disabled
            className="w-full h-11 rounded-xl bg-gray-100 text-gray-400 font-semibold text-xs cursor-not-allowed flex items-center justify-center"
          >
            Stok Habis
          </button>
        ) : qty === 0 ? (
          <button
            onClick={handleIncrement}
            className="w-full h-11 rounded-xl bg-[#EAF6EE] hover:bg-[#d8edd9] text-[#0B3B2C] font-extrabold text-xl flex items-center justify-center transition-colors active:scale-98"
            title="Tambah ke keranjang"
          >
            +
          </button>
        ) : (
          <div className="w-full h-11 rounded-xl bg-[#B6F53B] text-[#0B3B2C] px-3 flex items-center justify-between font-extrabold text-sm shadow-sm">
            <button
              onClick={handleDecrement}
              className="w-7 h-7 rounded-full border-2 border-[#0B3B2C] flex items-center justify-center hover:bg-[#0B3B2C] hover:text-[#B6F53B] transition-colors"
              title="Kurang"
            >
              <Minus className="h-3.5 w-3.5 stroke-[3]" />
            </button>
            <span className="text-base font-extrabold">{qty}</span>
            <button
              onClick={handleIncrement}
              disabled={qty >= availableStock}
              className={`w-7 h-7 rounded-full border-2 border-[#0B3B2C] flex items-center justify-center transition-colors ${
                qty >= availableStock
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-[#0B3B2C] hover:text-[#B6F53B]"
              }`}
              title="Tambah"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
