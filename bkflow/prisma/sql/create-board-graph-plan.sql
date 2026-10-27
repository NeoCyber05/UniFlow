BEGIN;

CREATE TABLE "public"."BoardGraphPlan" (
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "arranged" TEXT,
    "range" TEXT NOT NULL DEFAULT 'week',
    "aiOrder" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardGraphPlan_pkey" PRIMARY KEY ("userId", "boardId"),
    CONSTRAINT "BoardGraphPlan_boardId_fkey" FOREIGN KEY ("boardId")
        REFERENCES "public"."Board"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "public"."BoardGraphPlan" ENABLE ROW LEVEL SECURITY;

COMMIT;
