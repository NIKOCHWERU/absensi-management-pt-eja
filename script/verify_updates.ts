
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("--- Verifying Schema Updates ---");
    try {
        const [cols1] = await db.execute(sql`SHOW COLUMNS FROM announcements LIKE 'expires_at'`);
        if ((cols1 as any[]).length > 0) {
            console.log("✅ 'expires_at' column exists in 'announcements'.");
        } else {
            console.error("❌ 'expires_at' column MISSING in 'announcements'.");
        }

        const [cols2] = await db.execute(sql`SHOW COLUMNS FROM attendance LIKE 'shift'`);
        if ((cols2 as any[]).length > 0) {
            console.log("✅ 'shift' column exists in 'attendance'.");
        } else {
            console.error("❌ 'shift' column MISSING in 'attendance'.");
        }

    } catch (e) {
        console.error("Error checking columns:", e);
    }
    process.exit(0);
}

main();
