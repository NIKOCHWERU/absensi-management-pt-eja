import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db, poolConnection } from "../server/db";
import { users, announcements } from "../shared/schema";
import { eq } from "drizzle-orm"; // Ensure correct import for 'eq'
// If 'eq' is not exported from 'drizzle-orm', check typical usage. 
// Actually typical usage is `import { eq } from "drizzle-orm"`.
// Let's assume standard drizzle imports.

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // 1. Create Admin User
    const adminEmail = "admin@company.com";
    const existingAdmin = await db.select().from(users).where(eq(users.username, adminEmail)).limit(1);

    if (existingAdmin.length === 0) {
      const hashedPassword = await hashPassword("password123");
      await db.insert(users).values({
        email: adminEmail,
        username: adminEmail,
        password: hashedPassword,
        fullName: "Admin Utama",
        role: "admin",
        isAdmin: true,
      });
      console.log("✅ Admin user created: admin@company.com / password123");
    }

    // 1b. Create Second Admin User
    const admin2Email = "admin@nh.com";
    const existingAdmin2 = await db.select().from(users).where(eq(users.username, admin2Email)).limit(1);

    if (existingAdmin2.length === 0) {
      const hashedPassword2 = await hashPassword("password123");
      await db.insert(users).values({
        email: admin2Email,
        username: admin2Email,
        password: hashedPassword2,
        fullName: "Admin",
        role: "admin",
        isAdmin: true,
      });
      console.log("✅ Admin user created: admin@nh.com / password123");
    } else {
      const hashedPassword2 = await hashPassword("password123");
      await db.update(users).set({ password: hashedPassword2 }).where(eq(users.username, admin2Email));
      console.log("✅ Admin password updated to 'password123' for admin@nh.com.");
    }

    // 2. Create Employee User
    const employeeNik = "12345";
    const existingEmployee = await db.select().from(users).where(eq(users.nik, employeeNik)).limit(1);

    if (existingEmployee.length === 0) {
      const hashedPassword = await hashPassword("password123");
      await db.insert(users).values({
        username: employeeNik, // Employee uses NIK as username
        nik: employeeNik,
        password: hashedPassword,
        fullName: "Budi Santoso",
        role: "employee",
        branch: "Jakarta Pusat",
        position: "Staff IT",
        shift: "Shift 1",
        isAdmin: false,
      });
      console.log("✅ Employee user created: 12345 / password123");
    } else {
      console.log("ℹ️ Employee user already exists.");
    }

    // 3. Create Sample Announcement
    const existingAnnouncements = await db.select().from(announcements).limit(1);
    if (existingAnnouncements.length === 0) {
      // Need an author ID. Let's use the admin we just ensured exists.
      const admin = await db.select().from(users).where(eq(users.username, adminEmail)).limit(1);
      if (admin.length > 0) {
        await db.insert(announcements).values({
          title: "Selamat Datang di Sistem Absensi",
          content: "Ini adalah pengumuman pertama. Silahkan melakukan absensi setiap hari kerja.",
          authorId: admin[0].id,
          createdAt: new Date(),
        });
        console.log("✅ Sample announcement created.");
      }
    } else {
      console.log("ℹ️ Announcements already exist.");
    }

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await poolConnection.end(); // Close connection
    console.log("👋 Seeding complete.");
  }
}

seed();
