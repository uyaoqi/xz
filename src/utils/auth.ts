import type { JWTPayload } from "jose";
import { jwtVerify, SignJWT } from "jose";

export function getValidAdminAuthConfig(config: {
	username?: unknown;
	password?: unknown;
	secret?: unknown;
}): { username: string; password: string; secret: string } | null {
	if (
		typeof config.username === "string" &&
		config.username.length >= 6 &&
		typeof config.password === "string" &&
		config.password.length >= 6 &&
		typeof config.secret === "string" &&
		config.secret.length >= 32
	) {
		return {
			username: config.username,
			password: config.password,
			secret: config.secret,
		};
	}
	return null;
}

export async function getCredentialVersion(
	username: string,
	password: string,
	secret: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${username}\0${password}`),
	);
	return Array.from(new Uint8Array(signature), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

export async function createToken(
	payload: { username: string; credentialVersion: string },
	secret: string,
): Promise<string> {
	return await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("7d")
		.sign(new TextEncoder().encode(secret));
}

export async function verifyToken(
	token: string,
	secret: string,
	expected?: { username: string; credentialVersion: string },
): Promise<JWTPayload | null> {
	try {
		const { payload } = await jwtVerify(
			token,
			new TextEncoder().encode(secret),
		);
		if (
			expected &&
			(payload.username !== expected.username ||
				payload.credentialVersion !== expected.credentialVersion)
		) {
			return null;
		}
		return payload;
	} catch {
		return null;
	}
}
