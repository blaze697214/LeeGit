import { buildPaths, buildCodeContent, buildMetadata } from "../utils/formatter.js";
import { uploadFile, deleteFile } from "../utils/github.js";
import { getSettings, validateSettings } from "../utils/storage.js";

console.log("LeeGit worker loaded.");

// FIX #8: there used to be two separate `chrome.runtime.onMessage.addListener` blocks both
// matching "SYNC_DATA" - one that only logged the payload and did nothing, and one that
// actually synced. Both fired on every message. Merged into a single listener below.

async function syncToGitHub(data) {
    const config = await getSettings();

    // FIX #12: validate before hitting the API instead of letting a blank token/repo
    // surface as an opaque 401/404 from GitHub.
    const { valid, missing } = validateSettings(config);
    if (!valid) {
        throw new Error(`Missing settings: ${missing.join(", ")}. Open the popup and save your settings first.`);
    }

    if (!data.id || !data.title) {
        throw new Error("Could not read problem id/title from the page - try re-syncing after the page finishes loading.");
    }

    const paths = buildPaths(data);
    const codeContent = buildCodeContent(data);
    const metadataContent = buildMetadata(data);

    const codeResult = await uploadFile(
        config,
        paths.codePath,
        codeContent,
        `Add solution for ${data.title}`
    );

    try {
        await uploadFile(
            config,
            paths.metadataPath,
            metadataContent,
            `Add metadata for ${data.title}`
        );
    } catch (metadataError) {
        // FIX #13: best-effort rollback. Only delete the code file if we just created it
        // (wasNewFile) - if it already existed, deleting it would destroy a prior working
        // solution just because the metadata write failed.
        if (codeResult.wasNewFile) {
            await deleteFile(
                config,
                paths.codePath,
                codeResult.content.sha,
                `Rollback: metadata upload failed for ${data.title}`
            );
        }
        throw new Error(`Code uploaded but metadata failed, so the code file was rolled back: ${metadataError.message}`);
    }

    console.log("Sync successful!");
}

// FIX #11: report success/failure back to the popup instead of only console.log,
// so the UI can actually show the user what happened.
function notifyStatus(success, message) {
    chrome.runtime.sendMessage({
        type: "SYNC_STATUS",
        payload: { success, message }
    }).catch(() => {
        // popup may be closed - that's fine, nothing to update.
    });
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "SYNC_DATA") return;

    const data = message.payload;
    console.log("Received sync data:", data);

    syncToGitHub(data)
        .then(() => {
            notifyStatus(true, `Synced "${data.title}" to GitHub.`);
        })
        .catch((error) => {
            console.error("GitHub sync failed:", error);
            notifyStatus(false, error.message || "Sync failed.");
        });
});
