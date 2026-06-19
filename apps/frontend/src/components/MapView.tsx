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
const MIN_SPAN = 80
const MAX_SPAN = WORLD

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
}
interface World {
  features: Feature[]
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

function fitView(birth: Coordinates, death: Coordinates): ViewBox {
  const a = project(birth.lng, birth.lat)
  const b = project(death.lng, death.lat)
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const span = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  const size = Math.min(MAX_SPAN, Math.max(MIN_SPAN, span * 2.2 + 60))
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size }
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
      <circle cx={p.x} cy={p.y} r={r * 1.7} fill={color} opacity={0.3}>
        <animate attributeName="r" values={`${r * 1.5};${r * 2.6};${r * 1.5}`} dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0.05;0.35" dur="2.2s" repeatCount="indefinite" />
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

  function zoomBy(factor: number) {
    setView((v) => {
      const nw = Math.min(MAX_SPAN, Math.max(MIN_SPAN, v.w * factor))
      const cx = v.x + v.w / 2
      const cy = v.y + v.h / 2
      return { x: cx - nw / 2, y: cy - nw / 2, w: nw, h: nw }
    })
  }

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
    setView((v) => ({
      ...v,
      x: d.vx - (e.clientX - d.sx) * d.scale,
      y: d.vy - (e.clientY - d.sy) * d.scale,
    }))
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
