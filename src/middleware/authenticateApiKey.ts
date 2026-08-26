import { ApiKeyStatus } from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { hashApiKey } from "../utils/apiKey.js";

export const authenticateApiKey: RequestHandler = async (req, _res, next) => {
  try {
    const apiKey = req.header("x-api-key");

    if (!apiKey) {
      throw new AppError(401, "Missing API key");
    }

    const credential = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(apiKey) },
      include: { project: true }
    });

    if (!credential || credential.status !== ApiKeyStatus.ACTIVE || !credential.project.active) {
      throw new AppError(401, "Invalid API key");
    }

    req.project = credential.project;
    req.apiKeyId = credential.id;
    next();
  } catch (error) {
    next(error);
  }
};
