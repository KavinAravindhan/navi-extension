import type { PlaybackStatus } from '@/core/speech/speechPlayer';
import { renderMarkdown } from './markdown';

export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type MessageSender = 'user' | 'ai';

export interface PanelCallbacks {
  /** Font size confirmed — controller should scan + summarize the sheet. */
  onConfirm: (fontSize: FontSize) => void;
  /** A non-empty chat message was submitted (send button, Enter, or voice). */
  onUserMessage: (text: string) => void;
  /** Mic button clicked. */
  onVoiceToggle: () => void;
  /** Pause/resume button clicked. */
  onPauseToggle: () => void;
  /** Stop-speaking button clicked. */
  onStop: () => void;
  /** Panel closed via the ✕ button. */
  onClose: () => void;
  /** Panel opened via the floating icon (used for the greeting). */
  onOpen?: () => void;
}

/**
 * NAVI's floating icon + chat panel. All HTML, ids, and classes are ported
 * verbatim from v1 (content.js §5–6) so styles.css keeps working unchanged;
 * external actions are injected as callbacks instead of reaching into
 * globals.
 */
export class NaviPanel {
  private selectedFontSize: FontSize = 'medium';
  private summaryLoaded = false;

  constructor(
    iconUrl: string,
    private readonly callbacks: PanelCallbacks,
    private readonly doc: Document = document,
  ) {
    this.buildDom(iconUrl);
    this.wireEvents();
  }

  // ------------------------------------------------------------------
  // DOM construction (verbatim from v1 createNaviUI)
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

    <div id="navi-font-picker">
      <span id="navi-font-picker-label">Choose your text size:</span>
      <div id="navi-font-buttons">
        <button class="navi-font-btn" data-size="small">A</button>
        <button class="navi-font-btn navi-font-selected" data-size="medium">A</button>
        <button class="navi-font-btn" data-size="large">A</button>
        <button class="navi-font-btn" data-size="xlarge">A</button>
      </div>
      <button id="navi-font-confirm-btn">Confirm & Load Sheet ➤</button>
    </div>

    <div id="navi-messages" style="display: none;"></div>
    <div id="navi-input-area" style="display: none;">
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
  // Event wiring (verbatim behavior from v1 setupUIEventListeners)
  // ------------------------------------------------------------------

  private wireEvents(): void {
    const naviIcon = this.byId('navi-icon');
    const naviPanel = this.byId('navi-panel');

    naviIcon.addEventListener('click', () => this.open());

    this.byId('navi-close-btn').addEventListener('click', () => {
      this.callbacks.onClose();
      naviPanel.style.display = 'none';
      naviIcon.style.display = 'flex';
    });

    const fontButtons = naviPanel.querySelectorAll<HTMLButtonElement>('.navi-font-btn');
    fontButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        fontButtons.forEach((b) => b.classList.remove('navi-font-selected'));
        btn.classList.add('navi-font-selected');
        this.selectedFontSize = btn.dataset.size as FontSize;
      });
    });

    this.byId('navi-font-confirm-btn').addEventListener('click', () => {
      this.byId('navi-font-picker').style.display = 'none';
      this.byId('navi-messages').style.display = 'flex';
      this.byId('navi-input-area').style.display = 'flex';
      this.applyFontSize(this.selectedFontSize);
      this.callbacks.onConfirm(this.selectedFontSize);
    });

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
   * Opens the panel (icon click or the Alt/Option+N shortcut) and moves
   * keyboard focus inside it, per NAVI-001.
   */
  open(): void {
    this.callbacks.onOpen?.();

    this.byId('navi-panel').style.display = 'flex';
    this.byId('navi-icon').style.display = 'none';

    if (this.summaryLoaded) {
      this.byId('navi-font-picker').style.display = 'none';
      this.byId('navi-messages').style.display = 'flex';
      this.byId('navi-input-area').style.display = 'flex';
      this.byId('navi-text-input').focus();
    } else {
      this.byId('navi-font-picker').style.display = 'flex';
      this.byId('navi-messages').style.display = 'none';
      this.byId('navi-input-area').style.display = 'none';
      this.byId('navi-font-confirm-btn').focus();
    }
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

  /** After the first summary, reopening the panel skips the font picker. */
  markSummaryLoaded(): void {
    this.summaryLoaded = true;
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
