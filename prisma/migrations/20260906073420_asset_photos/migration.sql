-- AlterTable
ALTER TABLE "photos" ADD COLUMN     "assetId" TEXT;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
