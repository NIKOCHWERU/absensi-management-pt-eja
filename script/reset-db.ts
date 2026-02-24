
import { poolConnection } from "../server/db";

async function reset() {
    console.log("🧨 Resetting database...");
    try {
        // Disable foreign key checks to allow dropping tables in any order
        await poolConnection.query("SET FOREIGN_KEY_CHECKS = 0;");

        const tables = [
            "users",
            "attendance",
            "announcements",
            "complaints",
            "complaint_photos",
            "sessions",
            "__drizzle_migrations"
        ];

        for (const table of tables) {
            try {
                await poolConnection.query(`DROP TABLE IF EXISTS ${table}`);
                console.log(`🗑️ Dropped table: ${table}`);
            } catch (err) {
                console.error(`Error dropping table ${table}:`, err);
            }
        }

        // Re-enable foreign key checks
        await poolConnection.query("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("✅ Database reset complete.");

    } catch (error) {
        console.error("❌ Error resetting database:", error);
        process.exit(1);
    } finally {
        await poolConnection.end();
    }
}

reset();
