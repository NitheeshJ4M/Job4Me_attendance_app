export default async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      {
        success: false,
        message: "Method not allowed."
      },
      { status: 405 }
    );
  }

  try {
    const body = await request.json();
    const learnerId = String(body.learnerId || "").trim();

    // Adjust this later if your ID format changes.
    if (!/^J4M_\d{3,}$/.test(learnerId)) {
      return Response.json(
        {
          success: false,
          title: "❌ Invalid QR Code",
          name: learnerId,
          message: "This is not a valid learner ID."
        },
        { status: 400 }
      );
    }

    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    const backendSecret = process.env.BACKEND_SECRET;

    if (!appsScriptUrl || !backendSecret) {
      throw new Error("Server configuration is incomplete.");
    }

    const form = new URLSearchParams({
      learnerId,
      secret: backendSecret
    });

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: form.toString(),
      redirect: "follow"
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Google Apps Script returned an invalid response.");
    }

    return Response.json(result, {
      status: result.success ? 200 : 400
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        title: "Connection Error",
        message: "Attendance could not be recorded."
      },
      { status: 500 }
    );
  }
};
