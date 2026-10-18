export type QuotaLimit = { kind: string; percentUsed: number; resetsAt?: string }
export type QuotaSnapshot = { limits: QuotaLimit[]; contextPercent?: number; now: number; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'quota-band': { snapshot: QuotaSnapshot | null }
  }
}
