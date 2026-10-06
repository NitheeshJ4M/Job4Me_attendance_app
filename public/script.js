const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const systemStatus = document.getElementById("systemStatus");

const resultCard = document.getElementById("resultCard");
const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultName = document.getElementById("resultName");
const resultDetail = document.getElementById("resultDetail");
const logoutButton = document.getElementById("logoutButton");

const API_URL = "/.netlify/functions/attendance";

let scanner = null;
let scannerRunning = false;
let processingScan = false;

let lastScannedCode = "";
let lastScannedAt = 0;

startButton.addEventListener("click", startScanner);
stopButton.addEventListener("click", stopScanner);

// =====================================================
// START CAMERA
// =====================================================

async function startScanner() {
  if (scannerRunning) return;

  hideResult();
  setSystemStatus("Starting camera...");

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      {
        facingMode: "user",
      },
      {
        fps: 15,
        aspectRatio: 1.333333,
      },
      handleQrSuccess,
      () => {
        // Ignore normal scanning errors
      },
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
      detail: "Please allow camera permission to use the scanner.",
    });

    setSystemStatus("Camera error");
  }
}

// =====================================================
// STOP CAMERA
// =====================================================

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

// =====================================================
// QR SUCCESS
// =====================================================

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

  // Prevent the same learner being scanned
  // twice immediately.

  if (learnerId === lastScannedCode && now - lastScannedAt < 15000) {
    return;
  }

  lastScannedCode = learnerId;
  lastScannedAt = now;

  processingScan = true;

  setSystemStatus("Recording attendance...");

  // Show immediate feedback

  showResult({
    type: "success",
    title: "QR detected",
    name: learnerId,
    detail: "Recording attendance...",
  });

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

      birthday: result.birthday === true,
    });

    // Speak only if attendance succeeded

    if (result.success) {
      speakAttendance(result);
    }
  } catch (error) {
    console.error(error);

    showResult({
      type: "error",
      title: "Attendance was not recorded",
      name: learnerId,
      detail: error.message || "Please try again.",
    });
  }

  // Return to camera after confirmation

  window.setTimeout(resetScanner, 2500);
}

// =====================================================
// READ LEARNER ID FROM QR
// =====================================================

function extractLearnerId(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  // Supports old QR codes containing URLs
  // such as ?id=J4M_001

  try {
    const url = new URL(text);

    const idFromUrl = url.searchParams.get("id");

    if (idFromUrl) {
      return idFromUrl.trim();
    }
  } catch {
    // Not a URL.
    // Use the QR contents directly.
  }

  return text;
}

// =====================================================
// SEND ATTENDANCE TO NETLIFY FUNCTION
// =====================================================

async function sendAttendanceToBackend(learnerId) {
  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      learnerId,
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result) {
    throw new Error(
      result?.message || `Attendance server returned ${response.status}`,
    );
  }

  return result;
}

// =====================================================
// PAUSE CAMERA
// =====================================================

async function pauseScanner() {
  if (!scanner || !scannerRunning) {
    return;
  }

  try {
    scanner.pause(true);
  } catch (error) {
    console.warn("Could not pause scanner:", error);
  }
}

// =====================================================
// RESET CAMERA AFTER CHECK-IN / CHECK-OUT
// =====================================================

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

// =====================================================
// SHOW RESULT
// =====================================================

function showResult({ type, title, name, detail, birthday = false }) {
  resultCard.classList.remove("hidden", "success", "error");

  resultCard.classList.add(type === "error" ? "error" : "success");

  // Special birthday icon

  if (birthday) {
    resultIcon.textContent = "🎂";
  } else {
    resultIcon.textContent = type === "error" ? "×" : "✓";
  }

  resultTitle.textContent = title;

  resultName.textContent = name || "";

  resultDetail.textContent = detail || "";

  resultCard.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

// =====================================================
// HIDE RESULT
// =====================================================

function hideResult() {
  resultCard.classList.add("hidden");

  resultCard.classList.remove("success", "error");
}

// =====================================================
// SYSTEM STATUS
// =====================================================

function setSystemStatus(text) {
  systemStatus.textContent = text;
}

// =====================================================
// VOICE ANNOUNCEMENT
// =====================================================

function speakAttendance(result) {
  // Check whether browser supports
  // text-to-speech

  if (!("speechSynthesis" in window)) {
    console.warn("Text-to-speech is not supported.");

    return;
  }

  // Stop previous announcement

  window.speechSynthesis.cancel();

  let message = "";

  // ===================================================
  // CHECK IN
  // ===================================================
  const firstName = String(result.name || "")
    .trim()
    .split(/\s+/)[0];
  if (result.action === "checkin") {
    // Birthday check-in
    if (result.birthday === true) {
      message =
        `Happy birthday ${firstName}! ` +
        `Welcome. ` +
        `We hope you have a wonderful day.`;
    }

    // Normal check-in
    else {
      message = `Welcome ${firstName}.` + `Please Sign in`;
    }
  }

  // Check-out
  if (result.action === "checkout") {
    message = `Goodbye ${firstName}. ` + `Please Sign Out.`;
  }

  if (!message) return;

  const speech = new SpeechSynthesisUtterance(message);

  // British English

  speech.lang = "en-GB";

  // Slightly slower for clarity

  speech.rate = 0.95;

  speech.pitch = 1;

  speech.volume = 1;

  window.speechSynthesis.speak(speech);
}

// Check Authentication
checkAuthentication();

async function checkAuthentication() {
  try {
    const response = await fetch("/.netlify/functions/me", {
      cache: "no-store",
    });

    if (!response.ok) {
      window.location.replace("/");
    }
  } catch {
    window.location.replace("/");
  }
}

// Logout

logoutButton?.addEventListener("click", logout);

async function logout() {
  await fetch("/.netlify/functions/logout", {
    method: "POST",
  });

  window.location.replace("/");
}
