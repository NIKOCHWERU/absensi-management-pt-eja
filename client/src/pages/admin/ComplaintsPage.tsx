import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Loader2, ArrowLeft, Clock, CheckCircle, AlertCircle, Eye, User } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "wouter";

interface Complaint {
    id: number;
    userId: number;
    title: string;
    description: string;
    status: "pending" | "reviewed" | "resolved";
    createdAt: string;
}

interface ComplaintPhoto {
    id: number;
    complaintId: number;
    photoUrl: string;
    caption: string | null;
}

interface UserInfo {
    id: number;
    fullName: string;
    username: string;
    nik: string;
    branch: string;
    position: string;
}

export default function AdminComplaintsPage() {
    const { toast } = useToast();
    const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

    const { data: complaints = [], isLoading } = useQuery<Complaint[]>({
        queryKey: ["/api/admin/complaints"],
    });

    const { data: allUsers = [] } = useQuery<UserInfo[]>({
        queryKey: ["/api/admin/users"],
    });

    const { data: complaintPhotos = [] } = useQuery<ComplaintPhoto[]>({
        queryKey: [`/api/complaints/${selectedComplaint?.id}/photos`],
        enabled: !!selectedComplaint,
    });

    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: string }) => {
            const res = await fetch(`/api/admin/complaints/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Gagal update status");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/complaints"] });
            toast({ title: "Status diperbarui", className: "bg-green-500 text-white" });
            setSelectedComplaint(null);
        },
        onError: (e: any) => {
            toast({ title: "Gagal", description: e.message, variant: "destructive" });
        },
    });

    const getUserName = (userId: number) => {
        const u = allUsers.find((u) => u.id === userId);
        return u ? u.fullName : `User #${userId}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return (
                    <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" /> Menunggu
                    </span>
                );
            case "reviewed":
                return (
                    <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Ditinjau
                    </span>
                );
            case "resolved":
                return (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Selesai
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Pengaduan Karyawan</h1>
                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">
                        {complaints.filter((c) => c.status === "pending").length} Baru
                    </span>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : complaints.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Belum ada pengaduan</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {complaints.map((c, i) => (
                            <motion.div
                                key={c.id}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => setSelectedComplaint(c)}
                                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-800">{c.title}</h3>
                                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                            <User className="w-3 h-3" /> {getUserName(c.userId)}
                                        </p>
                                    </div>
                                    {getStatusBadge(c.status)}
                                </div>
                                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{c.description}</p>
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] text-gray-400">
                                        {c.createdAt && format(new Date(c.createdAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                                    </p>
                                    <Button variant="ghost" size="sm" className="text-xs text-primary">
                                        <Eye className="w-3 h-3 mr-1" /> Lihat Detail
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
                <DialogContent className="rounded-3xl max-w-md p-5 max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">{selectedComplaint?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedComplaint && getStatusBadge(selectedComplaint.status)}
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <User className="w-3 h-3" /> {selectedComplaint && getUserName(selectedComplaint.userId)}
                            </span>
                            <span className="text-[10px] text-gray-400">
                                {selectedComplaint?.createdAt &&
                                    format(new Date(selectedComplaint.createdAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedComplaint?.description}</p>

                        {complaintPhotos.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500">Foto Lampiran</p>
                                {complaintPhotos.map((photo) => (
                                    <div key={photo.id} className="space-y-1">
                                        <img
                                            src={photo.photoUrl}
                                            alt={photo.caption || ""}
                                            className="w-full rounded-xl border border-gray-100"
                                        />
                                        {photo.caption && (
                                            <p className="text-xs text-gray-400 italic">{photo.caption}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Status Update Buttons */}
                        <div className="border-t pt-4 space-y-2">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Ubah Status:</p>
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    disabled={selectedComplaint?.status === "pending" || statusMutation.isPending}
                                    onClick={() => selectedComplaint && statusMutation.mutate({ id: selectedComplaint.id, status: "pending" })}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                                >
                                    <Clock className="w-3 h-3 mr-1" /> Menunggu
                                </Button>
                                <Button
                                    disabled={selectedComplaint?.status === "reviewed" || statusMutation.isPending}
                                    onClick={() => selectedComplaint && statusMutation.mutate({ id: selectedComplaint.id, status: "reviewed" })}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-blue-700 border-blue-200 hover:bg-blue-50"
                                >
                                    <AlertCircle className="w-3 h-3 mr-1" /> Ditinjau
                                </Button>
                                <Button
                                    disabled={selectedComplaint?.status === "resolved" || statusMutation.isPending}
                                    onClick={() => selectedComplaint && statusMutation.mutate({ id: selectedComplaint.id, status: "resolved" })}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-green-700 border-green-200 hover:bg-green-50"
                                >
                                    <CheckCircle className="w-3 h-3 mr-1" /> Selesai
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
