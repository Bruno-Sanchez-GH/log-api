import type { Project, User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, "id" | "email" | "name">;
      project?: Project;
      apiKeyId?: string;
      validatedQuery?: unknown;
    }
  }
}

export {};
