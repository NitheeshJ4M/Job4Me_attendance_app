const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const systemStatus = document.getElementById("systemStatus");

const resultCard = document.getElementById("resultCard");
const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultName = document.getElementById("resultName");
const resultDetail = document.getElementById("resultDetail");

const API_URL = "/.netlify/functions/attendance";

let scanner = null;
let scannerRunning = false;
let processingScan = false;

let lastScannedCode = "";
let lastScannedAt = 0;

startButton.addEventListener("click", startScanner);
stopButton.addEventListener("click", stopScanner);

async function startScanner() {
  if (scannerRunning) return;

  hideResult();
  setSystemStatus("Starting camera...");

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 15,
        qrbox: { width: 300, height: 300 },
      },
      handleQrSuccess,
      () => {},
    );

    scannerRunning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    setSystemStatus("Camera ready");
  } catch (error) {
    console.error(error);

    scanner = null;
    scannerRunning = false;

    showResult({
      type: "error",
      title: "Camera could not start",
      name: "",
      detail: "Allow camera permission and use the deployed HTTPS site.",
    });

    setSystemStatus("Camera error");
  }
}

async function stopScanner() {
  if (!scanner || !scannerRunning) return;

  try {
    await scanner.stop();
    scanner.clear();
  } catch (error) {
    console.error(error);
  }

  scanner = null;
  scannerRunning = false;
  processingScan = false;

  startButton.disabled = false;
  stopButton.disabled = true;
  setSystemStatus("Stopped");
}

async function handleQrSuccess(decodedText) {
  if (processingScan) return;

  const learnerId = extractLearnerId(decodedText);

  if (!learnerId) {
    showResult({
      type: "error",
      title: "Invalid QR code",
      name: "",
      detail: "No learner ID was found.",
    });
    return;
  }

  const now = Date.now();

  // Prevent the same QR from immediately checking the learner back out.
  if (learnerId === lastScannedCode && now - lastScannedAt < 15000) {
    return;
  }

  lastScannedCode = learnerId;
  lastScannedAt = now;
  processingScan = true;

  setSystemStatus("Recording attendance...");
  await pauseScanner();

  try {
    const result = await sendAttendanceToBackend(learnerId);

    showResult({
      type: result.success ? "success" : "error",
      title: result.title || "Attendance updated",
      name: result.name || learnerId,
      detail: result.time
        ? `${result.session ? result.session + " • " : ""}${result.time}`
        : result.message || "",
    });
  } catch (error) {
    console.error(error);

    showResult({
      type: "error",
      title: "Attendance was not recorded",
      name: learnerId,
      detail: error.message || "Please try again.",
    });
  }

  window.setTimeout(resetScanner, 3000);
}

function extractLearnerId(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  try {
    const url = new URL(text);
    const idFromUrl = url.searchParams.get("id");

    if (idFromUrl) return idFromUrl.trim();
  } catch {
    // The QR is not a URL. Use its contents as the learner ID.
  }

  return text;
}

async function sendAttendanceToBackend(learnerId) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ learnerId }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result) {
    throw new Error(
      result?.message || `Attendance server returned ${response.status}`,
    );
  }

  return result;
}

async function pauseScanner() {
  if (!scanner || !scannerRunning) return;

  try {
    scanner.pause(true);
  } catch (error) {
    console.warn("Could not pause scanner:", error);
  }
}

function resetScanner() {
  hideResult();
  processingScan = false;

  if (scanner && scannerRunning) {
    try {
      scanner.resume();
      setSystemStatus("Camera ready");
    } catch (error) {
      console.warn(error);
      setSystemStatus("Ready");
    }
  }
}

function showResult({ type, title, name, detail }) {
  resultCard.classList.remove("hidden", "success", "error");
  resultCard.classList.add(type === "error" ? "error" : "success");

  resultIcon.textContent = type === "error" ? "×" : "✓";
  resultTitle.textContent = title;
  resultName.textContent = name || "";
  resultDetail.textContent = detail || "";

  resultCard.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function hideResult() {
  resultCard.classList.add("hidden");
  resultCard.classList.remove("success", "error");
}

function setSystemStatus(text) {
  systemStatus.textContent = text;
}
