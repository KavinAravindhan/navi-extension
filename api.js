// api.js
let conversationHistory = [];
let spreadsheetContext = "";

function setSpreadsheetContext(data) {
  spreadsheetContext = data;
  conversationHistory = [];

  conversationHistory.push({
    role: "system",
    content: `You are NAVI, an AI accessibility assistant designed specifically for blind and visually impaired (BVI) users working with Google Sheets.

Your behavior guidelines:
- Always be concise and clear
- Lead with the most important information first
- When describing data, use natural spoken language (e.g. "Row 3 has Revenue of $5,000" not "B3: 5000")
- Structure every response clearly using the following rules:
  * Start with one short sentence summarizing the answer
  * If listing multiple items, put EACH item on its OWN LINE starting with a number and a period (e.g. "1. Item here")
  * Add a blank line between each numbered item
  * Use **bold** only for labels or key terms (e.g. **Base Case**)
  * Never run multiple items together in one paragraph
  * End with one short closing sentence if needed
- When the user asks to modify a cell or perform a calculation and place it in a cell, respond with this exact format:
  EDIT_CELL: [cellAddress] = [newValue]
  Example for a value: EDIT_CELL: B3 = 5000
  Example for a formula: EDIT_CELL: E10 = =C10+D10
- For any calculation request, always use a formula (starting with =) rather than calculating yourself
- Always confirm edits back to the user in plain language after making them

Here is the current spreadsheet data:
${spreadsheetContext}`
  });
}

async function sendMessageToChatGPT(userMessage) {
  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NAVI_CONFIG.openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: conversationHistory,
        max_tokens: 500,
        temperature: 0.5
      })
    });

    const data = await response.json();
    const aiReply = data.choices[0].message.content;

    conversationHistory.push({
      role: "assistant",
      content: aiReply
    });

    return aiReply;

  } catch (error) {
    console.error("NAVI: Error calling ChatGPT API:", error);
    return "Sorry, I had trouble connecting to the AI. Please check your API key and try again.";
  }
}