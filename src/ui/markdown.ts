function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the tiny markdown subset NAVI's system prompt asks GPT to use
 * (**bold** and line breaks) into HTML for the chat panel.
 *
 * The input is LLM output — untrusted — so all HTML is escaped first and only
 * the tags we generate ourselves (<strong>, <br>) survive. This is the one
 * intentional behavior change in the v1 → v2 port: v1 injected the raw text
 * into innerHTML unescaped.
 */
export function renderMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
