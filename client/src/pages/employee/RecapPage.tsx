import { useAuth } from "@/hooks/use-auth";
import { useAttendance } from "@/hooks/use-attendance";
import { BottomNav } from "@/components/BottomNav";
import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { useState } from "react";
import { format, subMonths, addMonths, startOfWeek, endOfWeek, isWithinInterval, subWeeks, addWeeks } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, Calendar, Clock, MapPin, Coffee, LogOut, X, LayoutGrid, Calendar as CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Attendance } from "@shared/schema";

export default function RecapPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date()); // Tracks the "display month"
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [weekDate, setWeekDate] = useState(new Date());
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Fetch for current display month (format YYYY-MM)
  const monthStr = format(currentDate, 'yyyy-MM');
  const { data: attendanceData, isLoading } = useAttendance().useMonthlyAttendance(monthStr, user?.id);

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setWeekDate(subWeeks(weekDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setWeekDate(addWeeks(weekDate, 1));
  };

  const handleDateSelect = (_date: Date, record?: Attendance) => {
    if (record) {
      setSelectedRecord(record);
      setIsModalOpen(true);
    }
  };

  // Get filtered data based on view mode
  const filteredData = attendanceData?.filter(record => {
    if (viewMode === 'month') return true; // useMonthlyAttendance already gives 26th-25th
    
    // For week view, filter current month's data by week boundary
    const date = new Date(record.date);
    const wStart = startOfWeek(weekDate, { weekStartsOn: 1 });
    const wEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
    return isWithinInterval(date, { start: wStart, end: wEnd });
  }) || [];

  // Stats calculation based on filtered data
  const stats = {
    present: filteredData.filter(a => a.status === 'present').length,
    late: filteredData.filter(a => a.status === 'late').length,
    sick: filteredData.filter(a => a.status === 'sick').length,
    permission: filteredData.filter(a => a.status === 'permission').length,
    absent: filteredData.filter(a => a.status === 'absent').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-primary pt-10 pb-20 px-6 rounded-b-[2.5rem] shadow-lg mb-[-3rem]">
        <h1 className="text-2xl font-bold text-white mb-1">Rekap Absensi PT ELOK JAYA ABADHI</h1>
        <p className="text-white/80 text-sm">Pantau kehadiran bulanan Anda</p>
      </div>

      <main className="px-4 max-w-lg mx-auto space-y-6">
        
        {/* Calendar Card */}
        <div className="relative z-10">
          {isLoading ? (
            <div className="bg-white rounded-2xl h-80 flex items-center justify-center shadow-sm border border-border">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <AttendanceCalendar 
              currentDate={currentDate} 
              onPrevMonth={handlePrev} 
              onNextMonth={handleNext} 
              attendanceData={attendanceData || []} 
              onDateSelect={handleDateSelect}
              viewMode={viewMode}
              setViewMode={setViewMode}
              weekDate={weekDate}
            />
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-foreground">{stats.present}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hadir</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-amber-500">{stats.late}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Telat</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-blue-500">{stats.sick}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sakit</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <div className="text-2xl font-bold text-purple-500">{stats.permission}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Izin</div>
          </div>
        </div>

        {/* Detailed List */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-gray-50 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm text-foreground">Detail Riwayat</h3>
          </div>
          <div className="divide-y divide-border">
            {filteredData.map((record) => (
              <div 
                key={record.id} 
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleDateSelect(new Date(record.date), record)}
              >
                <div>
                  <div className="font-semibold text-sm">
                    {format(new Date(record.date), 'EEEE, dd MMM yyyy', { locale: id })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'} 
                    {' - '}
                    {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                  record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                  record.status === 'late' ? 'bg-amber-100 text-amber-700' :
                  record.status === 'absent' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {record.status === 'present' ? 'Hadir' :
                   record.status === 'late' ? 'Telat' :
                   record.status === 'sick' ? 'Sakit' :
                   record.status === 'permission' ? 'Izin' :
                   record.status === 'absent' ? 'Alpa' : record.status}
                </div>
              </div>
            ))}
            {(!filteredData || filteredData.length === 0) && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Belum ada data absensi untuk periode ini.
              </div>
            )}
          </div>
        </div>

      </main>
      <BottomNav />

      {/* Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-xl">Detail Absensi</DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="text-center pb-2 border-b">
                <p className="font-bold text-lg text-primary">
                  {format(new Date(selectedRecord.date), 'EEEE, dd MMM yyyy', { locale: id })}
                </p>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedRecord.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                  selectedRecord.status === 'late' ? 'bg-amber-100 text-amber-700' :
                  selectedRecord.status === 'absent' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {selectedRecord.status === 'present' ? 'Hadir' :
                   selectedRecord.status === 'late' ? 'Telat' :
                   selectedRecord.status === 'sick' ? 'Sakit' :
                   selectedRecord.status === 'permission' ? 'Izin' :
                   selectedRecord.status === 'absent' ? 'Alpa' : selectedRecord.status}
                </span>
                {selectedRecord.shift && (
                    <p className="text-xs text-muted-foreground mt-2">Shift: <span className="font-bold">{selectedRecord.shift}</span></p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> Masuk
                  </div>
                  <p className="font-mono font-bold text-lg">
                    {selectedRecord.checkIn ? format(new Date(selectedRecord.checkIn), 'HH:mm') : '--:--'}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground text-right justify-end">
                    Pulang <LogOut className="w-3 h-3" />
                  </div>
                  <p className="font-mono font-bold text-lg text-right">
                    {selectedRecord.checkOut ? format(new Date(selectedRecord.checkOut), 'HH:mm') : '--:--'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coffee className="w-3 h-3" /> Istirahat
                  </div>
                  <p className="font-mono font-medium text-sm">
                    {selectedRecord.breakStart ? format(new Date(selectedRecord.breakStart), 'HH:mm') : '--:--'}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground text-right justify-end">
                    Selesai <Clock className="w-3 h-3" />
                  </div>
                  <p className="font-mono font-medium text-sm text-right">
                    {selectedRecord.breakEnd ? format(new Date(selectedRecord.breakEnd), 'HH:mm') : '--:--'}
                  </p>
                </div>
              </div>

              {selectedRecord.notes && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mt-4">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Catatan / Keterangan</p>
                  <p className="text-sm text-gray-700 italic">{selectedRecord.notes}</p>
                </div>
              )}

              <div className="pt-4">
                <Button className="w-full rounded-xl" onClick={() => setIsModalOpen(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
