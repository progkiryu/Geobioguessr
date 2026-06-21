import {
  Lock,
  CalendarDays,
  UserRound,
  Briefcase,
  Landmark,
  Sparkles,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react'
import type { Hint } from '@/types'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const SLOTS: { level: number; title: string; subtitle: string; icon: typeof Lock }[] = [
  { level: 1, title: 'Lifespan', subtitle: 'Born, died & age', icon: CalendarDays },
  { level: 2, title: 'Identity', subtitle: 'Ethnicity, nationality, gender', icon: UserRound },
  { level: 3, title: 'Occupation', subtitle: 'Industry & roles', icon: Briefcase },
  { level: 4, title: 'Significance', subtitle: 'Notable contribution', icon: Landmark },
  { level: 5, title: 'Characteristic', subtitle: 'A distinctive fact', icon: Sparkles },
  { level: 6, title: 'Visual', subtitle: 'Portrait or initials', icon: ImageIcon },
]

function Field({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === '') return null
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm text-text break-words">{value}</div>
    </div>
  )
}

function HintBody({ hint }: { hint: Hint }) {
  switch (hint.level) {
    case 1:
      // Auto-fit columns so the fields reflow to fewer columns (eventually a
      // single vertical stack) instead of crowding when the card is narrow.
      return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-3">
          <Field label="Born" value={hint.data.born} />
          <Field label="Died" value={hint.data.died} />
          <Field label="Age" value={hint.data.age} />
        </div>
      )
    case 2:
      return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-3">
          <Field label="Ethnicity" value={hint.data.ethnicity} />
          <Field label="Nationality" value={hint.data.nationality} />
          <Field label="Gender" value={hint.data.gender} />
        </div>
      )
    case 3:
      return (
        <div className="space-y-2">
          <Field label="Industry" value={hint.data.industry.join(', ')} />
          <Field label="Occupation" value={hint.data.occupation.join(', ')} />
        </div>
      )
    case 4:
      return <p className="text-sm leading-relaxed text-text">{hint.data.contribution}</p>
    case 5:
      return <p className="text-sm leading-relaxed text-text">{hint.data.fact}</p>
    case 6:
      return hint.data.imageUrl ? (
        <img
          src={hint.data.imageUrl}
          alt="Portrait"
          className="mx-auto h-32 w-32 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg border border-border bg-surface-2 text-3xl font-bold tracking-widest text-accent">
          {hint.data.initials}
        </div>
      )
  }
}

export function HintGrid({ revealed }: { revealed: Hint[] }) {
  const byLevel = new Map<number, Hint>(revealed.map((h) => [h.level, h]))

  return (
    <div className="space-y-3">
      {/* Always-visible geographic base clue */}
      <Card className="border-sky/30 bg-sky/5">
        <div className="flex items-start gap-3 p-4">
          <span className="mt-0.5 rounded-md bg-sky/15 p-2 text-sky">
            <MapPin className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-text">Geographic Clue</div>
            <p className="text-xs text-muted">
              <span className="text-green-300">Birth</span> and <span className="text-red-300">death</span> locations are marked on the map. Reason about the places
              to identify the figure.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SLOTS.map((slot) => {
          const hint = byLevel.get(slot.level)
          const Icon = slot.icon
          const unlocked = Boolean(hint)
          return (
            <Card
              key={slot.level}
              className={cn(
                'transition-all',
                unlocked ? 'animate-fade-up border-accent/30' : 'opacity-70',
              )}
            >
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-md p-1.5',
                      unlocked ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {unlocked ? <Icon className="size-4" /> : <Lock className="size-4" />}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-text">
                      Hint {slot.level}: {slot.title}
                    </div>
                    {!unlocked && <div className="text-[11px] text-muted">{slot.subtitle}</div>}
                  </div>
                </div>
                {unlocked && hint ? (
                  <HintBody hint={hint} />
                ) : (
                  <p className="text-xs text-muted/70">
                    Revealed after wrong guess #{slot.level}.
                  </p>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
