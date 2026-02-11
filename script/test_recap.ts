
import { storage } from "../server/storage";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("--- Verifying Schema Fix ---");
    try {
        const [rows] = await db.execute(sql`SHOW COLUMNS FROM announcements LIKE 'image_url'`);
        console.log("Column verification:", rows);
        if ((rows as any[]).length > 0) {
            console.log("✅ 'image_url' column exists in 'announcements'.");
        } else {
            console.error("❌ 'image_url' column MISSING in 'announcements'.");
        }
    } catch (e) {
        console.error("Error checking column:", e);
    }

    console.log("\n--- Verifying Recap Logic ---");
    // 1. Get a user or create one
    let users = await storage.getAllUsers();
    let user = users[0];
    if (!user) {
        console.log("No users found, creating dummy user...");
        user = await storage.createUser({
            username: "testuser",
            password: "password",
            fullName: "Test User",
            role: "employee",
            nik: "123456"
        });
    }
    console.log("Using user:", user.id, user.username);

    // 2. Insert attendance in the range
    // Range for month 2026-02 is: 2026-01-26 to 2026-02-25
    const testDate = "2026-02-08";

    // Clean up existing for this date to avoid dupes
    const existing = await storage.getAttendanceByUserAndDate(user.id, testDate);
    if (existing) {
        console.log("Record already exists for", testDate);
    } else {
        console.log("Creating attendance record for", testDate);
        await storage.createAttendance({
            userId: user.id,
            date: testDate,
            status: 'present',
            checkIn: new Date(testDate + "T09:00:00"),
            checkInLocation: "Office"
        });
    }

    // 3. Query history
    const monthStr = "2026-02";
    console.log(`Fetching history for ${monthStr}...`);
    const history = await storage.getAttendanceHistory(user.id, monthStr);

    console.log(`Found ${history.length} records.`);
    const found = history.find(r => r.date === testDate);
    if (found) {
        console.log("✅ Found record for", testDate);
    } else {
        console.log("❌ Did NOT find record for", testDate);
        console.log("Records found:", history.map(h => h.date));
    }

    process.exit(0);
}

main();
