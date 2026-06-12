import type { ReactNode } from 'react'

export type StatsBarColor = 'c1' | 'c2' | 'c3' | 'c4'

export interface StatsBarItem {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon: ReactNode
  color: StatsBarColor
}

interface StatsBarProps {
  stats: StatsBarItem[]
  /** "tint" = brand-toned values (default), "punchy" = full-saturated brand colors */
  valueStyle?: 'tint' | 'punchy'
  className?: string
}

const COLORS: Record<StatsBarColor, string> = {
  c1: '#3b82f6',
  c2: '#ef4d6b',
  c3: '#22c55e',
  c4: '#f5a524',
}

// Brand tones for value text on a light surface
const TINTS: Record<StatsBarColor, string> = {
  c1: '#2563eb',
  c2: '#dc2640',
  c3: '#16a34a',
  c4: '#d68910',
}

const ICON_BG: Record<StatsBarColor, string> = {
  c1: 'rgba(59,130,246,.12)',
  c2: 'rgba(239,77,107,.12)',
  c3: 'rgba(34,197,94,.14)',
  c4: 'rgba(245,165,36,.16)',
}

const ICON_FG: Record<StatsBarColor, string> = {
  c1: '#2563eb',
  c2: '#dc2640',
  c3: '#16a34a',
  c4: '#d68910',
}

const VB_W = 1400
const VB_H = 160
const SLASH_DX = 32
const SLASH_TAB_H = 4

/**
 * Slashed unibar of stat cells. Geometry is computed from the cell count so
 * the same component renders 3- or 4-up bars consistently. Both diagonal
 * slash edges divide each cell at y = VB_H / 2, yielding clip-path offsets
 * of (SLASH_DX / CELL_VB_W) % and its complement on the right.
 */
export function StatsBar({ stats, valueStyle = 'tint', className = '' }: StatsBarProps) {
  const n = stats.length
  const cellW = VB_W / n
  const slope = (2 * SLASH_DX) / VB_H // dx per dy along the slash
  const offsetPct = (SLASH_DX / cellW) * 100
  const rightPct = 100 - offsetPct

  // Top tab right edge X (at y = SLASH_TAB_H) for divider i (1-indexed, i < n)
  const tabRightX = (i: number) => i * cellW + SLASH_DX - slope * SLASH_TAB_H

  const tabs = stats.map((s, i) => {
    const leftTopX = i === 0 ? 0 : i * cellW + SLASH_DX
    const rightTopX = i === n - 1 ? VB_W : (i + 1) * cellW + SLASH_DX
    const leftBotX = i === 0 ? 0 : tabRightX(i)
    const rightBotX = i === n - 1 ? VB_W : tabRightX(i + 1)
    const points = `${leftTopX},0 ${rightTopX},0 ${rightBotX},${SLASH_TAB_H} ${leftBotX},${SLASH_TAB_H}`
    return { points, color: COLORS[s.color], key: `tab-${i}` }
  })

  const dividers = Array.from({ length: n - 1 }, (_, idx) => {
    const i = idx + 1
    return {
      key: `div-${i}`,
      x1: tabRightX(i),
      y1: SLASH_TAB_H,
      x2: i * cellW - SLASH_DX,
      y2: VB_H,
    }
  })

  const CLIP_FIRST = `polygon(0 0, 100% 0, 100% 50%, ${rightPct.toFixed(2)}% 100%, 0 100%)`
  const CLIP_MIDDLE = `polygon(${offsetPct.toFixed(2)}% 0, 100% 0, 100% 50%, ${rightPct.toFixed(2)}% 100%, 0 100%, 0 50%)`
  const CLIP_LAST = `polygon(${offsetPct.toFixed(2)}% 0, 100% 0, 100% 100%, 0 100%, 0 50%)`

  return (
    <div
      className={
        'stats-bar relative h-32 overflow-hidden rounded-[20px] border border-black/[0.06] ' +
        'shadow-[0_1px_0_rgba(255,255,255,.6)_inset,0_18px_50px_-28px_rgba(15,23,42,.22)] ' +
        className
      }
    >
      {/* SVG frame: colored top tabs + diagonal dividers */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none block"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {tabs.map(t => (
          <polygon key={t.key} fill={t.color} points={t.points} />
        ))}
        {dividers.map(d => (
          <line
            key={d.key}
            x1={d.x1}
            y1={d.y1}
            x2={d.x2}
            y2={d.y2}
            stroke="rgba(15,23,42,0.10)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Cells */}
      <div
        className="absolute inset-0 grid z-[1]"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {stats.map((s, i) => {
          const isFirst = i === 0
          const isLast = i === n - 1
          const clip = isFirst ? CLIP_FIRST : isLast ? CLIP_LAST : CLIP_MIDDLE
          const gradOrigin = isFirst ? '0% 0%' : `${offsetPct.toFixed(2)}% 0%`

          return (
            <div
              key={i}
              className={
                'relative flex flex-col justify-between pr-[30px] pt-[18px] pb-4 min-w-0 ' +
                (isFirst ? 'pl-[38px]' : 'pl-[60px]')
              }
              style={{ isolation: 'isolate' }}
            >
              {/* Radial color wash, clipped to the cell's parallelogram */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none opacity-[0.12]"
                style={{
                  zIndex: -1,
                  background: `radial-gradient(140% 90% at ${gradOrigin}, ${COLORS[s.color]}, transparent 55%)`,
                  clipPath: clip,
                  WebkitClipPath: clip,
                }}
              />

              <div className="flex items-center gap-2.5">
                <span
                  className="grid place-items-center w-[30px] h-[30px] rounded-[9px] stats-bar__icon"
                  style={
                    {
                      '--icon-bg': ICON_BG[s.color],
                      '--icon-fg': ICON_FG[s.color],
                    } as React.CSSProperties
                  }
                  aria-hidden="true"
                >
                  {s.icon}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 truncate">
                  {s.label}
                </span>
              </div>

              <div
                className="text-[28px] font-bold leading-none tracking-[-0.02em] mt-1 tabular-nums truncate stats-bar__value"
                style={
                  {
                    '--value-color':
                      valueStyle === 'punchy' ? COLORS[s.color] : TINTS[s.color],
                  } as React.CSSProperties
                }
              >
                {s.value}
              </div>

              {s.sub != null && (
                <div className="text-xs text-slate-500 truncate">{s.sub}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
