console.log("LeeGit content script loaded.");

function getProblemTitle() {
    const titleElement = document.querySelector("div.text-title-large a");

    if (!titleElement) return null;

    return titleElement.innerText.trim();
}

function getProblemIdAndTitle() {
    const fullTitle = getProblemTitle();

    if (!fullTitle) {
        return { id: null, title: null };
    }

    const match = fullTitle.match(/^(\d+)\.\s(.+)$/);

    if (!match) {
        return { id: null, title: fullTitle };
    }

    return {
        id: parseInt(match[1]),
        title: match[2]
    };
}

// FIX #5: Previously scanned every single element on the page (document.querySelectorAll("*")),
// which could match "Easy"/"Medium"/"Hard" text sitting in unrelated widgets (recommended
// problems, sidebars, etc). Now scoped to the problem statement panel first, and falls back
// to a full-page scan only if that panel isn't found.
function getDifficulty() {
    const difficulties = ["Easy", "Medium", "Hard"];

    const scopeSelectors = [
        "[data-track-load='description_content']",
        "div.text-title-large", // near the title, difficulty badge usually lives close by
        "body"
    ];

    for (const scopeSelector of scopeSelectors) {
        const scope = document.querySelector(scopeSelector);
        if (!scope) continue;

        const candidates = scope.querySelectorAll("*");
        for (const el of candidates) {
            const text = el.innerText?.trim();
            if (difficulties.includes(text)) {
                return text;
            }
        }
    }

    return null;
}

function getTopics() {
    const topics = [];
    const topicElements = document.querySelectorAll("a[href*='/tag/']");

    topicElements.forEach(el => {
        const topic = el.innerText.trim();

        if (topic) {
            topics.push(topic);
        }
    });

    return [...new Set(topics)];
}

// FIX #7: was defined twice (identical copies) - now only exists once.
async function waitForEditor(maxRetries = 20) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const editors = document.querySelectorAll(".view-lines");

        for (const editor of editors) {
            const text = editor.innerText?.trim();

            if (text && text.length > 20) {
                return true;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return false;
}

// Scans the whole page for a language-name button. An earlier attempt scoped this to a
// guessed container (`[id^='editor']`) that doesn't actually wrap the language picker in
// LeetCode's current layout, which made this always return "Unknown" and silently made
// every synced file save as .txt. Reverted to a full-page scan, and now warns loudly if
// it still can't find a match instead of failing silently.
function getLanguage() {
    const languages = [
        "C++",
        "Java",
        "Python",
        "Python3",
        "JavaScript",
        "C",
        "C#",
        "Go",
        "Rust",
        "MySQL"
    ];

    const buttons = document.querySelectorAll("button");

    for (const btn of buttons) {
        const text = btn.innerText?.trim();

        if (languages.includes(text)) {
            return text;
        }
    }

    console.warn("LeeGit: could not detect language, falling back to .txt extension.");
    return "Unknown";
}

// Reads the code out of Monaco's rendered lines. Monaco splits each visual line into its
// own `.view-line` div, so we join them back together in DOM order and preserve blank lines.
function getCode() {
    const editors = document.querySelectorAll(".view-lines");

    let bestEditor = null;
    let bestLength = 0;

    for (const editor of editors) {
        const text = editor.innerText?.trim() || "";
        if (text.length > bestLength) {
            bestEditor = editor;
            bestLength = text.length;
        }
    }

    if (!bestEditor) return "";

    const lines = Array.from(bestEditor.querySelectorAll(".view-line"))
        .map(line => line.innerText.replace(/\u00A0/g, " "));

    return lines.length ? lines.join("\n") : bestEditor.innerText.trim();
}

async function extractAllData() {
    const editorReady = await waitForEditor();

    if (!editorReady) {
        console.log("Editor not loaded.");
        return null;
    }

    const problem = getProblemIdAndTitle();

    const data = {
        id: problem.id,
        title: problem.title,
        difficulty: getDifficulty(),
        topics: getTopics(),
        language: getLanguage(),
        code: getCode()
    };

    console.log("Extracted Data:", data);

    return data;
}

// FIX #2: Previously the popup sent this via chrome.runtime.sendMessage, which never reaches
// a content script. The popup now uses chrome.tabs.sendMessage(tabId, ...) targeting this
// tab directly, so this listener now actually receives MANUAL_SYNC.
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MANUAL_SYNC") {
        console.log("Manual sync triggered.");

        extractAllData().then(data => {
            if (!data) {
                chrome.runtime.sendMessage({
                    type: "SYNC_STATUS",
                    payload: { success: false, error: "Could not extract problem data (editor not ready)." }
                });
                return;
            }

            chrome.runtime.sendMessage({
                type: "SYNC_DATA",
                payload: data
            });
        });
    }
});

let submissionInProgress = false;
let autoSyncDone = false;

// FIX #6: was an exact string match against "Submit", which breaks if LeetCode renders the
// button with extra whitespace/icons/shortcut hints. Now normalizes the text before comparing,
// and excludes "Submissions" (the tab label) which also contains "Submit".
function detectSubmitButton() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest("button");

        if (!button) return;

        const normalized = button.innerText?.trim().toLowerCase().replace(/[^a-z]/g, "");

        if (normalized === "submit") {
            console.log("Submit clicked.");
            submissionInProgress = true;
            autoSyncDone = false;
        }
    });
}

// FIX #4: was `document.body.innerText.includes("Accepted")`, which can false-positive on
// unrelated text elsewhere on the page (e.g. "Accepted solutions" in the sidebar) and could
// fire before the real result panel renders. Now prefers LeetCode's actual submission-result
// element, and only falls back to the old body-text scan if that element isn't found.
function checkAcceptedStatus() {
    if (!submissionInProgress || autoSyncDone) {
        return;
    }

    const resultEl = document.querySelector("[data-e2e-locator='submission-result']");
    const resultText = resultEl ? resultEl.innerText?.trim() : null;

    const accepted = resultText
        ? resultText === "Accepted"
        : document.body.innerText.includes("Accepted"); // fallback if selector changes

    if (accepted) {
        console.log("Accepted detected.");

        autoSyncDone = true;
        submissionInProgress = false;

        extractAllData().then(data => {
            if (!data) return;

            chrome.runtime.sendMessage({
                type: "SYNC_DATA",
                payload: data
            });
        });
    }
}

const observer = new MutationObserver(() => {
    checkAcceptedStatus();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

detectSubmitButton();
