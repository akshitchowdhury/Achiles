import { useState } from 'react'
import { CalendarDays, Clock, Info, Layers } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { OptionGroup } from '../components/ui/OptionGroup'
import { StatTile } from '../components/ui/StatTile'
import {
  EXPERIENCE_META,
  FOCUS_META,
  sessionMinutes,
  splitFor,
  weeklySets,
} from '../lib/workout'
import type { DaysPerWeek, Experience, Focus } from '../lib/workout'

const DAY_OPTIONS = [
  { value: '3', label: '3 days', detail: 'Full-body rotation' },
  { value: '4', label: '4 days', detail: 'Upper / lower' },
  { value: '5', label: '5 days', detail: 'Push / pull / legs +' },
  { value: '6', label: '6 days', detail: 'Push / pull / legs ×2' },
] as const

export function WorkoutPage() {
  const [days, setDays] = useState<'3' | '4' | '5' | '6'>('4')
  const [focus, setFocus] = useState<Focus>('hypertrophy')
  const [experience, setExperience] = useState<Experience>('returning')

  const dayCount = Number(days) as DaysPerWeek
  const split = splitFor(dayCount)
  const sets = weeklySets(dayCount, focus, experience)
  const minutes = sessionMinutes(focus)
  const meta = FOCUS_META[focus]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workout"
        title="Shape your week"
        description="Pick a frequency and a focus to see the split it implies. This planner runs locally — nothing is saved to your profile yet."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="space-y-6 lg:col-span-2">
          <OptionGroup
            legend="Days per week"
            value={days}
            onChange={setDays}
            options={DAY_OPTIONS}
            columns={2}
          />

          <OptionGroup
            legend="Training focus"
            value={focus}
            onChange={setFocus}
            options={(Object.keys(FOCUS_META) as Focus[]).map((key) => ({
              value: key,
              label: FOCUS_META[key].label,
              detail: FOCUS_META[key].detail,
            }))}
          />

          <OptionGroup
            legend="Experience"
            value={experience}
            onChange={setExperience}
            options={(Object.keys(EXPERIENCE_META) as Experience[]).map((key) => ({
              value: key,
              label: EXPERIENCE_META[key].label,
              detail: EXPERIENCE_META[key].detail,
            }))}
          />
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Sessions" value={dayCount} unit="/ week" icon={CalendarDays} />
            <StatTile label="Working sets" value={sets} unit="/ week" icon={Layers} hint="Estimated" />
            <StatTile label="Session length" value={`~${minutes}`} unit="min" icon={Clock} />
          </div>

          <Card>
            <CardHeader
              title="Your split"
              hint={`${meta.sets} sets × ${meta.reps} reps · ${meta.rest} rest`}
            />
            <ol className="space-y-2">
              {split.map((day) => (
                <li
                  key={`${day.day}-${day.focus}`}
                  className="border-hairline bg-raised flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-3"
                >
                  <span className="bg-volt/15 text-volt flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold">
                    {day.day}
                  </span>
                  <span className="text-ink w-28 shrink-0 text-sm font-medium">{day.focus}</span>
                  <span className="text-ink-muted min-w-0 flex-1 text-xs">
                    {day.movements.join(' · ')}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <div className="flex gap-3">
              <Info className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="text-ink-dim text-sm">
                These are conventional templates, not a prescription. For a plan built
                around your own numbers, use the{' '}
                <span className="text-ink font-medium">AI panel</span> — it reads your
                stored metrics directly.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
