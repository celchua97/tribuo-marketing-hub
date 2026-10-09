// Shown at once while the lists load, so moving between pages feels instant
export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[980px] animate-pulse space-y-8 px-4 py-8">
      <div className="h-9 w-40 rounded-xl bg-sand" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-full bg-sand" />
            <div className="h-6 w-48 rounded-lg bg-sand" />
          </div>
          <div className="h-10 rounded-lg bg-sand/70" />
          <div className="h-10 rounded-lg bg-sand/70" />
        </div>
      ))}
    </div>
  )
}
