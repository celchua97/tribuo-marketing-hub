'use client'

import { useState } from 'react'

export type ExportRow = {
  id: string
  created: string
  name: string
  department: string
  kind: string
  area: string
  status: string
  title: string
  details: string
  files: string[]
}

const PROMPT = `I'm the Head of Marketing at Tribuo, a semi-private training club with studios in Malaysia and Cambodia. Above are ideas and feedback from my team. Please:
1. Group them into themes.
2. Pick the five strongest and say why.
3. Point out anything that came up more than once.
4. For anything shortlisted, suggest a simple next step.
Keep it short, friendly and in plain language.`

function summary(rows: ExportRow[], note: string) {
  const today = new Date().toISOString().slice(0, 10)
  const head = `Tribuo Idea Bank. ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}${note ? ` (${note})` : ''}. Exported ${today}.`
  const body = rows.map((r, i) =>
    [
      `${i + 1}. [${r.kind.toUpperCase()}] ${r.title}`,
      `   Area: ${r.area} | Department: ${r.department || 'none'} | Status: ${r.status}`,
      r.details ? `   ${r.details.replace(/\n/g, '\n   ')}` : '',
      `   From: ${r.name}, ${r.created}`,
      r.files.length ? `   Files: ${r.files.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  return [head, '', ...body.flatMap((b) => [b, '']), '---', PROMPT].join('\n')
}

function csv(rows: ExportRow[]) {
  const cols: (keyof ExportRow)[] = ['created', 'name', 'department', 'kind', 'area', 'status', 'title', 'details', 'files']
  const cell = (v: unknown) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n')
}

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Blue card with white pill buttons. Exports whatever the filters are showing.
export function ExportCard({ rows, note }: { rows: ExportRow[]; note: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const today = new Date().toISOString().slice(0, 10)
  const text = summary(rows, note)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('manual')
    }
  }

  const pill = 'inline-flex min-h-14 w-full items-center justify-center rounded-full bg-white px-6 text-base font-bold text-blue transition active:scale-[0.98] disabled:opacity-60'

  return (
    <section className="space-y-4 rounded-[18px] bg-blue p-5 text-white">
      <div>
        <h2 className="label-caps text-xs text-white/80">Export</h2>
        <p className="mt-2 text-white/90">
          Takes what you see below ({rows.length} entr{rows.length === 1 ? 'y' : 'ies'}). Copy for Claude adds a ready-made prompt at the end.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" className={pill} onClick={copy} disabled={rows.length === 0}>
          {state === 'copied' ? 'Copied' : 'Copy for Claude'}
        </button>
        <button type="button" className={pill} onClick={() => save(`tribuo-ideas-${today}.csv`, csv(rows), 'text/csv;charset=utf-8')} disabled={rows.length === 0}>
          Save CSV
        </button>
        <button type="button" className={pill} onClick={() => save(`tribuo-ideas-${today}.json`, JSON.stringify(rows, null, 2), 'application/json')} disabled={rows.length === 0}>
          Save JSON
        </button>
      </div>
      {state === 'manual' && (
        <textarea readOnly rows={10} className="field text-sm" value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Summary to copy" />
      )}
    </section>
  )
}
