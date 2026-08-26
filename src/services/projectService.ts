import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";

export const createProject = (ownerId: string, input: { name: string; description?: string }) =>
  prisma.project.create({
    data: {
      ownerId,
      name: input.name,
      description: input.description
    }
  });

export const listProjects = (ownerId: string) =>
  prisma.project.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" }
  });

export const getOwnedProject = async (ownerId: string, projectId: string) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new AppError(404, "Project not found");
  }

  if (project.ownerId !== ownerId) {
    throw new AppError(403, "You cannot access this project");
  }

  return project;
};

export const updateProject = async (
  ownerId: string,
  projectId: string,
  input: { name?: string; description?: string | null; active?: boolean }
) => {
  await getOwnedProject(ownerId, projectId);

  return prisma.project.update({
    where: { id: projectId },
    data: input
  });
};

export const deactivateProject = async (ownerId: string, projectId: string) => {
  await getOwnedProject(ownerId, projectId);

  return prisma.project.update({
    where: { id: projectId },
    data: { active: false }
  });
};
