-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kcAccessToken" TEXT,
ADD COLUMN     "kcRefreshToken" TEXT,
ADD COLUMN     "kcTokenExpiresAt" TIMESTAMP(3);
