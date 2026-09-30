import crypto from "node:crypto";

const COOKIE_NAME = "j4m_session";

const SESSION_SECONDS = 10 * 60 * 60;

function sign(value) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionCookie(staffId) {
  const data = {
    staffId,
    expires: Date.now() + SESSION_SECONDS * 1000,
  };

  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");

  const signature = sign(payload);

  const token = `${payload}.${signature}`;

  return (
    `${COOKIE_NAME}=${token}; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=Strict; ` +
    `Path=/; ` +
    `Max-Age=${SESSION_SECONDS}`
  );
}

function getSessionToken(request) {
  const cookies = request.headers.get("cookie") || "";

  const parts = cookies.split(";").map((value) => value.trim());

  const sessionCookie = parts.find((value) =>
    value.startsWith(`${COOKIE_NAME}=`),
  );

  if (!sessionCookie) {
    return "";
  }

  return sessionCookie.substring(COOKIE_NAME.length + 1);
}

export function verifySession(request) {
  try {
    const token = getSessionToken(request);

    if (!token) {
      return false;
    }

    const [payload, suppliedSignature] = token.split(".");

    if (!payload || !suppliedSignature) {
      return false;
    }

    const expectedSignature = sign(payload);

    const suppliedBuffer = Buffer.from(suppliedSignature);

    const expectedBuffer = Buffer.from(expectedSignature);

    if (suppliedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    if (!crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
      return false;
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );

    if (session.expires < Date.now()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function clearSessionCookie() {
  return (
    `${COOKIE_NAME}=; ` +
    `HttpOnly; ` +
    `Secure; ` +
    `SameSite=Strict; ` +
    `Path=/; ` +
    `Max-Age=0`
  );
}
