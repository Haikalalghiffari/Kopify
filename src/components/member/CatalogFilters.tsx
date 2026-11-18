import Link from "next/link";

type CategoryOption = { id: string; name: string };

type Props = {
  q: string;
  categoryId: string;
  categories: CategoryOption[];
};

export default function CatalogFilters({ q, categoryId, categories }: Props) {
  const field =
    "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  const hasFilter = Boolean(q || categoryId);

  return (
    <form
      method="get"
      className="p-4 bg-white border border-slate-200 rounded-2xl grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end"
    >
      <div className="lg:col-span-2">
        <label className="text-xs text-slate-500">Cari nama atau SKU</label>
        <input
          name="q"
          defaultValue={q}
          placeholder="Contoh: kopi atau SKU-001"
          className={field}
        />
      </div>
      <div>
        <label className="text-xs text-slate-500">Kategori</label>
        <select name="category" defaultValue={categoryId} className={field}>
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Cari
        </button>
        {hasFilter && (
          <Link
            href="/catalog"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}