import mysql from 'mysql2/promise';

async function run() {
    console.log("Starting missing columns fix (direct ESM JS)...");
    const connectionString = 'mysql://niko:niko@localhost:3306/absensi_management_pt_e_j_a';
    
    // Wait, let me double check the DB name from the error message or .env
    // .env says: absensi_management_pt_eja
    const dbUrl = 'mysql://niko:niko@localhost:3306/absensi_management_pt_eja';

    try {
        const connection = await mysql.createConnection(dbUrl);
        console.log("Connected to DB.");

        console.log("Adding permit_duration column...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS permit_duration INT DEFAULT 0");

        console.log("Adding permit_exit_at column if not exists...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS permit_exit_at TIMESTAMP NULL");

        console.log("Adding permit_resume_at column if not exists...");
        await connection.query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS permit_resume_at TIMESTAMP NULL");

        console.log("DB columns updated successfully!");
        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error("Error updating DB:", err);
        process.exit(1);
    }
}

run();
