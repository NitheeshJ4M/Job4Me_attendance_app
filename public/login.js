const loginForm = document.getElementById("loginForm");

const staffIdInput = document.getElementById("staffId");

const passwordInput = document.getElementById("password");

const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginMessage.textContent = "Signing in...";

  try {
    const response = await fetch("/.netlify/functions/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        staffId: staffIdInput.value.trim(),

        password: passwordInput.value,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      loginMessage.textContent =
        result?.message || "Incorrect Staff ID or password.";

      return;
    }

    window.location.replace("/scanner.html");
  } catch (error) {
    console.error(error);

    loginMessage.textContent = "Could not connect to the login server.";
  }
});
