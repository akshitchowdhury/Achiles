/**
 * Rendered by every shell as its first focusable element.
 *
 * With five different nav placements — a left rail, a centred entablature, a
 * bottom dock, a scoreboard bar, a right rail — how much chrome a keyboard user
 * tabs through before reaching content varies per layout. This makes that
 * difference irrelevant. Each shell's <main> carries the matching id="main".
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="bg-volt text-on-accent sr-only rounded-lg px-4 py-2 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
    >
      Skip to content
    </a>
  )
}
