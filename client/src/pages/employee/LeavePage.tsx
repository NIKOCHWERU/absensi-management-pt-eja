import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LeaveRequest } from "@shared/schema";
import { CompanyHeader } from "@/components/CompanyHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, isBefore, startOfDay, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { useState } from "react";
import { Loader2, Calendar as CalendarIcon, History, Send, Info } from "lucide-react";
import { api } from "@shared/routes";
import { DateRange } from "react-day-picker";

export default function LeavePage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [reason, setReason] = useState("");

    const { data: balance, isLoading: isLoadingBalance } = useQuery<{ used: number, remaining: number, limit: number }>({
        queryKey: [api.leave.balance.path],
    });

    const { data: requests, isLoading: isLoadingRequests } = useQuery<LeaveRequest[]>({
        queryKey: [api.leave.list.path],
    });

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(api.leave.create.path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal mengajukan cuti");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.leave.list.path] });
            queryClient.invalidateQueries({ queryKey: [api.leave.balance.path] });
            setDateRange(undefined);
            setReason("");
            toast({
                title: "Berhasil",
                description: "Permohonan cuti Anda telah dikirim.",
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

    const handleApply = () => {
        if (!dateRange?.from || !dateRange?.to) {
            return toast({ title: "Pilih Tanggal", description: "Mohon pilih rentang tanggal cuti.", variant: "destructive" });
        }
        if (!reason.trim()) {
            return toast({ title: "Isi Alasan", description: "Mohon masukkan alasan cuti Anda.", variant: "destructive" });
        }

        mutation.mutate({
            startDate: format(dateRange.from, "yyyy-MM-dd"),
            endDate: format(dateRange.to, "yyyy-MM-dd"),
            reason,
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'text-green-600 bg-green-50 border-green-100';
            case 'rejected': return 'text-red-600 bg-red-50 border-red-100';
            default: return 'text-orange-600 bg-orange-50 border-orange-100';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return 'Disetujui';
            case 'rejected': return 'Ditolak';
            default: return 'Menunggu';
        }
    };

    const totalSelectedDays = dateRange?.from && dateRange?.to
        ? differenceInDays(dateRange.to, dateRange.from) + 1
        : 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <CompanyHeader />

            <main className="p-4 space-y-4 max-w-lg mx-auto">
                {/* Balance Card */}
                <Card className="border-none shadow-sm bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-3xl overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-green-100 text-sm font-medium opacity-90">Sisa Kuota Cuti</p>
                                <h2 className="text-4xl font-black mt-1">
                                    {isLoadingBalance ? "..." : balance?.remaining} <span className="text-lg font-normal opacity-70">Hari</span>
                                </h2>
                            </div>
                            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                <CalendarIcon className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                            <div>
                                <p className="text-green-100 text-[10px] uppercase font-bold tracking-wider opacity-70">Telah Digunakan</p>
                                <p className="text-xl font-bold">{balance?.used} Hari</p>
                            </div>
                            <div>
                                <p className="text-green-100 text-[10px] uppercase font-bold tracking-wider opacity-70">Total Jatah</p>
                                <p className="text-xl font-bold">{balance?.limit} Hari</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Apply Section */}
                <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-white pb-2 px-6 pt-6">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-green-600" />
                            Pilih Tanggal Cuti
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <div className="bg-gray-50 rounded-2xl p-2 flex justify-center border border-gray-100">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={setDateRange}
                                disabled={(date) => isBefore(date, startOfDay(new Date()))}
                                initialFocus
                                className="w-full h-full flex justify-center"
                            />
                        </div>

                        {totalSelectedDays > 0 && (
                            <div className="bg-green-50 p-3 rounded-2xl border border-green-100 flex items-center gap-3">
                                <div className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                                    {totalSelectedDays} Hari
                                </div>
                                <p className="text-xs text-green-700 font-medium">
                                    {format(dateRange!.from!, "d MMM")} - {format(dateRange!.to!, "d MMM yyyy", { locale: id })}
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-400 ml-1">Alasan Cuti</label>
                            <Textarea
                                placeholder="Misal: Keperluan Keluarga, Liburan, dll..."
                                className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-all h-24 resize-none"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl h-14 font-bold shadow-lg shadow-green-200 gap-2"
                            onClick={handleApply}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            Kirim Pengajuan
                        </Button>
                    </CardContent>
                </Card>

                {/* History Section */}
                <Card className="rounded-3xl border-none shadow-sm overflow-hidden mb-8">
                    <CardHeader className="bg-white pb-2 px-6 pt-6">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <History className="w-5 h-5 text-gray-400" />
                            Riwayat Pengajuan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-gray-50">
                            {isLoadingRequests ? (
                                <div className="p-8 flex justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                                </div>
                            ) : requests?.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="bg-gray-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                        <Info className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium">Belum ada riwayat pengajuan.</p>
                                </div>
                            ) : (
                                requests?.map((req) => (
                                    <div key={req.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {format(new Date(req.startDate), "d MMM")} - {format(new Date(req.endDate), "d MMM yyyy")}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{req.reason}</p>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${getStatusColor(req.status!)}`}>
                                                {getStatusLabel(req.status!)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>

            <BottomNav />
        </div>
    );
}
