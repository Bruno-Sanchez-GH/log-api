import type { Environment, LogLevel, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { shouldCreateIncidentForLevel } from "../utils/incidents.js";
import { attachLogToIncident } from "./incidentService.js";

export const ingestLog = async (input: {
  projectId: string;
  level: LogLevel;
  message: string;
  source?: string;
  environment?: Environment;
  metadata?: Prisma.InputJsonValue;
  errorCode?: string;
}) => {
  const log = await prisma.log.create({
    data: {
      projectId: input.projectId,
      level: input.level,
      message: input.message,
      source: input.source,
      environment: input.environment,
      metadata: input.metadata,
      errorCode: input.errorCode
    }
  });

  if (!shouldCreateIncidentForLevel(input.level)) {
    return log;
  }

  const incident = await attachLogToIncident({
    logId: log.id,
    projectId: input.projectId,
    level: input.level,
    message: input.message,
    source: input.source,
    errorCode: input.errorCode,
    occurredAt: log.createdAt
  });

  return {
    ...log,
    incidentId: incident.id
  };
};

export const listLogs = async (
  ownerId: string,
  filters: {
    projectId?: string;
    level?: LogLevel;
    source?: string;
    environment?: Environment;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }
) => {
  const ownedProjects = await prisma.project.findMany({
    where: {
      ownerId,
      ...(filters.projectId ? { id: filters.projectId } : {})
    },
    select: { id: true }
  });

  if (filters.projectId && ownedProjects.length === 0) {
    throw new AppError(403, "You cannot access this project");
  }

  const where: Prisma.LogWhereInput = {
    projectId: { in: ownedProjects.map((project) => project.id) },
    ...(filters.level ? { level: filters.level } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.environment ? { environment: filters.environment } : {}),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      }
    })
  };

  const [items, total] = await Promise.all([
    prisma.log.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        incident: { select: { id: true, status: true, severity: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize
    }),
    prisma.log.count({ where })
  ]);

  return {
    items,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize)
    }
  };
};

export const getLog = async (ownerId: string, logId: string) => {
  const log = await prisma.log.findUnique({
    where: { id: logId },
    include: {
      project: { select: { id: true, name: true, ownerId: true } },
      incident: true
    }
  });

  if (!log) {
    throw new AppError(404, "Log not found");
  }

  if (log.project.ownerId !== ownerId) {
    throw new AppError(403, "You cannot access this log");
  }

  return log;
};
