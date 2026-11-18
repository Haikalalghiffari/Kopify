export type CartItem = {
  productId: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  max: number; // stok tersedia saat ditambahkan
};

const KEY = "koperasi-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

export function addToCart(item: Omit<CartItem, "qty">, qty = 1) {
  const cart = getCart();
  const existing = cart.find((c) => c.productId === item.productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, item.max);
    existing.max = item.max;
  } else {
    cart.push({ ...item, qty: Math.min(qty, item.max) });
  }
  saveCart(cart);
}