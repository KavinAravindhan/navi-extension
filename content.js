// content.js
// -----------
// This is the main file that runs on the Google Sheets page.
// It is responsible for:
// 1. Reading the spreadsheet data from the page
// 2. Creating and managing the NAVI icon and chat panel UI
// 3. Handling user messages (typed and voice)
// 4. Processing cell edit commands from ChatGPT
// 5. Managing voice input via the Web Speech API

// ========================================================
// SECTION 1: READING THE SPREADSHEET DATA
// ========================================================

/**
 * Reads the visible spreadsheet data from the Google Sheets DOM.
 * Since Google Sheets only renders visible cells, this works best
 * for demo sheets that are fully visible on screen.
 * @returns {string} - A formatted string of the spreadsheet content
 */
function readSpreadsheetData() {
  try {
    // Google Sheets renders cells inside elements with this class
    const cells = document.querySelectorAll(".cell-input");

    // If no cells found, the sheet might still be loading
    if (!cells || cells.length === 0) {
      return "No spreadsheet data found. Please make sure a Google Sheet is open and fully loaded.";
    }

    // Build a readable summary of what's in the sheet
    let sheetData = "Spreadsheet Data:\n";
    let cellCount = 0;

    cells.forEach((cell) => {
      const value = cell.textContent.trim();

      // Only include cells that actually have content
      if (value !== "") {
        // Try to get the cell address from the parent element's data attributes
        const cellAddress = cell.closest("[data-row][data-col]");
        if (cellAddress) {
          const row = cellAddress.getAttribute("data-row");
          const col = cellAddress.getAttribute("data-col");
          const colLetter = columnNumberToLetter(parseInt(col));
          sheetData += `${colLetter}${row}: ${value}\n`;
          cellCount++;
        }
      }
    });

    if (cellCount === 0) {
      return "The spreadsheet appears to be empty or no data is visible on screen.";
    }

    return sheetData;

  } catch (error) {
    console.error("NAVI: Error reading spreadsheet:", error);
    return "I had trouble reading the spreadsheet. Please refresh and try again.";
  }
}

/**
 * Converts a column number to a column letter (e.g. 1 → A, 2 → B, 27 → AA)
 * Used to format cell addresses in a human-readable way.
 * @param {number} colNumber - The column number starting from 1
 * @returns {string} - The column letter(s)
 */
function columnNumberToLetter(colNumber) {
  let letter = "";
  while (colNumber > 0) {
    const remainder = (colNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colNumber = Math.floor((colNumber - 1) / 26);
  }
  return letter;
}

// ========================================================
// SECTION 2: HANDLING CELL EDITS
// ========================================================

/**
 * Parses ChatGPT's response to check if it contains a cell edit command.
 * ChatGPT is instructed to use the format: EDIT_CELL: [address] = [value]
 * @param {string} aiResponse - The full response text from ChatGPT
 * @returns {object|null} - An object with cellAddress and newValue, or null
 */
function parseEditCommand(aiResponse) {
  // Look for the EDIT_CELL pattern in the response
  const editPattern = /EDIT_CELL:\s*([A-Z]+\d+)\s*=\s*(.+)/i;
  const match = aiResponse.match(editPattern);

  if (match) {
    return {
      cellAddress: match[1].trim(),
      newValue: match[2].trim()
    };
  }

  return null;
}

/**
 * Attempts to edit a cell in Google Sheets by simulating user interaction.
 * Uses the Name Box (cell address input) to navigate to the cell,
 * then simulates typing the new value.
 * @param {string} cellAddress - The cell to edit (e.g. "B3")
 * @param {string} newValue - The value to enter into the cell
 */
function editCell(cellAddress, newValue) {
  try {
    // Step 1: Find the Name Box (the cell address input at the top left)
    // This is where you normally type a cell address to navigate to it
    const nameBox = document.querySelector(".cell-input-container input, #t-name-box-input, .waffle-name-box");

    if (!nameBox) {
      console.error("NAVI: Could not find the Name Box to navigate to cell");
      return;
    }

    // Step 2: Click the Name Box and type the cell address
    nameBox.click();
    nameBox.value = cellAddress;

    // Simulate pressing Enter to navigate to the cell
    nameBox.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    nameBox.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));

    // Step 3: Wait briefly for navigation, then type the new value
    setTimeout(() => {
      // Find the currently active/focused cell editor
      const activeCell = document.querySelector(".cell-input:focus, .waffle-cell-input");

      if (activeCell) {
        activeCell.focus();
        activeCell.textContent = newValue;

        // Simulate pressing Enter to confirm the value
        activeCell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        activeCell.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
      }
    }, 500);

  } catch (error) {
    console.error("NAVI: Error editing cell:", error);
  }
}

// ========================================================
// SECTION 3: VOICE INPUT
// ========================================================

// Tracks whether voice recognition is currently active
let isListening = false;

// The Web Speech API object for voice recognition
let recognition = null;

/**
 * Initializes the Web Speech API for voice input.
 * Sets up handlers for when speech is detected and transcribed.
 * @param {function} onResult - Callback function that receives the transcribed text
 */
function initVoiceRecognition(onResult) {
  // Check if the browser supports voice recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("NAVI: Voice recognition is not supported in this browser.");
    return null;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false; // Only return final results
  recognition.maxAlternatives = 1;   // Only return the top result

  // When speech is successfully transcribed
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("NAVI: Voice input received:", transcript);
    onResult(transcript);
  };

  // When voice recognition ends (either by itself or manually)
  recognition.onend = () => {
    isListening = false;
    updateVoiceButton(false);
  };

  // Handle errors gracefully
  recognition.onerror = (event) => {
    console.error("NAVI: Voice recognition error:", event.error);
    isListening = false;
    updateVoiceButton(false);
  };

  return recognition;
}

/**
 * Toggles voice recognition on and off.
 * Called when the user clicks the microphone button.
 */
function toggleVoiceRecognition() {
  if (!recognition) {
    console.warn("NAVI: Voice recognition not initialized.");
    return;
  }

  if (isListening) {
    recognition.stop();
    isListening = false;
    updateVoiceButton(false);
  } else {
    recognition.start();
    isListening = true;
    updateVoiceButton(true);
  }
}

/**
 * Updates the microphone button's appearance based on listening state.
 * @param {boolean} listening - Whether voice recognition is active
 */
function updateVoiceButton(listening) {
  const voiceBtn = document.getElementById("navi-voice-btn");
  if (voiceBtn) {
    voiceBtn.textContent = listening ? "🔴" : "🎙️";
    voiceBtn.title = listening ? "Listening... click to stop" : "Click to speak";
  }
}

// ========================================================
// SECTION 4: BUILDING THE CHAT UI
// ========================================================

/**
 * Creates and injects the NAVI floating icon and chat panel into the page.
 * The icon sits in the bottom right corner. Clicking it opens the chat panel.
 */
function createNaviUI() {
  // --- Create the floating NAVI icon ---
  const naviIcon = document.createElement("div");
  naviIcon.id = "navi-icon";
  naviIcon.title = "Open NAVI Assistant";
  naviIcon.innerHTML = `
    <span style="font-size: 20px;">👁️</span>
    <span style="font-size: 12px; font-weight: bold;">NAVI</span>
  `;

  // --- Create the chat panel (hidden by default) ---
  const naviPanel = document.createElement("div");
  naviPanel.id = "navi-panel";
  naviPanel.style.display = "none";
  naviPanel.innerHTML = `
    <div id="navi-header">
      <span>👁️ NAVI Assistant</span>
      <button id="navi-close-btn" title="Close NAVI">✕</button>
    </div>

    <div id="navi-messages">
      <div class="navi-message navi-ai-message">
        Hi! I'm NAVI. Opening your spreadsheet now...
      </div>
    </div>

    <div id="navi-input-area">
      <input
        type="text"
        id="navi-text-input"
        placeholder="Ask NAVI something..."
        autocomplete="off"
      />
      <button id="navi-voice-btn" title="Click to speak">🎙️</button>
      <button id="navi-send-btn" title="Send message">➤</button>
    </div>
  `;

  // Add both elements to the page
  document.body.appendChild(naviIcon);
  document.body.appendChild(naviPanel);

  // --- Wire up the UI interactions ---
  setupUIEventListeners();
}

// ========================================================
// SECTION 5: UI EVENT LISTENERS AND MAIN LOGIC
// ========================================================

/**
 * Sets up all the click handlers and interactions for the NAVI UI.
 * This is where everything gets connected together.
 */
function setupUIEventListeners() {
  const naviIcon = document.getElementById("navi-icon");
  const naviPanel = document.getElementById("navi-panel");
  const closeBtn = document.getElementById("navi-close-btn");
  const sendBtn = document.getElementById("navi-send-btn");
  const textInput = document.getElementById("navi-text-input");
  const voiceBtn = document.getElementById("navi-voice-btn");

  // --- Open chat panel when NAVI icon is clicked ---
  naviIcon.addEventListener("click", () => {
    naviPanel.style.display = "flex";
    naviIcon.style.display = "none";

    // Read the sheet and generate an initial summary
    loadSpreadsheetAndSummarize();
  });

  // --- Close chat panel ---
  closeBtn.addEventListener("click", () => {
    naviPanel.style.display = "none";
    naviIcon.style.display = "flex";
  });

  // --- Send message when Send button is clicked ---
  sendBtn.addEventListener("click", () => {
    handleUserMessage();
  });

  // --- Send message when Enter key is pressed ---
  textInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleUserMessage();
    }
  });

  // --- Toggle voice recognition when mic button is clicked ---
  voiceBtn.addEventListener("click", () => {
    toggleVoiceRecognition();
  });

  // --- Initialize voice recognition ---
  // When voice input is received, fill the text input and send automatically
  initVoiceRecognition((transcript) => {
    textInput.value = transcript;
    handleUserMessage();
  });
}

/**
 * Reads the spreadsheet, sets it as context, and asks ChatGPT for
 * an initial accessibility-friendly summary to greet the user.
 */
async function loadSpreadsheetAndSummarize() {
  addMessageToChat("Reading your spreadsheet...", "ai");

  // Read the sheet data from the DOM
  const sheetData = readSpreadsheetData();

  // Pass the sheet data to the API so ChatGPT knows the context
  setSpreadsheetContext(sheetData);

  // Ask ChatGPT to give an initial summary of the spreadsheet
  const summary = await sendMessageToChatGPT(
    "Please give me a brief, accessible summary of this spreadsheet. Start with the overall structure, then highlight the key data points a BVI user would want to know first."
  );

  // Replace the "Reading..." message with the actual summary
  const messages = document.getElementById("navi-messages");
  messages.innerHTML = "";
  addMessageToChat(summary, "ai");
}

/**
 * Handles sending a user message — either typed or from voice.
 * Gets the text, displays it, sends it to ChatGPT, and shows the response.
 */
async function handleUserMessage() {
  const textInput = document.getElementById("navi-text-input");
  const userMessage = textInput.value.trim();

  // Don't send empty messages
  if (!userMessage) return;

  // Clear the input field
  textInput.value = "";

  // Display the user's message in the chat
  addMessageToChat(userMessage, "user");

  // Show a thinking indicator while waiting for ChatGPT
  addMessageToChat("Thinking...", "ai", "navi-thinking");

  // Send the message to ChatGPT
  const aiResponse = await sendMessageToChatGPT(userMessage);

  // Remove the thinking indicator
  const thinkingMsg = document.querySelector(".navi-thinking");
  if (thinkingMsg) thinkingMsg.remove();

  // Check if the response contains a cell edit command
  const editCommand = parseEditCommand(aiResponse);
  if (editCommand) {
    editCell(editCommand.cellAddress, editCommand.newValue);
  }

  // Display ChatGPT's response
  addMessageToChat(aiResponse, "ai");
}

/**
 * Adds a message bubble to the chat panel.
 * @param {string} text - The message text to display
 * @param {string} sender - Either "user" or "ai"
 * @param {string} extraClass - Optional extra CSS class for the message
 */
function addMessageToChat(text, sender, extraClass = "") {
  const messages = document.getElementById("navi-messages");
  const messageDiv = document.createElement("div");

  messageDiv.className = `navi-message ${sender === "user" ? "navi-user-message" : "navi-ai-message"} ${extraClass}`;
  messageDiv.textContent = text;

  messages.appendChild(messageDiv);

  // Auto scroll to the latest message
  messages.scrollTop = messages.scrollHeight;
}

// ========================================================
// SECTION 6: INITIALIZE NAVI
// ========================================================

/**
 * Waits for the Google Sheets page to fully load before injecting NAVI.
 * Google Sheets is a heavy app and takes a moment to render completely.
 */
function initializeNAVI() {
  console.log("NAVI: Initializing...");
  createNaviUI();
  console.log("NAVI: Ready.");
}

// Wait 3 seconds after page load to make sure Google Sheets is fully rendered
setTimeout(initializeNAVI, 3000);