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

  // Helper to handle photo upload
  async function handlePhotoUpload(
    req: Request,
    actionType: 'clockIn' | 'breakStart' | 'breakEnd' | 'clockOut'
  ): Promise<string | undefined> {
    console.log(`[handlePhotoUpload] Action: ${actionType}, Method: ${req.file ? 'Multipart' : 'Base64'}`);

    if (req.file) {
      // Multipart upload
      const result = await uploadFile(
        req.file.buffer,
        `attendance-${Date.now()}-${req.file.originalname}`,
        req.file.mimetype,
        {
          employeeName: (req.user as DbUser).fullName,
          actionType: actionType,
          timestamp: new Date()
        }
      );
      console.log(`[handlePhotoUpload] Multipart upload success: ${result.fileId}`);
      return result.fileId;
    } else if (req.body.checkInPhoto && req.body.checkInPhoto.startsWith('data:image')) {
      console.log(`[handlePhotoUpload] Base64 data length: ${req.body.checkInPhoto.length}`);
      // Base64 upload
      const matches = req.body.checkInPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const type = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const result = await uploadFile(
          buffer,
          `attendance-${Date.now()}.png`,
          type,
          {
            employeeName: (req.user as DbUser).fullName,
            actionType: actionType,
            timestamp: new Date()
          }
        );
        console.log(`[handlePhotoUpload] Base64 upload success: ${result.fileId}`);
        return result.fileId;
      }
    }
    console.warn(`[handlePhotoUpload] No photo data found in request payload for ${actionType}`);
    return undefined;
  }

  // --- Attendance Routes ---

  // Helper date function for Jakarta Timezone
  function getJakartaDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // Returns YYYY-MM-DD
  }

  // --- Attendance Routes ---

  app.post(api.attendance.clockIn.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const today = getJakartaDate();
      const userId = req.user!.id;

      // Check if already checked in
      const existing = await storage.getAttendanceByUserAndDate(userId, today);
      if (existing) {
        return res.status(400).json({ message: "Already checked in for today" });
      }

      const photoFileId = await handlePhotoUpload(req, 'clockIn');
      const location = req.body.location;
      const shift = req.body.shift; // 'Shift 1', 'Shift 2', 'Shift 3', 'Long Shift'

      // Determine status based on Shift Rules
      const now = new Date();
      // Using Jakarta Time for calculation
      const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      const hour = jakartaTime.getHours();
      const minute = jakartaTime.getMinutes();
      const timeInMinutes = hour * 60 + minute;

      let status = "present";

      /*
        Rules:
        Shift 1: Late if > 07:00 (implies > 07:00 and <= 10:00 per prompt, assuming entry window)
        Shift 2: Late if > 12:00 (and < 14:00)
        Shift 3: Late if > 15:00 (and < 17:00)
        Long Shift: Late if > 07:00 (and < 10:00)
      */

      if (shift === 'Shift 1' || shift === 'Long Shift' || shift === 'Tim Management') {
        // Late if > 07:00 (7 * 60 = 420 minutes)
        if (timeInMinutes > 420) {
          status = "late";
        }
      } else if (shift === 'Shift 2') {
        // Late if > 12:00 (12 * 60 = 720 minutes)
        if (timeInMinutes > 720) {
          status = "late";
        }
      } else if (shift === 'Shift 3') {
        // Late if > 15:00 (15 * 60 = 900 minutes)
        if (timeInMinutes > 900) {
          status = "late";
        }
      } else {
        // Fallback or default logic if no shift provided (though frontend should force it)
        // Default to Shift 1 logic or just present
        if (timeInMinutes > 420) {
          status = "late";
        }
      }

      const attendance = await storage.createAttendance({
        userId,
        date: today,
        checkIn: now,
        status: status,
        checkInPhoto: photoFileId,
        checkInLocation: location,
        shift: shift // Store the shift
      });

      res.json(attendance);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: (err as Error).message || "Internal Server Error" });
    }
  });

  app.post(api.attendance.clockOut.path, upload.single('photo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const today = getJakartaDate();
    const userId = req.user!.id;
    const existing = await storage.getAttendanceByUserAndDate(userId, today);

    if (!existing) {
      return res.status(400).json({ message: "No check-in record found for today" });
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
    const existing = await storage.getAttendanceByUserAndDate(userId, today);

    if (!existing) {
      return res.status(400).json({ message: "No check-in record found for today" });
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
    const existing = await storage.getAttendanceByUserAndDate(userId, today);

    if (!existing) {
      return res.status(400).json({ message: "No check-in record found for today" });
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
    const existing = await storage.getAttendanceByUserAndDate(userId, today);

    if (!existing) {
      return res.status(400).json({ message: "No attendance record to resume" });
    }

    // Recalculate status based on shift if it was 'permission'/'sick'
    // or just restore it to something sensible.
    // If it was 'permission', let's check shift again or just set to 'present'/'late'
    let status = existing.status;
    if (existing.status === 'permission' || existing.status === 'sick') {
      // Default to recalculate or just 'present' if we don't know
      // Better: use the same logic as clockIn
      const now = new Date(existing.checkIn!); // Use original checkIn time
      const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      const hour = jakartaTime.getHours();
      const minute = jakartaTime.getMinutes();
      const timeInMinutes = hour * 60 + minute;

      status = "present";
      const shift = existing.shift;
      if (shift === 'Shift 1' || shift === 'Long Shift' || shift === 'Tim Management') {
        if (timeInMinutes > 420) status = "late";
      } else if (shift === 'Shift 2') {
        if (timeInMinutes > 720) status = "late";
      } else if (shift === 'Shift 3') {
        if (timeInMinutes > 900) status = "late";
      } else {
        if (timeInMinutes > 420) status = "late";
      }
    }

    const attendance = await storage.updateAttendance(existing.id, {
      checkOut: null,
      checkOutPhoto: null,
      checkOutLocation: null,
      status: status,
      permitResumeAt: new Date(), // Record when they resumed work
      notes: existing.notes ? `${existing.notes} (Resumed)` : null
    });

    res.json(attendance);
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
    const record = await storage.getAttendanceByUserAndDate(req.user!.id, today);

    res.json(record || null);
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
    // Simple stats
    const totalEmployees = users.filter(u => u.role === 'employee').length;

    // Present today
    const today = new Date().toISOString().split('T')[0];
    const allAttendance = await storage.getAttendanceHistory(undefined, undefined); // This gets all history, might be heavy. 
    // Optimization: getAttendanceHistory filters by month, but here we want today.
    // I should add getAttendanceByDate to storage later or filter here.
    // Ideally storage.getAttendanceByDate(date).
    // For now, let's just filter in memory if dataset is small, or use what we have.
    const todayRecords = allAttendance.filter(a => a.date === today && a.status === 'present');

    res.json({
      totalEmployees,
      presentToday: todayRecords.length,
    });
  });

  // --- Announcement Routes ---

  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }

  // Serve uploads statically
  app.use('/uploads', express.static(uploadsDir));

  app.get(api.announcements.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const list = await storage.getAnnouncements();
    // Filter expired on the fly or in DB query. Since DB query is simple select *, filter here.
    const now = new Date();
    const active = list.filter(a => !a.expiresAt || new Date(a.expiresAt).getTime() > now.getTime());
    res.json(active);
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

  return httpServer;
}
