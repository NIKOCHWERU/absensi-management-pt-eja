import { useQuery } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CalendarDays, UserPlus, LogOut, FileText } from "lucide-react";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell, 
    AreaChart, 
    Area, 
    LabelList,
    ResponsiveContainer as RC
} from 'recharts';
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { format, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [absenceDate, setAbsenceDate] = useState(new Date().toISOString().split('T')[0]);
  
  const { data: stats } = useQuery<{ totalEmployees: number; presentToday: number }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: attendanceHistory } = useQuery<Attendance[]>({
      queryKey: ["/api/attendance"], // Fetches all history
  });

  const { data: users } = useQuery<User[]>({
      queryKey: ["/api/admin/users"],
  });

  // Recent 5 activities
  const recentActivities = attendanceHistory?.slice(0, 5) || [];

  // Helper to get NIK
  const getUserNik = (userId: number) => {
      const u = users?.find(user => user.id === userId);
      return u?.nik || u?.username || userId;
  }

  const currentDate = new Date("2026-02-08T17:00:00"); // Using the source of truth time approximately for display if needed, but for "Hari ini" use System Date.
  // Actually, standard Date() is fine as long as system time is correct.
  
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar (Simple version for now) */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <img src="/logo_elok_buah.jpg" alt="Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-green-600">Admin Panel</h1>
            <p className="text-xs text-gray-400">PT ELOK JAYA ABADHI</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start text-green-600 bg-green-50 font-medium">
            <CalendarDays className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/employees")}>
            <Users className="mr-2 h-4 w-4" />
            Daftar Karyawan
          </Button>
          <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/recap")}>
            <Clock className="mr-2 h-4 w-4" />
            Rekap Absensi
          </Button>
           <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/info-board")}>
            <FileText className="mr-2 h-4 w-4" />
            Papan Informasi
          </Button>
          <Button variant="ghost" className="w-full justify-start h-auto py-2 text-left items-start whitespace-normal text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/attendance-summary")}>
            <FileText className="mr-2 h-4 w-4 shrink-0 mt-1" />
            <span>Absensi Management PT ELOK JAYA ABADHI</span>
          </Button>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <Button variant="outline" className="w-full text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <header className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
            <div className="text-sm text-gray-500 font-medium capitalize">
                {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
            </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card 
                className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl overflow-hidden group cursor-pointer hover:translate-y-[-2px]"
                onClick={() => setLocation("/admin/employees")}
            >
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                             <p className="text-sm font-medium text-gray-500 mb-1">Total Karyawan</p>
                             <h3 className="text-4xl font-bold text-gray-800">{stats?.totalEmployees || 0}</h3>
                        </div>
                        <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg group-hover:scale-110 transition-transform">
                            <Users className="h-6 w-6 text-green-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card 
                className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl overflow-hidden group cursor-pointer hover:translate-y-[-2px]"
                onClick={() => setLocation("/admin/recap")}
            >
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                             <p className="text-sm font-medium text-gray-500 mb-1">Hadir Hari Ini</p>
                             <h3 className="text-4xl font-bold text-gray-800">{stats?.presentToday || 0}</h3>
                        </div>
                        <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 rounded-lg group-hover:scale-110 transition-transform">
                            <Clock className="h-6 w-6 text-green-500" />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>Lihat Rekap Absen</span>
                    </div>
                </CardContent>
            </Card>

            <Card 
                className="border-none shadow-sm hover:shadow-md transition-all bg-white rounded-xl overflow-hidden group cursor-pointer hover:translate-y-[-2px]"
                onClick={() => setLocation("/admin/attendance-summary")}
            >
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                         <div>
                             <p className="text-sm font-medium text-gray-500 mb-1">Izin / Sakit</p>
                             <h3 className="text-4xl font-bold text-gray-800">
                                {(() => {
                                    const now = new Date();
                                    const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                    return attendanceHistory?.filter(a => isToday(a.date) && ['sick', 'permission'].includes(a.status || '')).length || 0;
                                })()}
                             </h3>
                        </div>
                        <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg group-hover:scale-110 transition-transform">
                            <CalendarDays className="h-6 w-6 text-blue-500" />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>Lihat Ringkasan</span>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Weekly Trend Chart */}
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-gray-800">Tren Kehadiran (7 Hari Terakhir)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={(() => {
                                    // Generate last 7 days including today
                                    const days = Array.from({ length: 7 }, (_, i) => {
                                        const d = new Date();
                                        d.setDate(d.getDate() - (6 - i));
                                        return d;
                                    });

                                    return days.map(day => {
                                        const dateStr = day.toISOString().split('T')[0];
                                        // Filter history for this day
                                        const dailyRecs = attendanceHistory?.filter(a => String(a.date).startsWith(dateStr)) || [];
                                        
                                        return {
                                            name: format(day, "d MMM", { locale: id }),
                                            Hadir: dailyRecs.filter(a => a.status === 'present').length,
                                            Telat: dailyRecs.filter(a => a.status === 'late').length,
                                            Izin: dailyRecs.filter(a => a.status && ['sick', 'permission'].includes(a.status)).length
                                        };
                                    });
                                })()}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                                    tickLine={false}
                                    axisLine={false} 
                                    dy={10}
                                />
                                <YAxis 
                                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                                    tickLine={false} 
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    align="right" 
                                    iconType="circle"
                                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 600 }} 
                                />
                                <Bar dataKey="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} activeBar={{ fill: '#059669' }}>
                                    <LabelList dataKey="Hadir" position="top" style={{ fill: '#10b981', fontSize: '10px', fontWeight: 'bold' }} />
                                </Bar>
                                <Bar dataKey="Telat" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} activeBar={{ fill: '#d97706' }}>
                                    <LabelList dataKey="Telat" position="top" style={{ fill: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }} />
                                </Bar>
                                <Bar dataKey="Izin" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} activeBar={{ fill: '#2563eb' }}>
                                    <LabelList dataKey="Izin" position="top" style={{ fill: '#3b82f6', fontSize: '10px', fontWeight: 'bold' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Daily Composition Chart */}
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl overflow-hidden">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-bold text-gray-800">Komposisi Kehadiran Hari Ini</CardTitle>
                        <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
                            {(() => {
                                const now = new Date();
                                const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                const todayRecs = attendanceHistory?.filter(a => isToday(a.date)) || [];
                                const totalEmps = stats?.totalEmployees || 0;
                                return Math.max(0, totalEmps - todayRecs.length);
                            })()} Belum Absen
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={(() => {
                                        const now = new Date();
                                        const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                        const todayRecs = attendanceHistory?.filter(a => isToday(a.date)) || [];
                                        const totalEmps = stats?.totalEmployees || 0;
                                        
                                        const present = todayRecs.filter(a => a.status === 'present').length;
                                        const late = todayRecs.filter(a => a.status === 'late').length;
                                        const permission = todayRecs.filter(a => a.status && ['sick', 'permission'].includes(a.status)).length; 
                                        const recordedCount = todayRecs.length;
                                        const absent = Math.max(0, totalEmps - recordedCount);

                                        return [
                                            { name: 'Hadir', value: present, color: '#10b981' },
                                            { name: 'Telat', value: late, color: '#f59e0b' },
                                            { name: 'Izin', value: permission, color: '#3b82f6' },
                                            { name: 'Belum', value: absent, color: '#e5e7eb' },
                                        ].filter(d => d.value > 0);
                                    })()}
                                     cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {(() => {
                                        const now = new Date();
                                        const isToday = (date: any) => new Date(date).toDateString() === now.toDateString();
                                        const todayRecs = attendanceHistory?.filter(a => isToday(a.date)) || [];
                                        const totalEmps = stats?.totalEmployees || 0;
                                        
                                        const present = todayRecs.filter(a => a.status === 'present').length;
                                        const late = todayRecs.filter(a => a.status === 'late').length;
                                        const permission = todayRecs.filter(a => a.status && ['sick', 'permission'].includes(a.status)).length; 
                                        const recordedCount = todayRecs.length;
                                        const absent = Math.max(0, totalEmps - recordedCount);

                                        return [
                                            { name: 'Hadir', value: present, color: '#10b981' },
                                            { name: 'Telat', value: late, color: '#f59e0b' },
                                            { name: 'Izin', value: permission, color: '#3b82f6' },
                                            { name: 'Belum', value: absent, color: '#e5e7eb' },
                                        ].filter(d => d.value > 0);
                                    })().map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
                                                    <p className="font-bold text-gray-800 mb-1">{data.name}</p>
                                                    <p className="text-sm">
                                                        <span className="font-semibold" style={{ color: data.color }}>
                                                            {data.value}
                                                        </span> Karyawan
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Live Feed and Absence List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-none shadow-md bg-white lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-gray-800">Live Absensi Terbaru</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                                <tr>
                                    <th className="px-4 py-3">Hari / Tanggal</th>
                                    <th className="px-4 py-3">NIK</th>
                                    <th className="px-4 py-3">Masuk</th>
                                    <th className="px-4 py-3">Istirahat</th>
                                    <th className="px-4 py-3">Selesai</th>
                                    <th className="px-4 py-3">Pulang</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentActivities.map((record) => (
                                    <tr key={record.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {format(new Date(record.date), 'EEEE, d MMM yyyy', { locale: id })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-600">{getUserNik(record.userId)}</td>
                                        <td className="px-4 py-3 text-green-600 font-mono">
                                            {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-green-600 font-mono">
                                            {record.breakStart ? format(new Date(record.breakStart), 'HH:mm') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-green-600 font-mono">
                                            {record.breakEnd ? format(new Date(record.breakEnd), 'HH:mm') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-red-600 font-mono">
                                            {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase
                                                ${record.status === 'present' ? 'bg-green-100 text-green-700' : 
                                                  record.status === 'late' ? 'bg-red-100 text-red-700' :
                                                  record.status === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                  record.status === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                  'bg-gray-100 text-gray-700'}`}>
                                                {record.status === 'present' ? 'Hadir' : 
                                                 record.status === 'late' ? 'Telat' : 
                                                 record.status === 'sick' ? 'Sakit' : 
                                                 record.status === 'permission' ? 'Izin' : 
                                                 record.status === 'absent' ? 'Alpha' : record.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {recentActivities.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                            Belum ada data absensi.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Who Didn't Clock In */}
            <Card className="border-none shadow-md bg-white">
                <CardHeader className="flex flex-col space-y-2">
                    <CardTitle className="text-lg font-bold text-gray-800">Daftar Belum Absen</CardTitle>
                    <Input 
                        type="date" 
                        value={absenceDate} 
                        onChange={(e) => setAbsenceDate(e.target.value)}
                        className="h-8 text-xs"
                    />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-auto pr-2">
                        {(() => {
                            const employees = users?.filter(u => u.role === 'employee') || [];
                            const dateRecords = attendanceHistory?.filter(a => format(new Date(a.date), 'yyyy-MM-dd') === absenceDate) || [];
                            const absentEmployees = employees.filter(emp => !dateRecords.some(att => att.userId === emp.id));

                            if (absentEmployees.length === 0) {
                                return <p className="text-center py-8 text-gray-400 text-sm">Semua karyawan sudah absen.</p>;
                            }

                            return absentEmployees.map(emp => (
                                <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50/50 border border-red-100/50">
                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">
                                        {emp.fullName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800 truncate">{emp.fullName}</p>
                                        <p className="text-[10px] text-gray-500 font-mono capitalize">{emp.nik || emp.username}</p>
                                    </div>
                                    <div className="text-[10px] font-bold text-red-400 uppercase">Alpha</div>
                                </div>
                            ));
                        })()}
                    </div>
                </CardContent>
            </Card>
        </div>

      </main>
    </div>
  );
}
