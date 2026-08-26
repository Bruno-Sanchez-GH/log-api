import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

export const validateRequest =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query
    }) as { body?: unknown; params?: unknown; query?: unknown };

    if (parsed.body) req.body = parsed.body;
    if (parsed.params) req.params = parsed.params as typeof req.params;
    if (parsed.query) req.validatedQuery = parsed.query;

    next();
  };
