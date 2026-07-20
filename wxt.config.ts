import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'NAVI',
    description:
      'AI-powered accessibility assistant for Google Sheets, built for BVI users.',

    // Public key that pins the extension ID to fojpekkjeokfmckeohalgnmdjcdeejme
    // on every machine and build directory. Required so the Google OAuth client
    // (chrome.identity) keeps recognizing the extension. Safe to commit — this is
    // the PUBLIC half of the key.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0cvyIeBya6418Plbl7qrZ0/OVdTYFrfX2p6pL7X1gBbwopedY2Rh1nfm32ig71eyZuCy5ZkHSjzSI5ThKimQY1yjxDNiREbLRj0ZR53kXDn6+IM74zwY97yT3CJlOCBkzeBmg3jKiXmZN/uyabvjE7wWaax+YGI72DyCWcqkirLnbBp+lHFMizRf6BaTGDklHbT5W33oYCu51QXlqmmJfzbXdqQNgrVLUt6kxQ9VxioFgZTwfFfybxwJXIfHfM4aA2TYP5HBu0cw/63PF6ofxENr6+17qPqJ4t6U89wHg7jDiHEBLuhl7kQJX5ARvRLJZ0n+M+CNWz/DoByjefNZYQIDAQAB',

    permissions: ['activeTab', 'scripting', 'identity', 'identity.email', 'storage'],

    // Browser-level shortcut: works even while Google Sheets traps in-page
    // keyboard focus, and Chrome maps Alt→Option on Mac automatically.
    // Users can remap it at chrome://extensions/shortcuts (NAVI-001).
    commands: {
      'open-navi': {
        suggested_key: { default: 'Alt+N' },
        description: 'Open the NAVI assistant',
      },
      'navi-help': {
        suggested_key: { default: 'Alt+H' },
        description: 'NAVI: speak the help guide',
      },
      'navi-menu': {
        suggested_key: { default: 'Alt+M' },
        description: 'NAVI: open the settings menu',
      },
    },

    oauth2: {
      client_id:
        '923523142478-3f0r12g1ki8kkeoa56h7kdc88536gude.apps.googleusercontent.com',
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/presentations',
      ],
    },

    host_permissions: [
      'https://docs.google.com/*',
      'https://sheets.googleapis.com/*',
      'https://docs.googleapis.com/*',
      'https://slides.googleapis.com/*',
    ],

    web_accessible_resources: [
      {
        resources: ['icons/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
