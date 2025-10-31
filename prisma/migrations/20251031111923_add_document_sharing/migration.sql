-- CreateTable
CREATE TABLE "document_member" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'read',
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_member_userId_idx" ON "document_member"("userId");

-- CreateIndex
CREATE INDEX "document_member_documentId_idx" ON "document_member"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_member_documentId_userId_key" ON "document_member"("documentId", "userId");

-- AddForeignKey
ALTER TABLE "document_member" ADD CONSTRAINT "document_member_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_member" ADD CONSTRAINT "document_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
