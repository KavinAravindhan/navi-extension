import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it.each([
    ['hello **world**', 'hello <strong>world</strong>'],
    ['line one\nline two', 'line one<br>line two'],
    ['plain text', 'plain text'],
    ['**a**\n**b**', '<strong>a</strong><br><strong>b</strong>'],
  ])('renders %j as %j', (input, expected) => {
    expect(renderMarkdown(input)).toBe(expected);
  });

  it.each([
    [
      '<script>alert("x")</script>',
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    ],
    ['<img src=x onerror=alert(1)>', '&lt;img src=x onerror=alert(1)&gt;'],
    ['5 & 6 < 7', '5 &amp; 6 &lt; 7'],
  ])('escapes untrusted HTML: %j', (input, expected) => {
    expect(renderMarkdown(input)).toBe(expected);
  });

  it('still bolds text after escaping surrounding HTML', () => {
    expect(renderMarkdown('**<b>**')).toBe('<strong>&lt;b&gt;</strong>');
  });
});
