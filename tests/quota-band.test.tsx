import { expect, mock, test } from 'claude-code/testing'

import { color, label, left, meter } from '../hooks/register'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('helpers format labels, colors, meter and countdown', () => {
  expect(label('five_hour')).toBe('5h')
  expect(label('seven_day')).toBe('Woche')
  expect(label('seven_day_opus')).toBe('opus')
  expect(color(10)).toBe('success')
  expect(color(75)).toBe('warning')
  expect(color(95)).toBe('error')
  expect(meter(50, 8)).toBe('▰▰▰▰▱▱▱▱')
  const now = Date.parse('2026-10-17T20:00:00Z')
  expect(left('2026-10-17T22:14:00Z', now)).toBe('2h 14m')
  expect(left('2026-10-21T23:00:00Z', now)).toBe('4T 3h')
  expect(left('2026-10-17T19:00:00Z', now)).toBe('jetzt')
})

test('the band shows the limits and the context fill', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-17T20:00:00Z') })
  const rateLimits = [
    { kind: 'five_hour', percentUsed: 34, resetsAt: '2026-10-17T22:14:00Z' },
    { kind: 'seven_day', percentUsed: 92, resetsAt: '2026-10-21T23:00:00Z' },
  ]
  const context = { tokens: 82_000, window: 200_000, percent: 41 }
  on('session.usage', () => ({ value: { startedAt: 0, context, rateLimits } }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({ context, rateLimits, changed: ['context', 'rateLimits'] })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'quota-band', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /34%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /92%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2h 14m/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /41%/ })).toBeDefined()
    await ui.unmount()
  }
})
