import { ApiKeyStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";
import { createApiKey, hashApiKey } from "../utils/apiKey.js";
import { getOwnedProject } from "./projectService.js";

export const generateApiKey = async (ownerId: string, projectId: string) => {
  const project = await getOwnedProject(ownerId, projectId);

  if (!project.active) {
    throw new AppError(409, "Cannot generate API keys for an inactive project");
  }

  const apiKey = createApiKey();
  const keyHash = hashApiKey(apiKey);

  const credential = await prisma.apiKey.create({
    data: {
      projectId,
      keyHash
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      revokedAt: true
    }
  });

  return {
    apiKey,
    credential
  };
};

export const listApiKeys = async (ownerId: string, projectId: string) => {
  await getOwnedProject(ownerId, projectId);

  return prisma.apiKey.findMany({
    where: { projectId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      revokedAt: true
    },
    orderBy: { createdAt: "desc" }
  });
};

export const revokeApiKey = async (ownerId: string, projectId: string, apiKeyId: string) => {
  await getOwnedProject(ownerId, projectId);

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, projectId }
  });

  if (!apiKey) {
    throw new AppError(404, "API key not found");
  }

  if (apiKey.status === ApiKeyStatus.REVOKED) {
    return apiKey;
  }

  return prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      status: ApiKeyStatus.REVOKED,
      revokedAt: new Date()
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      revokedAt: true
    }
  });
};
