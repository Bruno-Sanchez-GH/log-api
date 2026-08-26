import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid()
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid()
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});
