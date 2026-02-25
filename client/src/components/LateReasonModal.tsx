import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, RefreshCw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LateReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string, photo?: string) => void;
}

export function LateReasonModal({ isOpen, onClose, onSubmit }: LateReasonModalProps) {
    const [reason, setReason] = useState("");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { toast } = useToast();

    const startCamera = async () => {
        try {
            setIsCameraActive(true);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            toast({
                title: "Gagal mengakses kamera",
                description: "Pastikan Anda memberikan izin akses kamera.",
                variant: "destructive",
            });
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraActive(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const photo = canvas.toDataURL("image/png");
                setCapturedPhoto(photo);
                stopCamera();
            }
        }
    };

    const handleSubmit = () => {
        if (!reason.trim()) {
            toast({
                title: "Alasan wajib diisi",
                description: "Silakan berikan alasan mengapa Anda terlambat.",
                variant: "destructive",
            });
            return;
        }
        onSubmit(reason, capturedPhoto || undefined);
        setReason("");
        setCapturedPhoto(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-center text-red-500">
                        Anda Terlambat
                    </DialogTitle>
                    <p className="text-sm text-zinc-400 text-center">
                        Pukul 07:00 telah lewat. Silakan isi alasan keterlambatan Anda.
                    </p>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Alasan</label>
                        <Textarea
                            placeholder="Contoh: Macet di jalan, kendala kendaraan, dll."
                            className="bg-zinc-900 border-zinc-800 text-zinc-100 min-h-[100px]"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Bukti Foto (Opsional)</label>
                        <div className="relative aspect-video bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center overflow-hidden">
                            {capturedPhoto ? (
                                <>
                                    <img src={capturedPhoto} alt="Bukti Terlambat" className="w-full h-full object-cover" />
                                    <Button
                                        size="icon"
                                        variant="destructive"
                                        className="absolute top-2 right-2 rounded-full"
                                        onClick={() => setCapturedPhoto(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : isCameraActive ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <Button
                                        className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-600 hover:bg-red-700"
                                        size="lg"
                                        onClick={capturePhoto}
                                    >
                                        Ambil Foto
                                    </Button>
                                </>
                            ) : (
                                <div className="text-center space-y-2 p-6">
                                    <div className="p-3 bg-zinc-800 rounded-full inline-block">
                                        <Camera className="h-6 w-6 text-zinc-400" />
                                    </div>
                                    <p className="text-xs text-zinc-500">Ambil foto bukti keterlambatan jika diperlukan</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-zinc-700 hover:bg-zinc-800"
                                        onClick={startCamera}
                                    >
                                        Buka Kamera
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        className="w-full sm:w-auto text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button
                        className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
                        onClick={handleSubmit}
                    >
                        Lanjutkan ke Absen
                    </Button>
                </DialogFooter>
            </DialogContent>
            <canvas ref={canvasRef} className="hidden" />
        </Dialog>
    );
}
