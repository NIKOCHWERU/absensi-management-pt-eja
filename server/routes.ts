import express, { type Express, Request } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import multer from "multer";
import { uploadFile } from "./services/googleDrive";
import { User as DbUser } from "@shared/schema";
import fs from "fs";
import path from "path";
import { format } from "date-fns";
import { id } from "date-fns/locale";

declare global {
  namespace Express {
    interface User extends DbUser { }
  }
}

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register Object Storage routes
  registerObjectStorageRoutes(app);

  // Setup Auth
  setupAuth(app);

  // Setup uploads directory BEFORE routes that use it
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  app.use('/uploads', express.static(uploadsDir));

  // Helper to handle photo upload
  async function handlePhotoUpload(
    req: Request,
    actionType: 'clockIn' | 'breakStart' | 'breakEnd' | 'clockOut' | 'lateReason'
  ): Promise<string | undefined> {
    console.log(`[handlePhotoUpload] Action: ${actionType}, Method: ${req.file ? 'Multipart' : 'Base64'}`);

    const fileName = `attendance-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const localFilePath = path.join(uploadsDir, fileName);

    let buffer: Buffer;
    let mimeType: string;

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body.checkInPhoto && req.body.checkInPhoto.startsWith('data:image')) {
      const matches = req.body.checkInPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        console.warn(`[handlePhotoUpload] Invalid base64 photo data for ${actionType}`);
        return undefined;
      }
    } else {
      console.warn(`[handlePhotoUpload] No photo data found in request payload for ${actionType}`);
      return undefined;
    }

    // 1. Save locally IMMEDIATELY (Fast)
    try {
      fs.writeFileSync(localFilePath, buffer);
      console.log(`[handlePhotoUpload] Saved locally: ${fileName}`);

      // 2. Await GDrive upload to get the actual File ID
      // This ensures we store the correct reference for the frontend
      const gDriveFile = await uploadFile(
        buffer,
        fileName,
        mimeType,
        {
          employeeName: (req.user as DbUser).fullName,
          actionType: actionType as any,
          timestamp: new Date()
        }
      );

      console.log(`[handlePhotoUpload] GDrive upload success: ${gDriveFile.fileId}`);

      // 3. Return the Google Drive File ID
      return gDriveFile.fileId;
    } catch (err: any) {
      console.error(`[handlePhotoUpload] Upload failed for ${fileName}:`, err.message);
      // Fallback to local filename if GDrive fails, though it might break links if frontend expects ID
      return fileName;
    }
  }

  // --- Attendance Routes ---

  // Helper date function for Jakarta Timezone
  // Day boundary is 04:00 AM Jakarta — before 04:00 counts as previous day
  function getJakartaDate(): string {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    if (jakartaTime.getHours() < 4) {
      jakartaTime.setDate(jakartaTime.getDate() - 1);
    }
    const y = jakartaTime.getFullYear();
    const m = String(jakartaTime.getMonth() + 1).padStart(2, '0');
    const d = String(jakartaTime.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // --- Attendance Routes ---

  app.post(api.attendance.clockIn.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const today = getJakartaDate();
      const userId = req.user!.id;
      console.log(`[ClockIn] User ${userId} attempting clock-in for date ${today}`);

      // Check existing sessions for today
      const existingSessions = await storage.getAttendanceSessionsByUserAndDate(userId, today);
      console.log(`[ClockIn] Found ${existingSessions.length} existing sessions for user ${userId}`);

      const activeSession = existingSessions.find(s => !s.checkOut);

      if (activeSession) {
        console.log(`[ClockIn] Blocked: Active session ${activeSession.id} exists`);
        return res.status(400).json({ message: `Anda masih status MASUK (Sesi ${activeSession.sessionNumber}). Harap absen PULANG terlebih dahulu.` });
      }

      const nextSessionNumber = existingSessions.length + 1;

      if (nextSessionNumber > 5) {
        console.log(`[ClockIn] Blocked: Session limit reached (${nextSessionNumber})`);
        return res.status(400).json({ message: "Batas harian 5 sesi tercapai." });
      }

      const photoFileId = await handlePhotoUpload(req, 'clockIn');
      const location = req.body.location;
      const shift = req.body.shift || 'Management'; // Default to Management if missing
      const lateReason = req.body.lateReason;

      let lateReasonPhotoId = undefined;
      if (req.body.lateReasonPhoto) {
        // Handle late reason photo (base64)
        lateReasonPhotoId = await handlePhotoUpload({
          ...req,
          body: { ...req.body, checkInPhoto: req.body.lateReasonPhoto }
        } as any, 'lateReason');
      }

      // Determine status based on Shift Rules
      const now = new Date();
      // Reliable way to get Jakarta hours and minutes
      const jakartaFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      const timeParts = jakartaFormatter.formatToParts(now);
      const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0');
      const timeInMinutes = hour * 60 + minute;

      let status = "present";

      /*
        Rules:
        Shift 1: Late if > 07:00 (420 minutes)
        Shift 2: Late if > 12:00 (720 minutes)
        Shift 3: Late if > 15:00 (900 minutes)
        Long Shift / Tim Management: Late if > 07:00 (420 minutes)
      */

      if (shift === 'Shift 2') {
        if (timeInMinutes > 720) status = "late";
      } else if (shift === 'Shift 3') {
        if (timeInMinutes > 900) status = "late";
      } else {
        // Default to 07:00 for Shift 1, Tim Management, Long Shift, or unspecified
        if (timeInMinutes > 420) status = "late";
      }

      const attendance = await storage.createAttendance({
        userId,
        date: today,
        checkIn: now,
        status: status,
        checkInPhoto: photoFileId,
        checkInLocation: location,
        shift: shift,
        sessionNumber: nextSessionNumber,
        lateReason: lateReason,
        lateReasonPhoto: lateReasonPhotoId
      });

      console.log(`[ClockIn] Success: Created session ${nextSessionNumber} for user ${userId}`);
      res.json(attendance);
    } catch (err) {
      console.error("[ClockIn] Error:", err);
      res.status(500).json({ message: (err as Error).message || "Internal Server Error" });
    }
  });

  app.post(api.attendance.clockOut.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const today = getJakartaDate();
    const userId = req.user!.id;
    // Find the active (not checked out) session for today
    const sessions = await storage.getAttendanceSessionsByUserAndDate(userId, today);
    const existing = sessions.find(s => !s.checkOut);

    if (!existing) {
      return res.status(400).json({ message: "No active check-in record found for today" });
    }

    const photoFileId = await handlePhotoUpload(req, 'clockOut');
    const location = req.body.location;

    const attendance = await storage.updateAttendance(existing.id, {
      checkOut: new Date(),
      checkOutPhoto: photoFileId,
      checkOutLocation: location,
    });

    res.json(attendance);
  });

  app.post(api.attendance.breakStart.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const today = getJakartaDate();
    const userId = req.user!.id;
    // Find the active (not checked out) session for today
    const sessions = await storage.getAttendanceSessionsByUserAndDate(userId, today);
    const existing = sessions.find(s => !s.checkOut);

    if (!existing) {
      return res.status(400).json({ message: "No active check-in record found for today" });
    }

    const photoFileId = await handlePhotoUpload(req, 'breakStart');
    const location = req.body.location;

    const attendance = await storage.updateAttendance(existing.id, {
      breakStart: new Date(),
      breakStartPhoto: photoFileId,
      breakStartLocation: location,
    });

    res.json(attendance);
  });

  app.post(api.attendance.breakEnd.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const today = getJakartaDate();
    const userId = req.user!.id;
    // Find the active (not checked out) session for today
    const sessions = await storage.getAttendanceSessionsByUserAndDate(userId, today);
    const existing = sessions.find(s => !s.checkOut);

    if (!existing) {
      return res.status(400).json({ message: "No active check-in record found for today" });
    }

    const photoFileId = await handlePhotoUpload(req, 'breakEnd');
    const location = req.body.location;

    const attendance = await storage.updateAttendance(existing.id, {
      breakEnd: new Date(),
      breakEndPhoto: photoFileId,
      breakEndLocation: location,
    });

    res.json(attendance);
  });

  app.post(api.attendance.permit.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { notes, type } = req.body;
    const today = getJakartaDate();
    const userId = req.user!.id;

    const existing = await storage.getAttendanceByUserAndDate(userId, today);

    // Upload photo if provided
    const photoFileId = await handlePhotoUpload(req, 'clockIn');
    const now = new Date();

    if (existing) {
      // If already working, this is "Early Exit" or partial day permit
      // We mark session as finished (checkOut) and update status
      const attendance = await storage.updateAttendance(existing.id, {
        status: type,
        notes: notes,
        checkOut: now,
        checkOutPhoto: photoFileId,
        permitExitAt: now, // Record when the permit started mid-day
      });
      return res.json(attendance);
    }

    const attendance = await storage.createAttendance({
      userId,
      date: today,
      status: type, // 'sick' or 'permission'
      notes: notes,
      checkInPhoto: photoFileId,
      checkIn: now, // Technically they "started" their day with a permit
    });

    res.json(attendance);
  });

  app.post(api.attendance.resume.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const today = getJakartaDate();
    const userId = req.user!.id;

    // Get all sessions for today to determine next session number
    const existingSessions = await storage.getAttendanceSessionsByUserAndDate(userId, today);

    if (existingSessions.length === 0) {
      return res.status(400).json({ message: "No attendance record found for today" });
    }

    // Check if there's an active (not checked out) session
    const activeSession = existingSessions.find(s => !s.checkOut);
    if (activeSession) {
      return res.status(400).json({ message: "Masih ada sesi aktif. Silakan pulang dulu sebelum lanjut kerja." });
    }

    // Create new session with incremented session number
    const nextSessionNumber = existingSessions.length + 1;
    const now = new Date();
    const jakartaFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const timeParts = jakartaFormatter.formatToParts(now);
    const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0');
    const timeInMinutes = hour * 60 + minute;

    let status = "present";
    const shift = 'Management'; // Default for resume or should we inherit?

    if (timeInMinutes > 420) {
      status = "late";
    }

    // Create new attendance session
    const newSession = await storage.createAttendance({
      userId,
      date: today,
      checkIn: now,
      status: status,
      shift: 'Management',
      sessionNumber: nextSessionNumber,
      notes: `Sesi ke-${nextSessionNumber}`
    });

    res.json(newSession);
  });

  app.get(api.attendance.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Admin can see all, Employee sees only theirs
    const userId = req.user!.role === 'admin' ? (req.query.userId ? Number(req.query.userId) : undefined) : req.user!.id;
    const month = req.query.month as string | undefined;

    const records = await storage.getAttendanceHistory(userId, month);
    res.json(records);
  });

  app.get(api.attendance.today.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const today = getJakartaDate();
    const sessions = await storage.getAttendanceSessionsByUserAndDate(req.user!.id, today);

    // Auto-close logic: if we are past 04:00 AM, check for open sessions from previous days
    const now = new Date();
    const jakartaFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const timeParts = jakartaFormatter.formatToParts(now);
    const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0');

    if (hour >= 4) {
      if (sessions.length === 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const yesterdaySessions = await storage.getAttendanceSessionsByUserAndDate(req.user!.id, yesterdayStr);
        const openSessions = yesterdaySessions.filter(s => !s.checkOut);

        for (const session of openSessions) {
          await storage.updateAttendance(session.id, {
            checkOut: new Date(new Date(session.date).setHours(23, 59, 59)), // End of that day
            notes: session.notes ? `${session.notes} (Sesi ditutup otomatis: Lupa Absen Pulang)` : "Sesi ditutup otomatis: Lupa Absen Pulang"
          });
          console.log(`[AutoReset] Closed session ${session.sessionNumber} for user ${req.user!.id} from ${yesterdayStr}`);
        }
      }
    }

    // Return all sessions for today as array
    res.json(sessions);
  });

  // --- Admin Routes ---

  app.get(api.admin.users.list.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.post(api.admin.users.create.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated() || (req.user as DbUser).role !== 'admin') return res.sendStatus(401);

    try {
      const userData = { ...req.body };

      // Clean up empty strings to null for unique/optional fields
      if (userData.email === "") userData.email = null;
      if (userData.nik === "") userData.nik = null;
      if (userData.username === "") userData.username = null;
      if (userData.phoneNumber === "") userData.phoneNumber = null;

      // For employee, ensure username matches NIK if not provided
      if (userData.role === 'employee' && !userData.username && userData.nik) {
        userData.username = userData.nik;
      }

      // If still no username, return error as it's required for login
      if (!userData.username) {
        return res.status(400).json({ message: "Username atau NIK wajib diisi" });
      }

      // Hash the password before storing
      const hashedPassword = await hashPassword(userData.password || "password123");

      // Create user
      const user = await storage.createUser({ ...userData, password: hashedPassword });

      // If photo is uploaded, save it locally and update user
      if (req.file) {
        const filename = `emp-${user.id}-${Date.now()}-${req.file.originalname}`;
        const empUploadsDir = path.join(uploadsDir, 'employees');
        if (!fs.existsSync(empUploadsDir)) fs.mkdirSync(empUploadsDir);

        const filepath = path.join(empUploadsDir, filename);
        fs.writeFileSync(filepath, req.file.buffer);

        await storage.updateUser(user.id, { photoUrl: `/uploads/employees/${filename}` });
        user.photoUrl = `/uploads/employees/${filename}`;
      }

      res.status(201).json(user);
    } catch (err: any) {
      console.error("Create User Error:", err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: "NIK atau Username sudah digunakan" });
      }
      res.status(400).json({ message: "Gagal membuat karyawan: " + (err.message || "Internal error") });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      await storage.deleteUser(id);
      res.sendStatus(204);
    } catch (err) {
      console.error("Delete User Error:", err);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post(api.admin.attendance.manual.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);

    try {
      const { userId, date, status, notes, shift } = req.body;
      if (!userId || !date || !status) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if record exists for this user and date
      // getAttendanceByUserAndDate uses sql`DATE(date)` so it's robust
      const existing = await storage.getAttendanceByUserAndDate(userId, date);

      let record;
      if (existing) {
        record = await storage.updateAttendance(existing.id, {
          status,
          notes,
          shift: shift || existing.shift
        });
      } else {
        record = await storage.createAttendance({
          userId,
          date: new Date(date),
          status,
          notes: notes || "",
          shift: shift || 'Management',
          sessionNumber: 1
        });
      }

      res.json(record);
    } catch (err: any) {
      console.error("Manual Attendance Error:", err);
      res.status(500).json({ message: "Gagal memproses data absensi" });
    }
  });

  app.patch("/api/admin/users/:id", upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);

    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });

      const updates = { ...req.body };

      // Clean up empty strings to null for unique/optional fields
      if (updates.email === "") updates.email = null;
      if (updates.nik === "") updates.nik = null;
      if (updates.username === "") updates.username = null;
      if (updates.phoneNumber === "") updates.phoneNumber = null;

      // If photo is uploaded, save it locally
      if (req.file) {
        const filename = `emp-${id}-${Date.now()}-${req.file.originalname}`;
        const empUploadsDir = path.join(uploadsDir, 'employees');
        if (!fs.existsSync(empUploadsDir)) fs.mkdirSync(empUploadsDir);

        const filepath = path.join(empUploadsDir, filename);
        fs.writeFileSync(filepath, req.file.buffer);
        updates.photoUrl = `/uploads/employees/${filename}`;
      }

      // If password provided, hash it
      if (updates.password && updates.password.length > 0) {
        updates.password = await hashPassword(updates.password);
      } else {
        delete updates.password; // Don't update password if empty
      }

      const user = await storage.updateUser(id, updates);
      res.json(user);
    } catch (err: any) {
      console.error("Update User Error:", err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: "NIK atau Username sudah digunakan" });
      }
      res.status(400).json({ message: "Gagal memperbarui karyawan" });
    }
  });

  app.get(api.admin.dashboard.stats.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);

    const users = await storage.getAllUsers();
    const totalEmployees = users.filter(u => u.role === 'employee').length;

    // Present today - use Jakarta timezone for consistency
    const today = getJakartaDate();
    const allAttendance = await storage.getAttendanceHistory(undefined, undefined);
    const todayRecords = allAttendance.filter(a => {
      const dateStr = typeof a.date === 'string' ? a.date : new Date(a.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      return dateStr === today && (a.status === 'present' || a.status === 'late');
    });

    res.json({
      totalEmployees,
      presentToday: todayRecords.length,
    });
  });

  // --- Announcement Routes ---

  // uploadsDir already declared and configured at the top of registerRoutes

  app.get(api.announcements.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const list = await storage.getAnnouncements();
      // Filter expired on the fly or in DB query. Since DB query is simple select *, filter here.
      const now = new Date();
      const active = list.filter(a => !a.expiresAt || new Date(a.expiresAt).getTime() > now.getTime());
      res.json(active);
    } catch (err) {
      console.error("Error fetching announcements:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.announcements.create.path, upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);

    try {
      // Parse body (multipart/form-data means numbers come as strings)
      // We manually construct input object because z.parse might fail specific format
      // But let's try to match what schema expects

      let imageUrl = undefined;
      const multerReq = req as any;
      if (multerReq.file) {
        const filename = `${Date.now()}-${multerReq.file.originalname}`;
        const filepath = path.join(uploadsDir, filename);
        fs.writeFileSync(filepath, multerReq.file.buffer);
        imageUrl = `/uploads/${filename}`;
      }

      const inputData = {
        title: req.body.title,
        content: req.body.content,
        imageUrl: imageUrl,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined, // Handle empty string
      };

      const announcement = await storage.createAnnouncement({
        ...inputData,
        authorId: req.user!.id,
      });
      res.status(201).json(announcement);
    } catch (e) {
      console.error("Announcement Create Error:", e);
      res.status(400).json({ message: "Invalid input or server error" });
    }
  });

  // Admin: Get complaint stats
  app.get("/api/admin/complaints/stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);

    try {
      const count = await storage.getPendingComplaintsCount();
      res.json({ pendingCount: count });
    } catch (e) {
      console.error("Complaint Stats Error:", e);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);

    // We need to implement deleteAnnouncement in storage first, but for now let's do direct DB delete if possible 
    // or assume storage.deleteAnnouncement exists (it doesn't yet).
    // I will need to update storage.ts first! 
    // Wait, I can't update TWO files in one replace_file_content.
    // So I will update storage.ts in NEXT step.
    // For now, I will add the route and it will fail if method missing. 
    // Actually, I can use db directly here if I import db?
    // No, let's stick to storage pattern. I will add storage.deleteAnnouncement in next step.
    // So I'll comment out the call or just add it knowing I'll fix it immediately.

    try {
      const id = parseInt(req.params.id);
      await storage.deleteAnnouncement(id);
      res.sendStatus(204);
    } catch (e) {
      console.error(e);
      res.sendStatus(500);
    }
  });

  // --- Complaint Routes ---

  // Employee: create complaint with photos
  app.post("/api/complaints", upload.array('photos', 10), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const { title, description, captions } = req.body;
      const complaint = await storage.createComplaint({
        userId: req.user!.id,
        title,
        description,
      });

      // Handle uploaded photos
      const files = (req.files as Express.Multer.File[]) || [];
      const captionList = captions ? (Array.isArray(captions) ? captions : [captions]) : [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = `complaint-${Date.now()}-${i}-${file.originalname}`;
        const filepath = path.join(uploadsDir, filename);

        // Use async write to avoid blocking event loop
        await fs.promises.writeFile(filepath, file.buffer);
        const photoUrl = `/uploads/${filename}`;

        await storage.createComplaintPhoto({
          complaintId: complaint.id,
          photoUrl,
          caption: captionList[i] || null,
        });
      }

      res.status(201).json(complaint);
    } catch (e) {
      console.error("Complaint Create Error:", e);
      // Ensure we return JSON, not HTML, even if something weird happens
      if (!res.headersSent) {
        res.status(500).json({ message: "Gagal membuat pengaduan: Server error" });
      }
    }
  });

  // Employee: get own complaints
  app.get("/api/complaints", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const list = await storage.getComplaintsByUser(req.user!.id);
    res.json(list);
  });

  // Admin: get all complaints
  app.get("/api/admin/complaints", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);
    const list = await storage.getAllComplaints();
    res.json(list);
  });

  // Get complaint photos
  app.get("/api/complaints/:id/photos", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const photos = await storage.getComplaintPhotos(parseInt(req.params.id));
    res.json(photos);
  });

  // Admin: update complaint status
  app.patch("/api/admin/complaints/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);
    try {
      const updated = await storage.updateComplaintStatus(
        parseInt(req.params.id),
        req.body.status
      );
      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Gagal update status" });
    }
  });

  // --- Leave Request Routes ---

  app.get(api.leave.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const requests = await storage.getLeaveRequestsByUser(req.user!.id);
    res.json(requests);
  });

  app.get(api.leave.balance.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const year = new Date().getFullYear();
    const used = await storage.getApprovedLeaveDaysCount(req.user!.id, year);
    res.json({ used, remaining: 12 - used, limit: 12 });
  });

  app.post(api.leave.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { startDate, endDate, reason, selectedDates } = req.body;

    const year = new Date(startDate).getFullYear();
    const used = await storage.getApprovedLeaveDaysCount(req.user!.id, year);

    let requestedDays = 0;
    if (selectedDates && Array.isArray(selectedDates)) {
      requestedDays = selectedDates.length;
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    if (used + requestedDays > 12) {
      return res.status(400).json({ message: `Sisa kuota cuti Anda tidak mencukupi. (Terpakai: ${used}/12, Diminta: ${requestedDays})` });
    }

    const request = await storage.createLeaveRequest({
      userId: req.user!.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      selectedDates: selectedDates ? selectedDates.join(',') : null,
      reason,
      status: 'pending'
    });
    res.status(201).json(request);
  });

  app.post(api.leave.cancel.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    const requests = await storage.getLeaveRequestsByUser(req.user!.id);
    const request = requests.find(r => r.id === id);

    if (!request) return res.status(404).json({ message: "Permohonan tidak ditemukan" });
    if (request.status !== 'pending') return res.status(400).json({ message: "Hanya permohonan pending yang bisa dibatalkan" });

    const updated = await storage.updateLeaveRequestStatus(id, 'cancelled');
    res.json(updated);
  });

  // Admin Leave Routes
  app.get("/api/admin/leave-requests/recent", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);
    const requests = await storage.getRecentLeaveRequests(5);
    res.json(requests);
  });

  app.get(api.admin.attendance.leave.list.path, async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);
    const requests = await storage.getAllLeaveRequests();
    res.json(requests);
  });

  app.patch(api.admin.attendance.leave.update.path, async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user!.role !== 'admin') return res.sendStatus(401);
      const id = parseInt(req.params.id);
      const { status } = req.body;

      console.log(`[AdminLeaveUpdate] Processing ID: ${id}, Status: ${status}`);

      // Get the request first to know the dates
      const request = await storage.getLeaveRequestById(id);
      if (!request) {
        console.error(`[AdminLeaveUpdate] Request ${id} not found`);
        return res.status(404).json({ message: "Request not found" });
      }

      const updated = await storage.updateLeaveRequestStatus(id, status);
      console.log(`[AdminLeaveUpdate] Status updated to: ${status}`);

      // If approved, create attendance records automatically for those dates
      if (status === 'approved') {
        const datesToProcess: string[] = [];
        if (request.selectedDates) {
          console.log(`[AdminLeaveUpdate] Processing selected dates list`);
          datesToProcess.push(...request.selectedDates.split(',').filter(d => d.trim() !== ''));
        } else {
          console.log(`[AdminLeaveUpdate] Processing date range: ${request.startDate} to ${request.endDate}`);
          // Ensure we have valid dates
          let current = new Date(request.startDate);
          const end = new Date(request.endDate);

          // Safety check for absolute dates to avoid timezone shifts
          // If the date is string like YYYY-MM-DD, new Date() might be UTC
          if (typeof request.startDate === 'string' && request.startDate.includes('-')) {
            // Use UTC to avoid local timezone shifts which can change the day
            current = new Date(request.startDate + 'T00:00:00Z');
          }

          let safetyCounter = 0;
          while (current <= end && safetyCounter < 40) { // Safety limit of 40 days
            const dateStr = format(current, "yyyy-MM-dd");
            datesToProcess.push(dateStr);
            current.setUTCDate(current.getUTCDate() + 1);
            safetyCounter++;
          }
        }

        console.log(`[AdminLeaveUpdate] Dates to process: ${datesToProcess.join(', ')}`);

        for (const dateStr of datesToProcess) {
          if (!dateStr) continue;

          // Find existing record
          const existing = await storage.getAttendanceByUserAndDate(request.userId, dateStr);

          if (!existing) {
            await storage.createAttendance({
              userId: request.userId,
              date: dateStr as any,
              status: 'cuti',
              notes: `Cuti Disetujui: ${request.reason}`,
              shift: 'Management',
              sessionNumber: 1
            });
          } else {
            await storage.updateAttendance(existing.id, {
              status: 'cuti',
              notes: `Cuti Disetujui: ${request.reason}`
            });
          }
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error(`[AdminLeaveUpdate] FATAL ERROR:`, error);
      res.status(500).json({ message: "Internal Server Error", detail: error.message });
    }
  });

  return httpServer;
}
