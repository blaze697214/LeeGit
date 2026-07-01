// FIX #9: shared storage helper, now actually used instead of duplicating
// chrome.storage.local calls in popup.js and worker.js.

export function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            ["githubUsername", "repoName", "branch", "token"],
            (result) => resolve(result)
        );
    });
}

export function saveSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.local.set(settings, () => resolve());
    });
}

// FIX #12: centralized validation so both popup (on save) and background (before syncing)
// can reject incomplete config with a clear message instead of a bare GitHub 404/401.
export function validateSettings(settings) {
    const missing = [];

    if (!settings.githubUsername) missing.push("GitHub Username");
    if (!settings.repoName) missing.push("Repository Name");
    if (!settings.token) missing.push("GitHub Token");

    return {
        valid: missing.length === 0,
        missing
    };
}
