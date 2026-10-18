export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Memuat">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-black/10" />
        <div className="h-9 w-64 max-w-full rounded-2xl bg-black/10" />
        <div className="h-4 w-full max-w-md rounded-full bg-black/5" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel h-28 rounded-3xl bg-white/50 p-5">
            <div className="h-3 w-20 rounded-full bg-black/10" />
            <div className="mt-4 h-8 w-16 rounded-xl bg-black/10" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel h-64 rounded-3xl bg-white/50 p-5">
          <div className="h-6 w-40 rounded-xl bg-black/10" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full rounded-full bg-black/5" />
            <div className="h-3 w-5/6 rounded-full bg-black/5" />
            <div className="h-3 w-4/6 rounded-full bg-black/5" />
          </div>
        </div>
        <div className="panel h-64 rounded-3xl bg-white/50 p-5">
          <div className="h-6 w-48 rounded-xl bg-black/10" />
          <div className="mt-6 space-y-3">
            <div className="h-10 w-full rounded-2xl bg-black/5" />
            <div className="h-10 w-full rounded-2xl bg-black/5" />
            <div className="h-10 w-full rounded-2xl bg-black/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
