ALTER TABLE "categories" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "units" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "categories_deleted_at_idx" ON "categories"("deleted_at");
CREATE INDEX "units_deleted_at_idx" ON "units"("deleted_at");
