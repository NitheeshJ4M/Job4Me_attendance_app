import { createSessionCookie } from "./_auth.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return Response.json(
      {
        success: false,
        message: "Method not allowed.",
      },
      {
        status: 405,
      },
    );
  }

  try {
    const body = await request.json();

    const staffId = String(body.staffId || "").trim();

    const password = String(body.password || "");

    const expectedStaffId = process.env.STAFF_ID;

    const expectedPassword = process.env.STAFF_PASSWORD;

    if (!expectedStaffId || !expectedPassword) {
      return Response.json(
        {
          success: false,
          message: "Login has not been configured.",
        },
        {
          status: 500,
        },
      );
    }

    if (staffId !== expectedStaffId || password !== expectedPassword) {
      return Response.json(
        {
          success: false,
          message: "Incorrect Staff ID or password.",
        },
        {
          status: 401,
        },
      );
    }

    return Response.json(
      {
        success: true,
      },
      {
        status: 200,

        headers: {
          "Set-Cookie": createSessionCookie(staffId),

          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        message: "Login failed.",
      },
      {
        status: 500,
      },
    );
  }
};
