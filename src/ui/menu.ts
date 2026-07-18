import type { FontSize, OutputMode } from '@/core/settings/settings';

export interface MenuDeps {
  /** Speak feedback (routed through the announcer). */
  announce: (text: string) => void;
  getFontSize: () => FontSize;
  setFontSize: (size: FontSize) => void;
  getGreetingEnabled: () => boolean;
  setGreetingEnabled: (enabled: boolean) => void;
  getSpeechRate: () => number;
  getOutputMode: () => OutputMode;
  setOutputMode: (mode: OutputMode) => void;
  /** Called after the menu closes (controller restores focus). */
  onClose?: () => void;
}

const FONT_LABELS: Record<FontSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'Extra large',
};

const FONT_ORDER: FontSize[] = ['small', 'medium', 'large', 'xlarge'];

/**
 * The NAVI menu (tracker "[NAVI+m] to access menu"): text size, greeting
 * toggle, and speed info. Fully keyboard-driven — arrows move, Enter
 * activates, Escape closes — and every move is spoken.
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
    this.deps.announce(
      'Menu opened. Use up and down arrows to move, Enter to choose, Escape to close.',
    );
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
    this.container.innerHTML = '';
    this.items = [];

    const current = this.deps.getFontSize();
    for (const size of FONT_ORDER) {
      this.addItem({
        label: `Text size: ${FONT_LABELS[size]}`,
        role: 'menuitemradio',
        checked: size === current,
        onActivate: () => {
          this.deps.setFontSize(size);
          this.deps.announce(`Text size set to ${FONT_LABELS[size]}.`);
          this.refreshChecks();
        },
      });
    }

    const mode = this.deps.getOutputMode();
    this.addItem({
      label: 'Read out loud: NAVI voice',
      role: 'menuitemradio',
      checked: mode === 'voice',
      onActivate: () => {
        this.deps.setOutputMode('voice');
        this.deps.announce('NAVI voice on. NAVI reads responses out loud itself.');
        this.refreshChecks();
      },
    });

    this.addItem({
      label: 'Read out loud: My screen reader',
      role: 'menuitemradio',
      checked: mode === 'screenreader',
      onActivate: () => {
        this.deps.setOutputMode('screenreader');
        this.deps.announce(
          'Screen reader mode on. NAVI stays silent and your screen reader reads the responses.',
        );
        this.refreshChecks();
      },
    });

    this.addItem({
      label: 'Greeting when NAVI opens',
      role: 'menuitemcheckbox',
      checked: this.deps.getGreetingEnabled(),
      onActivate: () => {
        const enabled = !this.deps.getGreetingEnabled();
        this.deps.setGreetingEnabled(enabled);
        this.deps.announce(enabled ? 'Greeting turned on.' : 'Greeting turned off.');
        this.refreshChecks();
      },
    });

    this.addItem({
      label: `Speech speed: ${this.deps.getSpeechRate()}`,
      role: 'menuitem',
      onActivate: () => {
        this.deps.announce(
          `Speech speed is ${this.deps.getSpeechRate()}. Press Alt and period to speed up, Alt and comma to slow down.`,
        );
      },
    });

    this.addItem({
      label: 'Close menu',
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

  /** Font/greeting checkmarks change together — re-render in place. */
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
      checked === 'true' ? ', selected' : checked === 'false' ? ', not selected' : '';
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
