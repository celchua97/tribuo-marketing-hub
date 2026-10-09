export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-[1180px] animate-pulse space-y-5 px-4 py-8">
      <div className="h-9 w-48 rounded-xl bg-sand" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-[20px] bg-white" />
        ))}
      </div>
      <div className="h-64 rounded-[20px] bg-white" />
    </div>
  )
}
