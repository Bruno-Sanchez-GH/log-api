import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { signToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

export const registerUser = async (input: { name: string; email: string; password: string }) => {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });

  if (existingUser) {
    throw new AppError(409, "Email is already registered");
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password)
    },
    select: { id: true, name: true, email: true, createdAt: true }
  });

  return {
    user,
    token: signToken({ userId: user.id })
  };
};

export const loginUser = async (input: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, "Invalid email or password");
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    },
    token: signToken({ userId: user.id })
  };
};
