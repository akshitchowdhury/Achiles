/**
 * Local training-split templates. These are conventional programming
 * structures, generated deterministically from the reader's choices — the
 * server has no workout route yet, so nothing here is persisted.
 */

export type Focus = 'strength' | 'hypertrophy' | 'conditioning'
export type Experience = 'new' | 'returning' | 'trained'
export type DaysPerWeek = 3 | 4 | 5 | 6

export const FOCUS_META: Record<
  Focus,
  { label: string; detail: string; sets: string; reps: string; rest: string }
> = {
  strength: {
    label: 'Strength',
    detail: 'Heavy, low reps',
    sets: '4–5',
    reps: '3–6',
    rest: '2–3 min',
  },
  hypertrophy: {
    label: 'Muscle',
    detail: 'Moderate load, volume',
    sets: '3–4',
    reps: '8–12',
    rest: '60–90 s',
  },
  conditioning: {
    label: 'Conditioning',
    detail: 'Circuits, short rest',
    sets: '3',
    reps: '12–20',
    rest: '30–45 s',
  },
}

export const EXPERIENCE_META: Record<
  Experience,
  { label: string; detail: string; volumeScale: number }
> = {
  new: { label: 'New to lifting', detail: 'Under 6 months', volumeScale: 0.75 },
  returning: { label: 'Returning', detail: 'Trained before, off a while', volumeScale: 0.9 },
  trained: { label: 'Consistent', detail: 'A year or more', volumeScale: 1 },
}

export interface SplitDay {
  day: string
  focus: string
  movements: string[]
}

const SPLITS: Record<DaysPerWeek, SplitDay[]> = {
  3: [
    { day: 'Mon', focus: 'Full body A', movements: ['Squat', 'Bench press', 'Row', 'Plank'] },
    { day: 'Wed', focus: 'Full body B', movements: ['Deadlift', 'Overhead press', 'Pull-up', 'Carry'] },
    { day: 'Fri', focus: 'Full body C', movements: ['Front squat', 'Incline press', 'Lat pulldown', 'Hanging leg raise'] },
  ],
  4: [
    { day: 'Mon', focus: 'Upper', movements: ['Bench press', 'Row', 'Lateral raise', 'Curl'] },
    { day: 'Tue', focus: 'Lower', movements: ['Squat', 'Romanian deadlift', 'Calf raise', 'Plank'] },
    { day: 'Thu', focus: 'Upper', movements: ['Overhead press', 'Pull-up', 'Chest fly', 'Triceps extension'] },
    { day: 'Fri', focus: 'Lower', movements: ['Deadlift', 'Split squat', 'Leg curl', 'Side plank'] },
  ],
  5: [
    { day: 'Mon', focus: 'Push', movements: ['Bench press', 'Overhead press', 'Lateral raise', 'Triceps extension'] },
    { day: 'Tue', focus: 'Pull', movements: ['Deadlift', 'Pull-up', 'Row', 'Curl'] },
    { day: 'Wed', focus: 'Legs', movements: ['Squat', 'Romanian deadlift', 'Leg press', 'Calf raise'] },
    { day: 'Fri', focus: 'Upper', movements: ['Incline press', 'Lat pulldown', 'Face pull', 'Dip'] },
    { day: 'Sat', focus: 'Lower + core', movements: ['Front squat', 'Hip thrust', 'Leg curl', 'Hanging leg raise'] },
  ],
  6: [
    { day: 'Mon', focus: 'Push', movements: ['Bench press', 'Overhead press', 'Lateral raise', 'Dip'] },
    { day: 'Tue', focus: 'Pull', movements: ['Deadlift', 'Pull-up', 'Row', 'Curl'] },
    { day: 'Wed', focus: 'Legs', movements: ['Squat', 'Romanian deadlift', 'Leg press', 'Calf raise'] },
    { day: 'Thu', focus: 'Push', movements: ['Incline press', 'Arnold press', 'Cable fly', 'Triceps pushdown'] },
    { day: 'Fri', focus: 'Pull', movements: ['Rack pull', 'Lat pulldown', 'Face pull', 'Hammer curl'] },
    { day: 'Sat', focus: 'Legs + core', movements: ['Front squat', 'Hip thrust', 'Leg curl', 'Ab wheel'] },
  ],
}

export function splitFor(days: DaysPerWeek): SplitDay[] {
  return SPLITS[days]
}

/** Rough weekly working-set count, before the experience scale is applied. */
export function weeklySets(days: DaysPerWeek, focus: Focus, experience: Experience): number {
  const setsPerMovement = focus === 'strength' ? 4.5 : focus === 'hypertrophy' ? 3.5 : 3
  const movements = splitFor(days).reduce((sum, day) => sum + day.movements.length, 0)
  return Math.round(movements * setsPerMovement * EXPERIENCE_META[experience].volumeScale)
}

/** Estimated minutes per session, from set count and rest length. */
export function sessionMinutes(focus: Focus): number {
  return focus === 'strength' ? 70 : focus === 'hypertrophy' ? 55 : 40
}
