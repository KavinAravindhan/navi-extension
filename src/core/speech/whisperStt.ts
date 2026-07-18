import type { VoiceRecognitionOptions } from './stt';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Voice input via OpenAI Whisper: record with getUserMedia (WITH echo
 * cancellation — the Web Speech API can't do that, which is how NAVI used to
 * hear its own voice, NAVI-009) and transcribe the recording on stop.
 * Click-to-start, click-to-stop, same surface as VoiceRecognition.
 * Handles Indonesian well (tracker language row).
 */
export class WhisperRecognition {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private listening = false;
  private lang = 'en-US';

  constructor(
    private readonly apiKey: string,
    private readonly options: VoiceRecognitionOptions,
  ) {}

  get isListening(): boolean {
    return this.listening;
  }

  setLanguage(speechLang: string): void {
    this.lang = speechLang;
  }

  /** Returns false when recording is not supported in this browser. */
  init(): boolean {
    const supported =
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined';
    if (!supported) {
      console.warn('NAVI: Whisper voice input is not supported in this browser.');
    }
    return supported;
  }

  toggle(): void {
    if (this.listening) {
      this.recorder?.stop(); // onstop → transcribe
      return;
    }
    this.options.onBeforeStart?.();
    void this.start();
  }

  // ------------------------------------------------------------------

  private async start(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const recorder = new MediaRecorder(stream);
      this.chunks = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        this.recorder = null;
        this.setListening(false);
        const blob = new Blob(this.chunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        void this.transcribe(blob);
      };

      this.recorder = recorder;
      recorder.start();
      this.setListening(true);
    } catch (error) {
      this.setListening(false);
      if ((error as Error).name === 'NotAllowedError') {
        this.options.onPermissionDenied?.();
      } else {
        console.error('NAVI: Could not start recording:', error);
        this.options.onTranscriptionError?.();
      }
    }
  }

  private async transcribe(blob: Blob): Promise<void> {
    try {
      if (blob.size === 0) return;

      const form = new FormData();
      form.append('file', blob, 'speech.webm');
      form.append('model', 'whisper-1');
      form.append('language', this.lang.split('-')[0]);

      const response = await fetch(WHISPER_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
      const data = await response.json();

      if (data.error) throw new Error(data.error.message);

      const text = String(data.text ?? '').trim();
      if (text) {
        console.log('NAVI: Voice input received:', text);
        this.options.onResult(text);
      }
    } catch (error) {
      console.error('NAVI: Whisper transcription failed:', error);
      this.options.onTranscriptionError?.();
    }
  }

  private setListening(value: boolean): void {
    this.listening = value;
    this.options.onStateChange?.(value);
  }
}
