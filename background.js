// background.js
// Handles OAuth token retrieval and Google Sheets API write calls
// Runs as a service worker — content.js sends messages here to edit cells

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "editCell") {
    handleEditCell(message)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

async function handleEditCell({ spreadsheetId, sheetName, cellAddress, newValue }) {
  try {
    // Get OAuth token — prompts user to sign in if not already authenticated
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    const range = `${sheetName}!${cellAddress}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        range: range,
        values: [[newValue]]
      })
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error.message };
  }
}