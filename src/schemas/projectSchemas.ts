import { z } from "zod";
import { idParamSchema } from "./commonSchemas.js";

export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional()
  })
});

export const updateProjectSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      description: z.string().trim().max(500).nullable().optional(),
      active: z.boolean().optional()
    })
    .refine((body) => Object.keys(body).length > 0, "At least one field is required")
});
