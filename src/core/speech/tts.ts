import { cleanTextForSpeech } from './textCleanup';

export type SpeakingStateListener = (speaking: boolean) => void;

/**
 * Text-to-speech engine backed by the Web Speech API.
 * Behavior ported verbatim from v1 (content.js §3), with the only structural
 * change that button updates now happen through an injected state listener
 * instead of a hardcoded getElementById.
 */
export class TextToSpeech {
  private speaking = false;

  constructor(
    private readonly onStateChange: SpeakingStateListener = () => {},
  ) {}

  get isSpeaking(): boolean {
    return this.speaking;
  }

  speak(text: string): void {
    if (!window.speechSynthesis) {
      console.warn('NAVI: Text-to-speech is not supported in this browser.');
      return;
    }

    if (!text || text.trim() === '') {
      console.warn('NAVI: No text to speak.');
      return;
    }

    const cleanText = cleanTextForSpeech(text);

    window.speechSynthesis.cancel();
    this.setSpeaking(false);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = [
        'Google US English',
        'Google UK English Female',
        'Google UK English Male',
        'Microsoft Aria Online (Natural) - English (United States)',
        'Microsoft Guy Online (Natural) - English (United States)',
      ];
      let chosen: SpeechSynthesisVoice | undefined;
      for (const name of preferred) {
        chosen = voices.find((v) => v.name === name);
        if (chosen) break;
      }
      if (!chosen) {
        chosen = voices.find((v) => v.lang.startsWith('en') && !v.default);
      }
      if (chosen) {
        utterance.voice = chosen;
        console.log('NAVI: Using voice:', chosen.name);
      }
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      setVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoice();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }

    // Chrome pauses long utterances after ~15s of speech; nudging resume()
    // periodically keeps long summaries playing to the end.
    const resumeInterval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 10000);

    utterance.onstart = () => {
      this.setSpeaking(true);
    };
    utterance.onend = () => {
      this.setSpeaking(false);
      clearInterval(resumeInterval);
    };
    utterance.onerror = (event) => {
      if (event.error === 'interrupted') return;
      console.error('NAVI: Speech error:', event.error);
      this.setSpeaking(false);
      clearInterval(resumeInterval);
    };

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.setSpeaking(false);
    }
  }

  private setSpeaking(value: boolean): void {
    this.speaking = value;
    this.onStateChange(value);
  }
}
