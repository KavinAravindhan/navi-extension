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
    menuVoiceSystem: 'Voice: System (fast)',
    menuVoiceNatural: 'Voice: Natural (OpenAI)',
    voiceSystemOn: 'System voice on.',
    voiceNaturalOn:
      'Natural voice on. Each reply may take a moment to start speaking.',
    menuMicBrowser: 'Microphone: Standard',
    menuMicWhisper: 'Microphone: Whisper (OpenAI)',
    micBrowserOn: 'Standard microphone on.',
    micWhisperOn:
      'Whisper microphone on. Click the microphone to start and again to stop recording.',
    micWhisperUnavailable: 'Whisper is not available in this browser.',
    transcribeFail: "Sorry, I couldn't understand that recording. Please try again.",
    menuGreeting: 'Greeting when NAVI opens',
    greetingOn: 'Greeting turned on.',
    greetingOff: 'Greeting turned off.',
    menuSpeed: 'Speech speed: {rate}',
    menuSpeedInfo:
      'Speech speed is {rate}. Press Alt and period to speed up, Alt and comma to slow down.',
    menuClose: 'Close menu',
    itemSelected: ', selected',
    itemNotSelected: ', not selected',
    menuWakeWord: 'Wake word: "Hey NAVI"',
    wakeOn:
      'Wake word on. While this tab is open, NAVI keeps listening for "Hey NAVI", even when the panel is closed. You can turn this off here anytime.',
    wakeOff: 'Wake word off.',
    wakeUnavailable: 'The wake word is not available in this browser.',
    wakeHeard: 'Yes? How can I help?',
    menuTour: 'Play the welcome tour',
    tourIntro:
      "Welcome! I'm NAVI, your spreadsheet assistant. Here is a quick tour. Tap Shift twice at any time to skip it.",
    tourPause:
      'To pause or continue my voice, tap the Shift key once. You can try it right now while I keep talking.',
    tourSpeed:
      'To change my speed, hold Alt and press period to go faster, or Alt and comma to go slower.',
    tourShortcuts:
      'Press Alt and N to open me from anywhere in the sheet. Press Alt and M for my menu with all settings. Press Alt and Q twice to close me.',
    tourTalk:
      'To talk to me, click the microphone button or type in the message box. I can read your data, answer questions, and edit cells for you.',
    tourEnd:
      'You can replay this tour anytime from my menu. Now let me scan your spreadsheet.',
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
    menuVoiceSystem: 'Suara: Sistem (cepat)',
    menuVoiceNatural: 'Suara: Natural (OpenAI)',
    voiceSystemOn: 'Suara sistem aktif.',
    voiceNaturalOn:
      'Suara natural aktif. Setiap jawaban mungkin perlu sesaat sebelum mulai berbicara.',
    menuMicBrowser: 'Mikrofon: Standar',
    menuMicWhisper: 'Mikrofon: Whisper (OpenAI)',
    micBrowserOn: 'Mikrofon standar aktif.',
    micWhisperOn:
      'Mikrofon Whisper aktif. Klik mikrofon untuk mulai dan klik lagi untuk berhenti merekam.',
    micWhisperUnavailable: 'Whisper tidak tersedia di peramban ini.',
    transcribeFail: 'Maaf, saya tidak bisa memahami rekaman itu. Silakan coba lagi.',
    menuGreeting: 'Sapaan saat NAVI terbuka',
    greetingOn: 'Sapaan diaktifkan.',
    greetingOff: 'Sapaan dimatikan.',
    menuSpeed: 'Kecepatan bicara: {rate}',
    menuSpeedInfo:
      'Kecepatan bicara {rate}. Tekan Alt dan titik untuk mempercepat, Alt dan koma untuk memperlambat.',
    menuClose: 'Tutup menu',
    itemSelected: ', terpilih',
    itemNotSelected: ', tidak terpilih',
    menuWakeWord: 'Kata pemicu: "Hey NAVI"',
    wakeOn:
      'Kata pemicu aktif. Selama tab ini terbuka, NAVI terus mendengarkan "Hey NAVI", bahkan saat panel tertutup. Anda bisa mematikannya di sini kapan saja.',
    wakeOff: 'Kata pemicu dimatikan.',
    wakeUnavailable: 'Kata pemicu tidak tersedia di peramban ini.',
    wakeHeard: 'Ya? Ada yang bisa saya bantu?',
    menuTour: 'Putar tur sambutan',
    tourIntro:
      'Selamat datang! Saya NAVI, asisten spreadsheet Anda. Ini tur singkat. Ketuk Shift dua kali kapan saja untuk melewatinya.',
    tourPause:
      'Untuk menjeda atau melanjutkan suara saya, ketuk tombol Shift sekali. Anda bisa mencobanya sekarang selagi saya bicara.',
    tourSpeed:
      'Untuk mengubah kecepatan, tahan Alt dan tekan titik untuk mempercepat, atau Alt dan koma untuk memperlambat.',
    tourShortcuts:
      'Tekan Alt dan N untuk membuka saya dari mana saja di sheet. Tekan Alt dan M untuk menu dengan semua pengaturan. Tekan Alt dan Q dua kali untuk menutup saya.',
    tourTalk:
      'Untuk berbicara dengan saya, klik tombol mikrofon atau ketik di kotak pesan. Saya bisa membaca data Anda, menjawab pertanyaan, dan mengedit sel.',
    tourEnd:
      'Anda bisa memutar tur ini lagi kapan saja dari menu saya. Sekarang saya akan memindai spreadsheet Anda.',
  },
} as const;

export type Language = keyof typeof STRINGS;
export type StringKey = keyof (typeof STRINGS)['en'];
