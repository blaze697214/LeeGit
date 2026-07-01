document.addEventListener("DOMContentLoaded", () => {
    const username = document.getElementById("username");
    const repo = document.getElementById("repo");
    const branch = document.getElementById("branch");
    const token = document.getElementById("token");

    const saveBtn = document.getElementById("saveBtn");
    const syncBtn = document.getElementById("syncBtn");
    const status = document.getElementById("status");

    loadSettings();

    function loadSettings() {
        chrome.storage.local.get(
            ["githubUsername", "repoName", "branch", "token"],
            (result) => {
                username.value = result.githubUsername || "";
                repo.value = result.repoName || "";
                branch.value = result.branch || "main";
                token.value = result.token || "";
            }
        );
    }

    saveBtn.addEventListener("click", () => {
        chrome.storage.local.set({
            githubUsername: username.value.trim(),
            repoName: repo.value.trim(),
            branch: branch.value.trim() || "main",
            token: token.value.trim()
        }, () => {
            status.textContent = "Settings saved successfully.";
        });
    });

    syncBtn.addEventListener("click", () => {
        status.textContent = "Manual sync requested...";

        chrome.runtime.sendMessage({
            type: "MANUAL_SYNC"
        });
    });
});