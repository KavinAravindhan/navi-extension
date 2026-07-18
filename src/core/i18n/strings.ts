/**
 * All user-facing NAVI strings (NAVI language tracker row — P0, Bahasa
 * Indonesia first for Nada's user testing in Indonesia).
 *
 * NOTE for reviewers: the Indonesian translations were machine-drafted and
 * should be reviewed by a native speaker (Nada) before the pilot.
 */
export const STRINGS = {
  en: {
    greeting: "Hi, I'm NAVI.",
    scanIntro:
      "Hi! I'm NAVI, your accessibility assistant. Let me scan your spreadsheet now...",
    readFail:
      "I couldn't read this spreadsheet. Please make sure Chrome is signed in to a Google account that can view it. Details: {details}.",
    thinking: 'Thinking...',
    micBlocked:
      'Microphone access is blocked. To fix it, click the microphone icon at the right end of the address bar and choose Allow.',
    micWillPrompt:
      'Chrome will ask for microphone permission. Please choose Allow.',
    quitPrompt: 'Do you want to close NAVI? Press the shortcut again to confirm.',
    quitFarewell: 'Closing NAVI. See you next time.',
    menuOpened:
      'Menu opened. Use up and down arrows to move, Enter to choose, Escape to close.',
    speedAnnounce: 'Speed {rate}',
    srModeOn: 'Screen reader mode on.',
    srModeOnWithCell: 'Screen reader mode on. Active cell {cell}.',
    clipboardRead: 'Your clipboard says: {text}',
    clipboardEmpty: 'Your clipboard is empty.',
    clipboardBlocked:
      'I could not read the clipboard. Chrome may be blocking clipboard access.',
    inputPlaceholder: 'Ask NAVI something...',
    ariaMicStart: 'Start voice input',
    ariaMicStop: 'Stop listening',
    menuTextSize: 'Text size: {size}',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    sizeXlarge: 'Extra large',
    menuTextSizeSet: 'Text size set to {size}.',
    menuVoiceOutput: 'Read out loud: NAVI voice',
    menuSrOutput: 'Read out loud: My screen reader',
    voiceModeOn: 'NAVI voice on. NAVI reads responses out loud itself.',
    srOutputOn:
      'Screen reader mode on. NAVI stays silent and your screen reader reads the responses.',
    menuScopeTab: 'AI reads: Current tab only',
    menuScopeFile: 'AI reads: Entire workbook',
    scopeTabOn: 'NAVI will read only the current tab. Rescanning now.',
    scopeFileOn: 'NAVI will read the entire workbook. Rescanning now.',
    menuLanguageEn: 'Language: English',
    menuLanguageId: 'Language: Bahasa Indonesia',
    languageSet: 'Language set to English. Rescanning now.',
    menuGreeting: 'Greeting when NAVI opens',
    greetingOn: 'Greeting turned on.',
    greetingOff: 'Greeting turned off.',
    menuSpeed: 'Speech speed: {rate}',
    menuSpeedInfo:
      'Speech speed is {rate}. Press Alt and period to speed up, Alt and comma to slow down.',
    menuClose: 'Close menu',
    itemSelected: ', selected',
    itemNotSelected: ', not selected',
  },
  id: {
    greeting: 'Halo, saya NAVI.',
    scanIntro:
      'Halo! Saya NAVI, asisten aksesibilitas Anda. Saya akan memindai spreadsheet Anda sekarang...',
    readFail:
      'Saya tidak bisa membaca spreadsheet ini. Pastikan Chrome masuk dengan akun Google yang punya akses. Detail: {details}.',
    thinking: 'Sedang berpikir...',
    micBlocked:
      'Akses mikrofon diblokir. Untuk memperbaikinya, klik ikon mikrofon di ujung kanan bilah alamat dan pilih Izinkan.',
    micWillPrompt: 'Chrome akan meminta izin mikrofon. Silakan pilih Izinkan.',
    quitPrompt:
      'Apakah Anda ingin menutup NAVI? Tekan pintasan sekali lagi untuk konfirmasi.',
    quitFarewell: 'Menutup NAVI. Sampai jumpa lagi.',
    menuOpened:
      'Menu terbuka. Gunakan panah atas dan bawah untuk berpindah, Enter untuk memilih, Escape untuk menutup.',
    speedAnnounce: 'Kecepatan {rate}',
    srModeOn: 'Mode pembaca layar aktif.',
    srModeOnWithCell: 'Mode pembaca layar aktif. Sel aktif {cell}.',
    clipboardRead: 'Isi papan klip Anda: {text}',
    clipboardEmpty: 'Papan klip Anda kosong.',
    clipboardBlocked:
      'Saya tidak bisa membaca papan klip. Chrome mungkin memblokir akses papan klip.',
    inputPlaceholder: 'Tanyakan sesuatu pada NAVI...',
    ariaMicStart: 'Mulai input suara',
    ariaMicStop: 'Berhenti mendengarkan',
    menuTextSize: 'Ukuran teks: {size}',
    sizeSmall: 'Kecil',
    sizeMedium: 'Sedang',
    sizeLarge: 'Besar',
    sizeXlarge: 'Ekstra besar',
    menuTextSizeSet: 'Ukuran teks diatur ke {size}.',
    menuVoiceOutput: 'Bacakan dengan: Suara NAVI',
    menuSrOutput: 'Bacakan dengan: Pembaca layar saya',
    voiceModeOn: 'Suara NAVI aktif. NAVI membacakan jawaban dengan suaranya sendiri.',
    srOutputOn:
      'Mode pembaca layar aktif. NAVI diam dan pembaca layar Anda yang membacakan jawaban.',
    menuScopeTab: 'AI membaca: Hanya tab saat ini',
    menuScopeFile: 'AI membaca: Seluruh workbook',
    scopeTabOn: 'NAVI hanya akan membaca tab saat ini. Memindai ulang sekarang.',
    scopeFileOn: 'NAVI akan membaca seluruh workbook. Memindai ulang sekarang.',
    menuLanguageEn: 'Bahasa: Inggris',
    menuLanguageId: 'Bahasa: Bahasa Indonesia',
    languageSet: 'Bahasa diatur ke Bahasa Indonesia. Memindai ulang sekarang.',
    menuGreeting: 'Sapaan saat NAVI terbuka',
    greetingOn: 'Sapaan diaktifkan.',
    greetingOff: 'Sapaan dimatikan.',
    menuSpeed: 'Kecepatan bicara: {rate}',
    menuSpeedInfo:
      'Kecepatan bicara {rate}. Tekan Alt dan titik untuk mempercepat, Alt dan koma untuk memperlambat.',
    menuClose: 'Tutup menu',
    itemSelected: ', terpilih',
    itemNotSelected: ', tidak terpilih',
  },
} as const;

export type Language = keyof typeof STRINGS;
export type StringKey = keyof (typeof STRINGS)['en'];
