
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Adding expires_at column to announcements table...");
        await db.execute(sql`ALTER TABLE announcements ADD COLUMN expires_at TIMESTAMP NULL`);
        console.log("Column expires_at added successfully.");
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("Column expires_at already exists.");
        } else {
            console.error("Error adding column:", error);
        }
    }
    process.exit(0);
}

main();
