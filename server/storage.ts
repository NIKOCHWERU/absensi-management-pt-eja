import {
  User, InsertUser, Attendance, InsertAttendance, Announcement, InsertAnnouncement,
  users, attendance, announcements
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import session from "express-session";
import MySQLSessionStore from "express-mysql-session";
import { poolConnection } from "./db";

const MySQLStore = MySQLSessionStore(session as any);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MySQLStore({
      clearExpired: true,
      checkExpirationInterval: 900000, // 15 minutes
      expiration: 86400000, // 24 hours
      createDatabaseTable: true,
    }, poolConnection as any);
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByNik(nik: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.nik, nik));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // MySQL insert returns [ResultSetHeader], not the row. We need to fetch it back or use logic.
    // Drizzle with mysql2: .insert().values().$returningId() can give ID.
    // Then fetch.
    const [result] = await db.insert(users).values(insertUser);
    const id = result.insertId;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user!;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    await db.update(users)
      .set(updates)
      .where(eq(users.id, id));

    const [record] = await db.select().from(users).where(eq(users.id, id));
    return record!;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Attendance
  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const [result] = await db.insert(attendance).values(insertAttendance);
    const id = result.insertId;
    const [record] = await db.select().from(attendance).where(eq(attendance.id, id));
    return record!;
  }

  async getAttendance(id: number): Promise<Attendance | undefined> {
    const [record] = await db.select().from(attendance).where(eq(attendance.id, id));
    return record;
  }

  async getAttendanceByUserAndDate(userId: number, date: string): Promise<Attendance | undefined> {
    // date here is string YYYY-MM-DD
    const [record] = await db.select()
      .from(attendance)
      .where(and(eq(attendance.userId, userId), sql`DATE(${attendance.date}) = ${date}`));
    return record;
  }

  async updateAttendance(id: number, updates: Partial<Attendance>): Promise<Attendance> {
    await db.update(attendance)
      .set(updates)
      .where(eq(attendance.id, id));

    const [record] = await db.select().from(attendance).where(eq(attendance.id, id));
    return record!;
  }

  async getAttendanceHistory(userId?: number, monthStr?: string): Promise<Attendance[]> {
    let query = db.select().from(attendance);
    const conditions = [];

    if (userId) {
      conditions.push(eq(attendance.userId, userId));
    }

    if (monthStr) {
      const [year, month] = monthStr.split('-').map(Number);

      // Calculate start date: 26th of previous month
      let startYear = year;
      let startMonth = month - 1;
      if (startMonth === 0) {
        startMonth = 12;
        startYear -= 1;
      }
      const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-26`;

      // Calculate end date: 25th of current month
      const endDate = `${year}-${String(month).padStart(2, '0')}-25`;

      conditions.push(gte(attendance.date, new Date(startDate)));
      conditions.push(lte(attendance.date, new Date(endDate)));
    }

    return await query.where(and(...conditions)).orderBy(desc(attendance.date));
  }

  // Announcements
  async createAnnouncement(insertAnnouncement: InsertAnnouncement): Promise<Announcement> {
    const [result] = await db.insert(announcements).values(insertAnnouncement);
    const id = result.insertId;
    const [announcement] = await db.select().from(announcements).where(eq(announcements.id, id));
    return announcement!;
  }

  async getAnnouncements(): Promise<Announcement[]> {
    return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }
}

export const storage = new DatabaseStorage();

export interface IStorage {
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByNik(nik: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: number): Promise<void>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Attendance methods
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  getAttendance(id: number): Promise<Attendance | undefined>;
  getAttendanceByUserAndDate(userId: number, date: string): Promise<Attendance | undefined>;
  updateAttendance(id: number, updates: Partial<Attendance>): Promise<Attendance>;
  getAttendanceHistory(userId?: number, monthStr?: string): Promise<Attendance[]>;

  // Announcement methods
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getAnnouncements(): Promise<Announcement[]>;
  deleteAnnouncement(id: number): Promise<void>;
}
