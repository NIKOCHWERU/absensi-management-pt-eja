import { useQuery } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { format, subMonths, addMonths, isSameMonth, setDate, isAfter, isBefore, isEqual, differenceInBusinessDays, startOfMonth, endOfMonth, isWeekend, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Image as ImageIcon, CalendarIcon, ArrowUpDown, ChevronLeft, ChevronRight, FileDown, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { cn, formatLongDate } from "@/lib/utils";

export default function AttendanceSummaryPage() {
    const [, setLocation] = useLocation();
    // State for selected period (e.g., Feb 2026 means Jan 26 - Feb 25)
    const [targetDate, setTargetDate] = useState(new Date());
    const [logoBase64, setLogoBase64] = useState("");

    useEffect(() => {
        // Pre-fetch logo to avoid async delays during export that trigger popup blockers
        fetch('/logo_elok_buah.jpg')
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onload = () => setLogoBase64(reader.result as string);
                reader.readAsDataURL(blob);
            })
            .catch(() => {});
    }, []);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortField, setSortField] = useState<string>("fullName");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: allAttendance } = useQuery<Attendance[]>({
        queryKey: ["/api/attendance"],
    });

    const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: undefined,
        to: undefined,
    });

    // Calculate Period Range
    let startDate: Date = startOfDay(new Date());
    let endDate: Date = endOfDay(new Date());

    if (reportType === "custom" && dateRange?.from) {
        startDate = startOfDay(dateRange.from);
        endDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    } else if (reportType === "daily") {
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

    // Filter Employees
    const employees = users?.filter(u => u.role === 'employee') || [];
    const filteredEmployees = employees.filter(emp =>
        emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.nik && emp.nik.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Helper to check if a date is in range
    const isDateInRange = (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(0, 0, 0, 0);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    };

    // Helper to calculate business days in range (Simple: Mon-Fri)
    // Ideally this should use a holiday calendar, but for now just exclude weekends.
    const calculateWorkingDays = () => {
        let count = 0;
        let curDate = new Date(startDate);
        while (curDate <= endDate) {
            const day = curDate.getDay();
            if (day !== 0 && day !== 6) count++;
            curDate.setDate(curDate.getDate() + 1);
        }
        return count;
    };
    const totalWorkingDays = calculateWorkingDays();

    // Calculate Stats per Employee
    const getAttendanceForPeriod = (userId: number) => {
        return allAttendance?.filter(a => a.userId === userId && isDateInRange(new Date(a.date))) || [];
    };

    const employeeStats = filteredEmployees.map(emp => {
        const empAttendance = getAttendanceForPeriod(emp.id);

        const present = empAttendance.filter(a => a.status === 'present').length;
        const late = empAttendance.filter(a => a.status === 'late').length;
        const sick = empAttendance.filter(a => a.status === 'sick').length;
        const permission = empAttendance.filter(a => a.status === 'permission').length;
        // Alpha is tricky. It's working days minus recorded days.
        // But if user joined mid-month? Ignored for simplicity now.
        const recorded = present + late + sick + permission;
        // Also absent status might be explicitly recorded?
        const explicitAbsent = empAttendance.filter(a => a.status === 'absent').length;

        // Effective Alpha = Total Working Days - (Present + Late + Sick + Permission)
        // Note: Future dates shouldn't count as Alpha if today < endDate.

        // Let's refine Alpha calculation:
        // iterate days from startDate to min(endDate, today)
        // check if record exists. if not -> alpha.
        let alphaCount = 0;
        let iterDate = new Date(startDate);
        const today = new Date();
        const cutoff = isBefore(today, endDate) ? today : endDate;

        while (iterDate <= cutoff) {
            if (iterDate.getDay() !== 0 && iterDate.getDay() !== 6) { // Skip weekends
                const dayStr = iterDate.toDateString();
                const hasRecord = empAttendance.some(a => new Date(a.date).toDateString() === dayStr);
                if (!hasRecord) {
                    alphaCount++;
                }
            }
            iterDate.setDate(iterDate.getDate() + 1);
        }

        return {
            ...emp,
            stats: {
                present,
                late,
                sick,
                permission,
                alpha: alphaCount,
                totalAttendance: present + late,
                percentage: Math.round(((present + late) / totalWorkingDays) * 100) || 0
            }
        };
    });

    const sortedEmployees = [...employeeStats].sort((a, b) => {
        let valA: any, valB: any;

        switch (sortField) {
            case 'present': valA = a.stats.present; valB = b.stats.present; break;
            case 'late': valA = a.stats.late; valB = b.stats.late; break;
            case 'sick': valA = a.stats.sick; valB = b.stats.sick; break;
            case 'permission': valA = a.stats.permission; valB = b.stats.permission; break;
            case 'alpha': valA = a.stats.alpha; valB = b.stats.alpha; break;
            case 'percentage': valA = a.stats.percentage; valB = b.stats.percentage; break;
            default: valA = a.fullName.toLowerCase(); valB = b.fullName.toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const toggleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handleExport = () => {
        let periodStr = '';
        if (reportType === 'daily') {
            periodStr = formatLongDate(targetDate).toUpperCase();
        } else if (reportType === 'weekly') {
            periodStr = `${format(startDate, "d MMMM yyyy", { locale: id })} - ${format(endDate, "d MMMM yyyy", { locale: id })}`.toUpperCase();
        } else if (reportType === 'custom') {
            periodStr = `${format(startDate, "d MMMM yyyy", { locale: id })} - ${format(endDate, "d MMMM yyyy", { locale: id })}`.toUpperCase();
        } else {
            periodStr = format(targetDate, "MMMM yyyy", { locale: id }).toUpperCase();
        }

        const fileName = `LAPORAN ABSENSI SUMMARY PT EJA - ${periodStr}.html`;

        let tableHeader: string = "";
        let tableRows: string = "";

        if (reportType === 'monthly' || reportType === 'custom') {
            tableHeader = `
                <tr>
                    <th class="c" style="width: 40px;">No</th>
                    <th>Nama Karyawan</th>
                    <th class="c" style="width: 80px;">Hadir</th>
                    <th class="c" style="width: 80px;">Telat</th>
                    <th class="c" style="width: 80px;">Sakit</th>
                    <th class="c" style="width: 80px;">Izin</th>
                    <th class="c" style="width: 80px;">Alpha</th>
                    <th class="c" style="width: 100px;">Persentase</th>
                </tr>
            `;
            tableRows = sortedEmployees.map((emp, index) => `
                <tr>
                    <td class="col-no">${index + 1}</td>
                    <td>
                        <div style="font-weight: 700; color: #1e293b; font-size: 13px;">${emp.fullName}</div>
                        <div style="font-size: 10px; color: #64748b; font-family: monospace;">NIK: ${emp.nik || '-'}</div>
                    </td>
                    <td class="c"><span class="st-hadir">${emp.stats.present}</span></td>
                    <td class="c"><span class="st-telat">${emp.stats.late}</span></td>
                    <td class="c"><span class="st-sakit">${emp.stats.sick}</span></td>
                    <td class="c"><span class="st-izin">${emp.stats.permission}</span></td>
                    <td class="c"><span class="st-alpha">${emp.stats.alpha}</span></td>
                    <td class="c"><b style="font-size: 13px;">${emp.stats.percentage}%</b></td>
                </tr>
            `).join('');
        } else {
            // Weekly, Daily, Custom: Show detailed records
            tableHeader = `
                <tr>
                    <th class="c" style="width: 30px;">No</th>
                    <th>Tanggal</th>
                    <th>Nama Karyawan</th>
                    <th class="c">Masuk</th>
                    <th class="c">Istirahat</th>
                    <th class="c">Selesai</th>
                    <th class="c">Pulang</th>
                    <th>Jam Kerja</th>
                    <th class="c">Total Istirahat</th>
                    <th class="c">Status</th>
                    <th>Keterangan</th>
                </tr>
            `;

            const calculateHours = (start?: Date | string | null, end?: Date | string | null) => {
                if (!start || !end) return 0;
                return Math.floor(Math.abs(new Date(end).getTime() - new Date(start).getTime()) / 60000);
            };

            const formatDur = (minutes: number) => {
                if (minutes <= 0) return "-";
                const h = Math.floor(minutes / 60);
                const m = minutes % 60;
                return `${h}j ${m}m`;
            };

            const allRecords: any[] = [];
            sortedEmployees.forEach(emp => {
                const records = getAttendanceForPeriod(emp.id);
                records.forEach(r => {
                    allRecords.push({ ...r, employeeName: emp.fullName });
                });
            });

            // Sort by date then name
            allRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.employeeName.localeCompare(b.employeeName));

            tableRows = allRecords.map((row, index) => {
                let workMins = calculateHours(row.checkIn, row.checkOut);
                if (row.permitExitAt && row.permitResumeAt) {
                    const permitMins = calculateHours(row.permitExitAt, row.permitResumeAt);
                    workMins = Math.max(0, workMins - permitMins);
                }
                const breakMins = calculateHours(row.breakStart, row.breakEnd);
                const netMins = Math.max(0, workMins - breakMins);

                const inTime = row.checkIn ? format(new Date(row.checkIn), "HH:mm") : "-";
                const brkStart = row.breakStart ? format(new Date(row.breakStart), "HH:mm") : "-";
                const brkEnd = row.breakEnd ? format(new Date(row.breakEnd), "HH:mm") : "-";
                const outTime = row.checkOut ? format(new Date(row.checkOut), "HH:mm") : "-";

                let statusLabel = row.status === 'present' ? 'Hadir' :
                    row.status === 'late' ? 'Telat' :
                        row.status === 'sick' ? 'Sakit' :
                            row.status === 'permission' ? 'Izin' :
                                row.status === 'absent' ? 'Alpha' : row.status;
                
                if ((row as any).sessionNumber > 1) {
                    statusLabel += ` (Sesi ${(row as any).sessionNumber})`;
                }
                
                const statusClass = row.status === 'present' ? 'st-hadir' :
                    row.status === 'late' ? 'st-telat' :
                        row.status === 'sick' ? 'st-sakit' :
                            row.status === 'permission' ? 'st-izin' :
                                row.status === 'absent' ? 'st-alpha' : '';

                return `
                    <tr>
                        <td class="col-no">${index + 1}</td>
                        <td class="col-date">${formatLongDate(row.date)}</td>
                        <td class="col-name">${row.employeeName}</td>
                        <td class="col-time ${inTime === '-' ? 't-dash' : 't-in'}">${inTime}</td>
                        <td class="col-time ${brkStart === '-' ? 't-dash' : 't-brk'}">${brkStart}</td>
                        <td class="col-time ${brkEnd === '-' ? 't-dash' : 't-brk'}">${brkEnd}</td>
                        <td class="col-time ${outTime === '-' ? 't-dash' : 't-out'}">${outTime}</td>
                        <td class="col-work">${formatDur(netMins)}</td>
                        <td class="col-brk">${formatDur(breakMins)}</td>
                        <td class="col-stat"><span class="${statusClass}">${statusLabel}</span></td>
                        <td class="col-note">${row.notes || "-"}</td>
                    </tr>
                `;
            }).join('');
        }

        const html = `<!DOCTYPE html>
<html>
<head>
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 28px 36px; }

    /* LETTERHEAD */
    .letterhead { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; }
    .logo-img { width: 60px; height: 60px; object-fit: contain; }
    .company-block h1 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .company-block .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }

    /* TITLE */
    .report-meta { text-align: center; margin-bottom: 20px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }

    /* TABLE */
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; white-space: nowrap; }
    th.c { text-align: center; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }

    .col-no   { text-align: center; color: #94a3b8; font-size: 10px; }
    .col-date { color: #374151; font-weight: 600; }
    .col-name { color: #1d4ed8; font-weight: 600; }
    .col-time { font-family: ui-monospace, Consolas, monospace; font-size: 11px; text-align: center; }
    .t-in   { color: #15803d; font-weight: 700; }
    .t-brk  { color: #b45309; font-weight: 700; }
    .t-out  { color: #b91c1c; font-weight: 700; }
    .t-dash { color: #94a3b8; }
    .col-work { font-size: 11px; font-weight: 700; color: #1e293b; }
    .col-brk  { text-align: center; font-size: 11px; font-weight: 700; color: #ea580c; }
    .col-stat { text-align: center; font-weight: 700; font-size: 11px; }
    .st-hadir { color: #16a34a; font-weight: 700; }
    .st-telat { color: #ea580c; font-weight: 700;}
    .st-sakit { color: #2563eb; font-weight: 700;}
    .st-izin  { color: #7c3aed; font-weight: 700;}
    .st-cuti  { color: #0d9488; font-weight: 700;}
    .st-alpha { color: #dc2626; font-weight: 700;}
    .col-note { font-size: 10.5px; color: #475569; white-space: normal; max-width: 200px; }

    /* SIGNATURE */
    .signature-section { margin-top: 48px; display: flex; justify-content: space-between; padding: 0 24px; }
    .sig-box { text-align: center; width: 160px; }
    .sig-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #374151; margin-bottom: 64px; }
    .sig-name { font-size: 11px; font-weight: 800; border-top: 1.5px solid #374151; padding-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }

    .footer { margin-top: 18px; font-size: 8.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 8px; }

    /* DOWNLOAD BUTTON */
    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #1d4ed8; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.5px; text-decoration: none; }
    .download-btn:hover { background: #1e40af; }

    @media print {
      body { padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead tr, tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .btn-wrap { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <img src="${logoBase64}" class="logo-img" alt="Logo" />
    <div class="company-block">
      <h1>PT Elok Jaya Abadhi</h1>
      <p class="tagline">Sistem Manajemen Kehadiran Digital</p>
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />

  <div class="report-meta">
    <h2>Laporan Ringkasan Absensi PT EJA</h2>
    <p class="sub">Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : reportType === 'custom' ? 'Kustom' : 'Bulanan'}</p>
    <p class="sub">Rentang Waktu: ${format(startDate, "EEEE, d MMMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMMM yyyy", { locale: id })}</p>
  </div>

  <table>
    <thead>
      ${tableHeader}
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="signature-section">
    <div class="sig-box">
      <p class="sig-label">Checked By</p>
      <div class="sig-name">NIKO</div>
    </div>
    <div class="sig-box">
      <p class="sig-label">Approved By</p>
      <div class="sig-name">CLAVERINA</div>
    </div>
  </div>

  <div class="footer">
    Dokumen ini dicetak secara otomatis oleh Sistem Absensi PT Elok Jaya Abadhi &mdash; ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: id })} WIB &mdash; Harap simpan sebagai arsip resmi perusahaan.
  </div>

  <div class="btn-wrap">
    <a id="dl-btn" class="download-btn" href="#">&#11015;&nbsp; Download File</a>
  </div>

  <script>
    var _fn = "${fileName}";
    document.title = _fn;
    window.onload = function() {
      var btn = document.getElementById('dl-btn');
      if (btn) {
        btn.href = window.location.href;
        btn.download = _fn;
      }
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 p-4 px-8 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold text-gray-800">Absensi Management PT ELOK JAYA ABADHI</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Cari nama atau NIK..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                        {reportType !== "custom" && (
                            <>
                                <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                                <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium min-w-[120px] text-center">
                                    {reportType === 'daily' ? formatLongDate(targetDate) :
                                        reportType === 'weekly' ? `${format(startDate, "d MMM")} - ${format(endDate, "d MMM yyyy", { locale: id })}` :
                                            format(targetDate, "MMMM yyyy", { locale: id })}
                                </span>
                                <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        {reportType === "custom" && (
                            <>
                                <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id="date"
                                            variant={"ghost"}
                                            className={cn(
                                                "h-8 justify-start text-left font-medium",
                                                !dateRange && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (
                                                dateRange.to ? (
                                                    <>
                                                        {format(dateRange.from, "d MMMM", { locale: id })} -{" "}
                                                        {format(dateRange.to, "d MMMM yyyy", { locale: id })}
                                                    </>
                                                ) : (
                                                    formatLongDate(dateRange.from)
                                                )
                                            ) : (
                                                <span>Pilih Tanggal</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange?.from}
                                            selected={dateRange}
                                            onSelect={setDateRange}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="p-8 flex-1 overflow-auto">
                <Card className="border-none shadow-sm mb-6">
                    <CardContent className="p-4 flex items-center justify-between bg-green-50/50">
                        <div className="flex gap-6 text-sm">
                            <div>
                                <span className="text-gray-500">Periode:</span>
                                <span className="ml-2 font-semibold text-gray-700">
                                    {formatLongDate(startDate)} - {formatLongDate(endDate)}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-500">Total Hari Kerja:</span>
                                <span className="ml-2 font-semibold text-gray-700">{totalWorkingDays} Hari</span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            className="gap-2 text-green-600 border-green-200 bg-white hover:bg-green-50"
                        >
                            <FileDown className="h-4 w-4" /> Export PDF
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="w-[50px]">No</TableHead>
                                    <TableHead className="min-w-[200px] cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('fullName')}>
                                        <div className="flex items-center gap-1">Karyawan <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-green-50 text-green-700 w-[100px] cursor-pointer hover:bg-green-100" onClick={() => toggleSort('present')}>
                                        <div className="flex items-center justify-center gap-1">Hadir <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-yellow-50 text-yellow-700 w-[100px] cursor-pointer hover:bg-yellow-100" onClick={() => toggleSort('late')}>
                                        <div className="flex items-center justify-center gap-1">Telat <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-blue-50 text-blue-700 w-[100px] cursor-pointer hover:bg-blue-100" onClick={() => toggleSort('sick')}>
                                        <div className="flex items-center justify-center gap-1">Sakit <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-purple-50 text-purple-700 w-[100px] cursor-pointer hover:bg-purple-100" onClick={() => toggleSort('permission')}>
                                        <div className="flex items-center justify-center gap-1">Izin <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center bg-red-50 text-red-700 w-[100px] cursor-pointer hover:bg-red-100" onClick={() => toggleSort('alpha')}>
                                        <div className="flex items-center justify-center gap-1">Alpha <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-center w-[150px] cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('percentage')}>
                                        <div className="flex items-center justify-center gap-1">Persentase <ArrowUpDown className="h-3 w-3" /></div>
                                    </TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedEmployees.map((emp, index) => {
                                    const attendancePercentage = emp.stats.percentage;

                                    return (
                                        <TableRow key={emp.id} className="hover:bg-gray-50/50">
                                            <TableCell className="text-gray-500">{index + 1}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-semibold text-gray-800">{emp.fullName}</p>
                                                    <p className="text-xs text-gray-500">{emp.nik || '-'}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-green-600 bg-green-50/30">
                                                {emp.stats.present}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-yellow-600 bg-yellow-50/30">
                                                {emp.stats.late}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-blue-600 bg-blue-50/30">
                                                {emp.stats.sick}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-purple-600 bg-purple-50/30">
                                                {emp.stats.permission}
                                            </TableCell>
                                            <TableCell className="text-center font-mono font-bold text-red-600 bg-red-50/30">
                                                {emp.stats.alpha}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="h-2 w-16 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${attendancePercentage >= 90 ? 'bg-green-500' :
                                                                attendancePercentage >= 75 ? 'bg-yellow-500' :
                                                                    'bg-red-500'
                                                                }`}
                                                            style={{ width: `${Math.min(100, attendancePercentage)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-semibold w-8">{attendancePercentage}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/employees")}>
                                                    Detail
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {employeeStats.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                                            Tidak ada data karyawan ditemukan.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </main>
        </div>
    );
}
