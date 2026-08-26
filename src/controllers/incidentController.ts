import type { RequestHandler } from "express";
import { getIncident, listIncidents, resolveIncident } from "../services/incidentService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const result = await listIncidents(req.user!.id, req.validatedQuery as never);
  res.json(result);
});

export const getById: RequestHandler = asyncHandler(async (req, res) => {
  const incident = await getIncident(req.user!.id, String(req.params.id));
  res.json(incident);
});

export const resolve: RequestHandler = asyncHandler(async (req, res) => {
  const incident = await resolveIncident(req.user!.id, String(req.params.id));
  res.json(incident);
});
