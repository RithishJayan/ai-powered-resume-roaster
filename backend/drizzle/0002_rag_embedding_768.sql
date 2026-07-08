DROP INDEX IF EXISTS "rag_chunks_embedding_hnsw";
--> statement-breakpoint
ALTER TABLE "rag_chunks" DROP COLUMN "embedding";
--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD COLUMN "embedding" vector(768);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_hnsw" ON "rag_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
