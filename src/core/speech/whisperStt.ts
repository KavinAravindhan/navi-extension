import type { VoiceRecognitionOptions } from './stt';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** Auto-stop when quiet this long (voice-first: no click needed to finish). */
const SILENCE_MS = 1800;
/** Hard recording cap — never leaves a hot mic running. */
const MAX_RECORDING_MS = 20000;
const SILENCE_RMS_THRESHOLD = 0.015;

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
  private silenceTimer: ReturnType<typeof setInterval> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private audioContext: AudioContext | null = null;

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
        this.clearWatchers();
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
      this.watchForSilence(stream);
      this.maxTimer = setTimeout(() => this.recorder?.stop(), MAX_RECORDING_MS);
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

  /**
   * Watches the input level and stops the recording after ~2s of silence,
   * so speaking to NAVI needs no stop click. Skipped quietly where the
   * AudioContext API is unavailable (click-to-stop still works there).
   */
  private watchForSilence(stream: MediaStream): void {
    const AudioContextCtor =
      (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const audioContext: AudioContext = new AudioContextCtor();
      this.audioContext = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const samples = new Float32Array(analyser.fftSize);
      let heardSpeech = false;
      let quietSince = Date.now();

      this.silenceTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);

        if (rms > SILENCE_RMS_THRESHOLD) {
          heardSpeech = true;
          quietSince = Date.now();
        } else if (heardSpeech && Date.now() - quietSince >= SILENCE_MS) {
          this.recorder?.stop();
        }
      }, 200);
    } catch (error) {
      console.warn('NAVI: Silence detection unavailable:', error);
    }
  }

  private clearWatchers(): void {
    if (this.silenceTimer !== null) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxTimer !== null) {
      clearTimeout(this.maxTimer);
      this.maxTimer = null;
    }
    void this.audioContext?.close().catch(() => {});
    this.audioContext = null;
  }
}
