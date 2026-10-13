ALTER TABLE "notes" ADD COLUMN "id_user" uuid;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_id_user_users_id_fk" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_id_user_idx" ON "notes" USING btree ("id_user");