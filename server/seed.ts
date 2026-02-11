import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  const existingUsers = await storage.getAllUsers();
  // We will delete existing users to ensure new passwords apply if this is a development reset
  // Or just update them. For a simple seed, let's keep it safe.

  const hashedPassword = await hashPassword("password123");

  // Admin User
  const admin = await storage.getUserByUsername("admin@company.com");
  if (!admin) {
    await storage.createUser({
      username: "admin@company.com", // Email for admin
      password: hashedPassword,
      fullName: "Admin User",
      role: "admin",
      isAdmin: true,
    });
    console.log("✅ Admin user created: admin@company.com / password123");
  } else {
    await storage.updateUser(admin.id, { password: hashedPassword });
    console.log("✅ Admin password updated to password123");
  }

  // Employee User
  const employee = await storage.getUserByNik("12345");
  if (!employee) {
    await storage.createUser({
      username: "12345", // NIK for employee
      password: hashedPassword,
      fullName: "Budi Santoso",
      role: "employee",
      nik: "12345",
      branch: "Jakarta Pusat",
      position: "Staff IT",
      shift: "Pagi (08:00 - 17:00)",
      isAdmin: false,
    });
    console.log("✅ Employee user created: 12345 / password123");
  } else {
    await storage.updateUser(employee.id, { password: hashedPassword });
    console.log("✅ Employee password updated to password123");
  }

  console.log("Seeding complete");
}

seed().catch(console.error);
