import crypto from "node:crypto";

export const createApiKey = () => `flog_${crypto.randomBytes(32).toString("base64url")}`;

export const hashApiKey = (apiKey: string) => crypto.createHash("sha256").update(apiKey).digest("hex");
