import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  q: string;
  categoryId: string;
};

function hrefFor(page: number, q: string, categoryId: string) {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (categoryId) sp.set("category", categoryId);
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/catalog?${qs}` : "/catalog";
}

export default function CatalogPagination({ page, totalPages, q, categoryId }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-slate-500">
        Halaman {page} dari {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={hrefFor(page - 1, q, categoryId)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Sebelumnya
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={hrefFor(page + 1, q, categoryId)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Berikutnya
          </Link>
        )}
      </div>
    </div>
  );
}