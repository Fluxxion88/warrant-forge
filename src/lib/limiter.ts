// Per-provider concurrency control, retry, and a hard spend ceiling.
//
// Eleven workstreams firing at once will rate-limit most accounts immediately.
// Every model call in the pipeline goes through this gate: it caps how many
// requests are in flight per provider, retries throttled calls with backoff,
// and aborts the run rather than overrunning a budget.

export interface LimiterOptions {
  /** Simultaneous in-flight requests per provider. */
  concurrency?: number;
  maxRetries?: number;
  /** First backoff step in ms; doubles each attempt with jitter. */
  baseDelayMs?: number;
  /** Hard ceiling in USD. Exceeding it aborts the run. */
  budgetUsd?: number;
  /** Injected for tests so retries do not actually sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export class BudgetExceededError extends Error {
  constructor(spent: number, cap: number) {
    super(
      `Run stopped: spend reached $${spent.toFixed(2)} against a $${cap.toFixed(2)} cap. ` +
        `Raise the cap or reduce scope.`,
    );
    this.name = "BudgetExceededError";
  }
}

const RETRYABLE = /\b(429|500|502|503|504|rate.?limit|overloaded|timeout|timed out|econnreset)\b/i;

export function isRetryable(err: unknown): boolean {
  return RETRYABLE.test(String(err));
}

/** A simple FIFO gate: at most `limit` holders at a time. */
class Gate {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
  }

  release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

export class Limiter {
  private gates = new Map<string, Gate>();
  private spent = 0;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly budgetUsd: number;
  private readonly sleep: (ms: number) => Promise<void>;
  /** Observability: retries and waits, for the run summary. */
  public retries = 0;

  constructor(opts: LimiterOptions = {}) {
    this.concurrency = opts.concurrency ?? 3;
    this.maxRetries = opts.maxRetries ?? 4;
    this.baseDelayMs = opts.baseDelayMs ?? 1500;
    this.budgetUsd = opts.budgetUsd ?? Infinity;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  get spentUsd(): number {
    return this.spent;
  }

  /** Record spend and abort the run if the ceiling is breached. */
  charge(usd: number): void {
    this.spent += usd;
    if (this.spent > this.budgetUsd) {
      throw new BudgetExceededError(this.spent, this.budgetUsd);
    }
  }

  private gateFor(providerId: string): Gate {
    let g = this.gates.get(providerId);
    if (!g) {
      g = new Gate(this.concurrency);
      this.gates.set(providerId, g);
    }
    return g;
  }

  /**
   * Run `fn` under this provider's concurrency gate, retrying throttled and
   * transient failures with exponential backoff plus jitter. Non-retryable
   * errors (a bad key, an unknown model) fail immediately — retrying those
   * only wastes the user's time.
   */
  async run<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
    if (this.spent > this.budgetUsd) {
      throw new BudgetExceededError(this.spent, this.budgetUsd);
    }
    const gate = this.gateFor(providerId);
    await gate.acquire();
    try {
      let lastError: unknown;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          return await fn();
        } catch (e) {
          lastError = e;
          if (e instanceof BudgetExceededError || !isRetryable(e) || attempt === this.maxRetries) {
            throw e;
          }
          this.retries += 1;
          const delay = this.baseDelayMs * 2 ** attempt;
          await this.sleep(delay + Math.random() * 250);
        }
      }
      throw lastError;
    } finally {
      gate.release();
    }
  }
}
