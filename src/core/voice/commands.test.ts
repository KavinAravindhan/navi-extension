import { describe, expect, it } from 'vitest';
import { detectVoiceCommand } from './commands';

describe('detectVoiceCommand', () => {
  it.each([
    // Help — English
    ['help', 'help'],
    ['Help!', 'help'],
    ['hey navi, help', 'help'],
    ['navi help', 'help'],
    ['can you help', 'help'],
    ['what can you do', 'help'],
    ['What can you do?', 'help'],
    ['what are my options', 'help'],
    ['list the commands', 'help'],
    ['read your shortcuts', 'help'],
    // Help — Indonesian
    ['bantuan', 'help'],
    ['tolong bantuan', 'help'],
    ['apa yang bisa kamu lakukan', 'help'],
    // Menu — English
    ['menu', 'menu'],
    ['open the menu', 'menu'],
    ['open menu', 'menu'],
    ['Open the menu.', 'menu'],
    ['can you open the menu', 'menu'],
    ['could you please open the menu', 'menu'],
    ['hey navi, show the menu', 'menu'],
    ['show your menu', 'menu'],
    ['display the settings menu', 'menu'],
    ['open settings', 'menu'],
    ['go to settings', 'menu'],
    // Menu — Indonesian
    ['buka menu', 'menu'],
    ['tolong buka menu', 'menu'],
    ['buka pengaturan', 'menu'],
    ['tampilkan menunya', 'menu'],
  ] as const)('%j → %s', (text, command) => {
    expect(detectVoiceCommand(text)).toBe(command);
  });

  it.each([
    // Real questions that merely contain the trigger words go to the AI.
    'help me create a chart',
    'can you help me with column B',
    'what can you do with this data',
    'read the menu column',
    'the menu says pizza',
    'open the file',
    'what is on the menu in row 3',
    'sum the options column',
    'menu prices for March',
    '',
    '   ',
  ])('%j → null (goes to the AI)', (text) => {
    expect(detectVoiceCommand(text)).toBeNull();
  });
});
