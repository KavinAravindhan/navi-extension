/**
 * Two-press confirmation, used by the quit shortcut (tracker "[NAVI+q]"):
 * the first press arms and prompts ("Do you want to close NAVI?"), a second
 * press within the window confirms. After the window expires, the next press
 * prompts again.
 */
export class TwoStepConfirm {
  private armedAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly windowMs = 10000) {}

  press(now: number = Date.now()): 'prompt' | 'confirmed' {
    if (now - this.armedAt <= this.windowMs) {
      this.armedAt = Number.NEGATIVE_INFINITY;
      return 'confirmed';
    }
    this.armedAt = now;
    return 'prompt';
  }

  /** Disarms a pending confirmation (e.g. when the panel closes anyway). */
  reset(): void {
    this.armedAt = Number.NEGATIVE_INFINITY;
  }
}
