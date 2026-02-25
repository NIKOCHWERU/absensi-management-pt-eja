import { poolConnection } from "./server/db";

async function fix() {
    console.log("Starting DB fix...");
    try {
        const connection = await poolConnection.getConnection();
        console.log("Connected to DB.");

        console.log("Adding late_reason column...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_reason TEXT");

        console.log("Adding late_reason_photo column...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_reason_photo VARCHAR(255)");

        console.log("DB columns updated successfully!");
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error("Error updating DB:", err);
        process.exit(1);
    }
}

fix();
