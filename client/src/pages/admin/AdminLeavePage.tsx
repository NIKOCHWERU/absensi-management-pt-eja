import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeaveRequest, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, Check, X, ArrowLeft, Calendar, User as UserIcon, MessageSquare, Info , Image as ImageIcon} from "lucide-react";
import { api } from "@shared/routes";
import { useLocation } from "wouter";

export default function AdminLeavePage() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: requests, isLoading } = useQuery<LeaveRequest[]>({
        queryKey: [api.admin.attendance.leave.list.path],
    });

    const mutation = useMutation({
        mutationFn: async ({ id, status }: { id: number, status: string }) => {
            const res = await fetch(api.admin.attendance.leave.update.path.replace(':id', id.toString()), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) throw new Error("Gagal memperbarui status");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.admin.attendance.leave.list.path] });
            queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
            toast({
                title: "Berhasil",
                description: "Status permohonan telah diperbarui.",
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

    const getUserName = (userId: number) => {
        return users?.find(u => u.id === userId)?.fullName || `User #${userId}`;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 p-4 px-8 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-bold text-gray-800">Manajemen Cuti Karyawan</h1>
                </div>
            </header>

            <main className="p-8 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Permohonan Cuti</h2>
                        <p className="text-sm text-gray-500">Setujui atau tolak permohonan cuti dari karyawan.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <p>Memuat data permohonan...</p>
                        </div>
                    ) : requests?.length === 0 ? (
                        <Card className="col-span-full border-dashed border-2 py-20 flex flex-col items-center justify-center text-gray-400 bg-transparent">
                            <Calendar className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-medium text-lg">Belum ada permohonan cuti.</p>
                        </Card>
                    ) : (
                        requests?.map((req) => (
                            <Card key={req.id} className="rounded-3xl border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <CardHeader className="bg-white pb-2 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                                            <UserIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-bold text-gray-900 leading-tight">
                                                {getUserName(req.userId)}
                                            </CardTitle>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                Diajukan pada: {format(new Date(req.createdAt!), "d MMM yyyy")}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${req.status === 'approved' ? 'text-green-600 bg-green-50 border-green-100' :
                                            req.status === 'rejected' ? 'text-red-600 bg-red-50 border-red-100' :
                                                req.status === 'cancelled' ? 'text-gray-600 bg-gray-50 border-gray-100' :
                                                    'text-orange-600 bg-orange-50 border-orange-100'
                                        }`}>
                                        {req.status === 'approved' ? 'Disetujui' :
                                            req.status === 'rejected' ? 'Ditolak' :
                                                req.status === 'cancelled' ? 'Dibatalkan' : 'Pending'}
                                    </span>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border border-gray-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                            <Calendar className="w-3 h-3" /> {req.selectedDates ? "TANGGAL TERPILIH" : "PERIODE CUTI"}
                                        </div>
                                        <div className="font-bold text-gray-800">
                                            {req.selectedDates ? (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {req.selectedDates.split(',').map(d => (
                                                        <span key={d} className="bg-white px-2 py-0.5 rounded-md border border-gray-100 text-[10px]">
                                                            {format(new Date(d), "d MMM yyyy", { locale: id })}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p>
                                                    {format(new Date(req.startDate), "EEEE, d MMM", { locale: id })} - {format(new Date(req.endDate), "EEEE, d MMM yyyy", { locale: id })}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                            <MessageSquare className="w-3 h-3" /> ALASAN
                                        </div>
                                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl italic">
                                            "{req.reason}"
                                        </p>
                                    </div>

                                    {req.status === 'pending' && (
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 rounded-xl h-12 text-red-600 border-red-100 hover:bg-red-50 gap-2 font-bold"
                                                onClick={() => mutation.mutate({ id: req.id, status: 'rejected' })}
                                                disabled={mutation.isPending}
                                            >
                                                <X className="w-4 h-4" /> Tolak
                                            </Button>
                                            <Button
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 gap-2 font-bold shadow-lg shadow-green-100"
                                                onClick={() => mutation.mutate({ id: req.id, status: 'approved' })}
                                                disabled={mutation.isPending}
                                            >
                                                <Check className="w-4 h-4" /> Setujui
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
