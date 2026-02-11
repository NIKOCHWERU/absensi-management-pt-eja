import { useQuery } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { format, subMonths, addMonths, isSameMonth, setDate, isAfter, isBefore, isEqual, differenceInBusinessDays, startOfMonth, endOfMonth, isWeekend, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, FileDown, ArrowLeft, Search, Filter } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AttendanceSummaryPage() {
  const [, setLocation] = useLocation();
  // State for selected period (e.g., Feb 2026 means Jan 26 - Feb 25)
  const [targetDate, setTargetDate] = useState(new Date()); 
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("fullName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: allAttendance } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance"],
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

  // Filter Employees
  const employees = users?.filter(u => u.role === 'employee') || [];
  const filteredEmployees = employees.filter(emp => 
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.nik && emp.nik.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Helper to check if a date is in range
  const isDateInRange = (date: Date) => {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      const s = new Date(startDate);
      s.setHours(0,0,0,0);
      const e = new Date(endDate);
      e.setHours(0,0,0,0);
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
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let tableHeader: string;
        let tableRows: string;

        if (reportType === 'monthly') {
            tableHeader = `
                <tr>
                    <th style="width: 40px;">No</th>
                    <th>Nama Karyawan</th>
                    <th style="text-align: center; width: 60px;">Hadir</th>
                    <th style="text-align: center; width: 60px;">Telat</th>
                    <th style="text-align: center; width: 60px;">Sakit</th>
                    <th style="text-align: center; width: 60px;">Izin</th>
                    <th style="text-align: center; width: 60px;">Alpha</th>
                    <th style="text-align: center; width: 80px;">Persentase</th>
                </tr>
            `;
            tableRows = sortedEmployees.map((emp, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div style="font-weight: 600;">${emp.fullName}</div>
                        <div style="font-size: 10px; color: #64748b;">${emp.nik || '-'}</div>
                    </td>
                    <td style="text-align: center;">${emp.stats.present}</td>
                    <td style="text-align: center;">${emp.stats.late}</td>
                    <td style="text-align: center;">${emp.stats.sick}</td>
                    <td style="text-align: center;">${emp.stats.permission}</td>
                    <td style="text-align: center;">${emp.stats.alpha}</td>
                    <td style="text-align: center; font-weight: bold;">${emp.stats.percentage}%</td>
                </tr>
            `).join('');
        } else {
            // Weekly or Daily: Show detailed records
            tableHeader = `
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

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${format(new Date(row.date), "dd/MM/yyyy")}</td>
                        <td>${row.employeeName}</td>
                        <td>${row.checkIn ? format(new Date(row.checkIn), "HH:mm") : "-"}</td>
                        <td>${row.breakStart ? format(new Date(row.breakStart), "HH:mm") : "-"}</td>
                        <td>${row.breakEnd ? format(new Date(row.breakEnd), "HH:mm") : "-"}</td>
                        <td>${row.checkOut ? format(new Date(row.checkOut), "HH:mm") : "-"}</td>
                        <td><b>${formatDur(netMins)}</b></td>
                        <td>${formatDur(breakMins)}</td>
                        <td>${
                            row.status === 'present' ? 'Hadir' : 
                            row.status === 'late' ? 'Telat' : 
                            row.status === 'sick' ? 'Sakit' : 
                            row.status === 'permission' ? 'Izin' : 
                            row.status === 'absent' ? 'Alpha' : row.status
                        }</td>
                        <td>${row.notes || "-"}</td>
                    </tr>
                `;
            }).join('');
        }

        const html = `
            <html>
                <head>
                    <title>Laporan Absensi Karyawan - ${format(targetDate, "MMMM yyyy", { locale: id })}</title>
                    <style>
                        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; }
                        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; }
                        .logo-section { display: flex; align-items: center; gap: 15px; }
                        .logo-placeholder { width: 44px; height: 44px; background: #ea580c; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 20px; }
                        .company-info h1 { margin: 0; font-size: 20px; color: #0f172a; }
                        .company-info p { margin: 2px 0 0; color: #64748b; font-size: 13px; }
                        .report-title { text-align: center; margin-bottom: 30px; }
                        .report-title h2 { margin: 0; font-size: 22px; color: #0f172a; }
                        .report-title p { margin: 5px 0 0; color: #64748b; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                        th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 12px 8px; border: 1px solid #e2e8f0; }
                        td { padding: 10px 8px; border: 1px solid #e2e8f0; color: #334155; }
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
                            <div class="logo-placeholder">A</div>
                            <div class="company-info">
                                <h1>Absensi Pro</h1>
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
                            ${tableHeader}
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
                        Dicetak pada: ${format(new Date(), "EEEE, d MMM yyyy HH:mm", { locale: id })}
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
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
            <h1 className="text-xl font-bold text-gray-800">Absensi Karyawan</h1>
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
          </div>
       </header>

       <main className="p-8 flex-1 overflow-auto">
          <Card className="border-none shadow-sm mb-6">
             <CardContent className="p-4 flex items-center justify-between bg-orange-50/50">
                 <div className="flex gap-6 text-sm">
                      <div>
                         <span className="text-gray-500">Periode:</span>
                         <span className="ml-2 font-semibold text-gray-700">
                             {format(startDate, "EEEE, d MMM yyyy", { locale: id })} - {format(endDate, "EEEE, d MMM yyyy", { locale: id })}
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
                    className="gap-2 text-orange-600 border-orange-200 bg-white hover:bg-orange-50"
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
                                                    className={`h-full rounded-full ${
                                                        attendancePercentage >= 90 ? 'bg-green-500' :
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
