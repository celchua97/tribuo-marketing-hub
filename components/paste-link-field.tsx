'use client'

import { useState } from 'react'

// One-tap paste for the editor: reads the clipboard into the field.
export function PasteLinkField({ name, placeholder }: { name: string; placeholder: string }) {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState('')

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (text) setValue(text)
      setHint('')
    } catch {
      setHint('Long-press the box and choose Paste.')
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          name={name}
          className="field min-w-0 flex-1"
          inputMode="url"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" onClick={paste} className="chip shrink-0 !border-sand bg-sand">
          Paste
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-grey">{hint}</p>}
    </div>
  )
}
