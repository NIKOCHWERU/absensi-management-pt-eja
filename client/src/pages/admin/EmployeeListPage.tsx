import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowLeft, UserPlus, Search, Calendar, Phone, Image as ImageIcon, ImageOff, MapPin, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { addMonths, subMonths, format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminEmployeeList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [attendanceViewDate, setAttendanceViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [weekDate, setWeekDate] = useState(new Date());
  
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });
  
  // Fetch attendance for selected employee if needed
  const { data: employeeAttendance } = useQuery<Attendance[]>({
      queryKey: ["/api/attendance", selectedEmployee?.id, attendanceViewDate.toISOString()],
      queryFn: async () => {
          if (!selectedEmployee) return [];
          const res = await fetch(`/api/attendance?userId=${selectedEmployee.id}`);
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
      },
      enabled: !!selectedEmployee
  });

  const employees = users?.filter(u => u.role === 'employee') || [];
  
  // Create a more flexible schema for the form
  const formSchema = z.object({
    fullName: z.string().min(1, "Nama lengkap wajib diisi"),
    password: z.string().optional(),
    role: z.string(),
    nik: z.string().min(1, "NIK wajib diisi"),
    branch: z.string().optional(),
    position: z.string().optional(),
    shift: z.string().optional(),
    email: z.string().optional(),
    username: z.string().optional(),
    phoneNumber: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      password: "",
      role: "employee",
      nik: "",
      branch: "Pusat",
      position: "Staff",
      shift: "Shift 1",
      email: "", 
      username: "",
      phoneNumber: ""
    }
  });

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);

  const upsertMutation = useMutation({
    mutationFn: async (data: any) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                formData.append(key, data[key]);
            }
        });
        
        if (selectedPhoto) {
            formData.append('photo', selectedPhoto);
        }

        const url = selectedEmployee ? `/api/admin/users/${selectedEmployee.id}` : "/api/admin/users";
        const method = selectedEmployee ? "PATCH" : "POST";

        const res = await fetch(url, {
            method,
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Failed to save");
        }
        return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        toast({ title: "Berhasil", description: selectedEmployee ? "Karyawan diperbarui" : "Karyawan ditambahkan" });
        setOpen(false);
        form.reset();
        setSelectedEmployee(null);
        setSelectedPhoto(null);
    },
    onError: (err: any) => {
        toast({ title: "Gagal", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Berhasil", description: "Karyawan berhasil dihapus" });
    },
    onError: (err: any) => {
      toast({ title: "Gagal", description: "Gagal menghapus karyawan: " + err.message, variant: "destructive" });
    }
  });

  const handleNext = () => {
    if (viewMode === 'month') setAttendanceViewDate(d => addMonths(d, 1));
    else setWeekDate(d => addWeeks(d, 1));
  };
  
  const handlePrev = () => {
    if (viewMode === 'month') setAttendanceViewDate(d => subMonths(d, 1));
    else setWeekDate(d => subWeeks(d, 1));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       <header className="bg-white border-b border-gray-200 p-4 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800">Daftar Karyawan</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => {
                        setSelectedEmployee(null);
                        form.reset({
                            fullName: "",
                            password: "",
                            role: "employee",
                            nik: "",
                            branch: "Pusat",
                            position: "Staff",
                            shift: "Shift 1",
                            email: "", 
                            username: "",
                            phoneNumber: ""
                        });
                    }}
                >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Tambah Karyawan
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{selectedEmployee ? "Edit Karyawan" : "Tambah Karyawan Baru"}</DialogTitle>
                </DialogHeader>
                <div className="flex justify-center mb-4">
                    <div className="relative group">
                        <div className="w-24 aspect-[2/3] bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden rounded-lg shadow-sm">
                            {selectedPhoto ? (
                                <img src={URL.createObjectURL(selectedPhoto)} className="w-full h-full object-cover" />
                            ) : selectedEmployee?.photoUrl ? (
                                <img src={selectedEmployee.photoUrl} className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="w-8 h-8 text-gray-400" />
                            )}
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-lg cursor-pointer transition-opacity">
                            <span className="text-[10px] font-bold">Ganti Foto</span>
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => setSelectedPhoto(e.target.files?.[0] || null)}
                            />
                        </label>
                    </div>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((d) => upsertMutation.mutate(d))} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="fullName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Lengkap</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="nik"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>NIK (Nomor Induk Karyawan)</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nomor HP</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ''} placeholder="08..." /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl><Input type="password" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="branch"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cabang</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="position"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Jabatan</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="shift"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Shift</FormLabel>
                                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white" disabled={upsertMutation.isPending}>
                            {upsertMutation.isPending ? "Menyimpan..." : "Simpan Data"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
          </Dialog>
       </header>

       <main className="p-8 flex-1">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input placeholder="Cari karyawan..." className="pl-9" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>NIK</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp, index) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 aspect-[2/3] bg-gray-100 rounded flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                          {emp.photoUrl ? (
                            <img src={emp.photoUrl} className="w-full h-full object-cover" alt={emp.fullName} />
                          ) : (
                            <div className="text-xs font-bold text-gray-400">{emp.fullName.charAt(0)}</div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{emp.fullName}</span>
                          {emp.phoneNumber && (
                             <span className="text-xs text-gray-500 flex items-center gap-1">
                               <Phone className="w-3 h-3" /> {emp.phoneNumber}
                             </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-gray-600">{emp.nik}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>{emp.branch}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => {
                                setSelectedEmployee(emp);
                                form.reset({
                                    fullName: emp.fullName,
                                    nik: emp.nik || "",
                                    role: emp.role,
                                    branch: emp.branch || "",
                                    position: emp.position || "",
                                    shift: emp.shift || "",
                                    phoneNumber: emp.phoneNumber || "",
                                    username: emp.username || "",
                                    password: "" // Keep empty to not change
                                });
                                setOpen(true);
                            }}
                        >
                            Edit
                        </Button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={() => {
                                        setSelectedEmployee(emp);
                                        setAttendanceViewDate(new Date());
                                        setSelectedDate(null);
                                    }}
                                >
                                    <Calendar className="w-4 h-4 mr-1" />
                                    Absensi
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Riwayat Absensi - {emp.fullName}</DialogTitle>
                                </DialogHeader>
                                <div className="mt-4">
                                    <AttendanceCalendar 
                                        currentDate={attendanceViewDate}
                                        onNextMonth={handleNext}
                                        onPrevMonth={handlePrev}
                                        attendanceData={employeeAttendance || []}
                                        onDateSelect={(date) => {
                                            setSelectedDate(date);
                                        }}
                                        viewMode={viewMode}
                                        setViewMode={setViewMode}
                                        weekDate={weekDate}
                                    />
                                </div>
                                
                                {/* Detailed Inline View - Shows only when a date is selected */}
                                {selectedDate && (
                                    <div className="mt-8 space-y-6">
                                        <h4 className="font-bold text-gray-800 border-b pb-2">
                                            Detail {format(selectedDate, "EEEE, d MMM yyyy", { locale: id })}
                                        </h4>
                                        
                                        {(() => {
                                            // Find record for the selected date
                                            const att = employeeAttendance?.find(a => 
                                                new Date(a.date).toDateString() === selectedDate.toDateString()
                                            );

                                            if (!att) {
                                                return (
                                                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                        <p className="text-gray-400">Tidak ada data absensi pada tanggal ini.</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={att.id} className="bg-white border rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-4">
                                                    <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                                                        <span className="font-bold text-gray-800">Status Absensi</span>
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                            att.status === 'present' ? 'bg-green-100 text-green-700' : 
                                                            att.status === 'late' ? 'bg-red-100 text-red-700' :
                                                            att.status === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                            att.status === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {att.status === 'present' ? 'Hadir' : 
                                                             att.status === 'late' ? 'Telat' : 
                                                             att.status === 'sick' ? 'Sakit' : 
                                                             att.status === 'permission' ? 'Izin' : 
                                                             att.status === 'absent' ? 'Alpha' : att.status}
                                                        </span>
                                                    </div>
                                                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        {/* Masuk */}
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-gray-500 text-center">Masuk</p>
                                                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                {att.checkInPhoto ? (
                                                                    <a 
                                                                        href={`https://drive.google.com/file/d/${att.checkInPhoto}/view`} 
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-full h-full flex items-center justify-center hover:bg-blue-50 transition-colors group"
                                                                    >
                                                                        <ImageIcon className="w-12 h-12 text-blue-600 group-hover:scale-110 transition-transform" />
                                                                    </a>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                        <ImageOff className="w-12 h-12" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-center font-mono text-sm font-bold text-green-600">
                                                                {att.checkIn ? new Date(att.checkIn).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                                                            </p>
                                                        </div>

                                                        {/* Mulai Istirahat */}
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-gray-500 text-center">Mulai Istirahat</p>
                                                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                {att.breakStartPhoto ? (
                                                                    <a 
                                                                        href={`https://drive.google.com/file/d/${att.breakStartPhoto}/view`} 
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-full h-full flex items-center justify-center hover:bg-orange-50 transition-colors group"
                                                                    >
                                                                        <ImageIcon className="w-12 h-12 text-orange-600 group-hover:scale-110 transition-transform" />
                                                                    </a>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                        <ImageOff className="w-12 h-12" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-center font-mono text-sm font-bold text-orange-600">
                                                                {att.breakStart ? new Date(att.breakStart).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                                                            </p>
                                                        </div>

                                                        {/* Selesai Istirahat */}
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-gray-500 text-center">Selesai Istirahat</p>
                                                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                {att.breakEndPhoto ? (
                                                                    <a 
                                                                        href={`https://drive.google.com/file/d/${att.breakEndPhoto}/view`} 
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-full h-full flex items-center justify-center hover:bg-orange-50 transition-colors group"
                                                                    >
                                                                        <ImageIcon className="w-12 h-12 text-orange-600 group-hover:scale-110 transition-transform" />
                                                                    </a>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                        <ImageOff className="w-12 h-12" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-center font-mono text-sm font-bold text-orange-600">
                                                                {att.breakEnd ? new Date(att.breakEnd).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                                                            </p>
                                                        </div>

                                                        {/* Pulang */}
                                                        <div className="space-y-2">
                                                            <p className="text-xs font-semibold text-gray-500 text-center">Pulang</p>
                                                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center">
                                                                {att.checkOutPhoto ? (
                                                                    <a 
                                                                        href={`https://drive.google.com/file/d/${att.checkOutPhoto}/view`} 
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="w-full h-full flex items-center justify-center hover:bg-red-50 transition-colors group"
                                                                    >
                                                                        <ImageIcon className="w-12 h-12 text-red-600 group-hover:scale-110 transition-transform" />
                                                                    </a>
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                        <ImageOff className="w-12 h-12" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-center font-mono text-sm font-bold text-red-600">
                                                                {att.checkOut ? new Date(att.checkOut).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="px-4 pb-4 text-xs text-gray-500 flex items-center gap-1">
                                                        📍 {(() => {
                                                            const loc = att.checkInLocation || 'Lokasi tidak terdeteksi';
                                                            // Check if it's coordinates (format: lat,lng)
                                                            if (loc.match(/^-?\d+\.?\d*,-?\d+\.?\d*$/)) {
                                                                return (
                                                                    <a 
                                                                        href={`https://www.google.com/maps/search/?api=1&query=${loc}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-600 hover:underline flex items-center"
                                                                    >
                                                                        {loc} (Lihat di Peta)
                                                                        <MapPin className="ml-1 h-3 w-3" />
                                                                    </a>
                                                                );
                                                            }
                                                            // Otherwise display as address
                                                            return <span className="line-clamp-2">{loc}</span>;
                                                        })()}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Default List if no date selected: Last 5 Activities */}
                                {!selectedDate && (
                                    <div className="mt-8">
                                        <h4 className="font-bold text-gray-800 mb-4">Aktivitas Terakhir</h4>
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-gray-500">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left">Tanggal</th>
                                                        <th className="px-4 py-2 text-left">Masuk</th>
                                                        <th className="px-4 py-2 text-left">Pulang</th>
                                                        <th className="px-4 py-2 text-left">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {employeeAttendance?.slice(0, 5).map(att => (
                                                        <tr key={att.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedDate(new Date(att.date))}>
                                                            <td className="px-4 py-2">{format(new Date(att.date), "EEEE, d MMM yyyy", { locale: id })}</td>
                                                            <td className="px-4 py-2 font-mono text-green-600">
                                                                {att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 font-mono text-red-600">
                                                                {att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <span className={
                                                                    att.status === 'present' ? 'text-green-600 font-bold' : 
                                                                    att.status === 'late' ? 'text-red-600 font-bold' : 
                                                                    'text-gray-600'
                                                                }>
                                                                    {att.status === 'present' ? 'Hadir' : 
                                                                     att.status === 'late' ? 'Telat' : 
                                                                     att.status === 'sick' ? 'Sakit' : 
                                                                     att.status === 'permission' ? 'Izin' : 
                                                                     att.status === 'absent' ? 'Alpha' : att.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2 text-center">*Klik tanggal di kalender atau di tabel untuk melihat detail foto.</p>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                                <Trash2 className="w-4 h-4 mr-1" />
                                Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apakah anda yakin?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tindakan ini tidak dapat dibatalkan. Data karyawan <strong>{emp.fullName}</strong> akan dihapus permanen beserta data absensinya.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteMutation.mutate(emp.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Ya, Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {employees.length === 0 && (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                        Belum ada data karyawan.
                     </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
       </main>
    </div>
  );
}
