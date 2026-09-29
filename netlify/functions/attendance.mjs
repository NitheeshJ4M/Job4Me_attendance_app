export default async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      {
        success: false,
        message: "Method not allowed.",
      },
      { status: 405 },
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
          message: "This is not a valid learner ID.",
        },
        { status: 400 },
      );
    }

    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    const backendSecret = process.env.BACKEND_SECRET;

    if (!appsScriptUrl || !backendSecret) {
      throw new Error("Server configuration is incomplete.");
    }

    const url = new URL(appsScriptUrl);

    url.searchParams.set("action", "attendance");

    url.searchParams.set("learnerId", learnerId);

    url.searchParams.set("secret", backendSecret);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      redirect: "follow",
    });

    const text = await response.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Apps Script response: " + text.substring(0, 250));
    }

    return Response.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        title: "Connection Error",
        message: error.message || "Attendance could not be recorded.",
      },
      { status: 500 },
    );
  }
};
