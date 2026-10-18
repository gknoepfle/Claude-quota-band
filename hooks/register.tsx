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

async function measure($: EngineInterface): Promise<QuotaSnapshot> {
  const now = await $.clock.now()
  try {
    const usage = await $.session.usage()
    return {
      limits: (usage.rateLimits ?? []).map(
        (r): QuotaLimit => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt }),
      ),
      contextPercent: usage.context?.percent,
      now,
    }
  } catch (err) {
    return { limits: [], now, error: String(err) }
  }
}

export const summary = (snap: QuotaSnapshot): string => {
  const parts = snap.limits.map(
    l => `${label(l.kind)} ${Math.round(l.percentUsed)}%${l.resetsAt ? ` ↻ ${left(l.resetsAt, snap.now)}` : ''}`,
  )
  if (typeof snap.contextPercent === 'number') parts.push(`Kontext ${snap.contextPercent}%`)
  return parts.length ? parts.join('  ·  ') : 'Quota: Werte nach der ersten Antwort'
}

async function refresh($: EngineInterface): Promise<void> {
  const next = await measure($)
  await update($, snapshot, () => next)
  $.ui.status(summary(next))
}

const PANE = 'quota-band'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    await $.command.register({ name: 'quota', description: 'Quota-Anzeige (5h, Woche, Kontext) als Panel öffnen' })
    void $.ui.open({ id: PANE, title: 'Quota' })
    // Countdown einmal pro Minute nachziehen
    $.clock.every(60_000, () => refresh($))
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    // nie das Absenden blockieren
    refresh($).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const snap = (await read($, snapshot)) ?? (await measure($))

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={2}>
        {snap.error ? (
          <Text color="error" mono size="footnote">
            Quota nicht lesbar: {snap.error}
          </Text>
        ) : snap.limits.length === 0 ? (
          <Text dimColor mono size="footnote">
            Quota: Limits erscheinen nach der ersten Antwort
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
  on('command.run', { command: 'quota' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Quota' })
    return { text: 'Quota-Panel geöffnet.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const snap = (await read($, snapshot)) ?? (await measure($))
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" gap={1}>
        {snap.error ? <Text color="error">Quota nicht lesbar: {snap.error}</Text> : null}
        {!snap.error && snap.limits.length === 0 ? (
          <Text dimColor>Limits erscheinen nach der ersten Antwort.</Text>
        ) : null}
        {snap.limits.map(l => (
          <Text key={l.kind} mono>
            <Text dimColor>{label(l.kind).padEnd(7)}</Text>
            <Text color={color(l.percentUsed)}>{meter(l.percentUsed, 12)} </Text>
            <Text color={color(l.percentUsed)} weight="semibold" tabular>
              {String(Math.round(l.percentUsed)).padStart(3)}%
            </Text>
            {l.resetsAt ? <Text dimColor>  ↻ {left(l.resetsAt, snap.now)}</Text> : null}
          </Text>
        ))}
        {typeof snap.contextPercent === 'number' ? (
          <Text key="ctx" mono>
            <Text dimColor>{'Kontext'.padEnd(7)}</Text>
            <Text color={color(snap.contextPercent)}>{meter(snap.contextPercent, 12)} </Text>
            <Text color={color(snap.contextPercent)} tabular>
              {String(snap.contextPercent).padStart(3)}%
            </Text>
          </Text>
        ) : null}
      </Box>
    )
  })
}
