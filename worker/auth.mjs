import { createRemoteJWKSet, jwtVerify } from "jose";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export const addresses = value => String(value || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export async function verifyGoogleToken(token, clientId, keys = googleKeys) {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"], audience: clientId,
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    requiredClaims: ["exp", "sub", "email", "email_verified"]
  });
  if (payload.email_verified !== true || typeof payload.email !== "string") throw new Error("Unverified email");
  return { epost: payload.email.toLowerCase(), navn: String(payload.name || payload.email).slice(0, 200) };
}

export async function authenticate(req, env) {
  const token = /^Bearer (\S+)$/i.exec(req.headers.get("authorization") || "")?.[1];
  if (!token || !env.GOOGLE_CLIENT_ID) return null;
  try {
    const user = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
    return addresses(env.ADMIN_EPOSTER).includes(user.epost) ? user : null;
  } catch { return null; }
}
