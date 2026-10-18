export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Memuat">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded-full bg-black/10" />
        <div className="h-9 w-56 max-w-full rounded-2xl bg-black/10" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel h-24 rounded-3xl p-5">
            <div className="h-3 w-24 rounded-full bg-black/10" />
            <div className="mt-3 h-8 w-12 rounded-xl bg-black/10" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel h-52 rounded-3xl p-5">
            <div className="h-6 w-40 rounded-xl bg-black/10" />
            <div className="mt-4 space-y-2">
              <div className="h-8 w-full rounded-xl bg-black/5" />
              <div className="h-8 w-full rounded-xl bg-black/5" />
              <div className="h-8 w-full rounded-xl bg-black/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
