
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Adding image_url column to announcements table...");
        await db.execute(sql`ALTER TABLE announcements ADD COLUMN image_url VARCHAR(512)`);
        console.log("Column added successfully.");
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("Column image_url already exists.");
        } else {
            console.error("Error adding column:", error);
        }
    }
    process.exit(0);
}

main();
