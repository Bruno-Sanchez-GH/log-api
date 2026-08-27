import { IncidentStatus, type LogLevel } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import {
  buildIncidentFingerprint,
  getHighestSeverity,
  INCIDENT_WINDOW_MS,
  isInsideIncidentWindow
} from "../utils/incidents.js";

export const resolveExpiredOpenIncidents = async (projectIds?: string[]) => {
  const expirationLimit = new Date(Date.now() - INCIDENT_WINDOW_MS);

  await prisma.incident.updateMany({
    where: {
      status: IncidentStatus.OPEN,
      lastOccurrenceAt: { lt: expirationLimit },
      ...(projectIds ? { projectId: { in: projectIds } } : {})
    },
    data: { status: IncidentStatus.RESOLVED }
  });
};

export const attachLogToIncident = async (input: {
  logId: string;
  projectId: string;
  level: LogLevel;
  message: string;
  source?: string | null;
  environment?: string | null;
  version?: string | null;
  errorCode?: string | null;
  occurredAt: Date;
}) => {
  const fingerprint = buildIncidentFingerprint(input);

  const openIncident = await prisma.incident.findFirst({
    where: {
      projectId: input.projectId,
      fingerprint,
      status: IncidentStatus.OPEN
    },
    orderBy: { lastOccurrenceAt: "desc" }
  });

  if (openIncident && isInsideIncidentWindow(openIncident.lastOccurrenceAt, input.occurredAt)) {
    const incident = await prisma.incident.update({
      where: { id: openIncident.id },
      data: {
        lastOccurrenceAt: input.occurredAt,
        occurrenceCount: { increment: 1 },
        severity: getHighestSeverity(openIncident.severity, input.level)
      }
    });

    await prisma.log.update({
      where: { id: input.logId },
      data: { incidentId: incident.id }
    });

    return incident;
  }

  if (openIncident) {
    await prisma.incident.update({
      where: { id: openIncident.id },
      data: { status: IncidentStatus.RESOLVED }
    });
  }

  const incident = await prisma.incident.create({
    data: {
      projectId: input.projectId,
      fingerprint,
      severity: input.level,
      firstOccurrenceAt: input.occurredAt,
      lastOccurrenceAt: input.occurredAt,
      occurrenceCount: 1
    }
  });

  await prisma.log.update({
    where: { id: input.logId },
    data: { incidentId: incident.id }
  });

  return incident;
};

export const listIncidents = async (
  ownerId: string,
  filters: {
    projectId?: string;
    status?: IncidentStatus;
    severity?: LogLevel;
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

  const projectIds = ownedProjects.map((project) => project.id);
  await resolveExpiredOpenIncidents(projectIds);

  const where = {
    projectId: { in: projectIds },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.severity ? { severity: filters.severity } : {})
  };

  const [items, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
      orderBy: { lastOccurrenceAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize
    }),
    prisma.incident.count({ where })
  ]);

  return {
    items: items.map(serializeIncident),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize)
    }
  };
};

export const getIncident = async (ownerId: string, incidentId: string) => {
  await resolveExpiredOpenIncidents();

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      project: { select: { id: true, name: true, ownerId: true } },
      logs: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!incident) {
    throw new AppError(404, "Incident not found");
  }

  if (incident.project.ownerId !== ownerId) {
    throw new AppError(403, "You cannot access this incident");
  }

  return serializeIncident(incident);
};

export const resolveIncident = async (ownerId: string, incidentId: string) => {
  await getIncident(ownerId, incidentId);

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: { status: IncidentStatus.RESOLVED }
  });

  return serializeIncident(incident);
};

const serializeIncident = <T extends { firstOccurrenceAt: Date; lastOccurrenceAt: Date }>(incident: T) => ({
  ...incident,
  firstSeen: incident.firstOccurrenceAt,
  lastSeen: incident.lastOccurrenceAt,
  durationMs: incident.lastOccurrenceAt.getTime() - incident.firstOccurrenceAt.getTime()
});
