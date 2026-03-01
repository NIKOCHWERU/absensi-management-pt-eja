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
    const [selectedPhotoRecord, setSelectedPhotoRecord] = useState<Attendance | null>(null);

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

    const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("daily");

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
        return users?.find(u => u.id === userId)?.fullName || null;
    };

    // Filter Data by Date Period — exclude records for deleted employees
    const filteredRecords = allAttendance?.filter(att => {
        // Skip records whose user no longer exists
        if (!getUserName(att.userId)) return false;

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
            const name = (getUserName(att.userId) || '').toLowerCase();
            return name.includes(searchName.toLowerCase());
        })
        .sort((a, b) => {
            if (sortField === 'date') {
                const dateA = new Date(a.date).setHours(0, 0, 0, 0);
                const dateB = new Date(b.date).setHours(0, 0, 0, 0);

                if (dateA !== dateB) return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;

                // Secondary sort: Group by User
                const nameA = (getUserName(a.userId) || '').toLowerCase();
                const nameB = (getUserName(b.userId) || '').toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;

                // Tertiary sort: Latest session first (DESC) or Earliest (ASC)
                const checkInA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
                const checkInB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
                return sortOrder === 'desc' ? checkInB - checkInA : checkInA - checkInB;
            } else {
                const nameA = (getUserName(a.userId) || '').toLowerCase();
                const nameB = (getUserName(b.userId) || '').toLowerCase();
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
    // Key: "YYYY-MM-DD-userId" -> { mins, hasAllCheckOuts }
    const dailyTotals = new Map<string, { mins: number; complete: boolean }>();
    processedData.forEach(row => {
        const key = `${format(new Date(row.date), "yyyy-MM-dd")}-${row.userId}`;
        if (!dailyTotals.has(key)) {
            // Find all records for this day/user
            const dayRecords = processedData.filter(r =>
                format(new Date(r.date), "yyyy-MM-dd") === format(new Date(row.date), "yyyy-MM-dd") &&
                r.userId === row.userId
            );
            const { netWorkMins, hasAllCheckOuts } = calculateDailyTotal(dayRecords);
            dailyTotals.set(key, { mins: netWorkMins, complete: hasAllCheckOuts });
        }
    });

    const calculateHours = (start?: Date | string | null, end?: Date | string | null) => {
        if (!start || !end) return 0;

        const startDate = new Date(start);
        startDate.setSeconds(0, 0);
        const endDate = new Date(end);
        endDate.setSeconds(0, 0);

        const diff = differenceInMinutes(endDate, startDate);
        return diff < 0 ? diff + 1440 : diff;
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

            const { netWorkMins: sessionNetMins } = calculateDailyTotal([row]);

            const rawStatus = row.status || 'present';
            let statusBadgeClass = 'status-hadir';
            if (rawStatus === 'late') statusBadgeClass = 'status-telat';
            else if (rawStatus === 'sick') statusBadgeClass = 'status-sakit';
            else if (rawStatus === 'permission') statusBadgeClass = 'status-izin';
            else if (rawStatus === 'cuti') statusBadgeClass = 'status-cuti';
            else if (rawStatus === 'absent') statusBadgeClass = 'status-alpha';

            const displayStatus = (row.status === 'present' ? 'Hadir' :
                row.status === 'late' ? 'Telat' :
                    row.status === 'sick' ? 'Sakit' :
                        row.status === 'permission' ? 'Izin' :
                            row.status === 'cuti' ? 'Cuti' :
                                row.status === 'absent' ? 'Alpha' : row.status) +
                ((row as any).sessionNumber > 1 ? ` (Sesi ${(row as any).sessionNumber})` : '');

            // Grouping Logic: Check if same as previous row
            const dateStr = format(new Date(row.date), "yyyy-MM-dd");
            const key = `${dateStr}-${row.userId}`;
            const dailyEntry = dailyTotals.get(key);
            const dailyTotalMins = dailyEntry?.mins ?? 0;
            const dailyIsComplete = dailyEntry?.complete ?? false;

            const prevRow = index > 0 ? processedData[index - 1] : null;
            const isSameDayAndUser = prevRow &&
                format(new Date(prevRow.date), "yyyy-MM-dd") === dateStr &&
                prevRow.userId === row.userId;

            return `
            <tr>
                <td style="text-align: center; color: #94a3b8; font-weight: 500; position: relative;">
                    ${isSameDayAndUser ? '<div style="position: absolute; left: 50%; top: -10px; bottom: 10px; width: 2px; background-color: #e2e8f0; transform: translateX(-50%);"></div>' : index + 1}
                </td>
                <td>${isSameDayAndUser ? '' : format(new Date(row.date), "dd/MM/yyyy")}</td>
                <td class="name">${isSameDayAndUser ? '' : getUserName(row.userId)}</td>
                <td class="time text-green">${row.checkIn ? format(new Date(row.checkIn), "HH:mm") : "-"}</td>
                <td class="time text-orange">${row.breakStart ? format(new Date(row.breakStart), "HH:mm") : "-"}</td>
                <td class="time text-orange">${row.breakEnd ? format(new Date(row.breakEnd), "HH:mm") : "-"}</td>
                <td class="time text-red">${row.checkOut ? format(new Date(row.checkOut), "HH:mm") : "-"}</td>
                <td>
                    ${!isSameDayAndUser ? `<div style="font-weight: 800; color: #0f172a; margin-bottom: 4px;">Total: ${dailyIsComplete && dailyTotalMins > 0 ? formatDuration(dailyTotalMins) : "-"}${!row.checkOut ? ' <span style="color: #ca8a04; font-size: 10px;">(Belum Absen Pulang)</span>' : ""}</div>` : ''}
                    <div style="font-size: 11px; color: #64748b; font-weight: 600;">Sesi: <span style="color: ${!row.checkOut ? '#ca8a04' : '#059669'};">${!row.checkOut ? "Belum Absen Pulang" : formatDuration(sessionNetMins)}</span></div>
                </td>

                <td style="color: #ea580c; font-weight: 600; font-size: 12px; text-align: center;">${breakMins > 0 ? formatDuration(breakMins) : "-"}</td>
                <td><span class="status-badge ${statusBadgeClass}">${displayStatus}</span></td>
                <td style="font-size: 11px; line-height: 1.4; color: #64748b; max-width: 250px;">
                    ${row.notes ? row.notes : (!row.checkOut ? "-" : "-")} 
                    ${row.status === 'late' && (row as any).lateReason ? `<br><span style="color: #ef4444; font-weight: 600;">[Telat: ${(row as any).lateReason}]</span>` : ""}
                    ${!row.checkOut ? `<br><span style="color: #eab308; font-weight: 600;">[Belum Absen Pulang]</span>` : ""}
                </td>
            </tr>
        `;
        }).join('');

        const html = `
        <html>
            <head>
                <title>Laporan Absensi - ${format(targetDate, "MMMM yyyy", { locale: id })}</title>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; background: white; }
                    .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 32px; }
                    .logo-section { display: flex; align-items: flex-start; gap: 20px; }
                    .logo-img { width: 72px; height: 72px; object-fit: contain; border-radius: 8px; }
                    .company-info { max-width: 600px; }
                    .company-info h1 { margin: 0; font-size: 26px; color: #0f172a; font-weight: 800; letter-spacing: -0.5px; }
                    .company-info p.subtitle { margin: 4px 0 8px; color: #3b82f6; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                    .company-info p.address { margin: 0; color: #64748b; font-size: 12px; line-height: 1.5; }
                    
                    .report-title { text-align: center; margin-bottom: 30px; background: #f8fafc; padding: 24px; border-radius: 16px; border: 1px dashed #cbd5e1; }
                    .report-title h2 { margin: 0; color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
                    .report-title .meta { display: flex; justify-content: center; gap: 16px; margin-top: 16px; }
                    .report-title .meta p { margin: 0; color: #475569; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
                    .report-title .meta p.badge { background: white; padding: 6px 16px; border-radius: 20px; border: 1px solid #cbd5e1; font-weight: 700; color: #1e293b; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                    
                    table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 20px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                    th { background: #f8fafc; color: #475569; font-weight: 700; text-align: left; padding: 14px 12px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
                    th:first-child { text-align: center; }
                    td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #475569; vertical-align: top; }
                    tr:last-child td { border-bottom: none; }
                    tr:hover td { background-color: #f8fafc; }
                    
                    /* Styling individual cells */
                    td.name { font-weight: 700; color: #0f172a; }
                    td.time { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; font-size: 13px; }
                    .text-green { color: #16a34a; }
                    .text-orange { color: #f97316; }
                    .text-red { color: #dc2626; }
                    
                    .status-badge { display: inline-block; padding: 6px 10px; border-radius: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                    .status-hadir { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                    .status-telat { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
                    .status-sakit { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
                    .status-izin { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
                    .status-cuti { background: #ccfbf1; color: #115e59; border: 1px solid #99f6e4; }
                    .status-alpha { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

                    .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: left; border-top: 1px dashed #e2e8f0; padding-top: 20px; font-weight: 500; }
                    
                    .signature-section { 
                        margin-top: 60px; 
                        display: flex; 
                        justify-content: flex-end; 
                        gap: 120px;
                        padding: 0 40px;
                    }
                    .signature-box { 
                        text-align: center; 
                        width: 220px;
                    }
                    .signature-box p { 
                        margin-bottom: 90px; 
                        font-weight: 800; 
                        font-size: 11px;
                        color: #64748b;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }
                    .signature-line { 
                        border-top: 2px solid #0f172a; 
                        padding-top: 12px;
                        font-weight: 800;
                        font-size: 14px;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    @media print {
                        body { padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .no-print { display: none; }
                        .report-title { border: 1px solid #cbd5e1; }
                        table { box-shadow: none; border-collapse: collapse; }
                        th, td { border: 1px solid #e2e8f0; }
                        .status-badge { box-shadow: none; border-width: 2px !important; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-section">
                        <img src="/logo_elok_buah.jpg" class="logo-img" alt="Logo PT Elok Jaya Abadhi" />
                        <div class="company-info">
                            <h1>PT ELOK JAYA ABADHI</h1>
                            <p class="subtitle">Sistem Manajemen Kehadiran Digital</p>
                            <p class="address">Perum Telagasari Indah Blok E1/15, Jalan Talagamulya, Talagamulya, Telagasari, Karawang, West Java 41381</p>
                        </div>
                    </div>
                </div>
                <div class="report-title">
                    <h2>LAPORAN REKAPITULASI ABSENSI</h2>
                    <div class="meta">
                        <p class="badge">Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : 'Bulanan'}</p>
                        <p class="badge">Periode: ${format(startDate, "EEEE, d MMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMM yyyy", { locale: id })}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align: center;">No</th>
                            <th style="width: 80px;">Tanggal</th>
                            <th>Nama Karyawan</th>
                            <th style="width: 50px;">Masuk</th>
                            <th style="width: 60px;">Istirahat</th>
                            <th style="width: 50px;">Selesai</th>
                            <th style="width: 50px;">Pulang</th>
                            <th style="width: 140px;">Jam Kerja (Total & Sesi)</th>
                            <th style="width: 90px; text-align: center;">Total Istirahat</th>
                            <th style="width: 120px;">Status</th>
                            <th style="width: 200px;">Keterangan</th>
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
                        setTimeout(() => window.print(), 500);
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
                                                    {!isSameDayAndUser && (() => {
                                                        const daily = dailyTotals.get(key);
                                                        const showTotal = daily?.complete && (daily?.mins ?? 0) > 0;
                                                        return (
                                                            <div className="text-gray-900 font-bold mb-1">
                                                                Total: {showTotal ? formatDuration(daily!.mins) : "-"}
                                                                {!row.checkOut && <span className="ml-1 text-[10px] text-yellow-600 font-semibold">(Belum Absen Pulang)</span>}
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="text-xs text-gray-500">
                                                        Sesi: {!row.checkOut ? <span className="text-yellow-600 font-semibold">Belum Absen Pulang</span> : formatDuration(sessionNetMins)}
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
                                                            <span className={!row.checkOut ? "text-yellow-600 font-semibold" : ""}>
                                                                {row.notes ? row.notes : (!row.checkOut ? "Belum Absen Pulang" : "-")}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-gray-400 hover:text-green-600"
                                                                onClick={() => handleOpenManualModal(row)}
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        {((row as any).lateReason || (row as any).checkInPhoto || (row as any).checkOutPhoto || (row as any).lateReasonPhoto) && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-auto p-0 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-transparent justify-start font-bold uppercase tracking-tight flex items-center gap-1.5"
                                                                onClick={() => setSelectedPhotoRecord(row)}
                                                            >
                                                                <Camera className="h-3 w-3" />
                                                                Lihat Detail Foto
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

            <Dialog open={!!selectedPhotoRecord} onOpenChange={(open) => !open && setSelectedPhotoRecord(null)}>
                <DialogContent className="sm:max-w-md bg-white border-zinc-200 text-zinc-900 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-blue-600 uppercase">Detail Bukti & Keterangan</DialogTitle>
                        <DialogDescription className="text-zinc-500">
                            Detail alasan dan bukti foto yang dikirimkan karyawan.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedPhotoRecord && (
                        <div className="space-y-4 mt-2">
                            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Karyawan</p>
                                <p className="font-bold text-zinc-800">{getUserName(selectedPhotoRecord.userId)}</p>
                                <p className="text-xs text-zinc-500 font-medium">
                                    Tanggal Absen: {format(new Date(selectedPhotoRecord.date), "dd MMMM yyyy", { locale: id })}
                                </p>
                            </div>

                            {/* Alasan Terlambat & Foto Alasan */}
                            {(selectedPhotoRecord as any).lateReason && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Alasan Keterlambatan</p>
                                    <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50 min-h-[60px]">
                                        <p className="text-sm text-zinc-700 leading-relaxed">{(selectedPhotoRecord as any).lateReason}</p>
                                    </div>
                                </div>
                            )}
                            {(selectedPhotoRecord as any).lateReasonPhoto && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bukti Terlambar (Foto)</p>
                                    <div className="aspect-video bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200">
                                        <img
                                            src={(() => {
                                                const p = (selectedPhotoRecord as any).lateReasonPhoto;
                                                if (!p) return '';
                                                if (p.startsWith('data:')) return p;
                                                if (!p.includes('/') && !p.includes('.') && p.length > 20)
                                                    return `/api/images/${p}`;
                                                return `/uploads/${p}`;
                                            })()}
                                            alt="Bukti Telat"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Foto Masuk */}
                            {(selectedPhotoRecord as any).checkInPhoto && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bukti Check-In (Masuk)</p>
                                    <div className="aspect-video bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200">
                                        <img
                                            src={(() => {
                                                const p = (selectedPhotoRecord as any).checkInPhoto;
                                                if (!p) return '';
                                                if (p.startsWith('data:')) return p;
                                                if (!p.includes('/') && !p.includes('.') && p.length > 20)
                                                    return `/api/images/${p}`;
                                                return `/uploads/${p}`;
                                            })()}
                                            alt="Bukti Check-In"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Foto Pulang */}
                            {(selectedPhotoRecord as any).checkOutPhoto && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-1">Bukti Check-Out (Pulang)</p>
                                    <div className="aspect-video bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200">
                                        <img
                                            src={(() => {
                                                const p = (selectedPhotoRecord as any).checkOutPhoto;
                                                if (!p) return '';
                                                if (p.startsWith('data:')) return p;
                                                if (!p.includes('/') && !p.includes('.') && p.length > 20)
                                                    return `/api/images/${p}`;
                                                return `/uploads/${p}`;
                                            })()}
                                            alt="Bukti Check-Out"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="pt-4">
                        <Button
                            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-2xl h-12"
                            onClick={() => setSelectedPhotoRecord(null)}
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
