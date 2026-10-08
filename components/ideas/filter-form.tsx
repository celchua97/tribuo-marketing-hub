'use client'

// Two columns of filters that apply as soon as one changes.
export function FilterForm({
  fields,
  hidden,
}: {
  fields: { name: string; label: string; value: string; options: { value: string; label: string }[] }[]
  hidden?: Record<string, string>
}) {
  return (
    <form method="get" onChange={(e) => e.currentTarget.requestSubmit()} className="grid grid-cols-2 gap-3">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={`f-${f.name}`}>
            {f.label}
          </label>
          <select id={`f-${f.name}`} name={f.name} defaultValue={f.value} className="field">
            <option value="">All</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <noscript>
        <button className="btn-ghost col-span-2">Apply filters</button>
      </noscript>
    </form>
  )
}
