import { clearSessionCookie } from "./_auth.mjs";

export default async () => {
  return Response.json(
    {
      success: true,
    },
    {
      status: 200,

      headers: {
        "Set-Cookie": clearSessionCookie(),

        "Cache-Control": "no-store",
      },
    },
  );
};
