import type { Translate } from '@/core/i18n/i18n';
import type { Language } from '@/core/i18n/strings';
import type {
  ContextScope,
  FontSize,
  OutputMode,
} from '@/core/settings/settings';

export interface MenuDeps {
  /** Translates UI strings for the current language. */
  t: Translate;
  /** Speak feedback (routed through the announcer). */
  announce: (text: string) => void;
  getFontSize: () => FontSize;
  setFontSize: (size: FontSize) => void;
  getGreetingEnabled: () => boolean;
  setGreetingEnabled: (enabled: boolean) => void;
  getSpeechRate: () => number;
  getOutputMode: () => OutputMode;
  setOutputMode: (mode: OutputMode) => void;
  getContextScope: () => ContextScope;
  setContextScope: (scope: ContextScope) => void;
  getLanguage: () => Language;
  setLanguage: (language: Language) => void;
  /** Called after the menu closes (controller restores focus). */
  onClose?: () => void;
}

const FONT_ORDER: FontSize[] = ['small', 'medium', 'large', 'xlarge'];
const FONT_LABEL_KEYS = {
  small: 'sizeSmall',
  medium: 'sizeMedium',
  large: 'sizeLarge',
  xlarge: 'sizeXlarge',
} as const;

/**
 * The NAVI menu (tracker "[NAVI+m] to access menu"): text size, output mode,
 * AI scope, language, greeting, and speed info. Fully keyboard-driven —
 * arrows move, Enter activates, Escape closes — and every move is spoken.
 */
export class NaviMenu {
  private items: HTMLButtonElement[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly deps: MenuDeps,
  ) {
    container.setAttribute('role', 'menu');
    container.setAttribute('aria-label', 'NAVI menu');
    container.addEventListener('keydown', (event) =>
      this.onKeyDown(event as KeyboardEvent),
    );
  }

  get isOpen(): boolean {
    return this.container.style.display === 'flex';
  }

  toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.render();
    this.container.style.display = 'flex';
    this.deps.announce(this.deps.t('menuOpened'));
    this.focusItem(0, { silent: true });
  }

  hide(): void {
    if (!this.isOpen) return;
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.items = [];
    this.deps.onClose?.();
  }

  // ------------------------------------------------------------------

  private render(): void {
    const { t } = this.deps;
    this.container.innerHTML = '';
    this.items = [];

    const currentSize = this.deps.getFontSize();
    for (const size of FONT_ORDER) {
      const sizeLabel = t(FONT_LABEL_KEYS[size]);
      this.addItem({
        label: t('menuTextSize', { size: sizeLabel }),
        role: 'menuitemradio',
        checked: size === currentSize,
        onActivate: () => {
          this.deps.setFontSize(size);
          this.deps.announce(t('menuTextSizeSet', { size: t(FONT_LABEL_KEYS[size]) }));
          this.refreshChecks();
        },
      });
    }

    const mode = this.deps.getOutputMode();
    this.addItem({
      label: t('menuVoiceOutput'),
      role: 'menuitemradio',
      checked: mode === 'voice',
      onActivate: () => {
        this.deps.setOutputMode('voice');
        this.deps.announce(t('voiceModeOn'));
        this.refreshChecks();
      },
    });

    this.addItem({
      label: t('menuSrOutput'),
      role: 'menuitemradio',
      checked: mode === 'screenreader',
      onActivate: () => {
        this.deps.setOutputMode('screenreader');
        this.deps.announce(t('srOutputOn'));
        this.refreshChecks();
      },
    });

    const scope = this.deps.getContextScope();
    this.addItem({
      label: t('menuScopeTab'),
      role: 'menuitemradio',
      checked: scope === 'tab',
      onActivate: () => {
        this.deps.setContextScope('tab');
        this.deps.announce(t('scopeTabOn'));
        this.refreshChecks();
      },
    });

    this.addItem({
      label: t('menuScopeFile'),
      role: 'menuitemradio',
      checked: scope === 'file',
      onActivate: () => {
        this.deps.setContextScope('file');
        this.deps.announce(t('scopeFileOn'));
        this.refreshChecks();
      },
    });

    const language = this.deps.getLanguage();
    this.addItem({
      label: t('menuLanguageEn'),
      role: 'menuitemradio',
      checked: language === 'en',
      onActivate: () => {
        this.deps.setLanguage('en');
        // t() is live: the confirmation speaks in the NEW language.
        this.deps.announce(this.deps.t('languageSet'));
        this.refreshChecks();
      },
    });

    this.addItem({
      label: t('menuLanguageId'),
      role: 'menuitemradio',
      checked: language === 'id',
      onActivate: () => {
        this.deps.setLanguage('id');
        this.deps.announce(this.deps.t('languageSet'));
        this.refreshChecks();
      },
    });

    this.addItem({
      label: t('menuGreeting'),
      role: 'menuitemcheckbox',
      checked: this.deps.getGreetingEnabled(),
      onActivate: () => {
        const enabled = !this.deps.getGreetingEnabled();
        this.deps.setGreetingEnabled(enabled);
        this.deps.announce(enabled ? t('greetingOn') : t('greetingOff'));
        this.refreshChecks();
      },
    });

    this.addItem({
      label: t('menuSpeed', { rate: this.deps.getSpeechRate() }),
      role: 'menuitem',
      onActivate: () => {
        this.deps.announce(t('menuSpeedInfo', { rate: this.deps.getSpeechRate() }));
      },
    });

    this.addItem({
      label: t('menuClose'),
      role: 'menuitem',
      onActivate: () => this.hide(),
    });
  }

  private addItem(config: {
    label: string;
    role: string;
    checked?: boolean;
    onActivate: () => void;
  }): void {
    const button = this.container.ownerDocument.createElement('button');
    button.className = 'navi-menu-item';
    button.textContent = config.label;
    button.setAttribute('role', config.role);
    if (config.checked !== undefined) {
      button.setAttribute('aria-checked', String(config.checked));
    }
    button.tabIndex = -1;
    button.addEventListener('click', config.onActivate);
    button.addEventListener('focus', () => {
      const index = this.items.indexOf(button);
      if (index >= 0) this.announceItem(index);
    });
    this.container.appendChild(button);
    this.items.push(button);
  }

  /** Checkmarks (and language labels) change together — re-render in place. */
  private refreshChecks(): void {
    const focused = this.items.findIndex(
      (item) => item === this.container.ownerDocument.activeElement,
    );
    this.render();
    if (focused >= 0) this.focusItem(focused, { silent: true });
  }

  private focusItem(index: number, opts: { silent?: boolean } = {}): void {
    if (this.items.length === 0) return;
    const clamped = ((index % this.items.length) + this.items.length) % this.items.length;
    this.items.forEach((item, i) => (item.tabIndex = i === clamped ? 0 : -1));
    if (!opts.silent) this.announceItem(clamped);
    this.items[clamped].focus();
  }

  private announceItem(index: number): void {
    const item = this.items[index];
    const checked = item.getAttribute('aria-checked');
    const suffix =
      checked === 'true'
        ? this.deps.t('itemSelected')
        : checked === 'false'
          ? this.deps.t('itemNotSelected')
          : '';
    this.deps.announce(`${item.textContent}${suffix}`);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const focused = this.items.findIndex(
      (item) => item === this.container.ownerDocument.activeElement,
    );
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusItem(focused + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusItem(focused - 1);
        break;
      case 'Home':
        event.preventDefault();
        this.focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusItem(this.items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.hide();
        break;
    }
  }
}
