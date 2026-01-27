-- Add term_agreements column to orders table
ALTER TABLE "public"."orders" ADD COLUMN "term_agreements" jsonb;
