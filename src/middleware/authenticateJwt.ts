import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { verifyToken } from "../utils/jwt.js";

export const authenticateJwt: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");

    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Missing JWT token");
    }

    const token = header.slice("Bearer ".length);
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      throw new AppError(401, "Invalid JWT token");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, "Invalid JWT token"));
  }
};
