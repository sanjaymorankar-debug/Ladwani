-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE');

-- CreateTable
CREATE TABLE "community_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "groupType" TEXT NOT NULL DEFAULT 'MANDAL',
    "description" TEXT,
    "areaId" TEXT,
    "convenerMemberId" TEXT,
    "meetingSchedule" TEXT,
    "maxMembers" INTEGER DEFAULT 25,
    "status" "GroupStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "lastRosterReviewAt" TIMESTAMP(3),
    "lastRosterReviewBy" TEXT,
    "rosterReviewIntervalDays" INTEGER NOT NULL DEFAULT 180,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "community_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "roleInGroup" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT,
    "leftAt" TIMESTAMP(3),
    "leftReason" TEXT,

    CONSTRAINT "community_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_groups_code_key" ON "community_groups"("code");

-- CreateIndex
CREATE INDEX "community_groups_status_isActive_idx" ON "community_groups"("status", "isActive");

-- CreateIndex
CREATE INDEX "community_group_members_memberId_idx" ON "community_group_members"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "community_group_members_groupId_memberId_key" ON "community_group_members"("groupId", "memberId");

-- AddForeignKey
ALTER TABLE "community_groups" ADD CONSTRAINT "community_groups_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_groups" ADD CONSTRAINT "community_groups_convenerMemberId_fkey" FOREIGN KEY ("convenerMemberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_group_members" ADD CONSTRAINT "community_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "community_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_group_members" ADD CONSTRAINT "community_group_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
