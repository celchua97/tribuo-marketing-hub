'use client'

import { useState } from 'react'

// Copies ready-to-paste WhatsApp text. If the browser refuses, the text is shown
// in a box so it can still be copied by hand.
export function CopyButton({
  text,
  label,
  className = 'btn-ghost',
}: {
  text: string
  label: string
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('manual')
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={copy} className={className}>
        {state === 'copied' ? 'Copied. Paste it into WhatsApp' : label}
      </button>
      {state === 'manual' && (
        <textarea
          readOnly
          rows={Math.min(12, text.split('\n').length + 1)}
          className="field text-sm"
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Message to copy"
        />
      )}
    </div>
  )
}
