import { memo, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Minus, Maximize2 } from 'lucide-react'
import type { Coordinates } from '@/types'
import { Spinner } from '@/components/ui/spinner'

/**
 * WebGL-free world map. Renders a bundled GeoJSON as an inline SVG using a Web
 * Mercator projection, with birth/death markers and a route line. Works on any
 * browser (no GPU / WebGL required) — MapLibre needs WebGL, which isn't always
 * available (VMs, RDP, software rendering).
 */

const WORLD = 1000
// Smaller span = more zoomed in. Lowered so the user can zoom further in
// (down to ~city/region level) than the previous country-block cap.
const MIN_SPAN = 22
const MAX_SPAN = WORLD
// Country names appear once the visible span is half the world or less
// (i.e. roughly half-way zoomed in).
const LABEL_SPAN = WORLD / 2
// A country's name only shows once its (projected) area is at least this
// fraction of the visible area. Larger countries surface first; smaller ones
// reveal as you keep zooming, which keeps dense regions from overlapping.
const LABEL_MIN_AREA_FRACTION = 0.0015
// Continent names show while zoomed out (i.e. before country names appear).
// Centers are hand-placed (lng/lat) for clean positioning — area-weighted
// centroids are skewed by Mercator and by Russia being classed as Europe.
const CONTINENTS: { name: string; lng: number; lat: number }[] = [
  { name: 'North America', lng: -100, lat: 45 },
  { name: 'South America', lng: -60, lat: -15 },
  { name: 'Africa', lng: 18, lat: 2 },
  { name: 'Europe', lng: 15, lat: 50 },
  { name: 'Asia', lng: 90, lat: 45 },
  { name: 'Oceania', lng: 140, lat: -25 },
  { name: 'Antarctica', lng: 0, lat: -82 },
]

// ----- projection (Web Mercator, scaled to a WORLD x WORLD square) -----
function project(lng: number, lat: number): { x: number; y: number } {
  const clampedLat = Math.max(-85, Math.min(85, lat))
  const x = ((lng + 180) / 360) * WORLD
  const rad = (clampedLat * Math.PI) / 180
  const merc = Math.log(Math.tan(Math.PI / 4 + rad / 2))
  const y = (0.5 - merc / (2 * Math.PI)) * WORLD
  return { x, y }
}

// ----- GeoJSON -> SVG path -----
type Ring = [number, number][]
interface Geometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: Ring[] | Ring[][]
}
interface Feature {
  geometry: Geometry
  properties: { NAME?: string }
}
interface World {
  features: Feature[]
}

interface CountryLabel {
  name: string
  x: number
  y: number
  /** Projected area of the country's largest polygon; drives zoom priority. */
  area: number
}

// Area-weighted centroid of a (closed) ring, in projected space.
function ringCentroid(ring: Ring): { x: number; y: number; area: number } {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const p0 = project(ring[i][0], ring[i][1])
    const p1 = project(ring[i + 1][0], ring[i + 1][1])
    const f = p0.x * p1.y - p1.x * p0.y
    a += f
    cx += (p0.x + p1.x) * f
    cy += (p0.y + p1.y) * f
  }
  a *= 0.5
  if (a === 0) return { x: 0, y: 0, area: 0 }
  return { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) }
}

// Label point for a country: centroid of its largest polygon, so multi-part
// countries (e.g. USA, Russia) get a label on the main landmass.
function featureLabel(f: Feature): CountryLabel | null {
  const name = f.properties?.NAME
  if (!name) return null
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][]
  let best: { x: number; y: number; area: number } | null = null
  for (const poly of polys) {
    const c = ringCentroid(poly[0]) // outer ring of each polygon
    if (!best || c.area > best.area) best = c
  }
  return best ? { name, x: best.x, y: best.y, area: best.area } : null
}

function ringToPath(ring: Ring): string {
  let d = ''
  for (let i = 0; i < ring.length; i++) {
    const { x, y } = project(ring[i][0], ring[i][1])
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d + 'Z'
}

function featureToPath(geom: Geometry): string {
  const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates) as Ring[][]
  let d = ''
  for (const poly of polys) for (const ring of poly) d += ringToPath(ring)
  return d
}

// ----- country layer (memoized; independent of pan/zoom) -----
const CountryLayer = memo(function CountryLayer({ paths }: { paths: string[] }) {
  return (
    <g fill="#1c2c4a" stroke="#35496e" strokeWidth={0.6} strokeLinejoin="round">
      {paths.map((d, i) => (
        <path key={i} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  )
})

interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

interface MapViewProps {
  birth: Coordinates
  death: Coordinates
  /** Place labels are only passed once the game is over (no clue leak). */
  birthPlace?: string
  deathPlace?: string
}

/** Keep the viewBox square, within the zoom range, and fully inside the world. */
function clampView(v: ViewBox): ViewBox {
  const w = Math.min(MAX_SPAN, Math.max(MIN_SPAN, v.w))
  const h = w
  return {
    w,
    h,
    x: Math.min(Math.max(v.x, 0), WORLD - w),
    y: Math.min(Math.max(v.y, 0), WORLD - h),
  }
}

function fitView(birth: Coordinates, death: Coordinates): ViewBox {
  const a = project(birth.lng, birth.lat)
  const b = project(death.lng, death.lat)
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const span = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  const size = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span * 2.2 + 60))
  return clampView({ x: cx - size / 2, y: cy - size / 2, w: size, h: size })
}

function Marker({
  p,
  color,
  r,
  label,
}: {
  p: { x: number; y: number }
  color: string
  r: number
  label?: string
}) {
  return (
    <g>
      <circle
        cx={p.x}
        cy={p.y}
        r={r}
        fill={color}
        opacity={0.3}
      >
        <animate
          attributeName="r"
          values={`${r};${r * 2.8};${r * 2.8}`}
          keyTimes="0;0.667;1"
          dur="3s"
          repeatCount="indefinite"
        />

        <animate
          attributeName="opacity"
          values="0.5;0;0"
          keyTimes="0;0.667;1"
          dur="3s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={p.x} cy={p.y} r={r} fill={color} stroke="#0a0f1e" strokeWidth={r * 0.4} />
      {label && (
        <text
          x={p.x}
          y={p.y - r * 2.4}
          textAnchor="middle"
          fontSize={r * 1.8}
          fill="#e9eefb"
          stroke="#0a0f1e"
          strokeWidth={r * 0.2}
          paintOrder="stroke"
          style={{ fontWeight: 600 }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

export function MapView({ birth, death, birthPlace, deathPlace }: MapViewProps) {
  const { data, isLoading, isError } = useQuery<World>({
    queryKey: ['world-geojson'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}world.geo.json`)
      if (!res.ok) throw new Error(`world.geo.json -> ${res.status}`)
      return res.json()
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const paths = useMemo(() => (data ? data.features.map((f) => featureToPath(f.geometry)) : []), [data])
  const countryLabels = useMemo<CountryLabel[]>(
    () => (data ? data.features.map(featureLabel).filter((l): l is CountryLabel => l !== null) : []),
    [data],
  )

  const [view, setView] = useState<ViewBox>(() => fitView(birth, death))
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; scale: number } | null>(null)

  // Re-fit when the figure (points) changes.
  useEffect(() => {
    setView(fitView(birth, death))
  }, [birth.lat, birth.lng, death.lat, death.lng])

  const a = project(birth.lng, birth.lat)
  const b = project(death.lng, death.lat)
  const markerR = view.w * 0.02

  // Country names: only when zoomed in past the threshold, and only those whose
  // label point falls within the current viewBox (keeps the DOM light).
  const showLabels = view.w <= LABEL_SPAN
  const minLabelArea = view.w * view.h * LABEL_MIN_AREA_FRACTION
  const visibleLabels = showLabels
    ? countryLabels.filter(
        (l) =>
          l.area >= minLabelArea &&
          l.x >= view.x &&
          l.x <= view.x + view.w &&
          l.y >= view.y &&
          l.y <= view.y + view.h,
      )
    : []
  const labelSize = view.w * 0.018

  // Continent names take over while zoomed out (when no country names show).
  const showContinents = !showLabels
  const continentSize = view.w * 0.03
  const visibleContinents = showContinents
    ? CONTINENTS.map((c) => ({ name: c.name, ...project(c.lng, c.lat) })).filter(
        (l) => l.x >= view.x && l.x <= view.x + view.w && l.y >= view.y && l.y <= view.y + view.h,
      )
    : []

  function zoomBy(factor: number) {
    setView((v) => {
      const nw = Math.min(MAX_SPAN, Math.max(MIN_SPAN, v.w * factor))
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      return clampView({ x: cx - nw / 2, y: cy - nw / 2, w: nw, h: nw })
    })
  }

  // Scroll-wheel zoom, anchored to the cursor. Registered manually so the
  // listener is non-passive (preventDefault stops the page from scrolling).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = svg!.getBoundingClientRect()
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1
      // "slice" scaling covers the larger container dimension; the square viewBox
      // is centered, so derive the cursor's position within it from that cover box.
      const cover = Math.max(rect.width, rect.height)
      const offX = (rect.width - cover) / 2
      const offY = (rect.height - cover) / 2
      const px = e.clientX - rect.left - offX
      const py = e.clientY - rect.top - offY
      setView((v) => {
        const nw = Math.min(MAX_SPAN, Math.max(MIN_SPAN, v.w * factor))
        const cursorX = v.x + (px / cover) * v.w
        const cursorY = v.y + (py / cover) * v.h
        return clampView({
          x: cursorX - (px / cover) * nw,
          y: cursorY - (py / cover) * nw,
          w: nw,
          h: nw,
        })
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = view.w / Math.max(rect.width, rect.height) // viewBox units per screen px (slice/cover)
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, scale }
    svgRef.current?.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    setView((v) =>
      clampView({
        ...v,
        x: d.vx - (e.clientX - d.sx) * d.scale,
        y: d.vy - (e.clientY - d.sy) * d.scale,
      }),
    )
  }
  function endDrag(e: RPointerEvent<SVGSVGElement>) {
    drag.current = null
    svgRef.current?.releasePointerCapture(e.pointerId)
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="size-6 text-accent" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
        Could not load the world map data (/world.geo.json).
      </div>
    )
  }

  return (
    <div className="absolute inset-0">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full touch-none select-none"
        style={{ background: '#0c1730', cursor: drag.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {/* ocean within world bounds (outside the [0,WORLD] box uses the svg background) */}
        <rect x={0} y={0} width={WORLD} height={WORLD} fill="#0c1730" />
        <CountryLayer paths={paths} />

        {/* country name labels (only once zoomed in past the threshold) */}
        {showLabels && (
          <g pointerEvents="none">
            {visibleLabels.map((l) => (
              <text
                key={l.name}
                x={l.x}
                y={l.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={labelSize}
                fill="#cdd8f0"
                stroke="#0a0f1e"
                strokeWidth={labelSize * 0.18}
                paintOrder="stroke"
                style={{ fontWeight: 500 }}
              >
                {l.name}
              </text>
            ))}
          </g>
        )}

        {/* continent name labels (while zoomed out, before country names appear) */}
        {showContinents && (
          <g pointerEvents="none">
            {visibleContinents.map((l) => (
              <text
                key={l.name}
                x={l.x}
                y={l.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={continentSize}
                fill="#8aa0c8"
                stroke="#0a0f1e"
                strokeWidth={continentSize * 0.14}
                paintOrder="stroke"
                style={{ fontWeight: 700, letterSpacing: continentSize * 0.15, textTransform: 'uppercase' }}
              >
                {l.name}
              </text>
            ))}
          </g>
        )}

        {/* route line */}
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#f4b740"
          strokeWidth={1.6}
          strokeDasharray="4 3"
          strokeLinecap="round"
          opacity={0.8}
          vectorEffect="non-scaling-stroke"
        />

        <Marker p={a} color="#34d399" r={markerR} label={birthPlace} />
        <Marker p={b} color="#f87171" r={markerR} label={deathPlace} />
      </svg>

      {/* zoom / fit controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-border bg-bg/80 backdrop-blur">
        <button
          onClick={() => zoomBy(0.7)}
          className="grid size-9 place-items-center text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <button
          onClick={() => zoomBy(1.4)}
          className="grid size-9 place-items-center border-t border-border text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
        <button
          onClick={() => setView(fitView(birth, death))}
          className="grid size-9 place-items-center border-t border-border text-muted hover:bg-surface-2 hover:text-text"
          aria-label="Fit to markers"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
    </div>
  )
}
