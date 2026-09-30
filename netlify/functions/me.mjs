import { verifySession } from "./_auth.mjs";

export default async (request) => {
  if (!verifySession(request)) {
    return Response.json(
      {
        authenticated: false,
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return Response.json(
    {
      authenticated: true,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
};
