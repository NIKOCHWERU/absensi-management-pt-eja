import { useQuery } from "@tanstack/react-query";
import { LeaveRequest, User } from "@shared/schema";
import { CompanyHeader } from "@/components/CompanyHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, ArrowLeft, Calendar, User as UserIcon, Search, Filter , Image as ImageIcon} from "lucide-react";
import { api } from "@shared/routes";
import { useLocation } from "wouter";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function AdminLeaveHistoryPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
        queryKey: [api.admin.attendance.leave.list.path],
    });

    const getUserName = (userId: number) => {
        return users?.find(u => u.id === userId)?.fullName || `User #${userId}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'text-green-600 bg-green-50 border-green-100';
            case 'rejected': return 'text-red-600 bg-red-50 border-red-100';
            case 'cancelled': return 'text-gray-600 bg-gray-50 border-gray-100';
            default: return 'text-orange-600 bg-orange-50 border-orange-100';
        }
    };

    const filteredRequests = requests?.filter(req => {
        const userName = getUserName(req.userId).toLowerCase();
        return userName.includes(searchTerm.toLowerCase()) || req.reason.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 p-4 px-8 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold text-gray-800">Riwayat & Log Cuti</h1>
                </div>
            </header>

            <main className="p-8 max-w-6xl mx-auto space-y-6">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                    <CardHeader className="bg-white border-b border-gray-50 flex flex-row items-center justify-between gap-4 p-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Cari nama karyawan atau alasan..."
                                className="pl-10 rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-all h-11"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" className="rounded-2xl h-11 gap-2 text-gray-600 border-gray-200">
                            <Filter className="w-4 h-4" /> Filter
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-gray-400 font-black uppercase tracking-widest bg-gray-50/50">
                                    <tr>
                                        <th className="px-6 py-4">Karyawan</th>
                                        <th className="px-6 py-4">Tanggal Pengajuan</th>
                                        <th className="px-6 py-4">Periode Cuti</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Alasan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-200" />
                                            </td>
                                        </tr>
                                    ) : filteredRequests?.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                Tidak ditemukan data permohonan.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRequests?.map((req) => (
                                            <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                            {getUserName(req.userId).charAt(0)}
                                                        </div>
                                                        <span className="font-bold text-gray-900">{getUserName(req.userId)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                                                    {format(new Date(req.createdAt!), "d MMM yyyy HH:mm")}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {req.selectedDates ? (
                                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                            {req.selectedDates.split(',').length} Hari Terpilih
                                                        </div>
                                                    ) : (
                                                        <div className="font-bold text-gray-700 whitespace-nowrap">
                                                            {format(new Date(req.startDate), "d MMM")} - {format(new Date(req.endDate), "d MMM yyyy")}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${getStatusColor(req.status!)}`}>
                                                        {req.status === 'approved' ? 'Disetujui' :
                                                            req.status === 'rejected' ? 'Ditolak' :
                                                                req.status === 'cancelled' ? 'Batal' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-gray-600 line-clamp-2 min-w-[200px] italic">"{req.reason}"</p>
                                                </td>
                                            </tr>
                                        ))
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
