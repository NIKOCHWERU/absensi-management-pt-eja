import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatabaseBackup, Download, UploadCloud, Trash2, CalendarDays, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "@/components/ui/dialog";

interface BackupFile {
    filename: string;
    size: number;
    createdAt: string;
    path: string;
}

export default function DatabaseBackupPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: backups, isLoading, refetch } = useQuery<BackupFile[]>({
        queryKey: ["/api/admin/backups"],
    });

    const createBackupMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/admin/backup/create", { method: "POST" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal membuat backup");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Berhasil", description: "Backup database berhasil dibuat." });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
        },
        onError: (error: Error) => {
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        }
    });

    const deleteBackupMutation = useMutation({
        mutationFn: async (filename: string) => {
            const res = await fetch(`/api/admin/backup/${filename}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Gagal menghapus backup");
            }
        },
        onSuccess: () => {
            toast({ title: "Berhasil", description: "File backup berhasil dihapus." });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
        },
        onError: (error: Error) => {
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        }
    });

    const handleRestoreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirmRestore = confirm("PERINGATAN! Restore akan MENIMPA seluruh data saat ini! Lanjutkan?");
        if (!confirmRestore) {
            e.target.value = ''; // Reset input
            return;
        }

        const formData = new FormData();
        formData.append("backup", file);

        try {
            const res = await fetch("/api/admin/restore", {
                method: "POST",
                body: formData
            });
            if (res.ok) {
                toast({ title: "Berhasil", description: "Database berhasil di-restore." });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                const json = await res.json();
                toast({ title: "Gagal", description: json.message || "Gagal restore database", variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Gagal menghubungi server", variant: "destructive" });
        }
    };

    const handleRestoreServerFile = async (filename: string) => {
        const confirmRestore = confirm(`PERINGATAN! Anda akan melakukan restore dari file ${filename}. Seluruh data saat ini akan DITIMPA! Lanjutkan?`);
        if (!confirmRestore) return;

        try {
            const res = await fetch(`/api/admin/restore/${filename}`, { method: "POST" });
            if (res.ok) {
                toast({ title: "Berhasil", description: "Database berhasil di-restore." });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                const json = await res.json();
                toast({ title: "Gagal", description: json.message || "Gagal restore database", variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Gagal menghubungi server", variant: "destructive" });
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center">
            <main className="flex-1 w-full max-w-5xl p-4 md:p-8">
                <header className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <DatabaseBackup className="w-6 h-6 text-green-600" />
                        Manajemen Database Backup
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Sistem otomatis melakukan backup setiap 12 jam. Anda juga bisa membuat backup secara manual.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Card className="border border-green-100 shadow-sm">
                        <CardHeader className="bg-green-50/50 border-b border-green-100 p-4">
                            <CardTitle className="text-md font-bold text-green-800 flex items-center gap-2">
                                <DatabaseBackup className="w-5 h-5" /> Buat Backup Manual
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex flex-col justify-between h-[120px]">
                            <p className="text-sm text-gray-600">
                                Buat file backup database MySQL terbaru sekarang. Anda dapat mengunduhnya nanti.
                            </p>
                            <Button
                                onClick={() => createBackupMutation.mutate()}
                                disabled={createBackupMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white w-full md:w-auto self-start mt-2"
                            >
                                {createBackupMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
                                Backup Sekarang
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border border-orange-100 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-16 h-16 bg-orange-100 rounded-bl-full flex items-start justify-end p-2 opacity-50">
                            <AlertTriangle className="w-6 h-6 text-orange-500" />
                        </div>
                        <CardHeader className="bg-orange-50/50 border-b border-orange-100 p-4">
                            <CardTitle className="text-md font-bold text-orange-800 flex items-center gap-2">
                                <UploadCloud className="w-5 h-5" /> Restore Database Custom
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex flex-col justify-between h-[120px]">
                            <p className="text-sm text-gray-600">
                                Upload file <strong className="text-orange-600">.sql</strong> untuk overwrite data sistem. Proses ini tidak dapat dibatalkan.
                            </p>
                            <div className="mt-2 text-left">
                                <label className="inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-orange-500 text-primary-foreground hover:bg-orange-600 h-10 px-4 py-2 text-white">
                                    <UploadCloud className="w-4 h-4 mr-2" /> Upload & Restore .sql
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".sql"
                                        onChange={handleRestoreUpload}
                                    />
                                </label>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-none shadow-md bg-white">
                    <CardHeader className="flex flex-row justify-between items-center border-b border-gray-100 p-6">
                        <div>
                            <CardTitle className="text-lg font-bold text-gray-800">Daftar Backup Tersedia</CardTitle>
                            <CardDescription>File backup .sql otomatis dan manual</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Segarkan
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-500">Memuat data backup...</div>
                        ) : backups && backups.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4">Nama File</th>
                                            <th className="px-6 py-4">Waktu Backup</th>
                                            <th className="px-6 py-4">Ukuran</th>
                                            <th className="px-6 py-4 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {backups.map((bkp, i) => (
                                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-gray-700 text-xs font-medium">
                                                    {bkp.filename}
                                                    {bkp.filename.includes('auto') && (
                                                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                                            Auto
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <CalendarDays className="w-4 h-4 text-gray-400" />
                                                        {format(new Date(bkp.createdAt), "dd MMM yyyy, HH:mm", { locale: id })}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                    {formatBytes(bkp.size)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                                            title="Download file sql"
                                                            onClick={() => window.location.href = `/api/admin/backup/download/${bkp.filename}`}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </Button>

                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-orange-600 border-orange-200 hover:bg-orange-50"
                                                                    title="Restore dari file ini"
                                                                >
                                                                    <UploadCloud className="w-4 h-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent>
                                                                <DialogHeader>
                                                                    <DialogTitle className="text-orange-700 flex items-center gap-2">
                                                                        <AlertTriangle className="w-5 h-5" />
                                                                        Konfirmasi Restore Database
                                                                    </DialogTitle>
                                                                    <DialogDescription className="pt-2">
                                                                        Anda akan me-restore database dari file: <br />
                                                                        <strong className="font-mono text-gray-800 text-xs block mt-2 p-2 bg-gray-100 rounded">{bkp.filename}</strong>
                                                                        <p className="mt-4 text-red-600 font-bold">
                                                                            PERINGATAN: Selesai proses ini, seluruh data di sistem akan ditimpa! Pastikan Anda tahu apa yang Anda lakukan!
                                                                        </p>
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <DialogFooter>
                                                                    <DialogClose asChild>
                                                                        <Button variant="outline">Batal</Button>
                                                                    </DialogClose>
                                                                    <Button
                                                                        variant="destructive"
                                                                        onClick={() => handleRestoreServerFile(bkp.filename)}
                                                                    >
                                                                        Ya, Jalankan Restore
                                                                    </Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>

                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50"
                                                            title="Hapus file backup"
                                                            onClick={() => {
                                                                if (confirm(`Hapus file ${bkp.filename}?`)) deleteBackupMutation.mutate(bkp.filename);
                                                            }}
                                                            disabled={deleteBackupMutation.isPending}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center flex flex-col items-center">
                                <DatabaseBackup className="w-12 h-12 text-gray-300 mb-4" />
                                <h3 className="text-lg font-bold text-gray-700">Belum ada backup</h3>
                                <p className="text-gray-500 max-w-sm mt-1">
                                    Sistem akan membuat backup otomatis pertama setelah 12 jam, atau klik "Buat Backup Manual" di atas.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
