import { strFromU8, unzipSync } from 'fflate'

// Reads the slide titles out of a PowerPoint file (.pptx), which is what Google
// Slides gives us when we export a deck.
//
// For each slide the title is, in order of preference:
//   1. the slide's title placeholder, or
//   2. the text box with the biggest lettering (ties go to the one nearest the top).
// A title that shows up again later in the deck is dropped; the first one stays.

const MAX_TITLES = 150
const MAX_TITLE_LENGTH = 160

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const key = (s: string) => s.toLowerCase().replace(/[\s\p{P}]+/gu, ' ').trim()

type Shape = { text: string; isTitle: boolean; size: number; y: number }

function shapesOf(xml: string): Shape[] {
  const shapes: Shape[] = []
  for (const m of xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)) {
    const sp = m[0]
    const paragraphs = [...sp.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
      .map((p) => {
        // line breaks inside a paragraph count as a space
        const withBreaks = p[0].replace(/<a:br\b[^>]*\/?>(?:<\/a:br>)?/g, '<a:t> </a:t>')
        const runs = [...withBreaks.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((r) => r[1])
        return clean(decode(runs.join('')))
      })
      .filter(Boolean)
    if (paragraphs.length === 0) continue
    const sizes = [...sp.matchAll(/\bsz="(\d+)"/g)].map((s) => Number(s[1]))
    const y = Number(/<a:off\s+x="-?\d+"\s+y="(-?\d+)"/.exec(sp)?.[1] ?? 0)
    shapes.push({
      text: paragraphs.length <= 2 ? paragraphs.join(' ') : paragraphs[0],
      isTitle: /<p:ph\b[^>]*\btype="(?:title|ctrTitle)"/.test(sp),
      size: sizes.length ? Math.max(...sizes) : 1800,
      y,
    })
  }
  return shapes
}

function titleOf(xml: string): string | null {
  const shapes = shapesOf(xml)
  const fromPlaceholder = shapes.find((s) => s.isTitle)
  if (fromPlaceholder) return fromPlaceholder.text.slice(0, MAX_TITLE_LENGTH)
  const candidates = shapes.filter((s) => s.text.length <= MAX_TITLE_LENGTH)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.size - a.size || a.y - b.y)
  return candidates[0].text
}

// Slide files in the order they appear in the deck
function slideOrder(files: Record<string, Uint8Array>): string[] {
  const slideNames = Object.keys(files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
  const numeric = [...slideNames].sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  const pres = files['ppt/presentation.xml']
  const rels = files['ppt/_rels/presentation.xml.rels']
  if (!pres || !rels) return numeric
  const targets = new Map<string, string>()
  for (const r of strFromU8(rels).matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(r[0])?.[1]
    const target = /\bTarget="([^"]+)"/.exec(r[0])?.[1]
    if (id && target) targets.set(id, 'ppt/' + target.replace(/^\/?(ppt\/)?/, ''))
  }
  const ordered = [...strFromU8(pres).matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
    .map((m) => targets.get(m[1]))
    .filter((f): f is string => !!f && f in files)
  return ordered.length ? ordered : numeric
}

export function titlesFromPptx(bytes: Uint8Array): { titles: string[]; slides: number } {
  const files = unzipSync(bytes, { filter: (f) => /^ppt\/(slides\/slide\d+\.xml|presentation\.xml|_rels\/presentation\.xml\.rels)$/.test(f.name) })
  const order = slideOrder(files)
  const seen = new Set<string>()
  const titles: string[] = []
  for (const name of order) {
    const t = titleOf(strFromU8(files[name]))
    if (!t) continue
    const k = key(t)
    if (!k || seen.has(k)) continue
    seen.add(k)
    titles.push(t)
    if (titles.length >= MAX_TITLES) break
  }
  return { titles, slides: order.length }
}

export const looksLikeZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b

export function slidesIdFromUrl(url: string): string | null {
  return /\/presentation\/d\/([a-zA-Z0-9_-]+)/.exec(url)?.[1] ?? null
}
