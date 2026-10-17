import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { QuotaLimit, QuotaSnapshot } from '../types'

const snapshot = atom({ plugin: 'quota-band', key: 'snapshot' } as const, null)

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'Woche',
  spend_limit: 'Budget',
}

export const label = (kind: string): string =>
  LABELS[kind] ?? kind.replace(/^seven_day_/, '').replace(/_/g, ' ')

export const color = (p: number): 'success' | 'warning' | 'error' =>
  p >= 90 ? 'error' : p >= 70 ? 'warning' : 'success'

export const meter = (p: number, cells = 8): string => {
  const filled = Math.max(0, Math.min(cells, Math.round((p / 100) * cells)))
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled)
}

export const left = (resetsAt: string | undefined, now: number): string => {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms)) return ''
  if (ms <= 0) return 'jetzt'
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mm = m % 60
  if (d > 0) return `${d}T ${h}h`
  if (h > 0) return `${h}h ${String(mm).padStart(2, '0')}m`
  return `${mm}m`
}

async function refresh($: EngineInterface): Promise<void> {
  const usage = await $.session.usage()
  const now = await $.clock.now()
  const next: QuotaSnapshot = {
    limits: usage.rateLimits.map(
      (r): QuotaLimit => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt }),
    ),
    contextPercent: usage.context.percent,
    now,
  }
  await update($, snapshot, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    // Countdown einmal pro Minute nachziehen
    $.clock.every(60_000, () => refresh($))
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={2}>
        {snap.limits.length === 0 ? (
          <Text dimColor mono size="footnote">
            Limits erscheinen nach der ersten Antwort
          </Text>
        ) : (
          snap.limits.map(l => (
            <Text key={l.kind} mono size="footnote">
              <Text dimColor>{label(l.kind)} </Text>
              <Text color={color(l.percentUsed)}>{meter(l.percentUsed)} </Text>
              <Text color={color(l.percentUsed)} weight="semibold" tabular>
                {Math.round(l.percentUsed)}%
              </Text>
              {l.resetsAt ? <Text dimColor> ↻ {left(l.resetsAt, snap.now)}</Text> : null}
            </Text>
          ))
        )}
        {typeof snap.contextPercent === 'number' ? (
          <Text key="ctx" mono size="footnote">
            <Text dimColor>Kontext </Text>
            <Text color={color(snap.contextPercent)} tabular>
              {snap.contextPercent}%
            </Text>
          </Text>
        ) : null}
      </Box>
    )
  })
}
