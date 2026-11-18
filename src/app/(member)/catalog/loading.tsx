export default function CatalogLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 bg-slate-200 rounded-2xl" />
      <div className="h-20 bg-white border border-slate-200 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 bg-white border border-slate-200 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}