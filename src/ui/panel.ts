import type { FontSize } from '@/core/settings/settings';
import type { PlaybackStatus } from '@/core/speech/speechPlayer';
import { renderMarkdown } from './markdown';

export type { FontSize };
export type MessageSender = 'user' | 'ai';

export interface PanelCallbacks {
  /** A non-empty chat message was submitted (send button, Enter, or voice). */
  onUserMessage: (text: string) => void;
  /** Mic button clicked. */
  onVoiceToggle: () => void;
  /** Pause/resume button clicked. */
  onPauseToggle: () => void;
  /** Stop-speaking button clicked. */
  onStop: () => void;
  /** Panel closed (✕ button, quit shortcut, or close()). */
  onClose: () => void;
  /** Panel opened (icon click, Alt/Option+N, or open()). */
  onOpen?: () => void;
}

/**
 * NAVI's floating icon + chat panel.
 *
 * Since Step 2 the panel opens straight into the chat — the v1 font-picker
 * gate is gone (tester feedback: a mandatory visual step blocks BVI users).
 * Text size is a persisted setting changed from the NAVI menu instead.
 */
export class NaviPanel {
  constructor(
    iconUrl: string,
    private readonly callbacks: PanelCallbacks,
    private readonly doc: Document = document,
  ) {
    this.buildDom(iconUrl);
    this.wireEvents();
  }

  // ------------------------------------------------------------------
  // DOM construction
  // ------------------------------------------------------------------

  private buildDom(iconUrl: string): void {
    const naviIcon = this.doc.createElement('div');
    naviIcon.id = 'navi-icon';
    naviIcon.title = 'Open NAVI Assistant';
    naviIcon.innerHTML = `
    <img src="${iconUrl}" style="width: 38px; height: 38px; border-radius: 6px;" alt="NAVI" />
  `;

    const naviPanel = this.doc.createElement('div');
    naviPanel.id = 'navi-panel';
    naviPanel.style.display = 'none';
    naviPanel.innerHTML = `
    <div id="navi-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${iconUrl}" style="width: 22px; height: 22px; border-radius: 4px;" alt="NAVI" />
        <span>NAVI Assistant</span>
      </div>
      <div style="display: flex; gap: 6px; align-items: center;">
        <button id="navi-pause-btn" title="Nothing playing">⏯️</button>
        <button id="navi-stop-btn" title="Nothing playing">⏹️</button>
        <button id="navi-close-btn" title="Close NAVI">✕</button>
      </div>
    </div>

    <div id="navi-menu" style="display: none;"></div>

    <div id="navi-messages"></div>
    <div id="navi-input-area">
      <input
        type="text"
        id="navi-text-input"
        placeholder="Ask NAVI something..."
        autocomplete="off"
      />
      <button id="navi-voice-btn" title="Click to speak">🎙️</button>
      <button id="navi-send-btn" title="Send message">➤</button>
    </div>
  `;

    this.doc.body.appendChild(naviIcon);
    this.doc.body.appendChild(naviPanel);
  }

  // ------------------------------------------------------------------
  // Event wiring
  // ------------------------------------------------------------------

  private wireEvents(): void {
    this.byId('navi-icon').addEventListener('click', () => this.open());
    this.byId('navi-close-btn').addEventListener('click', () => this.close());

    this.byId('navi-send-btn').addEventListener('click', () => this.handleSend());

    this.byId('navi-text-input').addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') this.handleSend();
    });

    this.byId('navi-voice-btn').addEventListener('click', () =>
      this.callbacks.onVoiceToggle(),
    );
    this.byId('navi-pause-btn').addEventListener('click', () =>
      this.callbacks.onPauseToggle(),
    );
    this.byId('navi-stop-btn').addEventListener('click', () =>
      this.callbacks.onStop(),
    );
  }

  private handleSend(): void {
    const textInput = this.byId<HTMLInputElement>('navi-text-input');
    const userMessage = textInput.value.trim();
    if (!userMessage) return;

    textInput.value = '';
    this.callbacks.onUserMessage(userMessage);
  }

  // ------------------------------------------------------------------
  // Public API used by the controller
  // ------------------------------------------------------------------

  /**
   * Opens the panel straight into the chat and moves keyboard focus to the
   * input (NAVI-001). Fires onOpen so the controller can greet + auto-scan.
   */
  open(): void {
    this.callbacks.onOpen?.();
    this.byId('navi-panel').style.display = 'flex';
    this.byId('navi-icon').style.display = 'none';
    this.focusInput();
  }

  /** Closes the panel back to the floating icon and fires onClose. */
  close(): void {
    this.byId('navi-panel').style.display = 'none';
    this.byId('navi-icon').style.display = 'flex';
    this.callbacks.onClose();
  }

  get isOpen(): boolean {
    return this.byId('navi-panel').style.display === 'flex';
  }

  focusInput(): void {
    this.byId<HTMLInputElement>('navi-text-input').focus();
  }

  /** The container the NaviMenu renders into. */
  getMenuContainer(): HTMLElement {
    return this.byId('navi-menu');
  }

  /** Voice transcript arrives — fill the input and submit it (v1 behavior). */
  submitTranscript(transcript: string): void {
    this.byId<HTMLInputElement>('navi-text-input').value = transcript;
    this.handleSend();
  }

  addMessage(text: string, sender: MessageSender, extraClass = ''): void {
    const messages = this.byId('navi-messages');
    const messageDiv = this.doc.createElement('div');
    messageDiv.className = `navi-message ${
      sender === 'user' ? 'navi-user-message' : 'navi-ai-message'
    } ${extraClass}`;
    if (sender === 'ai' && !extraClass) {
      messageDiv.innerHTML = renderMarkdown(text);
    } else {
      messageDiv.textContent = text;
    }
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
  }

  /** Removes the "Thinking..." placeholder message, if present. */
  removeThinking(): void {
    const thinkingMsg = this.doc.querySelector('.navi-thinking');
    if (thinkingMsg) thinkingMsg.remove();
  }

  applyFontSize(size: FontSize): void {
    const messages = this.doc.getElementById('navi-messages');
    if (!messages) return;
    messages.classList.remove(
      'navi-font-small',
      'navi-font-medium',
      'navi-font-large',
      'navi-font-xlarge',
    );
    messages.classList.add(`navi-font-${size}`);
  }

  /** Drives the pause + stop buttons from the speech player's status. */
  setPlaybackStatus(status: PlaybackStatus): void {
    const active = status !== 'idle';

    const pauseBtn = this.doc.getElementById('navi-pause-btn');
    if (pauseBtn) {
      pauseBtn.style.opacity = active ? '1' : '0.5';
      pauseBtn.title =
        status === 'speaking'
          ? 'Pause'
          : status === 'paused'
            ? 'Resume (paused)'
            : 'Play / replay last message';
    }

    const stopBtn = this.doc.getElementById('navi-stop-btn');
    if (stopBtn) {
      stopBtn.style.opacity = active ? '1' : '0.5';
      stopBtn.title = active ? 'Stop speaking' : 'Nothing playing';
    }
  }

  setVoiceButtonState(listening: boolean): void {
    const voiceBtn = this.doc.getElementById('navi-voice-btn');
    if (voiceBtn) {
      voiceBtn.textContent = listening ? '🔴' : '🎙️';
      voiceBtn.title = listening ? 'Listening... click to stop' : 'Click to speak';
    }
  }

  private byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = this.doc.getElementById(id);
    if (!el) throw new Error(`NAVI: missing element #${id}`);
    return el as T;
  }
}
