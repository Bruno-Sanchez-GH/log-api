import type { RequestHandler } from "express";
import { getLog, ingestLog, listLogs } from "../services/logService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const ingest: RequestHandler = asyncHandler(async (req, res) => {
  const log = await ingestLog({
    projectId: req.project!.id,
    ...req.body
  });
  res.status(201).json(log);
});

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const result = await listLogs(req.user!.id, req.validatedQuery as never);
  res.json(result);
});

export const getById: RequestHandler = asyncHandler(async (req, res) => {
  const log = await getLog(req.user!.id, String(req.params.id));
  res.json(log);
});
