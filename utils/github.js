// FIX #9: real GitHub API logic moved out of worker.js into its own module.
// FIX #3: getFileSHA now passes ?ref=<branch>, so it checks the SHA on the branch the user
// actually configured instead of always defaulting to the repo's default branch.

function contentsUrl(config, path) {
    return `https://api.github.com/repos/${config.githubUsername}/${config.repoName}/contents/${path}`;
}

export async function getFileSHA(config, path) {
    const branch = config.branch || "main";
    const url = `${contentsUrl(config, path)}?ref=${encodeURIComponent(branch)}`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json"
        }
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch file SHA (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    return data.sha;
}

export async function uploadFile(config, path, content, commitMessage) {
    const url = contentsUrl(config, path);

    const sha = await getFileSHA(config, path);

    const body = {
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: config.branch || "main"
    };

    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed for ${path} (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return { ...result, wasNewFile: sha === null };
}

// FIX #13: used for best-effort rollback - if the metadata upload fails right after the code
// upload succeeded, and the code file was brand new (not an overwrite of an existing solution),
// delete it again so a partial/broken sync doesn't sit in the repo silently.
export async function deleteFile(config, path, sha, commitMessage) {
    const url = contentsUrl(config, path);

    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: commitMessage,
            sha,
            branch: config.branch || "main"
        })
    });

    if (!response.ok) {
        console.error(`Rollback delete failed for ${path}:`, await response.text());
    }
}
