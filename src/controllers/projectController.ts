import type { RequestHandler } from "express";
import {
  createProject,
  deactivateProject,
  getOwnedProject,
  listProjects,
  updateProject
} from "../services/projectService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const project = await createProject(req.user!.id, req.body);
  res.status(201).json(project);
});

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const projects = await listProjects(req.user!.id);
  res.json(projects);
});

export const getById: RequestHandler = asyncHandler(async (req, res) => {
  const project = await getOwnedProject(req.user!.id, String(req.params.id));
  res.json(project);
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const project = await updateProject(req.user!.id, String(req.params.id), req.body);
  res.json(project);
});

export const deactivate: RequestHandler = asyncHandler(async (req, res) => {
  const project = await deactivateProject(req.user!.id, String(req.params.id));
  res.json(project);
});
