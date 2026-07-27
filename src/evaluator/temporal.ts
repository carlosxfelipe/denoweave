/**
 * Typed access to Deno's native Temporal API.
 *
 * Temporal is a TC39 Stage 3 proposal available as a native global in Deno.
 * This module centralises access behind a well-typed interface so the rest of
 * the codebase never touches `globalThis` directly and never needs @ts-ignore.
 */

// ── Exported types ────────────────────────────────────────────────────────────

export interface PlainDate {
  add(duration: TemporalValue | string): PlainDate;
  subtract(duration: TemporalValue | string): PlainDate;
  toString(): string;
  toJSON(): string;
}

export interface PlainDateTime {
  add(duration: TemporalValue | string): PlainDateTime;
  subtract(duration: TemporalValue | string): PlainDateTime;
  toString(): string;
  toJSON(): string;
}

export interface PlainTime {
  add(duration: TemporalValue | string): PlainTime;
  subtract(duration: TemporalValue | string): PlainTime;
  toString(): string;
  toJSON(): string;
}

export interface Duration {
  add(other: TemporalValue | string): Duration;
  subtract(other: TemporalValue | string): Duration;
  negated(): Duration;
  toString(): string;
  toJSON(): string;
}

export interface Instant {
  add(duration: TemporalValue | string): Instant;
  subtract(duration: TemporalValue | string): Instant;
  toString(): string;
  toJSON(): string;
}

export type TemporalValue =
  | PlainDate
  | PlainDateTime
  | PlainTime
  | Duration
  | Instant;

// ── Internal typed reference to the global ───────────────────────────────────

interface TemporalNamespace {
  PlainDate: { from(value: string): PlainDate };
  PlainDateTime: { from(value: string): PlainDateTime };
  PlainTime: { from(value: string): PlainTime };
  Duration: { from(value: string): Duration };
  Instant: { from(value: string): Instant };
}

function getAPI(): TemporalNamespace {
  const g = globalThis as Record<string, unknown>;
  const api = g['Temporal'];
  if (!api) throw new Error('Temporal API is not available in this runtime.');
  return api as TemporalNamespace;
}

// ── Factory functions ─────────────────────────────────────────────────────────

export const temporal = {
  isAvailable(): boolean {
    return typeof (globalThis as Record<string, unknown>)['Temporal'] !==
      'undefined';
  },

  plainDateFrom(value: string): PlainDate {
    return getAPI().PlainDate.from(value);
  },

  plainDateTimeFrom(value: string): PlainDateTime {
    return getAPI().PlainDateTime.from(value);
  },

  plainTimeFrom(value: string): PlainTime {
    return getAPI().PlainTime.from(value);
  },

  durationFrom(value: string): Duration {
    return getAPI().Duration.from(value);
  },

  instantFrom(value: string): Instant {
    return getAPI().Instant.from(value);
  },

  isTemporal(value: unknown): value is TemporalValue {
    if (!this.isAvailable()) return false;
    const api = getAPI();
    return (
      value instanceof (api.PlainDate as unknown as new () => object) ||
      value instanceof (api.PlainDateTime as unknown as new () => object) ||
      value instanceof (api.PlainTime as unknown as new () => object) ||
      value instanceof (api.Duration as unknown as new () => object) ||
      value instanceof (api.Instant as unknown as new () => object)
    );
  },

  isDuration(value: unknown): value is Duration {
    if (!this.isAvailable()) return false;
    return value instanceof
      (getAPI().Duration as unknown as new () => object);
  },
} as const;
