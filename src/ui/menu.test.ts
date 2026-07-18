import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeT } from '@/core/i18n/i18n';
import type { Language } from '@/core/i18n/strings';
import type {
  ContextScope,
  FontSize,
  OutputMode,
  SttEngine,
  VoiceEngine,
} from '@/core/settings/settings';
import { NaviMenu, type MenuDeps } from './menu';

describe('NaviMenu', () => {
  let container: HTMLElement;
  let state: {
    fontSize: FontSize;
    greetingEnabled: boolean;
    rate: number;
    outputMode: OutputMode;
    contextScope: ContextScope;
    language: Language;
    voiceEngine: VoiceEngine;
    sttEngine: SttEngine;
    wakeWordEnabled: boolean;
  };
  let deps: MenuDeps & {
    announce: ReturnType<typeof vi.fn<(text: string) => void>>;
    onClose: ReturnType<typeof vi.fn<() => void>>;
  };
  let menu: NaviMenu;

  const items = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('.navi-menu-item'));
  const itemByLabel = (label: string) =>
    items().find((i) => i.textContent === label)!;

  beforeEach(() => {
    document.body.innerHTML = '<div id="navi-menu" style="display: none;"></div>';
    container = document.getElementById('navi-menu')!;
    state = {
      fontSize: 'medium',
      greetingEnabled: true,
      rate: 1.25,
      outputMode: 'voice',
      contextScope: 'tab',
      language: 'en',
      voiceEngine: 'system',
      sttEngine: 'browser',
      wakeWordEnabled: false,
    };
    deps = {
      t: makeT(() => state.language),
      announce: vi.fn<(text: string) => void>(),
      getFontSize: () => state.fontSize,
      setFontSize: vi.fn((size: FontSize) => {
        state.fontSize = size;
      }),
      getGreetingEnabled: () => state.greetingEnabled,
      setGreetingEnabled: vi.fn((enabled: boolean) => {
        state.greetingEnabled = enabled;
      }),
      getSpeechRate: () => state.rate,
      getOutputMode: () => state.outputMode,
      setOutputMode: vi.fn((mode: OutputMode) => {
        state.outputMode = mode;
      }),
      getContextScope: () => state.contextScope,
      setContextScope: vi.fn((scope: ContextScope) => {
        state.contextScope = scope;
      }),
      getLanguage: () => state.language,
      setLanguage: vi.fn((language: Language) => {
        state.language = language;
      }),
      getVoiceEngine: () => state.voiceEngine,
      setVoiceEngine: vi.fn((engine: VoiceEngine) => {
        state.voiceEngine = engine;
      }),
      getSttEngine: () => state.sttEngine,
      setSttEngine: vi.fn((engine: SttEngine) => {
        state.sttEngine = engine;
      }),
      getWakeWordEnabled: () => state.wakeWordEnabled,
      setWakeWordEnabled: vi.fn((enabled: boolean) => {
        state.wakeWordEnabled = enabled;
      }),
      onPlayTour: vi.fn<() => void>(),
      onClose: vi.fn<() => void>(),
    };
    menu = new NaviMenu(container, deps);
  });

  it('toggle() opens with an announcement and marks the container as a menu', () => {
    menu.toggle();

    expect(menu.isOpen).toBe(true);
    expect(container.style.display).toBe('flex');
    expect(container.getAttribute('role')).toBe('menu');
    expect(deps.announce).toHaveBeenCalledWith(
      expect.stringContaining('Menu opened'),
    );
  });

  it('renders text sizes, greeting toggle, speed info, and close', () => {
    menu.show();

    expect(items().map((i) => i.textContent)).toEqual([
      'Text size: Small',
      'Text size: Medium',
      'Text size: Large',
      'Text size: Extra large',
      'Read out loud: NAVI voice',
      'Read out loud: My screen reader',
      'AI reads: Current tab only',
      'AI reads: Entire workbook',
      'Language: English',
      'Language: Bahasa Indonesia',
      'Voice: System (fast)',
      'Voice: Natural (OpenAI)',
      'Microphone: Standard',
      'Microphone: Whisper (OpenAI)',
      'Wake word: "Hey NAVI"',
      'Greeting when NAVI opens',
      'Speech speed: 1.25',
      'Play the welcome tour',
      'Close menu',
    ]);
    expect(itemByLabel('Text size: Medium').getAttribute('aria-checked')).toBe('true');
    expect(itemByLabel('Text size: Large').getAttribute('aria-checked')).toBe('false');
    expect(itemByLabel('Greeting when NAVI opens').getAttribute('aria-checked')).toBe('true');
    expect(itemByLabel('Read out loud: NAVI voice').getAttribute('aria-checked')).toBe('true');
  });

  it('expanding the AI scope to the whole workbook announces a rescan', () => {
    menu.show();

    itemByLabel('AI reads: Entire workbook').click();

    expect(deps.setContextScope).toHaveBeenCalledWith('file');
    expect(deps.announce).toHaveBeenCalledWith(
      expect.stringContaining('entire workbook'),
    );
    expect(
      itemByLabel('AI reads: Entire workbook').getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('the wake word toggle announces its privacy note, and the tour item plays', () => {
    menu.show();

    itemByLabel('Wake word: "Hey NAVI"').click();
    expect(deps.setWakeWordEnabled).toHaveBeenCalledWith(true);
    expect(deps.announce).toHaveBeenCalledWith(
      expect.stringContaining('keeps listening'),
    );

    itemByLabel('Play the welcome tour').click();
    expect(deps.onPlayTour).toHaveBeenCalledOnce();
    expect(menu.isOpen).toBe(false); // menu closes so the tour is audible
  });

  it('switching voice and microphone engines persists and announces', () => {
    menu.show();

    itemByLabel('Voice: Natural (OpenAI)').click();
    expect(deps.setVoiceEngine).toHaveBeenCalledWith('natural');
    expect(deps.announce).toHaveBeenCalledWith(
      expect.stringContaining('Natural voice on'),
    );

    itemByLabel('Microphone: Whisper (OpenAI)').click();
    expect(deps.setSttEngine).toHaveBeenCalledWith('whisper');
    expect(
      itemByLabel('Microphone: Whisper (OpenAI)').getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('switching to Indonesian announces the confirmation IN Indonesian', () => {
    menu.show();

    itemByLabel('Language: Bahasa Indonesia').click();

    expect(deps.setLanguage).toHaveBeenCalledWith('id');
    // t() is live: after the setter runs, the announcement is Indonesian.
    expect(deps.announce).toHaveBeenCalledWith(
      'Bahasa diatur ke Bahasa Indonesia. Memindai ulang sekarang.',
    );
    // The menu re-renders with Indonesian labels immediately.
    expect(
      items().some((i) => i.textContent === 'Ukuran teks: Sedang'),
    ).toBe(true);
  });

  it('choosing screen-reader output persists it and announces the change', () => {
    menu.show();

    itemByLabel('Read out loud: My screen reader').click();

    expect(deps.setOutputMode).toHaveBeenCalledWith('screenreader');
    expect(deps.announce).toHaveBeenCalledWith(
      expect.stringContaining('Screen reader mode on'),
    );
    expect(
      itemByLabel('Read out loud: My screen reader').getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      itemByLabel('Read out loud: NAVI voice').getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('choosing a text size persists it, announces it, and updates the checkmark', () => {
    menu.show();

    itemByLabel('Text size: Large').click();

    expect(deps.setFontSize).toHaveBeenCalledWith('large');
    expect(deps.announce).toHaveBeenCalledWith('Text size set to Large.');
    expect(itemByLabel('Text size: Large').getAttribute('aria-checked')).toBe('true');
    expect(itemByLabel('Text size: Medium').getAttribute('aria-checked')).toBe('false');
  });

  it('toggling the greeting flips the setting and announces the new state', () => {
    menu.show();

    itemByLabel('Greeting when NAVI opens').click();
    expect(deps.setGreetingEnabled).toHaveBeenCalledWith(false);
    expect(deps.announce).toHaveBeenCalledWith('Greeting turned off.');

    itemByLabel('Greeting when NAVI opens').click();
    expect(deps.setGreetingEnabled).toHaveBeenCalledWith(true);
    expect(deps.announce).toHaveBeenCalledWith('Greeting turned on.');
  });

  it('the speed item announces the rate and the rate keys', () => {
    menu.show();
    itemByLabel('Speech speed: 1.25').click();
    expect(deps.announce).toHaveBeenCalledWith(
      expect.stringContaining('Speech speed is 1.25'),
    );
  });

  it('Close menu and Escape both hide the menu and fire onClose', () => {
    menu.show();
    itemByLabel('Close menu').click();
    expect(menu.isOpen).toBe(false);
    expect(deps.onClose).toHaveBeenCalledOnce();

    menu.show();
    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(menu.isOpen).toBe(false);
    expect(deps.onClose).toHaveBeenCalledTimes(2);
  });

  it('arrow keys move focus and announce the focused item', () => {
    menu.show();
    expect(document.activeElement?.textContent).toBe('Text size: Small');

    container.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );

    expect(document.activeElement?.textContent).toBe('Text size: Medium');
    expect(deps.announce).toHaveBeenCalledWith('Text size: Medium, selected');
  });

  it('hide() is safe when already hidden', () => {
    expect(() => menu.hide()).not.toThrow();
    expect(deps.onClose).not.toHaveBeenCalled();
  });
});
