-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Matter_organizationId_idx" ON "Matter"("organizationId");

-- CreateIndex
CREATE INDEX "Document_organizationId_matterId_idx" ON "Document"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "Task_organizationId_matterId_idx" ON "Task"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "TimeEntry_organizationId_matterId_idx" ON "TimeEntry"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_matterId_idx" ON "Invoice"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "CalendarEvent_organizationId_matterId_idx" ON "CalendarEvent"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "TimelineEvent_organizationId_matterId_idx" ON "TimelineEvent"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "ClientMessage_organizationId_matterId_idx" ON "ClientMessage"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "PrivilegeLogEntry_organizationId_matterId_idx" ON "PrivilegeLogEntry"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "DepositionTranscript_organizationId_matterId_idx" ON "DepositionTranscript"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "TranscriptPage_organizationId_transcriptId_idx" ON "TranscriptPage"("organizationId", "transcriptId");

-- CreateIndex
CREATE INDEX "WarRoomWitness_organizationId_matterId_idx" ON "WarRoomWitness"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "WarRoomExhibit_organizationId_matterId_idx" ON "WarRoomExhibit"("organizationId", "matterId");

-- CreateIndex
CREATE INDEX "ConflictCheck_organizationId_idx" ON "ConflictCheck"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

