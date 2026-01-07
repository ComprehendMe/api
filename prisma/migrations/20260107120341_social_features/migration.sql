/*
  Warnings:

  - You are about to drop the `friends` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED');

-- DropForeignKey
ALTER TABLE "friends" DROP CONSTRAINT "friends_userId_fkey";

-- DropTable
DROP TABLE "friends";

-- CreateTable
CREATE TABLE "friendships" (
    "id" BIGINT NOT NULL,
    "requesterId" BIGINT NOT NULL,
    "addresseeId" BIGINT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requesterId_addresseeId_key" ON "friendships"("requesterId", "addresseeId");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
