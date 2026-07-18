export interface VoiceRecognitionOptions {
  /** Called with the transcript when the user finishes speaking. */
  onResult: (transcript: string) => void;
  /** Called whenever listening starts or stops (drives the mic button). */
  onStateChange?: (listening: boolean) => void;
  /** Called right before listening starts (v1 used this to stop TTS). */
  onBeforeStart?: () => void;
  /**
   * Called when the browser blocks microphone access, so NAVI can speak
   * recovery instructions instead of failing silently (NAVI-011).
   */
  onPermissionDenied?: () => void;
}

/**
 * Voice input backed by the Web Speech API (SpeechRecognition).
 * Behavior ported verbatim from v1 (content.js §4).
 */
export class VoiceRecognition {
  // The Web Speech recognition types are not consistently available across
  // TS lib versions, so the instance is intentionally loosely typed.
  private recognition: any = null;
  private listening = false;

  constructor(private readonly options: VoiceRecognitionOptions) {}

  get isListening(): boolean {
    return this.listening;
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
    recognition.lang = 'en-US';
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
      this.recognition.stop();
      this.setListening(false);
    } else {
      this.options.onBeforeStart?.();
      this.recognition.start();
      this.setListening(true);
    }
  }

  private setListening(value: boolean): void {
    this.listening = value;
    this.options.onStateChange?.(value);
  }
}
