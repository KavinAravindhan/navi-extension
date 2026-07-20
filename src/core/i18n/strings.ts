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
    whatToKnow: 'What would you like to know?',
    stillScanning: "One moment — I'm still reading this spreadsheet.",
    overviewOneTab: 'This workbook has one tab: {names}.',
    overviewTabs: 'This workbook has {count} tabs: {names}.',
    overviewCurrent: "You're on {tab}, with {rows} rows.",
    overviewCurrentWithHeading: "You're on {tab} — a table called {heading} with {rows} rows.",
    overviewCharts: 'It also has {count} chart{plural}.',
    overviewDoc:
      'This document is titled {title}, about {words} words, with {count} headings: {names}.',
    overviewDocNoHeadings: 'This document is titled {title}, about {words} words.',
    overviewSlides: 'This presentation "{title}" has {count} slides. Slide one: {first}.',
    readFail:
      "I couldn't read this spreadsheet. Please make sure Chrome is signed in to a Google account that can view it. Details: {details}.",
    readFailAccount:
      "I couldn't read this spreadsheet. I'm using the Google account {email}. If this file belongs to a different account — for example a school or work account — ask its owner to share it with {email}, or open it in a Chrome profile signed in as the owner. Details: {details}.",
    thinking: 'Thinking...',
    ack: 'One moment.',
    micBlocked:
      'Microphone access is blocked. To fix it, click the microphone icon at the right end of the address bar and choose Allow.',
    micWillPrompt:
      'Chrome will ask for microphone permission. Please choose Allow.',
    micStartFail:
      "I couldn't open the microphone just now. Say hey navi, or press the microphone button to try again.",
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
    menuVoiceNamed: 'Voice: {name} (natural)',
    voicePreview: "Hi, I'm NAVI. This is my voice.",
    voiceChosen: 'This is my voice from now on.',
    voiceSystemOn: 'System voice on.',
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
    menuTyping: 'Show the typing box',
    typingShown: 'Typing box shown.',
    typingHidden: 'Typing box hidden.',
    shortcutNotSet:
      'The keyboard shortcut is not set on this computer. A helper can set it at chrome extensions shortcuts. Meanwhile, just say Hey NAVI anytime.',

    tourIntro:
      "Welcome! I'm NAVI, your spreadsheet assistant. Here is a quick tour. Tap Shift twice at any time to skip it.",
    tourWake:
      'To call me, just say Hey NAVI, anytime. When I answer, speak your question — no buttons needed.',
    tourPause:
      'To pause or continue my voice, tap the Shift key once. You can try it right now while I keep talking.',
    tourSpeed:
      'To change my speed, hold Alt and press period to go faster, or Alt and comma to go slower.',
    tourShortcutBound:
      'You can also open me with the keyboard: press {shortcut}. For my settings menu, press Alt and M. To close me, press Alt and Q twice.',
    tourTalk:
      'I can read your data, answer questions, and edit cells — just ask.',
    tourHelp:
      'For a reminder of everything I can do, say help, or press Alt and H.',
    tourEnd:
      'You can replay this tour anytime from my menu. Now, your spreadsheet.',
    helpIntro: "Here's how to use me.",
    helpAsk:
      'Just talk to me. Ask about your data, edit cells, create charts, switch tabs, or jump to a cell — in Google Sheets, Docs, and Slides.',
    helpSummon: 'To call me, say Hey NAVI anytime.',
    helpShortcut: 'You can also open me with the keyboard: press {shortcut}.',
    helpMenu:
      'For my settings — voices, languages, and more — say open menu, or press Alt and M.',
    helpExtras:
      'Press Alt and C to hear the clipboard. Press Control Alt Z for screen reader mode.',
    helpQuit: 'To close me, press Alt and Q twice.',
    helpEnd: 'To hear this help again, say help, or press Alt and H.',
    tourPlaying: '🔊 Playing the quick tour — tap Shift twice to skip it.',
    helpPlaying: '🔊 Playing the help guide — tap Shift twice to skip it.',
  },
  id: {
    greeting: 'Halo, saya NAVI.',
    whatToKnow: 'Apa yang ingin Anda ketahui?',
    stillScanning: 'Sebentar — saya masih membaca spreadsheet ini.',
    overviewOneTab: 'Workbook ini punya satu tab: {names}.',
    overviewTabs: 'Workbook ini punya {count} tab: {names}.',
    overviewCurrent: 'Anda berada di {tab}, dengan {rows} baris.',
    overviewCurrentWithHeading: 'Anda berada di {tab} — tabel bernama {heading} dengan {rows} baris.',
    overviewCharts: 'Ada juga {count} grafik{plural}.',
    overviewDoc:
      'Dokumen ini berjudul {title}, sekitar {words} kata, dengan {count} judul bagian: {names}.',
    overviewDocNoHeadings: 'Dokumen ini berjudul {title}, sekitar {words} kata.',
    overviewSlides: 'Presentasi "{title}" punya {count} slide. Slide satu: {first}.',
    readFail:
      'Saya tidak bisa membaca spreadsheet ini. Pastikan Chrome masuk dengan akun Google yang punya akses. Detail: {details}.',
    readFailAccount:
      'Saya tidak bisa membaca spreadsheet ini. Saya memakai akun Google {email}. Jika file ini milik akun lain — misalnya akun kampus atau kantor — minta pemiliknya membagikannya ke {email}, atau buka di profil Chrome pemiliknya. Detail: {details}.',
    thinking: 'Sedang berpikir...',
    ack: 'Sebentar.',
    micBlocked:
      'Akses mikrofon diblokir. Untuk memperbaikinya, klik ikon mikrofon di ujung kanan bilah alamat dan pilih Izinkan.',
    micWillPrompt: 'Chrome akan meminta izin mikrofon. Silakan pilih Izinkan.',
    micStartFail:
      'Saya tidak bisa membuka mikrofon barusan. Ucapkan hei navi, atau tekan tombol mikrofon untuk mencoba lagi.',
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
    menuVoiceNamed: 'Suara: {name} (natural)',
    voicePreview: 'Halo, saya NAVI. Ini suara saya.',
    voiceChosen: 'Mulai sekarang, ini suara saya.',
    voiceSystemOn: 'Suara sistem aktif.',
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
    menuTyping: 'Tampilkan kotak ketik',
    typingShown: 'Kotak ketik ditampilkan.',
    typingHidden: 'Kotak ketik disembunyikan.',
    shortcutNotSet:
      'Pintasan keyboard belum diatur di komputer ini. Pendamping bisa mengaturnya di chrome extensions shortcuts. Sementara itu, ucapkan saja Hey NAVI kapan pun.',

    tourIntro:
      'Selamat datang! Saya NAVI, asisten spreadsheet Anda. Ini tur singkat. Ketuk Shift dua kali kapan saja untuk melewatinya.',
    tourWake:
      'Untuk memanggil saya, ucapkan saja Hey NAVI, kapan pun. Saat saya menjawab, langsung ucapkan pertanyaan Anda — tanpa tombol apa pun.',
    tourPause:
      'Untuk menjeda atau melanjutkan suara saya, ketuk tombol Shift sekali. Anda bisa mencobanya sekarang selagi saya bicara.',
    tourSpeed:
      'Untuk mengubah kecepatan, tahan Alt dan tekan titik untuk mempercepat, atau Alt dan koma untuk memperlambat.',
    tourShortcutBound:
      'Anda juga bisa membuka saya dengan keyboard: tekan {shortcut}. Untuk menu pengaturan, tekan Alt dan M. Untuk menutup saya, tekan Alt dan Q dua kali.',
    tourTalk:
      'Saya bisa membaca data Anda, menjawab pertanyaan, dan mengedit sel — tinggal minta.',
    tourHelp:
      'Untuk pengingat semua yang bisa saya lakukan, ucapkan bantuan, atau tekan Alt dan H.',
    tourEnd:
      'Anda bisa memutar tur ini lagi kapan saja dari menu saya. Sekarang, spreadsheet Anda.',
    helpIntro: 'Begini cara menggunakan saya.',
    helpAsk:
      'Cukup bicara dengan saya. Tanyakan tentang data Anda, ubah sel, buat grafik, pindah tab, atau lompat ke sel — di Google Sheets, Docs, dan Slides.',
    helpSummon: 'Untuk memanggil saya, ucapkan Hey NAVI kapan saja.',
    helpShortcut: 'Anda juga bisa membuka saya dengan keyboard: tekan {shortcut}.',
    helpMenu:
      'Untuk pengaturan saya — suara, bahasa, dan lainnya — ucapkan buka menu, atau tekan Alt dan M.',
    helpExtras:
      'Tekan Alt dan C untuk mendengar papan klip. Tekan Control Alt Z untuk mode pembaca layar.',
    helpQuit: 'Untuk menutup saya, tekan Alt dan Q dua kali.',
    helpEnd: 'Untuk mendengar bantuan ini lagi, ucapkan bantuan, atau tekan Alt dan H.',
    tourPlaying: '🔊 Memutar tur singkat — ketuk Shift dua kali untuk melewatinya.',
    helpPlaying: '🔊 Memutar panduan bantuan — ketuk Shift dua kali untuk melewatinya.',
  },
} as const;

export type Language = keyof typeof STRINGS;
export type StringKey = keyof (typeof STRINGS)['en'];
