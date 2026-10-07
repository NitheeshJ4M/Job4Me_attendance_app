const systemStatus = document.getElementById("systemStatus");

const enteredDigits = document.getElementById("enteredDigits");

const numberButtons = document.querySelectorAll(".number-button");

const clearButton = document.getElementById("clearButton");

const backspaceButton = document.getElementById("backspaceButton");

const submitButton = document.getElementById("submitButton");

const logoutButton = document.getElementById("logoutButton");

const resultCard = document.getElementById("resultCard");

const resultIcon = document.getElementById("resultIcon");

const resultTitle = document.getElementById("resultTitle");

const resultName = document.getElementById("resultName");

const resultDetail = document.getElementById("resultDetail");

const API_URL = "/.netlify/functions/attendance";

let digits = "";

let processingAttendance = false;

let resultTimer = null;

let activeSpeech = null;

let speechTimer = null;

/* -----------------------------------
   START
----------------------------------- */

checkAuthentication();

updateDisplay();

// Number buttons

numberButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const number = button.getAttribute("data-number");

    addNumber(number);
  });
});

// Clear

clearButton.addEventListener("click", clearNumber);

// Backspace

backspaceButton.addEventListener("click", removeLastNumber);

// Submit

submitButton.addEventListener("click", submitAttendance);

// Logout

logoutButton.addEventListener("click", logout);

// Helps recover speech after
// switching apps / locking device

document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && "speechSynthesis" in window) {
    window.speechSynthesis.resume();
  }
});

/* -----------------------------------
   NUMBER PAD
----------------------------------- */

function addNumber(number) {
  if (processingAttendance) {
    return;
  }

  // Maximum 6 digits.
  // Change this if you ever need more.

  if (digits.length >= 6) {
    return;
  }

  digits += number;

  updateDisplay();

  hideResult();
}

function removeLastNumber() {
  if (processingAttendance) {
    return;
  }

  digits = digits.slice(0, -1);

  updateDisplay();
}

function clearNumber() {
  if (processingAttendance) {
    return;
  }

  digits = "";

  updateDisplay();

  hideResult();
}

function updateDisplay() {
  if (!digits) {
    enteredDigits.textContent = "---";

    return;
  }

  enteredDigits.textContent = digits;
}

/* -----------------------------------
   SUBMIT ATTENDANCE
----------------------------------- */

async function submitAttendance() {
  if (processingAttendance) {
    return;
  }

  /*
    Learner IDs currently require
    at least 3 digits:

    J4M_001
    J4M_049
    J4M_123
  */

  if (digits.length < 3) {
    showResult({
      type: "error",
      title: "Invalid learner number",
      name: "",
      detail: "Please enter at least 3 numbers.",
    });

    setSystemStatus("Invalid number");

    return;
  }

  const learnerId = "J4M_" + digits;

  processingAttendance = true;

  setControlsDisabled(true);

  setSystemStatus("Recording...");

  try {
    const result = await sendAttendanceToBackend(learnerId);

    showResult({
      type: result.success ? "success" : "error",

      title: result.title || "Attendance updated",

      name: result.name || learnerId,

      detail: result.time
        ? (result.session ? result.session + " • " : "") + result.time
        : result.message || "",

      birthday: result.birthday === true,
    });

    if (result.success) {
      setSystemStatus(
        result.action === "checkout" ? "Checked out" : "Checked in",
      );

      /*
        Voice announcement
      */

      speakAttendance(result);

      /*
        Clear ID immediately so
        next learner can enter theirs.
      */

      digits = "";

      updateDisplay();
    } else {
      setSystemStatus("Not recorded");
    }
  } catch (error) {
    console.error(error);

    showResult({
      type: "error",

      title: "Attendance was not recorded",

      name: learnerId,

      detail: error.message || "Please try again.",
    });

    setSystemStatus("Connection error");
  }

  processingAttendance = false;

  setControlsDisabled(false);

  /*
    Automatically hide popup
    after 3 seconds.
  */

  clearTimeout(resultTimer);

  resultTimer = setTimeout(function () {
    hideResult();

    setSystemStatus("Ready");
  }, 3000);
}

/* -----------------------------------
   SEND TO NETLIFY
----------------------------------- */

async function sendAttendanceToBackend(learnerId) {
  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      learnerId: learnerId,
    }),
  });

  let result = null;

  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  /*
    Authentication expired
  */

  if (response.status === 401) {
    window.location.replace("/");

    throw new Error("Your login session has expired.");
  }

  if (!response.ok || !result) {
    throw new Error(
      result && result.message
        ? result.message
        : "Attendance server returned " + response.status,
    );
  }

  return result;
}

/* -----------------------------------
   RESULT POPUP
----------------------------------- */

function showResult(options) {
  clearTimeout(resultTimer);

  const type = options.type;

  const title = options.title;

  const name = options.name;

  const detail = options.detail;

  const birthday = options.birthday === true;

  resultCard.classList.remove("hidden", "success", "error");

  resultCard.classList.add(type === "error" ? "error" : "success");

  if (birthday) {
    resultIcon.textContent = "🎂";
  } else {
    resultIcon.textContent = type === "error" ? "×" : "✓";
  }

  resultTitle.textContent = title || "";

  resultName.textContent = name || "";

  resultDetail.textContent = detail || "";
}

/* -----------------------------------
   HIDE RESULT
----------------------------------- */

function hideResult() {
  resultCard.classList.add("hidden");

  resultCard.classList.remove("success", "error");
}

/* -----------------------------------
   STATUS
----------------------------------- */

function setSystemStatus(text) {
  systemStatus.textContent = text;
}

/* -----------------------------------
   DISABLE BUTTONS WHILE RECORDING
----------------------------------- */

function setControlsDisabled(disabled) {
  submitButton.disabled = disabled;

  clearButton.disabled = disabled;

  backspaceButton.disabled = disabled;

  numberButtons.forEach(function (button) {
    button.disabled = disabled;
  });
}

/* -----------------------------------
   VOICE
----------------------------------- */

function speakAttendance(result) {
  if (!("speechSynthesis" in window)) {
    console.warn("Text-to-speech is not supported.");

    return;
  }

  const firstName = String(result.name || "")
    .trim()
    .split(/\s+/)[0];

  let message = "";

  /*
    Check in
  */

  if (result.action === "checkin") {
    if (result.birthday === true) {
      message =
        "Happy birthday " +
        firstName +
        "! Welcome. " +
        "We hope you have a wonderful day.";
    } else {
      message = "Welcome " + firstName + ". Please sign in.";
    }
  }

  /*
    Check out
  */

  if (result.action === "checkout") {
    message = "Goodbye " + firstName + ". Please sign out.";
  }

  if (!message) {
    return;
  }

  /*
    Clear any previous timer
  */

  if (speechTimer) {
    clearTimeout(speechTimer);

    speechTimer = null;
  }

  /*
    Reset mobile speech engine.

    cancel + resume + short delay
    is more reliable on phones
    and tablets.
  */

  window.speechSynthesis.cancel();

  window.speechSynthesis.resume();

  speechTimer = setTimeout(function () {
    playSpeech(message, false);
  }, 180);
}

/* -----------------------------------
   PLAY SPEECH
----------------------------------- */

function playSpeech(message, isRetry) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.resume();

  activeSpeech = new SpeechSynthesisUtterance(message);

  activeSpeech.lang = "en-GB";

  activeSpeech.rate = 0.95;

  activeSpeech.pitch = 1;

  activeSpeech.volume = 1;

  /*
    Select an English UK voice
    if the device has one.
  */

  const voices = window.speechSynthesis.getVoices();

  let selectedVoice = null;

  for (let i = 0; i < voices.length; i++) {
    const language = String(voices[i].lang || "").toLowerCase();

    if (language.indexOf("en-gb") === 0) {
      selectedVoice = voices[i];

      break;
    }
  }

  if (selectedVoice) {
    activeSpeech.voice = selectedVoice;
  }

  /*
    Speech started
  */

  activeSpeech.onstart = function () {
    console.log("Speech started");
  };

  /*
    Speech completed
  */

  activeSpeech.onend = function () {
    console.log("Speech finished");

    activeSpeech = null;
  };

  /*
    If mobile speech engine
    randomly fails, try once.
  */

  activeSpeech.onerror = function (event) {
    console.warn("Speech error:", event.error);

    activeSpeech = null;

    /*
        Do not retry intentional
        cancel/interruption events.
      */

    if (
      !isRetry &&
      event.error !== "canceled" &&
      event.error !== "interrupted"
    ) {
      setTimeout(function () {
        window.speechSynthesis.cancel();

        window.speechSynthesis.resume();

        setTimeout(function () {
          playSpeech(message, true);
        }, 200);
      }, 250);
    }
  };

  /*
    Start voice
  */

  try {
    window.speechSynthesis.speak(activeSpeech);
  } catch (error) {
    console.error("Speech failed:", error);

    activeSpeech = null;
  }
}

/* -----------------------------------
   AUTHENTICATION
----------------------------------- */

async function checkAuthentication() {
  try {
    const response = await fetch("/.netlify/functions/me", {
      cache: "no-store",
    });

    if (!response.ok) {
      window.location.replace("/");
    }
  } catch (error) {
    console.error(error);

    window.location.replace("/");
  }
}

/* -----------------------------------
   LOGOUT
----------------------------------- */

async function logout() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  try {
    await fetch("/.netlify/functions/logout", {
      method: "POST",
    });
  } catch (error) {
    console.error(error);
  }

  window.location.replace("/");
}
