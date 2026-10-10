/**
 * Derived training/nutrition figures.
 *
 * Everything here is computed from the values the server actually stores
 * (BMI, BMR, verdict, age, height, weight). Nothing is invented history —
 * these are standard published heuristics, and the UI labels them as
 * estimates/targets rather than as measurements.
 */

/** WHO BMI bands, used to position the marker on the scale. */
export const BMI_BANDS = [
  { label: 'Under', from: 0, to: 18.5 },
  { label: 'Healthy', from: 18.5, to: 25 },
  { label: 'Over', from: 25, to: 30 },
  { label: 'Obese', from: 30, to: 40 },
] as const

export const BMI_SCALE_MIN = 12
export const BMI_SCALE_MAX = 40

/** Where a BMI sits along the rendered scale, as a 0–100 percentage. */
export function bmiScalePosition(bmi: number): number {
  const clamped = Math.min(Math.max(bmi, BMI_SCALE_MIN), BMI_SCALE_MAX)
  return ((clamped - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100
}

export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral'

/**
 * Maps the server's verdict string to a status tone. The Go logic emits
 * "Normal" as a fall-through for BMI values on its band boundaries, so that
 * case stays neutral instead of being reinterpreted here.
 */
export function verdictTone(verdict: string): Tone {
  switch (verdict.trim().toLowerCase()) {
    case 'healthy':
      return 'good'
    case 'underweight':
      return 'warning'
    case 'overweight':
      return 'serious'
    case 'obese':
      return 'critical'
    default:
      return 'neutral'
  }
}

/** Standard TDEE activity multipliers applied to BMR. */
export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary', detail: 'Desk work, no training', factor: 1.2 },
  { key: 'light', label: 'Light', detail: '1–3 sessions / week', factor: 1.375 },
  { key: 'moderate', label: 'Moderate', detail: '3–5 sessions / week', factor: 1.55 },
  { key: 'active', label: 'Active', detail: '6–7 sessions / week', factor: 1.725 },
  { key: 'athlete', label: 'Athlete', detail: 'Twice daily / physical job', factor: 1.9 },
] as const

export type ActivityKey = (typeof ACTIVITY_LEVELS)[number]['key']

export function tdee(bmr: number, factor: number): number {
  return Math.round(bmr * factor)
}

export type Goal = 'cut' | 'maintain' | 'bulk'

/** Picks a sensible default goal from the stored verdict. */
export function goalForVerdict(verdict: string): Goal {
  const tone = verdictTone(verdict)
  if (tone === 'serious' || tone === 'critical') return 'cut'
  if (tone === 'warning') return 'bulk'
  return 'maintain'
}

export const GOAL_META: Record<Goal, { label: string; detail: string; delta: number }> = {
  cut: { label: 'Cut', detail: '20% below maintenance', delta: -0.2 },
  maintain: { label: 'Maintain', detail: 'At maintenance', delta: 0 },
  bulk: { label: 'Build', detail: '15% above maintenance', delta: 0.15 },
}

/** Macro ratios as a share of total calories. Sums to 1 per goal. */
const MACRO_RATIOS: Record<Goal, { protein: number; carbs: number; fat: number }> = {
  cut: { protein: 0.35, carbs: 0.35, fat: 0.3 },
  maintain: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  bulk: { protein: 0.25, carbs: 0.5, fat: 0.25 },
}

export interface MacroTarget {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** Calories per gram, used to turn a calorie share into grams. */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const

/**
 * Baseline protein in grams per kg of bodyweight, by lifestyle. Spans the
 * commonly cited 1.2 g/kg (sedentary) to 2.0 g/kg (heavy training) range.
 */
const PROTEIN_G_PER_KG: Record<ActivityKey, number> = {
  sedentary: 1.2,
  light: 1.4,
  moderate: 1.6,
  active: 1.8,
  athlete: 2.0,
}

/**
 * Added on top of the lifestyle baseline: a deficit needs more protein to
 * hold on to muscle, a surplus a little more to build it.
 */
const PROTEIN_GOAL_BONUS: Record<Goal, number> = {
  cut: 0.4,
  maintain: 0,
  bulk: 0.2,
}

/** Upper bound on the combined g/kg figure. */
const PROTEIN_G_PER_KG_MAX = 2.4

export function proteinGramsPerKg(activity: ActivityKey, goal: Goal): number {
  const perKg = PROTEIN_G_PER_KG[activity] + PROTEIN_GOAL_BONUS[goal]
  return Math.round(Math.min(perKg, PROTEIN_G_PER_KG_MAX) * 10) / 10
}

/**
 * Daily calories and macros. With a bodyweight, protein is set in g/kg from
 * lifestyle and goal, fat takes a fixed share of calories and carbs fill the
 * rest. Without one, it falls back to fixed calorie ratios per goal.
 */
export function macroTarget(
  maintenance: number,
  goal: Goal,
  activity: ActivityKey,
  weightKg: number | null,
): MacroTarget {
  const calories = Math.round(maintenance * (1 + GOAL_META[goal].delta))
  const ratio = MACRO_RATIOS[goal]

  const fat = Math.round((calories * ratio.fat) / KCAL_PER_G.fat)

  if (!weightKg) {
    return {
      calories,
      protein: Math.round((calories * ratio.protein) / KCAL_PER_G.protein),
      carbs: Math.round((calories * ratio.carbs) / KCAL_PER_G.carbs),
      fat,
    }
  }

  const protein = Math.round(weightKg * proteinGramsPerKg(activity, goal))
  const remaining = calories - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat
  const carbs = Math.max(0, Math.round(remaining / KCAL_PER_G.carbs))

  return { calories, protein, carbs, fat }
}

/** Daily water target — 35ml per kg of bodyweight, in litres. */
export function waterTargetLitres(weightKg: number): number {
  return Math.round((weightKg * 35) / 100) / 10
}

/** Healthy weight range for a height, from the 18.5–25 BMI band. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m2 = (heightCm / 100) ** 2
  return { min: Math.round(18.5 * m2), max: Math.round(25 * m2) }
}
