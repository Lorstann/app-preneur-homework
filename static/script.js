const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const conversionType = document.getElementById("conversionType");
const convertBtn = document.getElementById("convertBtn");
const resultBox = document.getElementById("result");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const fileIcon = document.getElementById("fileIcon");
const historyList = document.getElementById("historyList");
const themeToggle = document.getElementById("themeToggle");

const HISTORY_KEY = "fch_recent_history";
const THEME_KEY = "fch_theme";
let selectedFile = null;

function humanFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickIcon(name) {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "🖼️";
    if (ext === "txt") return "📝";
    if (ext === "csv") return "📊";
    if (ext === "json") return "🧾";
    if (ext === "pdf") return "📄";
    return "📁";
}

function showSelectedFile(file) {
    selectedFile = file;
    fileInfo.classList.remove("hidden");
    fileName.textContent = file.name;
    fileSize.textContent = `(${humanFileSize(file.size)})`;
    fileIcon.textContent = pickIcon(file.name);
}

function showResult(message, ok, downloadUrl = null, outputName = "") {
    resultBox.classList.remove("hidden", "success", "error");
    resultBox.classList.add(ok ? "success" : "error");

    if (ok && downloadUrl) {
        resultBox.innerHTML = `${message} <a href="${downloadUrl}">Download ${outputName}</a>`;
    } else {
        resultBox.textContent = message;
    }
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    historyList.innerHTML = "";
    if (!history.length) {
        historyList.innerHTML = "<li>No conversions yet.</li>";
        return;
    }

    history.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.time} - ${entry.type} - ${entry.file}`;
        historyList.appendChild(li);
    });
}

function addHistory(type, file) {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    history.unshift({
        type,
        file,
        time: new Date().toLocaleString(),
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 6)));
    loadHistory();
}

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("active");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("active");
});

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("active");
    const file = event.dataTransfer.files[0];
    if (file) showSelectedFile(file);
});

fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) showSelectedFile(file);
});

convertBtn.addEventListener("click", async () => {
    if (!selectedFile) {
        showResult("Please choose a file first.", false);
        return;
    }
    if (!conversionType.value) {
        showResult("Please select a conversion type.", false);
        return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("conversion_type", conversionType.value);

    convertBtn.disabled = true;
    convertBtn.textContent = "Converting...";

    try {
        const response = await fetch("/convert", {
            method: "POST",
            body: formData,
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            showResult(data.message || "Conversion failed.", false);
        } else {
            showResult(data.message, true, data.download_url, data.output_filename);
            addHistory(conversionType.options[conversionType.selectedIndex].text, selectedFile.name);
        }
    } catch (error) {
        showResult("Server error. Please try again.", false);
    } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = "Convert File";
    }
});

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
});

// Load saved theme and recent conversion entries on startup.
(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark") {
        document.body.classList.add("dark");
    }
    loadHistory();
})();
