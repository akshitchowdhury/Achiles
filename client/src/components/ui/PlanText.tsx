import { useMemo } from 'react'
import clsx from 'clsx'
import { parsePlan } from '../../lib/planText'

/**
 * Renders the coach's answer as plain, formatted text.
 *
 * The model is asked for Markdown so its structure is machine-readable, but
 * none of that syntax reaches the screen: `parsePlan` drops the markers and
 * this turns what is left into real headings, paragraphs and lists. No raw
 * model output is ever interpreted as markup, so there is nothing for it to
 * inject either.
 *
 * Spacing is per-block rather than a container `space-y`, because a section
 * heading needs more air above it than a paragraph does.
 */
export function PlanText({ content, className }: { content: string; className?: string }) {
  const blocks = useMemo(() => parsePlan(content), [content])

  if (!blocks.length) return null

  return (
    <div className={clsx('text-ink-dim text-sm leading-relaxed', className)}>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`

        switch (block.kind) {
          case 'title':
            return (
              <h3
                key={key}
                className="text-ink mt-6 text-lg font-semibold tracking-tight first:mt-0"
              >
                {block.text}
              </h3>
            )

          case 'heading':
            return (
              <h4
                key={key}
                className="text-ink mt-6 text-base font-semibold tracking-tight first:mt-0"
              >
                {block.text}
              </h4>
            )

          case 'bullets':
            return (
              <ul key={key} className="mt-3 space-y-1.5 first:mt-0">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="relative pl-4">
                    <span
                      aria-hidden="true"
                      className="bg-ink-muted absolute top-2 left-0 size-1.5 rounded-full"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            )

          case 'steps':
            return (
              // The numbers are the model's own, not the DOM's, so a list that
              // resumes after a nested block keeps counting — hence `start`
              // and an explicit marker instead of `list-decimal`.
              <ol key={key} start={block.items[0]?.ordinal} className="mt-3 space-y-1.5 first:mt-0">
                {block.items.map((item) => (
                  <li key={item.ordinal} className="flex gap-2">
                    <span className="text-ink-muted shrink-0 tabular-nums">{item.ordinal}.</span>
                    <span className="min-w-0">{item.text}</span>
                  </li>
                ))}
              </ol>
            )

          default:
            return (
              <p key={key} className="mt-3 first:mt-0">
                {block.text}
              </p>
            )
        }
      })}
    </div>
  )
}
