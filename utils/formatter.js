// FIX #9: this file existed but was empty and unused - the real logic lived duplicated
// inline in background/worker.js. Moved here and now actually imported.

const EXTENSIONS = {
    "C++": "cpp",
    "Java": "java",
    "Python": "py",
    "Python3": "py",
    "JavaScript": "js",
    "C": "c",
    "C#": "cs",
    "Go": "go",
    "Rust": "rs",
    "SQL": "sql"
};

export function getFileExtension(language) {
    return EXTENSIONS[language] || "txt";
}

export function sanitizeTitle(title) {
    return title.replace(/[^\w\s]/g, "")
                .replace(/\s+/g, "_");
}

export function buildPaths(data) {
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

export function buildCodeContent(data) {
    const topics = data.topics.join(", ");

    return `// Problem: ${data.id}. ${data.title}
// Difficulty: ${data.difficulty}
// Topics: ${topics}

${data.code}`;
}

export function buildMetadata(data) {
    return JSON.stringify({
        id: data.id,
        title: data.title,
        difficulty: data.difficulty,
        topics: data.topics,
        language: data.language
    }, null, 2);
}
