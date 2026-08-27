-- AlterTable
ALTER TABLE "Log" ADD COLUMN     "version" TEXT;

-- CreateIndex
CREATE INDEX "Log_projectId_version_idx" ON "Log"("projectId", "version");
