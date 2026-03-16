import { poolConnection } from "./server/db.ts";

async function run() {
    console.log("Starting missing columns fix...");
    try {
        const connection = await poolConnection.getConnection();
        console.log("Connected to DB.");

        console.log("Adding permit_duration column...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS permit_duration INT DEFAULT 0");

        console.log("Adding permit_exit_at column if not exists...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS permit_exit_at TIMESTAMP NULL");

        console.log("Adding permit_resume_at column if not exists...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS permit_resume_at TIMESTAMP NULL");

        console.log("DB columns updated successfully!");
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error("Error updating DB:", err);
        process.exit(1);
    }
}

run();
