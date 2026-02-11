
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Adding shift column to attendance table...");
        await db.execute(sql`ALTER TABLE attendance ADD COLUMN shift VARCHAR(50)`);
        console.log("Column shift added successfully.");
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("Column shift already exists.");
        } else {
            console.error("Error adding column:", error);
        }
    }
    process.exit(0);
}

main();
