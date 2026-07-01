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

function getDifficulty() {
    const difficulties = ["Easy", "Medium", "Hard"];

    const allElements = document.querySelectorAll("*");

    for (const el of allElements) {
        const text = el.innerText?.trim();

        if (difficulties.includes(text)) {
            return text;
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
        "Rust"
    ];

    const buttons = document.querySelectorAll("button");

    for (const btn of buttons) {
        const text = btn.innerText?.trim();

        if (languages.includes(text)) {
            return text;
        }
    }

    return "Unknown";
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

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MANUAL_SYNC") {
        console.log("Manual sync triggered.");

        extractAllData().then(data => {
            if (!data) return;

            chrome.runtime.sendMessage({
                type: "SYNC_DATA",
                payload: data
            });
        });
    }
});

let submissionInProgress = false;
let autoSyncDone = false;

function detectSubmitButton() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest("button");

        if (!button) return;

        const text = button.innerText?.trim();

        if (text === "Submit") {
            console.log("Submit clicked.");
            submissionInProgress = true;
            autoSyncDone = false;
        }
    });
}
function checkAcceptedStatus() {
    if (!submissionInProgress || autoSyncDone) {
        return;
    }

    const bodyText = document.body.innerText;

    if (bodyText.includes("Accepted")) {
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