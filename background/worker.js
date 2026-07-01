console.log("LeeGit worker loaded.");

function getFileExtension(language) {
    const extensions = {
        "C++": "cpp",
        "Java": "java",
        "Python": "py",
        "Python3": "py",
        "JavaScript": "js",
        "C": "c",
        "C#": "cs",
        "Go": "go",
        "Rust": "rs"
    };

    return extensions[language] || "txt";
}

function sanitizeTitle(title) {
    return title.replace(/[^\w\s]/g, "")
                .replace(/\s+/g, "_");
}

function buildPaths(data) {
    const ext = getFileExtension(data.language);
    const safeTitle = sanitizeTitle(data.title);
    const paddedId = String(data.id).padStart(4, "0");

    const codeFileName = `${paddedId}_${safeTitle}.${ext}`;
    const metadataFileName = `${paddedId}_${safeTitle}.json`;

    return {
        codePath: `${data.difficulty}/${codeFileName}`,
        metadataPath: `metadata/${metadataFileName}`
    };
}

function buildCodeContent(data) {
    const topics = data.topics.join(", ");

    return `// Problem: ${data.id}. ${data.title}
// Difficulty: ${data.difficulty}
// Topics: ${topics}

${data.code}`;
}

function buildMetadata(data) {
    return JSON.stringify({
        id: data.id,
        title: data.title,
        difficulty: data.difficulty,
        topics: data.topics,
        language: data.language
    }, null, 2);
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SYNC_DATA") {
        const data = message.payload;

        console.log("Received sync data:", data);

        const paths = buildPaths(data);
        const codeContent = buildCodeContent(data);
        const metadataContent = buildMetadata(data);

        console.log("Code Path:", paths.codePath);
        console.log("Metadata Path:", paths.metadataPath);
        console.log("Code Content:", codeContent);
        console.log("Metadata Content:", metadataContent);
    }
});

async function getGitHubConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            ["githubUsername", "repoName", "branch", "token"],
            (result) => resolve(result)
        );
    });
}

async function getFileSHA(config, path) {
    const url = `https://api.github.com/repos/${config.githubUsername}/${config.repoName}/contents/${path}`;

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
        throw new Error("Failed to fetch file SHA");
    }

    const data = await response.json();
    return data.sha;
}

async function uploadFile(config, path, content, commitMessage) {
    const url = `https://api.github.com/repos/${config.githubUsername}/${config.repoName}/contents/${path}`;

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
        throw new Error(errorText);
    }

    return await response.json();
}

async function syncToGitHub(data) {
    const config = await getGitHubConfig();

    const paths = buildPaths(data);
    const codeContent = buildCodeContent(data);
    const metadataContent = buildMetadata(data);

    await uploadFile(
        config,
        paths.codePath,
        codeContent,
        `Add solution for ${data.title}`
    );

    await uploadFile(
        config,
        paths.metadataPath,
        metadataContent,
        `Add metadata for ${data.title}`
    );

    console.log("Sync successful!");
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SYNC_DATA") {
        syncToGitHub(message.payload)
            .then(() => {
                console.log("GitHub sync completed.");
            })
            .catch((error) => {
                console.error("GitHub sync failed:", error);
            });
    }
});