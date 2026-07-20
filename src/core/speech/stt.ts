export interface VoiceRecognitionOptions {
  /** Called with the transcript when the user finishes speaking. */
  onResult: (transcript: string) => void;
  /** Called whenever listening starts or stops (drives the mic button). */
  onStateChange?: (listening: boolean) => void;
  /** Called right before every open attempt (v1 used this to stop TTS). */
  onBeforeStart?: () => void;
  /**
   * Called when the browser blocks microphone access, so NAVI can speak
   * recovery instructions instead of failing silently (NAVI-011).
   */
  onPermissionDenied?: () => void;
  /** Called when a recording could not be transcribed (Whisper engine). */
  onTranscriptionError?: () => void;
  /** Called when the mic could not be opened after repeated retries. */
  onStartFailed?: () => void;
}

const RETRY_MS = 250;
const MAX_START_RETRIES = 8; // 2 seconds of trying before giving up audibly

/**
 * Voice input backed by the Web Speech API (SpeechRecognition).
 * Behavior ported from v1 (content.js §4), hardened against the shared
 * recognition engine: Chrome allows ONE recognition per page, so opening
 * the mic right after the wake-word loop stops can throw while the engine
 * is still releasing. Without retries here the wake listener (which does
 * retry) always wins that race, leaving NAVI awake but deaf.
 */
export class VoiceRecognition {
  // The Web Speech recognition types are not consistently available across
  // TS lib versions, so the instance is intentionally loosely typed.
  private recognition: any = null;
  private listening = false;
  private lang = 'en-US';
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private startAttempts = 0;

  constructor(private readonly options: VoiceRecognitionOptions) {}

  get isListening(): boolean {
    return this.listening;
  }

  /** Switches the recognition language (e.g. 'id-ID') for future listens. */
  setLanguage(speechLang: string): void {
    this.lang = speechLang;
    if (this.recognition) this.recognition.lang = speechLang;
  }

  /** Returns false when the browser does not support speech recognition. */
  init(): boolean {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      console.warn('NAVI: Voice recognition is not supported in this browser.');
      return false;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = this.lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('NAVI: Voice input received:', transcript);
      this.options.onResult(transcript);
    };

    recognition.onend = () => {
      this.setListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('NAVI: Voice recognition error:', event.error);
      this.setListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.options.onPermissionDenied?.();
      }
    };

    this.recognition = recognition;
    return true;
  }

  toggle(): void {
    if (!this.recognition) {
      console.warn('NAVI: Voice recognition not initialized.');
      return;
    }

    if (this.listening) {
      this.stop();
    } else {
      this.start();
    }
  }

  /** Opens the mic; no-op while already listening or mid-retry. */
  start(): void {
    if (!this.recognition || this.listening || this.retryTimer !== null) return;
    this.tryStart();
  }

  /** Closes the mic and cancels any pending open. Safe to call anytime. */
  stop(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.startAttempts = 0;
    if (!this.listening) return;
    try {
      this.recognition?.stop();
    } catch {
      // already stopped
    }
    this.setListening(false);
  }

  private tryStart(): void {
    // Every attempt re-silences the speakers and the wake loop, so a wake
    // restart scheduled between attempts can never steal the engine back.
    this.options.onBeforeStart?.();
    try {
      this.recognition.start();
      this.startAttempts = 0;
      this.setListening(true);
    } catch {
      if (this.startAttempts >= MAX_START_RETRIES) {
        this.startAttempts = 0;
        this.options.onStartFailed?.();
        return;
      }
      this.startAttempts += 1;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.tryStart();
      }, RETRY_MS);
    }
  }

  private setListening(value: boolean): void {
    this.listening = value;
    this.options.onStateChange?.(value);
  }
}
