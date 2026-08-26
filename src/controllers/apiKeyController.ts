import type { RequestHandler } from "express";
import { generateApiKey, listApiKeys, revokeApiKey } from "../services/apiKeyService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const generate: RequestHandler = asyncHandler(async (req, res) => {
  const result = await generateApiKey(req.user!.id, String(req.params.projectId));
  res.status(201).json(result);
});

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const apiKeys = await listApiKeys(req.user!.id, String(req.params.projectId));
  res.json(apiKeys);
});

export const revoke: RequestHandler = asyncHandler(async (req, res) => {
  const apiKey = await revokeApiKey(req.user!.id, String(req.params.projectId), String(req.params.id));
  res.json(apiKey);
});
