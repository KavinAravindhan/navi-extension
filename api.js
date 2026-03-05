// api.js
// -------
// This file handles all communication with the OpenAI ChatGPT API.
// It sends the spreadsheet data and user questions to ChatGPT,
// and returns the AI's response back to the chat panel.

// Keeps track of the conversation history so ChatGPT remembers context
// across multiple messages in the same session
let conversationHistory = [];

// Stores the spreadsheet data so we don't need to re-read the sheet
// every time the user sends a new message
let spreadsheetContext = "";

/**
 * Sets the spreadsheet data as context for the conversation.
 * Called once when the chat panel is first opened.
 * @param {string} data - The spreadsheet content as a formatted string
 */
function setSpreadsheetContext(data) {
  spreadsheetContext = data;

  // Reset conversation history when new sheet context is loaded
  conversationHistory = [];

  // Add a system message that tells ChatGPT how to behave
  // This is the instruction set that makes NAVI accessible and helpful
  conversationHistory.push({
    role: "system",
    content: `You are NAVI, an AI accessibility assistant designed specifically for blind and visually impaired (BVI) users working with Google Sheets.

Your behavior guidelines:
- Always be concise and clear — avoid long walls of text
- Lead with the most important information first
- When describing data, use natural spoken language (e.g. "Row 3 has Revenue of $5,000" not "B3: 5000")
- When the user asks to modify a cell, respond with this exact format so the system can process it:
  EDIT_CELL: [cellAddress] = [newValue]
  Example: EDIT_CELL: B3 = 5000
- Always confirm edits back to the user in plain language after making them

Here is the current spreadsheet data:
${spreadsheetContext}`
  });
}

/**
 * Sends a message to ChatGPT and returns the AI's response.
 * Maintains conversation history so follow-up questions work naturally.
 * @param {string} userMessage - The user's typed or spoken question
 * @returns {string} - ChatGPT's response text
 */
async function sendMessageToChatGPT(userMessage) {
  // Add the user's message to conversation history
  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  try {
    // Make the API call to OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: conversationHistory,
        max_tokens: 500,
        temperature: 0.5
      })
    });

    // Parse the response from OpenAI
    const data = await response.json();

    // Extract the AI's reply text
    const aiReply = data.choices[0].message.content;

    // Add the AI's reply to conversation history for future context
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