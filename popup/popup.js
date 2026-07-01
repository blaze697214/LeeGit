import { getSettings, saveSettings, validateSettings } from "../utils/storage.js";

document.addEventListener("DOMContentLoaded", () => {
    const username = document.getElementById("username");
    const repo = document.getElementById("repo");
    const branch = document.getElementById("branch");
    const token = document.getElementById("token");

    const saveBtn = document.getElementById("saveBtn");
    const syncBtn = document.getElementById("syncBtn");
    const status = document.getElementById("status");

    loadSettings();

    async function loadSettings() {
        const result = await getSettings();
        username.value = result.githubUsername || "";
        repo.value = result.repoName || "";
        branch.value = result.branch || "main";
        token.value = result.token || "";
    }

    saveBtn.addEventListener("click", async () => {
        const settings = {
            githubUsername: username.value.trim(),
            repoName: repo.value.trim(),
            branch: branch.value.trim() || "main",
            token: token.value.trim()
        };

        // FIX #12: validate before saving so the user gets an immediate, specific error
        // instead of finding out only when a sync later fails.
        const { valid, missing } = validateSettings(settings);
        if (!valid) {
            status.textContent = `Missing: ${missing.join(", ")}`;
            status.style.color = "#ff6b6b";
            return;
        }

        await saveSettings(settings);
        status.textContent = "Settings saved successfully.";
        status.style.color = "";
    });

    syncBtn.addEventListener("click", async () => {
        status.textContent = "Manual sync requested...";
        status.style.color = "";

        // FIX #2: chrome.runtime.sendMessage never reaches a content script. We need to find
        // the active LeetCode tab and message it directly with chrome.tabs.sendMessage.
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url || !tab.url.includes("leetcode.com/problems/")) {
            status.textContent = "Open a LeetCode problem page first.";
            status.style.color = "#ff6b6b";
            return;
        }

        chrome.tabs.sendMessage(tab.id, { type: "MANUAL_SYNC" }).catch(() => {
            status.textContent = "Could not reach the page - try reloading it.";
            status.style.color = "#ff6b6b";
        });
    });

    // FIX #11: show real success/failure instead of a static "requested..." message
    // that never updates.
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type !== "SYNC_STATUS") return;

        const { success, message: text, error } = message.payload;
        status.textContent = success ? text : (error || text);
        status.style.color = success ? "#4caf50" : "#ff6b6b";
    });
});
