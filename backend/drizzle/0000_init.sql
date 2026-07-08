CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roast_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roast_log_id" uuid NOT NULL,
	"rating" integer,
	"thumbs" varchar(8),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comment" text,
	"include_in_training" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roast_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" text NOT NULL,
	"roast_level" varchar(16) NOT NULL,
	"job_description_hash" text,
	"resume_text_hash" text NOT NULL,
	"resume_excerpt" text,
	"resume_full_text" text,
	"roast_text" text NOT NULL,
	"score" integer,
	"breakdown" jsonb,
	"ai_assessment" jsonb,
	"latency_ms" integer,
	"rag_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"moderation" jsonb
);
--> statement-breakpoint
ALTER TABLE "roast_feedback" ADD CONSTRAINT "roast_feedback_roast_log_id_roast_logs_id_fk" FOREIGN KEY ("roast_log_id") REFERENCES "public"."roast_logs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_hnsw" ON "rag_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);