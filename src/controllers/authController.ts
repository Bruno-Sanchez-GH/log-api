import type { RequestHandler } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginUser, registerUser } from "../services/authService.js";

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const result = await registerUser(req.body);
  res.status(201).json(result);
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  res.json(result);
});
