import {
  Activity,
  Amphora,
  Anvil,
  Crosshair,
  Crown,
  Droplets,
  Dumbbell,
  Flame,
  Hammer,
  Landmark,
  Mountain,
  Radar,
  Ruler,
  Scale,
  Scroll,
  Shield,
  ShieldHalf,
  Swords,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import {
  AuraFlame,
  ClawMark,
  CursedSeal,
  Katana,
  MoonTide,
  Obsidian,
  Shuriken,
  Talisman,
} from '../components/icons/AnimeGlyphs'
import type { PlanSlug } from '../types'
import { DEFAULT_SLUG } from './registry'

/**
 * Any icon a plan can use. Deliberately wider than LucideIcon: the manga plan
 * needs a shuriken and an arcane seal, which no dashboard icon set ships, and
 * a hand-drawn SVG has to be interchangeable with a lucide one at every call
 * site. Both satisfy this — they take the same SVG props.
 */
export type MotifIcon = ComponentType<SVGProps<SVGSVGElement>>

/**
 * The third lookup keyed on the plan slug — what the app SAYS and DRAWS, next
 * to registry.ts (which shell) and plan-themes.css (which tokens).
 *
 * The split is deliberate. Colour and layout already made the five plans look
 * different, and it was not enough: every dashboard still said "Your baseline"
 * over the same five grey stat tiles with the same five generic icons, so the
 * plan read as a skin rather than as a template. This table is what makes a
 * Spartan dashboard a muster roll and an Athlete dashboard a tale of the tape.
 *
 * Two rules hold everywhere below:
 *
 *  1. Only the FRAMING is themed. Every number, unit and hint stays literal —
 *     an athlete reading "Base output" still gets "kcal at complete rest"
 *     underneath. Flavour that hides what a figure means is a bug, and the
 *     `hint` fields exist so it never has to.
 *  2. Nothing here is a colour, radius or font. Those are tokens, and a plan
 *     that needs one adds it to plan-themes.css instead.
 */

/** The five figures of the KPI row, plus the two icons the page furniture uses. */
export interface MotifIcons {
  bmi: MotifIcon
  bmr: MotifIcon
  height: MotifIcon
  weight: MotifIcon
  water: MotifIcon
  /** Sits on the hero panel's eyebrow. */
  hero: MotifIcon
  /** Sits in the coach nudge at the foot of the page. */
  coach: MotifIcon
}

export interface MotifCopy {
  /** Uppercase eyebrow over the page title. */
  eyebrow: string
  /** Given a first name, the page title. */
  title: (firstName: string) => string
  /** Eyebrow on the hero figure — the maintenance-calorie panel. */
  heroLabel: string
  /** Word for the training intensity the hero figure assumes. */
  tempo: string
  /** Hero panel's link out to the coach. */
  heroCta: string
  /** KPI tile labels, in the order they appear. */
  stats: { bmi: string; bmr: string; height: string; weight: string; water: string }
  /** Card titles for the four charts. */
  charts: { band: string; range: string; burn: string; macros: string }
  /** The closing nudge toward /coach. */
  nudge: { title: string; body: string; cta: string }
  /** Decorative strip under the shell chrome — a rank, a file number, a
   *  chapter caption. Rendered aria-hidden. */
  banner: string
}

export interface PlanMotif {
  icons: MotifIcons
  copy: MotifCopy
}

export const PLAN_MOTIFS: Record<PlanSlug, PlanMotif> = {
  spartan: {
    icons: {
      bmi: Scale,
      bmr: Flame,
      height: Mountain,
      weight: Anvil,
      water: Droplets,
      hero: Swords,
      coach: Hammer,
    },
    copy: {
      eyebrow: 'The muster',
      title: (name) => `${name}'s field report`,
      heroLabel: 'Daily ration',
      tempo: 'campaign tempo',
      heroCta: 'Draw the orders',
      stats: {
        bmi: 'Mass index',
        bmr: 'Rest burn',
        height: 'Stature',
        weight: 'Load borne',
        water: 'Water ration',
      },
      charts: {
        band: 'Where you stand',
        range: 'Load against the line',
        burn: 'Ration by campaign tempo',
        macros: 'Ration split',
      },
      nudge: {
        title: 'Orders, not encouragement.',
        body: 'Turn the report into a week of work that does not negotiate.',
        cta: 'Open the war table',
      },
      banner: 'Standing orders · issued at dawn',
    },
  },

  'greek-god': {
    icons: {
      bmi: Landmark,
      bmr: Flame,
      height: Ruler,
      weight: Scale,
      water: Amphora,
      hero: Crown,
      coach: Scroll,
    },
    copy: {
      eyebrow: 'The canon',
      title: (name) => `The proportions of ${name}`,
      heroLabel: 'Daily sustenance',
      tempo: 'measured labour',
      heroCta: 'Consult the canon',
      stats: {
        bmi: 'Symmetry',
        bmr: 'Inner fire',
        height: 'Stature',
        weight: 'Substance',
        water: 'Libation',
      },
      charts: {
        band: 'Where you sit in the canon',
        range: 'Form against the ideal',
        burn: 'Sustenance by labour',
        macros: 'The offering, divided',
      },
      nudge: {
        title: 'The measure is only the beginning.',
        body: 'Let the oracle set the week — the labour, the table, the rest.',
        cta: 'Consult the oracle',
      },
      banner: 'Measured, not guessed',
    },
  },

  superhero: {
    icons: {
      bmi: Crosshair,
      bmr: Zap,
      height: Ruler,
      weight: ShieldHalf,
      water: Droplets,
      hero: Shield,
      coach: Radar,
    },
    copy: {
      eyebrow: 'Operator file',
      title: (name) => `${name} · baseline readout`,
      heroLabel: 'Daily intake',
      tempo: 'standard op tempo',
      heroCta: 'Pull the dossier',
      stats: {
        bmi: 'Mass ratio',
        bmr: 'Idle draw',
        height: 'Height',
        weight: 'Payload',
        water: 'Hydration',
      },
      charts: {
        band: 'Where you read',
        range: 'Payload vs spec',
        burn: 'Draw by op tempo',
        macros: 'Fuel mix',
      },
      nudge: {
        title: 'Baseline logged. Awaiting op order.',
        body: 'Convert the readout into a week of assignments and rations.',
        cta: 'Open comms',
      },
      banner: 'Baseline logged · eyes only',
    },
  },

  athlete: {
    icons: {
      bmi: Activity,
      bmr: Flame,
      height: Ruler,
      weight: Dumbbell,
      water: Droplets,
      hero: Trophy,
      coach: Timer,
    },
    copy: {
      eyebrow: 'Tale of the tape',
      title: (name) => `${name} — match fitness`,
      heroLabel: 'Daily fuel',
      tempo: 'moderate training load',
      heroCta: 'Get the game plan',
      stats: {
        bmi: 'BMI',
        bmr: 'BMR',
        height: 'Height',
        weight: 'Fight weight',
        water: 'Hydration',
      },
      charts: {
        band: 'Composition band',
        range: 'Weight vs target range',
        burn: 'Energy by training load',
        macros: 'Fuel split',
      },
      nudge: {
        title: 'Numbers are on the board.',
        body: 'Turn the tape into a periodised week — sessions, loads, macros.',
        cta: 'Open the performance desk',
      },
      banner: 'Season baseline · matchday −0',
    },
  },

  // Dark anime fantasy: cursed energy, sigils, moonlit blades. The voice is
  // the genre's own — a status window rendered by something that grades you.
  // Generic to the genre on purpose, never any one series' terminology.
  manga: {
    icons: {
      bmi: CursedSeal,
      bmr: AuraFlame,
      height: Katana,
      weight: Obsidian,
      water: MoonTide,
      hero: Shuriken,
      coach: Talisman,
    },
    copy: {
      eyebrow: 'Status window',
      title: (name) => `${name} — awakened`,
      heroLabel: 'Cursed energy',
      tempo: 'standard hunt',
      heroCta: 'Break the seal',
      stats: {
        bmi: 'Grade',
        bmr: 'Idle aura',
        height: 'Reach',
        weight: 'Vessel',
        water: 'Tide',
      },
      charts: {
        band: 'Where you rank',
        range: 'Vessel vs target band',
        burn: 'Aura by hunt tempo',
        macros: 'Domain split',
      },
      nudge: {
        title: 'The seal is only the first mark.',
        body: 'Take the reading into a full arc — hunts, rations, and the rest between.',
        cta: 'Open the grimoire',
      },
      banner: 'Rank assessment · seal 01',
    },
  },
}

/** The claw slash, used as ornament rather than as a stat icon. Exported so
 *  the manga shell can draw it without reaching into the motif table. */
export { ClawMark }

/** Kept total the same way layoutFor is, and for the same reason: a stale slug
 *  in localStorage must not blank the dashboard. */
export function motifFor(slug: PlanSlug | null | undefined): PlanMotif {
  return (slug && PLAN_MOTIFS[slug]) || PLAN_MOTIFS[DEFAULT_SLUG]
}
