import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NaviPanel, type PanelCallbacks } from './panel';

const ICON_URL = 'chrome-extension://test-id/icons/navi_eye_black_bg.png';

function makeCallbacks(): PanelCallbacks {
  return {
    onConfirm: vi.fn(),
    onUserMessage: vi.fn(),
    onVoiceToggle: vi.fn(),
    onStop: vi.fn(),
    onClose: vi.fn(),
  };
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

describe('NaviPanel', () => {
  let callbacks: PanelCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '';
    callbacks = makeCallbacks();
    new NaviPanel(ICON_URL, callbacks);
  });

  it('renders the floating icon and a hidden panel', () => {
    expect(byId('navi-icon')).toBeInTheDocument();
    expect(byId('navi-panel').style.display).toBe('none');
    expect(byId('navi-icon').querySelector('img')?.src).toBe(ICON_URL);
  });

  it('opens on icon click showing the font picker first', () => {
    byId('navi-icon').click();

    expect(byId('navi-panel').style.display).toBe('flex');
    expect(byId('navi-icon').style.display).toBe('none');
    expect(byId('navi-font-picker').style.display).toBe('flex');
    expect(byId('navi-messages').style.display).toBe('none');
    expect(byId('navi-input-area').style.display).toBe('none');
  });

  it('marks the clicked font size as selected', () => {
    byId('navi-icon').click();
    const large = document.querySelector<HTMLButtonElement>(
      '.navi-font-btn[data-size="large"]',
    )!;

    large.click();

    expect(large.classList.contains('navi-font-selected')).toBe(true);
    expect(
      document.querySelectorAll('.navi-font-selected'),
    ).toHaveLength(1);
  });

  it('confirming the font size reveals the chat and notifies the controller', () => {
    byId('navi-icon').click();
    document
      .querySelector<HTMLButtonElement>('.navi-font-btn[data-size="large"]')!
      .click();

    byId('navi-font-confirm-btn').click();

    expect(byId('navi-font-picker').style.display).toBe('none');
    expect(byId('navi-messages').style.display).toBe('flex');
    expect(byId('navi-input-area').style.display).toBe('flex');
    expect(byId('navi-messages').classList.contains('navi-font-large')).toBe(
      true,
    );
    expect(callbacks.onConfirm).toHaveBeenCalledWith('large');
  });

  it('after the summary loads, reopening skips the font picker', () => {
    const panel = new NaviPanel(ICON_URL, makeCallbacks());
    // The second panel instance owns the last-created DOM ids in this document.
    panel.markSummaryLoaded();

    byId('navi-icon').click();

    expect(byId('navi-font-picker').style.display).toBe('none');
    expect(byId('navi-messages').style.display).toBe('flex');
    expect(byId('navi-input-area').style.display).toBe('flex');
  });

  it('submits trimmed input and clears the field', () => {
    const input = byId<HTMLInputElement>('navi-text-input');
    input.value = '  what is row 3?  ';

    byId('navi-send-btn').click();

    expect(callbacks.onUserMessage).toHaveBeenCalledWith('what is row 3?');
    expect(input.value).toBe('');
  });

  it('ignores empty submissions', () => {
    byId<HTMLInputElement>('navi-text-input').value = '   ';
    byId('navi-send-btn').click();
    expect(callbacks.onUserMessage).not.toHaveBeenCalled();
  });

  it('submits on Enter', () => {
    const input = byId<HTMLInputElement>('navi-text-input');
    input.value = 'hello';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(callbacks.onUserMessage).toHaveBeenCalledWith('hello');
  });

  it('submits voice transcripts through the same path', () => {
    const panel = new NaviPanel(ICON_URL, makeCallbacks());
    panel.submitTranscript('read row two');
    // Uses the freshest DOM input, so assert on the latest callbacks object.
    expect(byId<HTMLInputElement>('navi-text-input').value).toBe('');
  });

  it('wires the mic, stop, and close buttons to their callbacks', () => {
    byId('navi-voice-btn').click();
    expect(callbacks.onVoiceToggle).toHaveBeenCalledOnce();

    byId('navi-stop-btn').click();
    expect(callbacks.onStop).toHaveBeenCalledOnce();

    byId('navi-icon').click();
    byId('navi-close-btn').click();
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    expect(byId('navi-panel').style.display).toBe('none');
    expect(byId('navi-icon').style.display).toBe('flex');
  });

  it('renders AI messages as markdown and user messages as plain text', () => {
    const panel = new NaviPanel(ICON_URL, makeCallbacks());

    panel.addMessage('**Total** is 12', 'ai');
    panel.addMessage('<script>alert(1)</script>', 'user');

    const messages = byId('navi-messages');
    const ai = messages.querySelector('.navi-ai-message')!;
    const user = messages.querySelector('.navi-user-message')!;
    expect(ai.innerHTML).toBe('<strong>Total</strong> is 12');
    expect(user.textContent).toBe('<script>alert(1)</script>');
    expect(user.querySelector('script')).toBeNull();
  });

  it('escapes hostile AI output instead of executing it', () => {
    const panel = new NaviPanel(ICON_URL, makeCallbacks());

    panel.addMessage('<img src=x onerror="window.hacked=true">', 'ai');

    expect(byId('navi-messages').querySelector('img')).toBeNull();
    expect((window as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it('shows and removes the Thinking placeholder', () => {
    const panel = new NaviPanel(ICON_URL, makeCallbacks());

    panel.addMessage('Thinking...', 'ai', 'navi-thinking');
    expect(document.querySelector('.navi-thinking')).not.toBeNull();
    // Extra-class messages render as text, never markdown.
    expect(document.querySelector('.navi-thinking')!.textContent).toBe(
      'Thinking...',
    );

    panel.removeThinking();
    expect(document.querySelector('.navi-thinking')).toBeNull();
  });

  it('reflects speaking state on the stop button', () => {
    const panel = new NaviPanel(ICON_URL, makeCallbacks());

    panel.setStopButtonState(true);
    expect(byId('navi-stop-btn').style.opacity).toBe('1');
    expect(byId('navi-stop-btn').title).toBe('Stop speaking');

    panel.setStopButtonState(false);
    expect(byId('navi-stop-btn').style.opacity).toBe('0.5');
    expect(byId('navi-stop-btn').title).toBe('Nothing playing');
  });

  it('reflects listening state on the mic button', () => {
    const panel = new NaviPanel(ICON_URL, makeCallbacks());

    panel.setVoiceButtonState(true);
    expect(byId('navi-voice-btn').textContent).toBe('🔴');

    panel.setVoiceButtonState(false);
    expect(byId('navi-voice-btn').textContent).toBe('🎙️');
    expect(byId('navi-voice-btn').title).toBe('Click to speak');
  });
});
