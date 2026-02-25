import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { format, subMonths, addMonths, isSameMonth, setDate, isAfter, isBefore, isEqual, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, FileDown, ArrowLeft, Search, ArrowUpDown, MessageSquare, Plus, Edit2 } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { differenceInMinutes } from "date-fns";
import { calculateDailyTotal, formatDuration } from "@/lib/attendance";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Image as ImageIcon } from "lucide-react";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function RecapPage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State for selected period (e.g., Feb 2026 means Jan 26 - Feb 25)
    // We store the "target" month (Feb 2026)
    const [targetDate, setTargetDate] = useState(new Date());
    const [selectedLateReason, setSelectedLateReason] = useState<Attendance | null>(null);

    // Manual Attendance Modal State
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [editingAttendance, setEditingAttendance] = useState<Partial<Attendance> | null>(null);
    const [manualEntry, setManualEntry] = useState({
        userId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        status: "present",
        notes: "",
        shift: "Management"
    });

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: allAttendance } = useQuery<Attendance[]>({
        queryKey: ["/api/attendance"],
    });

    const { data: complaintsStats } = useQuery<{ pendingCount: number }>({
        queryKey: ["/api/admin/complaints/stats"],
        refetchInterval: 10000,
    });

    const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("monthly");

    // Calculate Period Range
    let startDate: Date;
    let endDate: Date;

    if (reportType === "daily") {
        startDate = startOfDay(targetDate);
        endDate = endOfDay(targetDate);
    } else if (reportType === "weekly") {
        startDate = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(targetDate, { weekStartsOn: 1 });
    } else {
        // Default: 26th of previous month to 25th of current month
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 26);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 25);
    }

    const handlePrev = () => {
        if (reportType === "daily") setTargetDate(d => subDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => subDays(d, 7));
        else setTargetDate(d => subMonths(d, 1));
    };

    const handleNext = () => {
        if (reportType === "daily") setTargetDate(d => addDays(d, 1));
        else if (reportType === "weekly") setTargetDate(d => addDays(d, 7));
        else setTargetDate(d => addMonths(d, 1));
    };

    const [searchName, setSearchName] = useState("");
    const [sortField, setSortField] = useState<'date' | 'name'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const getUserName = (userId: number) => {
        return users?.find(u => u.id === userId)?.fullName || "Unknown";
    };

    // Filter Data by Date Period
    const filteredRecords = allAttendance?.filter(att => {
        const attDate = new Date(att.date);
        const d = new Date(attDate);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    }) || [];

    // Filter by Name & Sort
    const processedData = filteredRecords
        .filter(att => {
            const name = getUserName(att.userId).toLowerCase();
            return name.includes(searchName.toLowerCase());
        })
        .sort((a, b) => {
            if (sortField === 'date') {
                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                if (timeA !== timeB) return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;

                // Secondary sort: Latest session first (DESC) or Earliest (ASC)
                const checkInA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
                const checkInB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
                return sortOrder === 'desc' ? checkInB - checkInA : checkInA - checkInB;
            } else {
                const nameA = getUserName(a.userId).toLowerCase();
                const nameB = getUserName(b.userId).toLowerCase();
                if (nameA < nameB) return sortOrder === 'asc' ? -1 : 1;
                if (nameA > nameB) return sortOrder === 'asc' ? 1 : -1;

                const timeA = new Date(a.date).getTime();
                const timeB = new Date(b.date).getTime();
                return timeB - timeA;
            }
        });

    const toggleSort = (field: 'date' | 'name') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    // Pre-calculate daily totals for fast lookup
    const dailyTotals = new Map<string, number>();
    processedData.forEach(row => {
        const key = `${format(new Date(row.date), "yyyy-MM-dd")}-${row.userId}`;
        if (!dailyTotals.has(key)) {
            // Find all records for this day/user
            const dayRecords = processedData.filter(r =>
                format(new Date(r.date), "yyyy-MM-dd") === format(new Date(row.date), "yyyy-MM-dd") &&
                r.userId === row.userId
            );
            const { netWorkMins } = calculateDailyTotal(dayRecords);
            dailyTotals.set(key, netWorkMins);
        }
    });

    const calculateHours = (start?: Date | string | null, end?: Date | string | null) => {
        if (!start || !end) return 0;
        return differenceInMinutes(new Date(end), new Date(start));
    };

    const manualMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(api.admin.attendance.manual.path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Gagal menyimpan data");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
            setIsManualModalOpen(false);
            setEditingAttendance(null);
            toast({
                title: "Berhasil",
                description: "Data absensi telah diperbarui.",
            });
        },
        onError: (err: any) => {
            toast({
                title: "Gagal",
                description: err.message,
                variant: "destructive",
            });
        }
    });

    const handleOpenManualModal = (existing?: Attendance) => {
        if (existing) {
            setEditingAttendance(existing);
            setManualEntry({
                userId: String(existing.userId),
                date: format(new Date(existing.date), "yyyy-MM-dd"),
                status: existing.status || "present",
                notes: existing.notes || "",
                shift: existing.shift || "Management"
            });
        } else {
            setEditingAttendance(null);
            setManualEntry({
                userId: "",
                date: format(new Date(), "yyyy-MM-dd"),
                status: "present",
                notes: "",
                shift: "Management"
            });
        }
        setIsManualModalOpen(true);
    };

    const formatDuration = (minutes: number) => {
        if (minutes <= 0) return "-";
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}j ${m}m`;
    };

    const handleExport = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const tableRows = processedData.map((row, index) => {
            let workMins = calculateHours(row.checkIn, row.checkOut);
            if ((row as any).permitExitAt && (row as any).permitResumeAt) {
                const permitMins = calculateHours((row as any).permitExitAt, (row as any).permitResumeAt);
                workMins = Math.max(0, workMins - permitMins);
            }
            const breakMins = calculateHours(row.breakStart, row.breakEnd);
            const netMins = Math.max(0, workMins - breakMins);

            return `
            <tr>
                <td>${index + 1}</td>
                <td>${format(new Date(row.date), "dd/MM/yyyy")}</td>
                <td>${getUserName(row.userId)}</td>
                <td>${row.checkIn ? format(new Date(row.checkIn), "HH:mm") : "-"}</td>
                <td>${row.breakStart ? format(new Date(row.breakStart), "HH:mm") : "-"}</td>
                <td>${row.breakEnd ? format(new Date(row.breakEnd), "HH:mm") : "-"}</td>
                <td>${row.checkOut ? format(new Date(row.checkOut), "HH:mm") : "-"}</td>
                <td><b>${formatDuration(netMins)}</b></td>
                <td>${formatDuration(breakMins)}</td>
                <td>${(row.status === 'present' ? 'Hadir' :
                    row.status === 'late' ? 'Telat' :
                        row.status === 'sick' ? 'Sakit' :
                            row.status === 'permission' ? 'Izin' :
                                row.status === 'absent' ? 'Alpha' : row.status) +
                ((row as any).sessionNumber > 1 ? ` (Sesi ${(row as any).sessionNumber})` : '')
                }</td>
                <td>${row.notes || "-"}</td>
            </tr>
        `;
        }).join('');

        const html = `
        <html>
            <head>
                <title>Laporan Absensi - ${format(targetDate, "MMMM yyyy", { locale: id })}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
                    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo-section { display: flex; align-items: center; gap: 15px; }
                    .logo-img { width: 50px; height: 50px; object-fit: contain; border-radius: 12px; }
                    .company-info h1 { margin: 0; font-size: 24px; color: #111; }
                    .company-info p { margin: 5px 0 0; color: #666; font-size: 14px; }
                    .report-title { text-align: center; margin-bottom: 30px; }
                    .report-title h2 { margin: 0; color: #111; }
                    .report-title p { margin: 5px 0 0; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 12px 8px; border-bottom: 1px solid #e2e8f0; }
                    td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; color: #64748b; }
                    .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: right; }
                    .signature-section { 
                        margin-top: 80px; 
                        display: flex; 
                        justify-content: space-between; 
                        padding: 0 50px;
                    }
                    .signature-box { 
                        text-align: center; 
                        width: 200px;
                    }
                    .signature-box p { 
                        margin-bottom: 60px; 
                        font-weight: bold; 
                        font-size: 12px;
                        color: #475569;
                    }
                    .signature-line { 
                        border-top: 1.5px solid #475569; 
                        padding-top: 10px;
                        font-weight: bold;
                        font-size: 14px;
                        color: #1e293b;
                    }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-section">
                        <img src="/logo_elok_buah.jpg" class="logo-img" alt="Logo PT Elok Jaya Abadhi" />
                        <div class="company-info">
                            <h1>PT ELOK JAYA ABADHI</h1>
                            <p>Sistem Manajemen Kehadiran Digital</p>
                        </div>
                    </div>
                </div>
                    <div class="report-title">
                        <h2>LAPORAN REKAPITULASI ABSENSI</h2>
                        <p>Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : 'Bulanan'}</p>
                        <p>Periode: ${format(startDate, "EEEE, d MMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMM yyyy", { locale: id })}</p>
                    </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px;">No</th>
                            <th>Tanggal</th>
                            <th>Nama Karyawan</th>
                            <th>Masuk</th>
                            <th>Istirahat</th>
                            <th>Selesai</th>
                            <th>Pulang</th>
                            <th>Jam Kerja</th>
                            <th>Total Istirahat</th>
                            <th>Status</th>
                            <th>Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                <div class="signature-section">
                    <div class="signature-box">
                        <p>CHECKED BY</p>
                        <div class="signature-line">NIKO</div>
                    </div>
                    <div class="signature-box">
                        <p>APPROVED BY</p>
                        <div class="signature-line">CLAVERINA</div>
                    </div>
                </div>
                <div class="footer">
                    Dicetak pada: ${format(new Date(), "d MMMM yyyy HH:mm", { locale: id })}
                </div>
                <script>
                    window.onload = () => {
                        window.print();
                        // window.close();
                    };
                </script>
            </body>
        </html>
    `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 p-4 px-8 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold text-gray-800">Rekap Absensi Management PT ELOK JAYA ABADHI</h1>
                </div>
                <div className="flex items-center gap-2 bg-white border rounded-md p-1">
                    <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
                        <SelectTrigger className="w-[120px] h-8 border-none bg-transparent">
                            <SelectValue placeholder="Tipe Laporan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="daily">Harian</SelectItem>
                            <SelectItem value="weekly">Mingguan</SelectItem>
                            <SelectItem value="monthly">Bulanan</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                    <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                        {reportType === 'daily' ? format(targetDate, "d MMM yyyy", { locale: id }) :
                            reportType === 'weekly' ? `${format(startDate, "d MMM")} - ${format(endDate, "d MMM yyyy", { locale: id })}` :
                                format(targetDate, "MMMM yyyy", { locale: id })}
                    </span>
                    <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <main className="p-8 flex-1 overflow-auto">
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle>Laporan Bulanan</CardTitle>
                            <p className="text-sm text-gray-500">
                                Periode: {format(startDate, "EEEE, d MMM yyyy", { locale: id })} - {format(endDate, "EEEE, d MMM yyyy", { locale: id })}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Cari nama..."
                                    className="pl-9"
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" className="gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleOpenManualModal()}>
                                <Plus className="h-4 w-4" /> Input Manual
                            </Button>
                            <Button variant="outline" className="gap-2" onClick={handleExport}>
                                <FileDown className="h-4 w-4" /> Export
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('date')}>
                                            <div className="flex items-center gap-1">Tanggal <ArrowUpDown className="h-3 w-3" /></div>
                                        </th>
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('name')}>
                                            <div className="flex items-center gap-1">Nama Karyawan <ArrowUpDown className="h-3 w-3" /></div>
                                        </th>
                                        <th className="px-4 py-3">Masuk</th>
                                        <th className="px-4 py-3">Istirahat</th>
                                        <th className="px-4 py-3">Selesai</th>
                                        <th className="px-4 py-3">Pulang</th>
                                        <th className="px-4 py-3">Jam Kerja</th>
                                        <th className="px-4 py-3">Total Istirahat</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {processedData.map((row, index) => {
                                        // Calculate per-session stats
                                        const { netWorkMins: sessionNetMins, totalBreakMins: sessionBreakMins } = calculateDailyTotal([row]);

                                        // Grouping Logic: Check if same as previous row
                                        const dateStr = format(new Date(row.date), "yyyy-MM-dd");
                                        const key = `${dateStr}-${row.userId}`;
                                        const dailyTotalMins = dailyTotals.get(key) || 0;

                                        const prevRow = index > 0 ? processedData[index - 1] : null;
                                        const isSameDayAndUser = prevRow &&
                                            format(new Date(prevRow.date), "yyyy-MM-dd") === dateStr &&
                                            prevRow.userId === row.userId;

                                        return (
                                            <tr key={row.id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 text-gray-900 font-medium relative">
                                                    {isSameDayAndUser ? (
                                                        <div className="absolute left-8 top-0 h-full w-px bg-gray-200"></div> /* Connector */
                                                    ) : (
                                                        format(new Date(row.date), "dd/MM/yyyy")
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {isSameDayAndUser ? "" : getUserName(row.userId)}
                                                </td>
                                                <td className="px-4 py-3 text-green-600 font-mono">
                                                    {row.checkIn ? format(new Date(row.checkIn), "HH:mm") : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-green-600 font-mono">
                                                    {row.breakStart ? format(new Date(row.breakStart), "HH:mm") : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-green-600 font-mono">
                                                    {row.breakEnd ? format(new Date(row.breakEnd), "HH:mm") : "-"}
                                                </td>
                                                <td className="px-4 py-3 text-red-600 font-mono">
                                                    {row.checkOut ? format(new Date(row.checkOut), "HH:mm") : "-"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {!isSameDayAndUser && (
                                                        <div className="text-gray-900 font-bold mb-1">
                                                            Total: {formatDuration(dailyTotalMins)}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-gray-500">
                                                        Sesi: {formatDuration(sessionNetMins)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500">
                                                    {sessionBreakMins > 0 ? formatDuration(sessionBreakMins) : "-"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                ${row.status === 'present' ? 'bg-green-100 text-green-700' :
                                                            row.status === 'late' ? 'bg-orange-100 text-orange-700' :
                                                                row.status === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                                    row.status === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                                        row.status === 'cuti' ? 'bg-teal-100 text-teal-700' :
                                                                            'bg-gray-100 text-gray-700'}`}>
                                                        {row.status === 'present' ? 'Hadir' :
                                                            row.status === 'late' ? 'Telat' :
                                                                row.status === 'sick' ? 'Sakit' :
                                                                    row.status === 'permission' ? 'Izin' :
                                                                        row.status === 'cuti' ? 'Cuti' :
                                                                            row.status === 'absent' ? 'Alpha' : row.status}
                                                        {(row as any).sessionNumber > 1 && ` (Sesi ${(row as any).sessionNumber})`}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 italic max-w-xs">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span>{row.notes || "-"}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-gray-400 hover:text-green-600"
                                                                onClick={() => handleOpenManualModal(row)}
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        {(row as any).lateReason && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-auto p-0 text-[11px] text-red-600 hover:text-red-700 hover:bg-transparent justify-start font-bold uppercase tracking-tight flex items-center gap-1.5"
                                                                onClick={() => setSelectedLateReason(row)}
                                                            >
                                                                {(row as any).lateReasonPhoto ? <Camera className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                                                                Lihat Alasan Telat
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {processedData.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                                                Tidak ada data absensi untuk periode ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={!!selectedLateReason} onOpenChange={(open) => !open && setSelectedLateReason(null)}>
                <DialogContent className="sm:max-w-md bg-white border-zinc-200 text-zinc-900 rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-red-600 uppercase">Alasan Keterlambatan</DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            Detail alasan yang diberikan oleh karyawan saat clock-in terlambat.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedLateReason && (
                        <div className="space-y-4 mt-2">
                            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Karyawan</p>
                                <p className="font-bold text-zinc-800">{getUserName(selectedLateReason.userId)}</p>
                                <p className="text-xs text-zinc-500 font-medium">
                                    {format(new Date(selectedLateReason.checkIn!), "HH:mm")} - {format(new Date(selectedLateReason.date), "dd MMMM yyyy", { locale: id })}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Alasan</p>
                                <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50 min-h-[80px]">
                                    <p className="text-sm text-zinc-700 leading-relaxed">{(selectedLateReason as any).lateReason}</p>
                                </div>
                            </div>
                            {(selectedLateReason as any).lateReasonPhoto && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bukti Foto</p>
                                    <div className="aspect-video bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200">
                                        <img
                                            src={`/uploads/${(selectedLateReason as any).lateReasonPhoto}`}
                                            alt="Bukti Telat"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                // If it's a base64 string from a failed upload or recent submission
                                                const target = e.target as HTMLImageElement;
                                                if (!target.src.includes('base64') && (selectedLateReason as any).lateReasonPhoto.length > 100) {
                                                    target.src = (selectedLateReason as any).lateReasonPhoto;
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="pt-4">
                        <Button
                            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl h-12"
                            onClick={() => setSelectedLateReason(null)}
                        >
                            Tutup
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
                <DialogContent className="sm:max-w-[425px] bg-white rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-900">
                            {editingAttendance ? "Edit Data Absensi" : "Input Absensi Manual"}
                        </DialogTitle>
                        <DialogDescription>
                            Gunakan ini untuk koreksi data atau input jika karyawan cuti/tidak absen.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Pilih Karyawan</Label>
                            <Select
                                value={manualEntry.userId}
                                onValueChange={(v) => setManualEntry(prev => ({ ...prev, userId: v }))}
                                disabled={!!editingAttendance}
                            >
                                <SelectTrigger className="rounded-xl border-gray-200 h-10">
                                    <SelectValue placeholder="Pilih karyawan..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {users?.filter(u => u.role === 'employee').map(u => (
                                        <SelectItem key={u.id} value={String(u.id)}>{u.fullName} ({u.nik || "Tidak ada NIK"})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tanggal</Label>
                                <Input
                                    type="date"
                                    value={manualEntry.date}
                                    onChange={(e) => setManualEntry(prev => ({ ...prev, date: e.target.value }))}
                                    className="rounded-xl border-gray-200"
                                    disabled={!!editingAttendance}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Shift</Label>
                                <Select
                                    value={manualEntry.shift}
                                    onValueChange={(v) => setManualEntry(prev => ({ ...prev, shift: v }))}
                                >
                                    <SelectTrigger className="rounded-xl border-gray-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Management">Management</SelectItem>
                                        <SelectItem value="Office">Office</SelectItem>
                                        <SelectItem value="Security">Security</SelectItem>
                                        <SelectItem value="Warehouse">Warehouse</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Status Kehadiran</Label>
                            <Select
                                value={manualEntry.status}
                                onValueChange={(v) => setManualEntry(prev => ({ ...prev, status: v }))}
                            >
                                <SelectTrigger className="rounded-xl border-gray-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="present">Hadir</SelectItem>
                                    <SelectItem value="late">Telat</SelectItem>
                                    <SelectItem value="sick">Sakit</SelectItem>
                                    <SelectItem value="permission">Izin</SelectItem>
                                    <SelectItem value="cuti">Cuti</SelectItem>
                                    <SelectItem value="absent">Alpha</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Keterangan (Notes)</Label>
                            <Textarea
                                placeholder="Masukkan alasan atau catatan..."
                                value={manualEntry.notes}
                                onChange={(e) => setManualEntry(prev => ({ ...prev, notes: e.target.value }))}
                                className="rounded-xl border-gray-200 resize-none h-24"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setIsManualModalOpen(false)}>
                            Batal
                        </Button>
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl h-11 font-bold"
                            onClick={() => {
                                if (!manualEntry.userId) return toast({ title: "Error", description: "Pilih karyawan terlebih dahulu", variant: "destructive" });
                                manualMutation.mutate({
                                    ...manualEntry,
                                    userId: parseInt(manualEntry.userId)
                                });
                            }}
                            disabled={manualMutation.isPending}
                        >
                            {manualMutation.isPending ? "Menyimpan..." : "Simpan Data"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
