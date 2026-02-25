import { mysqlTable, mysqlEnum, varchar, text, int, boolean, timestamp, date, index } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  email: varchar("email", { length: 255 }), // Nullable for employees
  username: varchar("username", { length: 255 }).unique(), // Can be NIK for employees
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "employee"]).notNull().default("employee"),
  nik: varchar("nik", { length: 50 }).unique(), // Specific for employees
  branch: varchar("branch", { length: 100 }),
  position: varchar("position", { length: 100 }),
  shift: varchar("shift", { length: 50 }),
  photoUrl: varchar("photo_url", { length: 512 }),
  isAdmin: boolean("is_admin").default(false),
  phoneNumber: varchar("phone_number", { length: 20 }),
});

export const attendance = mysqlTable("attendance", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  date: date("date").notNull(), // YYYY-MM-DD

  checkIn: timestamp("check_in"),
  checkInPhoto: varchar("check_in_photo", { length: 255 }),
  checkInLocation: text("check_in_location"),

  breakStart: timestamp("break_start"),
  breakStartPhoto: varchar("break_start_photo", { length: 255 }),
  breakStartLocation: text("break_start_location"),

  breakEnd: timestamp("break_end"),
  breakEndPhoto: varchar("break_end_photo", { length: 255 }),
  breakEndLocation: text("break_end_location"),

  checkOut: timestamp("check_out"),
  checkOutPhoto: varchar("check_out_photo", { length: 255 }),
  checkOutLocation: text("check_out_location"),

  shift: varchar("shift", { length: 50 }), // 'Shift 1', 'Shift 2', 'Shift 3', 'Long Shift'
  sessionNumber: int("session_number").default(1), // Track multiple sessions per day
  status: mysqlEnum("status", ["present", "late", "sick", "permission", "cuti", "absent"]).default("absent"),
  notes: text("notes"), // For permission/sick details
  lateReason: text("late_reason"),
  lateReasonPhoto: varchar("late_reason_photo", { length: 255 }),
  permitExitAt: timestamp("permit_exit_at"), // When they left for permit mid-day
  permitResumeAt: timestamp("permit_resume_at"), // When they resumed work
}, (table) => ({
  userIdIdx: index("idx_attendance_user_id").on(table.userId),
  dateIdx: index("idx_attendance_date").on(table.date),
  userDateIdx: index("idx_attendance_user_date").on(table.userId, table.date),
}));

export const announcements = mysqlTable("announcements", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("image_url", { length: 512 }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  authorId: int("author_id"),
}, (table) => ({
  createdAtIdx: index("idx_announcements_created_at").on(table.createdAt),
}));

export const complaints = mysqlTable("complaints", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_complaints_user_id").on(table.userId),
  createdAtIdx: index("idx_complaints_created_at").on(table.createdAt),
}));

export const leaveRequests = mysqlTable("leave_requests", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  selectedDates: text("selected_dates"), // Comma separated dates for non-contiguous selection
  reason: text("reason").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_leave_request_user_id").on(table.userId),
  statusIdx: index("idx_leave_request_status").on(table.status),
}));

export const complaintPhotos = mysqlTable("complaint_photos", {
  id: int("id").primaryKey().autoincrement(),
  complaintId: int("complaint_id").notNull(),
  photoUrl: varchar("photo_url", { length: 512 }).notNull(),
  caption: text("caption"),
});

export const sessions = mysqlTable("sessions", {
  id: varchar("session_id", { length: 128 }).primaryKey(),
  expires: int("expires").notNull(),
  data: text("data"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  attendanceRecords: many(attendance),
  announcements: many(announcements),
  complaints: many(complaints),
  leaveRequests: many(leaveRequests),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, {
    fields: [attendance.userId],
    references: [users.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  user: one(users, {
    fields: [complaints.userId],
    references: [users.id],
  }),
  photos: many(complaintPhotos),
}));

export const complaintPhotosRelations = relations(complaintPhotos, ({ one }) => ({
  complaint: one(complaints, {
    fields: [complaintPhotos.complaintId],
    references: [complaints.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export const insertComplaintSchema = createInsertSchema(complaints).omit({ id: true, createdAt: true });
export const insertComplaintPhotoSchema = createInsertSchema(complaintPhotos).omit({ id: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type ComplaintPhoto = typeof complaintPhotos.$inferSelect;
export type InsertComplaintPhoto = z.infer<typeof insertComplaintPhotoSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
