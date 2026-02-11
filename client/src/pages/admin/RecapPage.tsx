import { useQuery } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { format, subMonths, addMonths, isSameMonth, setDate, isAfter, isBefore, isEqual, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, FileDown, ArrowLeft, Search, ArrowUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { differenceInMinutes } from "date-fns";

export default function RecapPage() {
  const [, setLocation] = useLocation();
  // State for selected period (e.g., Feb 2026 means Jan 26 - Feb 25)
  // We store the "target" month (Feb 2026)
  const [targetDate, setTargetDate] = useState(new Date()); 

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
      d.setHours(0,0,0,0);
      const s = new Date(startDate);
      s.setHours(0,0,0,0);
      const e = new Date(endDate);
      e.setHours(23,59,59,999);
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
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        } else {
            const nameA = getUserName(a.userId).toLowerCase();
            const nameB = getUserName(b.userId).toLowerCase();
            if (nameA < nameB) return sortOrder === 'asc' ? -1 : 1;
            if (nameA > nameB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
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

  const calculateHours = (start?: Date | string | null, end?: Date | string | null) => {
      if (!start || !end) return 0;
      return differenceInMinutes(new Date(end), new Date(start));
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

    const html = `
        <html>
            <head>
                <title>Laporan Absensi - ${format(targetDate, "MMMM yyyy", { locale: id })}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
                    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo-section { display: flex; align-items: center; gap: 15px; }
                    .logo-placeholder { width: 50px; height: 50px; background: #ea580c; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; }
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
            <h1 className="text-xl font-bold text-gray-800">Rekap Absensi</h1>
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
                            {processedData.map((row) => {
                                const workMins = calculateHours(row.checkIn, row.checkOut);
                                const breakMins = calculateHours(row.breakStart, row.breakEnd);
                                const netMins = Math.max(0, workMins - breakMins);

                                return (
                                    <tr key={row.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 text-gray-900 font-medium">
                                            {format(new Date(row.date), "dd/MM/yyyy")}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {getUserName(row.userId)}
                                        </td>
                                        <td className="px-4 py-3 text-green-600 font-mono">
                                            {row.checkIn ? format(new Date(row.checkIn), "HH:mm") : "-"}
                                        </td>
                                        <td className="px-4 py-3 text-orange-600 font-mono">
                                            {row.breakStart ? format(new Date(row.breakStart), "HH:mm") : "-"}
                                        </td>
                                        <td className="px-4 py-3 text-orange-600 font-mono">
                                            {row.breakEnd ? format(new Date(row.breakEnd), "HH:mm") : "-"}
                                        </td>
                                        <td className="px-4 py-3 text-red-600 font-mono">
                                            {row.checkOut ? format(new Date(row.checkOut), "HH:mm") : "-"}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-gray-800">
                                            {formatDuration(netMins)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {breakMins > 0 ? formatDuration(breakMins) : "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                                ${row.status === 'present' ? 'bg-green-100 text-green-700' : 
                                                  row.status === 'late' ? 'bg-red-100 text-red-700' :
                                                  row.status === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                  row.status === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                  'bg-gray-100 text-gray-700'}`}>
                                                {row.status === 'present' ? 'Hadir' : 
                                                 row.status === 'late' ? 'Telat' : 
                                                 row.status === 'sick' ? 'Sakit' : 
                                                 row.status === 'permission' ? 'Izin' : 
                                                 row.status === 'absent' ? 'Alpha' : row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 italic max-w-xs truncate">
                                            {row.notes || "-"}
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
    </div>
  );
}
