/**
 * Turns the coach's answer into display blocks with every Markdown marker
 * removed.
 *
 * The server still asks the model for `##` headings and `-` bullets, because
 * those markers are the most reliable way to get *structure* out of a model.
 * They are a wire format, not a design: nobody wants to read `**Day 1**` or a
 * row of pipes. So the markers are parsed here and thrown away, and the blocks
 * that come out are rendered as ordinary typography by `PlanText`.
 *
 * This is deliberately not a Markdown implementation. It recognises the handful
 * of constructs a training plan actually arrives in — sections, prose, bullets,
 * numbered steps, the occasional table — and flattens everything else to text.
 */

/**
 * One item of a numbered list, carrying the number the model wrote rather than
 * its position in the block. A nested bullet list splits the steps around it
 * into two blocks, and only the original ordinal keeps the second half
 * counting from where the first left off instead of restarting at 1.
 */
export interface Step {
  ordinal: number
  text: string
}

export type PlanBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'steps'; items: Step[] }

/** Strips the inline markers from one line's worth of text. */
export function stripInline(value: string): string {
  return (
    value
      // An image is pure markup once its syntax is gone — drop it whole.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // A link keeps its label; the URL is noise in something being read.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Autolinks lose only their brackets.
      .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
      .replace(/```([^`]*)```/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/(\*\*\*|___)(\S(?:.*?\S)?)\1/g, '$2')
      .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, '$2')
      // Bold is gone by here, so a surviving `*pair*` is emphasis.
      .replace(/\*([^*\n]+)\*/g, '$1')
      // Underscores only count as emphasis at a word boundary, which is what
      // keeps identifiers like Training_Plan intact.
      .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, '$1$2')
      .replace(/~~([^~\n]+)~~/g, '$1')
      // Escapes existed only to protect the markers just removed.
      .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** True for a `|---|:--:|` table separator, which carries no content. */
function isTableRule(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => cell === '' || /^:?-+:?$/.test(cell))
}

function tableCells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripInline(cell))
}

/**
 * Hangs an unmarked continuation line off whichever list item is still open.
 * Returns false when there is nothing open to continue.
 */
function appendToLastItem(blocks: PlanBlock[], text: string): boolean {
  const last = blocks.at(-1)
  if (last?.kind === 'bullets' && last.items.length) {
    last.items[last.items.length - 1] += ` ${text}`
    return true
  }
  if (last?.kind === 'steps' && last.items.length) {
    const step = last.items[last.items.length - 1]
    step.text += ` ${text}`
    return true
  }
  return false
}

export function parsePlan(raw: string): PlanBlock[] {
  const blocks: PlanBlock[] = []
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')

  let paragraph: string[] = []

  const flushParagraph = () => {
    const text = stripInline(paragraph.join(' '))
    paragraph = []
    if (text) blocks.push({ kind: 'text', text })
  }

  /**
   * Opens (or continues) a list and hands back the array to push onto. A list
   * is appended to `blocks` the moment it gains its first item, so "is a list
   * still open?" is just "is the last block a list?" — no second piece of
   * state to keep in step with the output.
   */
  const bulletItems = (): string[] => {
    flushParagraph()
    const last = blocks.at(-1)
    if (last?.kind === 'bullets') return last.items
    const items: string[] = []
    blocks.push({ kind: 'bullets', items })
    return items
  }

  const stepItems = (): Step[] => {
    flushParagraph()
    const last = blocks.at(-1)
    if (last?.kind === 'steps') return last.items
    const items: Step[] = []
    blocks.push({ kind: 'steps', items })
    return items
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // A fence around a plan is over-formatting, not code. Keep the contents
    // and drop the fence, so the lines inside parse like any others.
    if (/^(```|~~~)/.test(line)) continue

    if (!line) {
      flushParagraph()
      continue
    }

    // `---` / `***` / `___` were only ever a horizontal line on screen.
    if (/^([-*_])\1{2,}$/.test(line.replace(/\s+/g, ''))) {
      flushParagraph()
      continue
    }

    // ## Section — the level decides how loud it renders, nothing more.
    const atx = /^(#{1,6})\s+(.*)$/.exec(line)
    if (atx) {
      flushParagraph()
      const text = stripInline(atx[2].replace(/\s*#+\s*$/, ''))
      if (text) blocks.push({ kind: atx[1].length === 1 ? 'title' : 'heading', text })
      continue
    }

    // A line that is *only* bold is a heading written the lazy way:
    // `**Day 1 — Chest and Triceps**`. Trailing colon included, since a
    // `**Goal:**` that starts a sentence falls through to the paragraph path.
    const bold = /^(?:\*\*|__)(.+?)(?:\*\*|__):?$/.exec(line)
    if (bold) {
      flushParagraph()
      const text = stripInline(bold[1])
      if (text) blocks.push({ kind: 'heading', text })
      continue
    }

    // Table rows become bullets: the pipes go, the cells stay, joined by a
    // separator that survives being read aloud.
    if (line.startsWith('|')) {
      const cells = tableCells(line)
      if (isTableRule(cells)) continue
      const item = cells.filter(Boolean).join(' · ')
      if (item) bulletItems().push(item)
      continue
    }

    const bullet = /^[-*+•]\s+(.*)$/.exec(line)
    if (bullet) {
      const text = stripInline(bullet[1])
      if (text) bulletItems().push(text)
      continue
    }

    const step = /^(\d{1,3})[.)]\s+(.*)$/.exec(line)
    if (step) {
      const text = stripInline(step[2])
      if (text) {
        const items = stepItems()
        // Trust the model's number only while it keeps climbing. Some answers
        // number every item "1.", and a repaired sequence reads better than a
        // column of ones.
        const previous = items.at(-1)?.ordinal ?? 0
        const written = Number(step[1])
        items.push({
          ordinal: written > previous ? written : previous + 1,
          text,
        })
      }
      continue
    }

    // An indented, unmarked line under an open list is that item continuing
    // (or a sub-bullet the model indented) — appending keeps it with its item
    // instead of breaking the list in two around a stray paragraph.
    if (!paragraph.length && /^\s{2,}/.test(rawLine)) {
      const text = stripInline(line)
      if (text && appendToLastItem(blocks, text)) continue
    }

    // Blockquote markers add nothing once the quote is just another paragraph.
    paragraph.push(line.replace(/^>\s?/, ''))
  }

  flushParagraph()
  return blocks
}
