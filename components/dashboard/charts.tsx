// Small hand-drawn SVG charts in the Tribuo palette. Server-rendered, no library.

const BLUE = '#3750ab'
export const PALETTE = ['#3750ab', '#fd947a', '#f9c339', '#6f9fc8', '#5e5a52', '#e7e0cc']

export function LineChart({ points, label }: { points: { label: string; value: number }[]; label: string }) {
  const W = 400, H = 220, L = 34, R = 14, T = 22, B = 30
  const max = Math.max(4, ...points.map((p) => p.value))
  const top = Math.ceil(max / 4) * 4
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, points.length - 1)
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const pts = points.map((p, i) => [x(i), y(p.value)] as const)
  // a gentle curve through the points
  const path = pts.reduce((d, [px, py], i) => {
    if (i === 0) return `M${px},${py}`
    const [qx, qy] = pts[i - 1]
    const cx = (px + qx) / 2
    return `${d} C${cx},${qy} ${cx},${py} ${px},${py}`
  }, '')
  const area = `${path} L${x(points.length - 1)},${H - B} L${x(0)},${H - B} Z`
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BLUE} stopOpacity="0.22" />
          <stop offset="1" stopColor={BLUE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e0cc" strokeDasharray="3 4" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5e5a52">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#lc-fill)" />
      <path d={path} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" />
      {pts.map(([px, py], i) => (
        <g key={i}>
          <circle cx={px} cy={py} r="4.5" fill="#fff" stroke={BLUE} strokeWidth="2.5" />
          {points[i].value > 0 && (
            <text x={px} y={py - 11} textAnchor="middle" fontSize="11" fontWeight="700" fill="#050505">
              {points[i].value}
            </text>
          )}
          <text x={px} y={H - 9} textAnchor="middle" fontSize="11" fill="#5e5a52">
            {points[i].label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export type Bar = { label: string; value: number; extra?: number }

// Bars with an optional lighter bar stacked on top (for example done under open).
export function BarChart({ bars, label, base = BLUE, extra = '#c7d0ee' }: { bars: Bar[]; label: string; base?: string; extra?: string }) {
  const W = 400, H = 220, L = 34, R = 10, T = 16, B = 44
  const max = Math.max(4, ...bars.map((b) => b.value + (b.extra ?? 0)))
  const top = Math.ceil(max / 4) * 4
  const slot = (W - L - R) / bars.length
  const bw = Math.min(34, slot * 0.55)
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      {[0, 1, 2, 3, 4].map((i) => {
        const t = (top / 4) * i
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e7e0cc" strokeDasharray="3 4" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5e5a52">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        )
      })}
      {bars.map((b, i) => {
        const cx = L + slot * i + slot / 2
        const h1 = y(0) - y(b.value)
        const h2 = y(0) - y(b.extra ?? 0)
        return (
          <g key={b.label}>
            {h1 > 0 && <rect x={cx - bw / 2} y={y(0) - h1} width={bw} height={h1} rx="5" fill={base} />}
            {(b.extra ?? 0) > 0 && <rect x={cx - bw / 2} y={y(0) - h1 - h2} width={bw} height={h2} rx="5" fill={extra} />}
            <text x={cx} y={y(b.value + (b.extra ?? 0)) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#050505">
              {b.value + (b.extra ?? 0) > 0 ? b.value + (b.extra ?? 0) : ''}
            </text>
            {b.label.split('\n').map((line, li) => (
              <text key={li} x={cx} y={H - 24 + li * 13} textAnchor="middle" fontSize="11" fill="#5e5a52">
                {line}
              </text>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export function Donut({ slices, centre, sub }: { slices: { label: string; value: number }[]; centre: string; sub: string }) {
  const total = slices.reduce((n, s) => n + s.value, 0)
  const R = 62, C = 2 * Math.PI * R
  let offset = 0
  return (
    <svg viewBox="0 0 180 180" role="img" aria-label={`${centre} ${sub}`} className="h-auto w-44 shrink-0">
      <circle cx="90" cy="90" r={R} fill="none" stroke="#eee7c6" strokeWidth="22" />
      {total > 0 &&
        slices.map((s, i) => {
          const len = (s.value / total) * C
          const el = (
            <circle
              key={s.label}
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="22"
              strokeDasharray={`${Math.max(0, len - 2)} ${C - Math.max(0, len - 2)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            />
          )
          offset += len
          return el
        })}
      <text x="90" y="92" textAnchor="middle" fontSize="30" fontWeight="800" fill="#050505" style={{ fontFamily: 'var(--font-display, inherit)' }}>
        {centre}
      </text>
      <text x="90" y="112" textAnchor="middle" fontSize="11" fill="#5e5a52">
        {sub}
      </text>
    </svg>
  )
}
