ALTER TABLE "suppliers" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "suppliers_deleted_at_idx" ON "suppliers"("deleted_at");
