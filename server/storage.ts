import {
  User, InsertUser, Attendance, InsertAttendance, Announcement, InsertAnnouncement,
  Complaint, InsertComplaint, ComplaintPhoto, InsertComplaintPhoto,
  LeaveRequest, InsertLeaveRequest,
  users, attendance, announcements, complaints, complaintPhotos, leaveRequests
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql, or, isNotNull } from "drizzle-orm";
import { format } from "date-fns";
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

  async getAttendanceSessionsByUserAndDate(userId: number, date: string): Promise<Attendance[]> {
    // Get all sessions for a user on a specific date
    const records = await db.select()
      .from(attendance)
      .where(and(eq(attendance.userId, userId), sql`DATE(${attendance.date}) = ${date}`))
      .orderBy(attendance.sessionNumber);
    return records;
  }

  async updateAttendance(id: number, updates: Partial<Attendance>): Promise<Attendance> {
    await db.update(attendance)
      .set(updates)
      .where(eq(attendance.id, id));

    const [record] = await db.select().from(attendance).where(eq(attendance.id, id));
    return record!;
  }

  async deleteAttendance(id: number): Promise<void> {
    await db.delete(attendance).where(eq(attendance.id, id));
  }

  async getAttendanceHistory(userId?: number, monthStr?: string): Promise<Attendance[]> {
    const conditions = [];

    if (userId) {
      conditions.push(eq(attendance.userId, userId));
    }

    if (monthStr) {
      const [year, month] = monthStr.split('-').map(Number);

      // Use standard calendar month: 1st to the last day of the month
      const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01`);

      // Find last day of month
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);

      conditions.push(gte(attendance.date, startDate));
      conditions.push(lte(attendance.date, endDate));
    }

    // INNER JOIN with users to exclude attendance records of deleted employees
    const results = await db
      .select({ attendance })
      .from(attendance)
      .innerJoin(users, eq(attendance.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(attendance.date));

    return results.map(r => r.attendance);
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

  // Complaints
  async createComplaint(data: InsertComplaint): Promise<Complaint> {
    const [result] = await db.insert(complaints).values(data);
    const id = result.insertId;
    const [record] = await db.select().from(complaints).where(eq(complaints.id, id));
    return record!;
  }

  async createComplaintPhoto(data: InsertComplaintPhoto): Promise<ComplaintPhoto> {
    const [result] = await db.insert(complaintPhotos).values(data);
    const id = result.insertId;
    const [record] = await db.select().from(complaintPhotos).where(eq(complaintPhotos.id, id));
    return record!;
  }

  async getComplaintsByUser(userId: number): Promise<Complaint[]> {
    return await db.select().from(complaints)
      .where(eq(complaints.userId, userId))
      .orderBy(desc(complaints.createdAt));
  }

  async getAllComplaints(): Promise<Complaint[]> {
    return await db.select().from(complaints)
      .orderBy(desc(complaints.createdAt));
  }

  async getComplaintPhotos(complaintId: number): Promise<ComplaintPhoto[]> {
    return await db.select().from(complaintPhotos)
      .where(eq(complaintPhotos.complaintId, complaintId));
  }

  async updateComplaintStatus(id: number, status: string): Promise<Complaint> {
    await db.update(complaints)
      .set({ status: status as any })
      .where(eq(complaints.id, id));
    const [record] = await db.select().from(complaints).where(eq(complaints.id, id));
    return record!;
  }

  async getPendingComplaintsCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(complaints)
      .where(eq(complaints.status, "pending"));
    return result.count;
  }

  // Leave Requests
  async createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest> {
    const [result] = await db.insert(leaveRequests).values(data);
    const id = result.insertId;
    const [record] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return record!;
  }

  async getLeaveRequestsByUser(userId: number): Promise<LeaveRequest[]> {
    return await db.select().from(leaveRequests)
      .where(eq(leaveRequests.userId, userId))
      .orderBy(desc(leaveRequests.startDate));
  }

  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    return await db.select().from(leaveRequests)
      .orderBy(desc(leaveRequests.createdAt));
  }

  async getLeaveRequestById(id: number): Promise<LeaveRequest | undefined> {
    const [record] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return record;
  }

  async updateLeaveRequestStatus(id: number, status: string): Promise<LeaveRequest> {
    await db.update(leaveRequests)
      .set({ status: status as any })
      .where(eq(leaveRequests.id, id));
    const [record] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return record!;
  }

  async getApprovedLeaveDaysCount(userId: number, year: number): Promise<number> {
    const records = await db.select().from(leaveRequests)
      .where(and(
        eq(leaveRequests.userId, userId),
        eq(leaveRequests.status, "approved")
      ));

    let totalDays = 0;
    records.forEach(r => {
      if (r.selectedDates) {
        const dates = r.selectedDates.split(',').filter(d => d.startsWith(`${year}`));
        totalDays += dates.length;
      } else {
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        if (start.getFullYear() === year) {
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          totalDays += diffDays;
        }
      }
    });

    return totalDays;
  }

  async getRecentLeaveRequests(limit: number = 5): Promise<LeaveRequest[]> {
    return await db.select().from(leaveRequests)
      .orderBy(desc(leaveRequests.createdAt))
      .limit(limit);
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
  getAttendanceSessionsByUserAndDate(userId: number, date: string): Promise<Attendance[]>;
  updateAttendance(id: number, updates: Partial<Attendance>): Promise<Attendance>;
  deleteAttendance(id: number): Promise<void>;
  getAttendanceHistory(userId?: number, monthStr?: string): Promise<Attendance[]>;

  // Announcement methods
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>;
  getAnnouncements(): Promise<Announcement[]>;
  deleteAnnouncement(id: number): Promise<void>;

  // Complaint methods
  createComplaint(data: InsertComplaint): Promise<Complaint>;
  createComplaintPhoto(data: InsertComplaintPhoto): Promise<ComplaintPhoto>;
  getComplaintsByUser(userId: number): Promise<Complaint[]>;
  getAllComplaints(): Promise<Complaint[]>;
  getComplaintPhotos(complaintId: number): Promise<ComplaintPhoto[]>;
  updateComplaintStatus(id: number, status: string): Promise<Complaint>;
  getPendingComplaintsCount(): Promise<number>;

  // Leave Request methods
  createLeaveRequest(data: InsertLeaveRequest): Promise<LeaveRequest>;
  getLeaveRequestsByUser(userId: number): Promise<LeaveRequest[]>;
  getAllLeaveRequests(): Promise<LeaveRequest[]>;
  updateLeaveRequestStatus(id: number, status: string): Promise<LeaveRequest>;
  getApprovedLeaveDaysCount(userId: number, year: number): Promise<number>;
  getRecentLeaveRequests(limit?: number): Promise<LeaveRequest[]>;
}
