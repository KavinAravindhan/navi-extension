import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NaviPanel, type PanelCallbacks } from './panel';

const ICON_URL = 'chrome-extension://test-id/icons/navi_eye_black_bg.png';

function makeCallbacks() {
  return {
    onUserMessage: vi.fn(),
    onVoiceToggle: vi.fn(),
    onPauseToggle: vi.fn(),
    onStop: vi.fn(),
    onClose: vi.fn(),
    onOpen: vi.fn(),
  } satisfies PanelCallbacks;
}

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

describe('NaviPanel', () => {
  let callbacks: ReturnType<typeof makeCallbacks>;
  let panel: NaviPanel;

  beforeEach(() => {
    document.body.innerHTML = '';
    callbacks = makeCallbacks();
    panel = new NaviPanel(ICON_URL, callbacks);
  });

  it('renders the floating icon and a hidden panel', () => {
    expect(byId('navi-icon')).toBeInTheDocument();
    expect(byId('navi-panel').style.display).toBe('none');
    expect(byId('navi-icon').querySelector('img')?.src).toBe(ICON_URL);
  });

  it('exposes the icon as a labelled, focusable button that opens on Enter/Space', () => {
    const icon = byId('navi-icon');
    expect(icon.getAttribute('role')).toBe('button');
    expect(icon.getAttribute('aria-label')).toBe('Open NAVI Assistant');
    expect(icon.tabIndex).toBe(0);

    icon.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(panel.isOpen).toBe(true);
  });

  it('is a labelled landmark with accessible controls', () => {
    const p = byId('navi-panel');
    expect(p.getAttribute('role')).toBe('complementary');
    expect(p.getAttribute('aria-label')).toBe('NAVI Assistant');
    expect(byId('navi-messages').getAttribute('role')).toBe('log');
    expect(byId('navi-pause-btn').getAttribute('aria-label')).toBe('Pause or resume speech');
    expect(byId('navi-stop-btn').getAttribute('aria-label')).toBe('Stop speech');
    expect(byId('navi-close-btn').getAttribute('aria-label')).toBe('Close NAVI');
    expect(byId('navi-text-input').getAttribute('aria-label')).toBe('Message NAVI');
    expect(byId('navi-send-btn').getAttribute('aria-label')).toBe('Send message');
  });

  it('close() returns keyboard focus to the icon', () => {
    panel.open();
    panel.close();
    expect(document.activeElement?.id).toBe('navi-icon');
  });

  it('setOutputMode drives the live announcement of the message log', () => {
    expect(byId('navi-messages').getAttribute('aria-live')).toBe('off');

    panel.setOutputMode('screenreader');
    expect(byId('navi-messages').getAttribute('aria-live')).toBe('polite');

    panel.setOutputMode('voice');
    expect(byId('navi-messages').getAttribute('aria-live')).toBe('off');
  });

  it('open() goes straight to the chat, fires onOpen, and focuses the input', () => {
    panel.open();

    expect(byId('navi-panel').style.display).toBe('flex');
    expect(byId('navi-icon').style.display).toBe('none');
    expect(callbacks.onOpen).toHaveBeenCalledOnce();
    expect(document.activeElement?.id).toBe('navi-text-input');
    expect(panel.isOpen).toBe(true);
  });

  it('there is no font picker gate anymore', () => {
    panel.open();
    expect(document.getElementById('navi-font-picker')).toBeNull();
    expect(document.querySelectorAll('.navi-font-btn')).toHaveLength(0);
  });

  it('clicking the icon opens the panel the same way', () => {
    byId('navi-icon').click();
    expect(byId('navi-panel').style.display).toBe('flex');
    expect(callbacks.onOpen).toHaveBeenCalledOnce();
  });

  it('close() returns to the icon and fires onClose', () => {
    panel.open();
    panel.close();

    expect(byId('navi-panel').style.display).toBe('none');
    expect(byId('navi-icon').style.display).toBe('flex');
    expect(callbacks.onClose).toHaveBeenCalledOnce();
    expect(panel.isOpen).toBe(false);
  });

  it('the ✕ button closes via the same path', () => {
    panel.open();
    byId('navi-close-btn').click();
    expect(byId('navi-panel').style.display).toBe('none');
    expect(callbacks.onClose).toHaveBeenCalledOnce();
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
    panel.submitTranscript('read row two');
    expect(callbacks.onUserMessage).toHaveBeenCalledWith('read row two');
    expect(byId<HTMLInputElement>('navi-text-input').value).toBe('');
  });

  it('wires the mic, pause, and stop buttons to their callbacks', () => {
    byId('navi-voice-btn').click();
    expect(callbacks.onVoiceToggle).toHaveBeenCalledOnce();

    byId('navi-pause-btn').click();
    expect(callbacks.onPauseToggle).toHaveBeenCalledOnce();

    byId('navi-stop-btn').click();
    expect(callbacks.onStop).toHaveBeenCalledOnce();
  });

  it('exposes the menu container for the NaviMenu', () => {
    expect(panel.getMenuContainer().id).toBe('navi-menu');
    expect(panel.getMenuContainer().style.display).toBe('none');
  });

  it('renders AI messages as markdown and user messages as plain text', () => {
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
    panel.addMessage('<img src=x onerror="window.hacked=true">', 'ai');

    expect(byId('navi-messages').querySelector('img')).toBeNull();
    expect((window as { hacked?: boolean }).hacked).toBeUndefined();
  });

  it('shows and removes the Thinking placeholder', () => {
    panel.addMessage('Thinking...', 'ai', 'navi-thinking');
    expect(document.querySelector('.navi-thinking')).not.toBeNull();
    expect(document.querySelector('.navi-thinking')!.textContent).toBe(
      'Thinking...',
    );

    panel.removeThinking();
    expect(document.querySelector('.navi-thinking')).toBeNull();
  });

  it('applyFontSize swaps the font class on the messages area', () => {
    panel.applyFontSize('large');
    expect(byId('navi-messages').classList.contains('navi-font-large')).toBe(true);

    panel.applyFontSize('small');
    const classes = byId('navi-messages').classList;
    expect(classes.contains('navi-font-small')).toBe(true);
    expect(classes.contains('navi-font-large')).toBe(false);
  });

  it('reflects playback status on the pause and stop buttons', () => {
    panel.setPlaybackStatus('speaking');
    expect(byId('navi-pause-btn').style.opacity).toBe('1');
    expect(byId('navi-pause-btn').title).toBe('Pause');
    expect(byId('navi-stop-btn').title).toBe('Stop speaking');

    panel.setPlaybackStatus('paused');
    expect(byId('navi-pause-btn').title).toBe('Resume (paused)');

    panel.setPlaybackStatus('idle');
    expect(byId('navi-pause-btn').style.opacity).toBe('0.5');
    expect(byId('navi-pause-btn').title).toBe('Play / replay last message');
    expect(byId('navi-stop-btn').title).toBe('Nothing playing');
  });

  it('reflects listening state on the mic button, including aria-pressed', () => {
    panel.setVoiceButtonState(true);
    expect(byId('navi-voice-btn').textContent).toBe('🔴');
    expect(byId('navi-voice-btn').getAttribute('aria-pressed')).toBe('true');
    expect(byId('navi-voice-btn').getAttribute('aria-label')).toBe('Stop listening');

    panel.setVoiceButtonState(false);
    expect(byId('navi-voice-btn').textContent).toBe('🎙️');
    expect(byId('navi-voice-btn').getAttribute('aria-pressed')).toBe('false');
    expect(byId('navi-voice-btn').getAttribute('aria-label')).toBe('Start voice input');
  });
});
