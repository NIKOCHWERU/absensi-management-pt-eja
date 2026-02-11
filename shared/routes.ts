import { z } from 'zod';
import { insertUserSchema, insertAttendanceSchema, insertAnnouncementSchema, users, attendance, announcements } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  })
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(), // Email for admin, NIK for employee
        password: z.string(),
        role: z.enum(['admin', 'employee']).default('employee')
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  attendance: {
    clockIn: {
      method: 'POST' as const,
      path: '/api/attendance/clock-in',
      input: z.object({
        checkInPhoto: z.string().optional(),
        location: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof attendance.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    clockOut: {
      method: 'POST' as const,
      path: '/api/attendance/clock-out',
      responses: {
        200: z.custom<typeof attendance.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    breakStart: {
      method: 'POST' as const,
      path: '/api/attendance/break-start',
      responses: {
        200: z.custom<typeof attendance.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    breakEnd: {
      method: 'POST' as const,
      path: '/api/attendance/break-end',
      responses: {
        200: z.custom<typeof attendance.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    permit: {
      method: 'POST' as const,
      path: '/api/attendance/permit',
      input: z.object({
        notes: z.string(),
        type: z.enum(['sick', 'permission']),
      }),
      responses: {
        200: z.custom<typeof attendance.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/attendance',
      input: z.object({
        month: z.string().optional(), // YYYY-MM
        userId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof attendance.$inferSelect>()),
      },
    },
    today: {
      method: 'GET' as const,
      path: '/api/attendance/today',
      responses: {
        200: z.custom<typeof attendance.$inferSelect>().nullable(),
      },
    },
    resume: {
      method: 'POST' as const,
      path: '/api/attendance/resume',
      responses: {
        200: z.custom<typeof attendance.$inferSelect>(),
        400: errorSchemas.validation,
      },
    }
  },
  announcements: {
    list: {
      method: 'GET' as const,
      path: '/api/announcements',
      responses: {
        200: z.array(z.custom<typeof announcements.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/announcements',
      input: insertAnnouncementSchema,
      responses: {
        201: z.custom<typeof announcements.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  admin: {
    users: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/users',
        responses: {
          200: z.array(z.custom<typeof users.$inferSelect>()),
          401: errorSchemas.unauthorized,
        },
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/users',
        input: insertUserSchema,
        responses: {
          201: z.custom<typeof users.$inferSelect>(),
          400: errorSchemas.validation,
        },
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/users/:id',
        responses: {
          204: z.void(),
          400: errorSchemas.validation,
          401: errorSchemas.unauthorized,
        },
      },
    },
    dashboard: {
      stats: {
        method: 'GET' as const,
        path: '/api/admin/stats',
        responses: {
          200: z.object({
            totalEmployees: z.number(),
            presentToday: z.number(),
            // Add more stats as needed
          }),
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
