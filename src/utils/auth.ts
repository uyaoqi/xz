import type { JWTPayload } from "jose";
import { jwtVerify, SignJWT } from "jose";

export const ADMIN_USERNAME = "admax";

export function hasMinimumPasswordBytes(password: string): boolean {
	return new TextEncoder().encode(password).byteLength >= 6;
}

export function getValidAdminAuthConfig(config: {
	password?: unknown;
	secret?: unknown;
}): { username: string; password: string; secret: string } | null {
	if (
		typeof config.password === "string" &&
		hasMinimumPasswordBytes(config.password) &&
		typeof config.secret === "string" &&
		config.secret.length >= 32
	) {
		return {
			username: ADMIN_USERNAME,
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
