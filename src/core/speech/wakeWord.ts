/** Matches "hey navi" / "hei navi" / "hai navi" anywhere in a transcript. */
export const WAKE_PATTERN = /\b(hey|hei|hai),?\s*navi\b/i;

/**
 * Opt-in "Hey NAVI" wake word (NAVI-015): a continuous speech-recognition
 * loop that runs ONLY while the panel is closed and the feature is enabled.
 * On a match it stops itself and fires onWake (the controller opens NAVI).
 * Privacy: clearly announced when enabled; off by default.
 */
export class WakeWordListener {
  // Web Speech recognition types vary across TS lib versions.
  private recognition: any = null;
  private running = false;
  private lang = 'en-US';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private startAttempts = 0;

  constructor(private readonly onWake: () => void) {}

  get isRunning(): boolean {
    return this.running;
  }

  isSupported(): boolean {
    return Boolean(
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition,
    );
  }

  setLanguage(speechLang: string): void {
    this.lang = speechLang;
  }

  start(): void {
    if (this.running) return;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    this.running = true;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.lang;

    recognition.onresult = (event: any) => {
      // One utterance can match twice (interim + final result), and Chrome
      // still delivers queued events after stop() — a second onWake here
      // double-opened NAVI and spoke the introduction twice.
      if (!this.running) return;
      for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
        const transcript: string = event.results[i][0].transcript ?? '';
        if (WAKE_PATTERN.test(transcript)) {
          this.stop();
          this.onWake();
          return;
        }
      }
    };

    // Chrome ends continuous recognition regularly — keep the loop alive.
    recognition.onend = () => {
      if (!this.running) return;
      try {
        recognition.start();
      } catch {
        this.running = false;
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.stop();
      }
    };

    this.recognition = recognition;
    try {
      recognition.start();
      this.startAttempts = 0;
    } catch {
      // Chrome allows ONE recognition per page: right after the mic (or a
      // previous loop) stops, the engine may still be releasing and start()
      // throws. Retry shortly instead of giving up — swallowing this used
      // to leave the wake word permanently dead after quitting NAVI.
      this.running = false;
      this.recognition = null;
      if (this.startAttempts >= 10) return; // engine truly unavailable
      this.startAttempts += 1;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.start();
      }, 400);
    }
  }

  stop(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.startAttempts = 0;
    this.running = false;
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    }
  }
}
