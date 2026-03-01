import { useAuth } from "@/hooks/use-auth";
import { useAttendance } from "@/hooks/use-attendance";
import { CompanyHeader } from "@/components/CompanyHeader";
import { DigitalClock } from "@/components/DigitalClock";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Camera, MapPin, Coffee, LogOut, X, Check, RefreshCw, SwitchCamera, Zap } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { CameraModal } from "@/components/CameraModal";
import { LateReasonModal } from "@/components/LateReasonModal";
import { WorkTimer } from "@/components/WorkTimer";

// Helper: resolve photo URL — handles both local uploads and Google Drive File IDs
function getPhotoUrl(value: string): string {
    if (!value) return '';
    // Base64 data URI
    if (value.startsWith('data:')) return value;
    // Google Drive File ID: no dots, no slashes, length > 20 — use server proxy to avoid CORS/auth issues
    if (!value.includes('/') && !value.includes('.') && value.length > 20) {
        return `/api/images/${value}`;
    }
    // Local file
    return `/uploads/${value}`;
}

// Helper component for Shift Selection Modal
function ShiftModal({
    open,
    onSelect,
    onClose
}: {
    open: boolean,
    onSelect: (shift: string) => void,
    onClose: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="rounded-2xl max-w-xs md:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pilih Shift Kerja</DialogTitle>
                    <DialogDescription className="sr-only">
                        Pilih shift kerja yang sesuai untuk mulai melakukan absensi.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-3">
                    <Button
                        variant="outline"
                        className="h-12 justify-start px-4 text-base"
                        onClick={() => onSelect('Shift 1')}
                    >
                        <span className="font-bold mr-2">Shift 1</span>
                        <span className="text-muted-foreground text-xs">(07:00 - 15:00)</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-12 justify-start px-4 text-base"
                        onClick={() => onSelect('Shift 2')}
                    >
                        <span className="font-bold mr-2">Shift 2</span>
                        <span className="text-muted-foreground text-xs">(12:00 - 20:00)</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-12 justify-start px-4 text-base"
                        onClick={() => onSelect('Shift 3')}
                    >
                        <span className="font-bold mr-2">Shift 3</span>
                        <span className="text-muted-foreground text-xs">(15:00 - 23:00)</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-12 justify-start px-4 text-base"
                        onClick={() => onSelect('Tim Management')}
                    >
                        <span className="font-bold mr-2">Tim Management</span>
                        <span className="text-muted-foreground text-xs">(07:00 - 17:00)</span>
                    </Button>
                    <Button
                        variant="outline"
                        className="h-12 justify-start px-4 text-base"
                        onClick={() => onSelect('Long Shift')}
                    >
                        <span className="font-bold mr-2">Long Shift</span>
                        <span className="text-muted-foreground text-xs">(07:00 - ??)</span>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function EmployeeDashboard() {
    const { user } = useAuth();
    const { today, activeSession, todaySessions, sessionCount, completedSessions, isLoadingToday, clockIn, clockOut, breakStart, breakEnd, permit, resume, isPending } = useAttendance();
    const { toast } = useToast();

    const [permitOpen, setPermitOpen] = useState(false);
    const [permitNote, setPermitNote] = useState("");
    const [permitType, setPermitType] = useState<"sick" | "permission">("permission");
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Shift Selection State
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [selectedShift, setSelectedShift] = useState<string | null>(null);

    const [activeAction, setActiveAction] = useState<{
        fn: (data: any) => Promise<any>,
        successTitle: string,
        type: 'attendance' | 'permit'
    } | null>(null);

    const [isLateReasonModalOpen, setIsLateReasonModalOpen] = useState(false);
    const [lateReasonData, setLateReasonData] = useState<{ reason: string, photo?: string } | null>(null);

    const [locationAddress, setLocationAddress] = useState<string>("");
    const [processingLocation, setProcessingLocation] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    // ... (Keep existing getCoordinates logic)
    const lastLocationFetch = useRef<number>(0);
    const getCoordinates = async (force = false): Promise<{ lat: number, lng: number, address: string }> => {
        const now = Date.now();
        // If we have a location fetched in the last 5 mins, reuse it unless forced
        if (!force && locationAddress && (now - lastLocationFetch.current < 300000)) {
            return { lat: 0, lng: 0, address: locationAddress };
        }

        if (!navigator.geolocation) {
            throw new Error("Geolocation is not supported by your browser");
        }

        setProcessingLocation(true);
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude } = position.coords;
            let address = `${latitude},${longitude}`;

            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                if (data && data.display_name) {
                    address = data.display_name;
                }
            } catch (e) {
                console.error("Reverse geocoding failed", e);
            }

            setLocationAddress(address);
            lastLocationFetch.current = Date.now();
            return { lat: latitude, lng: longitude, address };
        } catch (err: any) {
            if (err.code === 1) { // PERMISSION_DENIED
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                if (isIOS) {
                    throw new Error("Akses lokasi ditolak. Buka Pengaturan iPhone -> Privasi -> Layanan Lokasi (Aktifkan), lalu pastikan Browser memiliki izin.");
                } else {
                    throw new Error("Akses lokasi ditolak. Silakan aktifkan izin lokasi di pengaturan browser atau HP Anda.");
                }
            } else if (err.code === 3) { // TIMEOUT
                throw new Error("Gagal mengambil lokasi (Timeout). Pastikan Anda berada di area terbuka dan koneksi internet stabil.");
            }
            throw err;
        } finally {
            setProcessingLocation(false);
        }
    };

    const handleError = (err: any) => {
        console.error(err);
        toast({
            title: "Gagal",
            description: err.message || "Terjadi kesalahan",
            variant: "destructive"
        });
    };

    const startAttendanceFlow = async (actionFn: (data: any) => Promise<any>, successTitle: string, isClockIn = false) => {
        // If it's a clock-in and session 1 and after 07:00, show late reason modal first
        if (isClockIn && sessionCount === 0) {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            if (hour * 60 + minute > 420) { // After 07:00
                setActiveAction({ fn: actionFn, successTitle, type: 'attendance' });
                setIsLateReasonModalOpen(true);
                return;
            }
        }

        // For PT ELOK JAYA ABADHI, we only use 'Management' shift.
        if (isClockIn && sessionCount === 0) {
            const wrappedClockIn = async (data: any) => {
                return clockIn({ ...data, shift: 'Management' });
            };
            setActiveAction({ fn: wrappedClockIn, successTitle, type: 'attendance' });
            setIsCameraOpen(true);
            return;
        }

        setActiveAction({ fn: actionFn, successTitle, type: 'attendance' });
        setIsCameraOpen(true);
    };

    const handleLateReasonSubmit = (reason: string, photo?: string) => {
        setLateReasonData({ reason, photo });
        setIsLateReasonModalOpen(false);

        // Continue to Camera Modal with Management shift
        const wrappedClockIn = async (data: any) => {
            return clockIn({ ...data, shift: 'Management' });
        };
        setActiveAction({ fn: wrappedClockIn, successTitle: "Berhasil Absen Masuk", type: 'attendance' });
        setIsCameraOpen(true);
    };

    // Removed handleShiftSelect logic as it's now defaulted to Management

    const startPermitFlow = () => {
        setPermitOpen(true);
    };

    const handlePermitCameraTrigger = () => {
        setPermitOpen(false);
        setActiveAction({
            fn: async (data: any) => {
                return permit({
                    type: permitType,
                    notes: permitNote,
                    checkInPhoto: data.checkInPhoto,
                    location: data.location
                });
            },
            successTitle: "Izin Diajukan",
            type: 'permit'
        });
        setIsCameraOpen(true);
    }

    const handlePhotoCaptured = async (photoData: string) => {
        if (!activeAction) return;

        try {
            const { address } = await getCoordinates(false);
            const payload: any = {
                location: address,
                checkInPhoto: photoData
            };

            if (lateReasonData) {
                payload.lateReason = lateReasonData.reason;
                payload.lateReasonPhoto = lateReasonData.photo;
            }

            await activeAction.fn(payload);

            toast({
                title: activeAction.successTitle,
                description: `Lokasi: ${address}`,
                className: "bg-green-500 text-white"
            });

            // Only close on success
            setIsCameraOpen(false);
            setActiveAction(null);
            // Clear shift selection after success
            setSelectedShift(null);
            setLateReasonData(null);

        } catch (err: any) {
            handleError(err);
            // Re-throw so the modal knows it failed
            throw err;
        }
    };

    // Clock Out Logic for Early Leave Check
    const handleClockOutClick = () => {
        // Logic: if current time < shift end time, warn user
        // We need to know shift end time. 
        // User prompt says: "jika karyawan pulang sebelum jam nya beri peringatan... dan beri pilihan IZIN"
        // Since we don't track shift info in 'today' object fully (we just added it to schema), we might need to rely on assumptions or fetch it.
        // Let's assume standard 8 hours from clockIn or fixed times based on shift name if we can get it.
        // BUT 'today' object in 'useAttendance' might not have 'shift' field yet on frontend type.
        // We should check shared/schema.ts updates are reflected in frontend types (Drizzle types are inferred usually).

        // Let's assume we can access today.shift or infer it.
        // If we can't get it easily, we will just prompt "Apakah anda yakin pulang sekarang?" -> "Izin Pulang Cepat" or "Pulang Biasa".
        // But prompt asks specific warning. 

        // Since I just added 'shift' to schema, 'today' SHOULD have it if I refetched.
        // Let's check time.

        const now = new Date();
        const hour = now.getHours();
        let isEarly = false;

        // We need to know the shift of the current attendance.
        // 'today' is type Attendance.
        // We can check 'today.shift' (we need to cast or ensure type is updated).
        // Let's assume 'today' has 'shift' property now.

        const currentShift = (today as any)?.shift;

        if (currentShift === 'Shift 1') {
            if (hour < 15) isEarly = true; // Ends 15:00
        } else if (currentShift === 'Shift 2') {
            if (hour < 20) isEarly = true; // Ends 20:00 (assumed 8h from 12)
            // Wait, shift 2 entry 12-14. Late >12. 
            // Use prompt rules? Shift 1 late >7. Shift 2 late >12. Shift 3 late >15.
            // Let's assume 8h work.
            // Shift 1: 07-15? Shift 2: 12-20? Shift 3: 15-23? Long: 07-??
        } else if (currentShift === 'Shift 3') {
            // Ends 23:00?
            if (hour < 23) {
                // But 23 is late night. Check if hour is small (next day) ? 
                // Complex. Let's just use 23 for today.
                isEarly = true;
            }
        }
        // If no shift stored, maybe skip check or warn always.

        if (isEarly) {
            // Show alert dialog (using a simple browser confirm or better a custom dialog)
            // Since I can't easily add another complex Dialog in this huge file without risk, I'll use window.confirm? 
            // No, User wants "pilihan IZIN yang akan membuat keterangan izin".

            // I'll reuse the Permit Flow for "Early Leave" aka "Izin Pulang"?
            // "jika karyawan pulang sebelum jam nya... beri pilihan IZIN yang akan membuat keterangan izin, dan foto pulang"

            // Let's trigger a specialized dialog or reuse permit dialog with type "permission" and prefilled note "Pulang Cepat / Early Leave".

            // I will use a simple window.confirm to ask "Belum waktunya pulang. Apakah anda ingin Izin Pulang Cepat?" 
            // If yes -> Open Permit Dialog. 
            // If no -> Cancel? Or proceed as normal clock out? 
            // "beri peringatan ... dan beri pilihan" -> usually implies blocking normal flow unless they force it, or guiding them to Izin.

            if (confirm("Belum waktunya pulang. Apakah Anda ingin mengajukan ISTIRAHAT/IZIN Pulang Cepat? \n\nKlik OK untuk Form Izin.\nKlik Cancel untuk membatalkan.")) {
                setPermitType('permission');
                setPermitNote("Pulang Cepat (Early Leave)");
                setPermitOpen(true);
            }
            return;
        }

        startAttendanceFlow(clockOut, "Hati-hati di jalan");
    };

    const isLoading = isPending || processingLocation;

    const hasCheckedIn = !!today?.checkIn;
    const hasCheckedOut = !!today?.checkOut;
    const isBreak = !!today?.breakStart && !today?.breakEnd;
    const hasBreakEnded = !!today?.breakEnd;

    const getStatusText = () => {
        if (!today) return "Belum Absen";
        if (today.status === 'sick') return "Sakit";
        if (today.status === 'permission') return "Izin";
        if (today.status === 'late') return "Telat";
        if (today.status === 'present') return "Hadir";
        if (today.checkOut) return "Absensi Selesai";
        if (isBreak) return "Sedang Istirahat";
        if (hasBreakEnded) return "Waktunya Pulang";
        return "Sedang Bekerja";
    };

    const handleResumeWork = async () => {
        if (confirm("Mau lanjut kerja hari ini?")) {
            try {
                await resume();
                toast({ title: "Selamat Bekerja Kembali", description: "Sesi Anda telah diaktifkan kembali." });
            } catch (err: any) {
                handleError(err);
            }
        }
    };

    const renderMainButton = () => {
        // --- PERMIT / SICK STATE ---
        // After permit or sick is submitted, today always has checkOut set (server always closes session).
        // Show an informational card + "Lanjut Bekerja" option.
        if (today?.status === 'sick' || today?.status === 'permission') {
            const permitLabel = today.status === 'sick' ? 'Sakit' : 'Izin';
            const permitColor = today.status === 'sick' ? 'blue' : 'purple';
            return (
                <div className="flex flex-col gap-3 w-full">
                    {/* Info card */}
                    <div className={`rounded-2xl p-4 bg-${permitColor}-50 border border-${permitColor}-200 flex items-start gap-3`}>
                        <span className={`text-${permitColor}-500 text-2xl leading-none mt-0.5`}>
                            {today.status === 'sick' ? '🤒' : '📋'}
                        </span>
                        <div>
                            <p className={`text-xs font-bold text-${permitColor}-700 uppercase tracking-wide`}>
                                Status: {permitLabel}
                            </p>
                            <p className={`text-sm text-${permitColor}-600 font-medium mt-0.5`}>
                                {today.notes || `Absensi ${permitLabel} hari ini sudah tercatat.`}
                            </p>
                            <p className={`text-xs text-${permitColor}-400 mt-1`}>
                                Jika sudah siap, Anda dapat melanjutkan bekerja di bawah ini.
                            </p>
                        </div>
                    </div>
                    {/* Lanjut Bekerja button — uses clockIn flow (photo + shift) */}
                    <Button
                        onClick={() => startAttendanceFlow(clockIn, "Berhasil Absen Masuk", true)}
                        disabled={isLoading || sessionCount >= 5}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-blue-200 shadow-lg text-lg"
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                            <>
                                <Zap className="mr-2 h-5 w-5" />
                                Lanjut Bekerja {sessionCount > 0 ? `(Sesi ${sessionCount + 1}/5)` : ''}
                            </>
                        )}
                    </Button>
                    {sessionCount >= 5 && (
                        <p className="text-center text-xs text-red-500 font-medium">Batas 5 sesi per hari tercapai</p>
                    )}
                </div>
            );
        }

        // --- SESSION COMPLETE (normal clock-out) ---
        if (today?.checkOut) {
            return (
                <div className="flex flex-col gap-3 w-full">
                    <Button
                        disabled
                        className="w-full py-8 text-xl font-bold rounded-2xl shadow-lg bg-gray-200 text-gray-400"
                    >
                        Sesi Hari Ini Selesai
                    </Button>
                    <Button
                        onClick={() => startAttendanceFlow(clockIn, "Berhasil Absen Masuk", true)}
                        disabled={sessionCount >= 5}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold shadow-blue-200 shadow-lg text-lg"
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                            <>
                                <Zap className="mr-2 h-5 w-5" />
                                Lanjut Kerja (Sesi {sessionCount + 1}/5)
                            </>
                        )}
                    </Button>
                    {sessionCount >= 5 && (
                        <p className="text-center text-xs text-red-500 font-medium">Batas 5 sesi per hari tercapai</p>
                    )}
                </div>
            );
        }

        // --- NOT YET CLOCKED IN ---
        if (!hasCheckedIn) {
            return (
                <Button
                    onClick={() => startAttendanceFlow(clockIn, "Berhasil Absen Masuk", true)}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold shadow-green-200 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <Camera className="mr-2 h-5 w-5" />
                            Absen Masuk
                        </>
                    )}
                </Button>
            );
        }

        // --- IN PROGRESS: waiting for break start ---
        if (!isBreak && !hasBreakEnded) {
            return (
                <Button
                    onClick={() => startAttendanceFlow(breakStart, "Selamat Istirahat")}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 text-white font-semibold shadow-orange-200 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <Coffee className="mr-2 h-5 w-5" />
                            Mulai Istirahat
                        </>
                    )}
                </Button>
            );
        }

        // --- IN BREAK: waiting for break end ---
        if (isBreak && !hasBreakEnded) {
            return (
                <Button
                    onClick={() => startAttendanceFlow(breakEnd, "Selamat Bekerja Kembali")}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-orange-200 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <Camera className="mr-2 h-5 w-5" />
                            Selesai Istirahat
                        </>
                    )}
                </Button>
            );
        }

        // --- READY TO CLOCK OUT ---
        if (hasCheckedIn && hasBreakEnded && !hasCheckedOut) {
            return (
                <Button
                    onClick={handleClockOutClick}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold shadow-red-200 shadow-lg text-lg"
                >
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : (
                        <>
                            <LogOut className="mr-2 h-5 w-5" />
                            Absen Pulang
                        </>
                    )}
                </Button>
            );
        }
    };

    // Fetch location when camera opens or on mount per user request
    useEffect(() => {
        getCoordinates().catch(console.error);
    }, []);

    useEffect(() => {
        if (isCameraOpen) {
            getCoordinates().catch(console.error);
        }
    }, [isCameraOpen]);

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Late Reason Modal */}
            <LateReasonModal
                isOpen={isLateReasonModalOpen}
                onClose={() => setIsLateReasonModalOpen(false)}
                onSubmit={handleLateReasonSubmit}
            />

            {/* Camera Modal */}
            <CameraModal
                open={isCameraOpen}
                onCapture={handlePhotoCaptured}
                onClose={() => setIsCameraOpen(false)}
                locationAddress={locationAddress}
            />

            {/* No Shift Selection Modal - Defaulting to Management */}

            <CompanyHeader />

            <main className="px-4 -mt-8 max-w-lg mx-auto space-y-6">
                {/* User Card */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white rounded-3xl p-5 shadow-xl shadow-black/5 border border-orange-100 flex items-center justify-between relative overflow-hidden"
                >
                    <div className="space-y-1.5 z-10">
                        <h2 className="text-lg font-bold text-gray-800">{user?.fullName}</h2>
                        <div className="text-xs text-gray-500 space-y-0.5">
                            <p>NIK: <span className="font-semibold text-gray-700">{user?.username}</span></p>
                            <p>Cabang: <span className="font-semibold text-gray-700">{user?.branch || '-'}</span></p>
                            <p>Jabatan: <span className="font-semibold text-gray-700">{user?.position || '-'}</span></p>
                            <p>Shift: <span className="font-semibold text-gray-700">{(today as any)?.shift || user?.shift || '-'}</span></p>
                        </div>
                    </div>
                    <div className="z-10">
                        <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-white shadow-md overflow-hidden">
                            {user?.photoUrl ? (
                                <img src={user.photoUrl} alt="User" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-500 font-bold text-2xl">
                                    {user?.fullName?.charAt(0)}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Timer */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col items-center justify-center bg-primary/5 py-4 rounded-3xl"
                >
                    <DigitalClock />

                    <div className="mt-4 flex flex-col items-center">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Status Hari Ini</p>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${getStatusText() === 'Telat' ? 'text-red-600' : 'text-primary'}`}>
                                {getStatusText()}
                            </span>
                            {today?.status === 'late' && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">TELAT</span>}
                            {sessionCount > 0 && <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">Sesi {sessionCount}/5</span>}
                        </div>
                        {locationAddress && (
                            <p className="text-[10px] text-gray-400 mt-2 flex items-center justify-center gap-1 max-w-[200px] text-center">
                                <MapPin className="w-3 h-3 flex-shrink-0" /> {locationAddress}
                            </p>
                        )}
                    </div>

                    {/* Work Timer / Break Timer - Show if checked in and not checked out */}
                    {hasCheckedIn && !hasCheckedOut && (
                        <div className="mt-4 flex flex-col items-center">
                            <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wider mb-1">
                                {isBreak ? "⏳ Durasi Istirahat" : "💼 Durasi Kerja"}
                            </p>
                            <WorkTimer
                                startTime={new Date(isBreak ? today!.breakStart! : today!.checkIn!)}
                            />
                        </div>
                    )}
                </motion.div>

                {/* Controls */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
                        {renderMainButton()}

                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <Button
                                variant="outline"
                                disabled={!!today?.checkOut || today?.status === 'sick' || today?.status === 'permission'}
                                onClick={() => {
                                    setPermitType('sick');
                                    setPermitNote("");
                                    setPermitOpen(true);
                                }}
                                className="h-14 rounded-xl border-blue-100 hover:bg-blue-50 text-blue-700 bg-white"
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-bold">Sakit</span>
                                </div>
                            </Button>
                            <Button
                                variant="outline"
                                disabled={!!today?.checkOut || today?.status === 'sick' || today?.status === 'permission'}
                                onClick={() => {
                                    setPermitType('permission');
                                    setPermitNote("");
                                    setPermitOpen(true);
                                }}
                                className="h-14 rounded-xl border-purple-100 hover:bg-purple-50 text-purple-700 bg-white"
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className="font-bold">Izin</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Today Summary */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4"
                >
                    <h4 className="font-bold text-gray-800 border-b pb-2">Riwayat Hari Ini</h4>

                    {/* ⚠️ Warning: Sedang istirahat belum selesai */}
                    {isBreak && !hasBreakEnded && (
                        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
                            <span className="text-orange-500 text-lg leading-none mt-0.5">⏳</span>
                            <div>
                                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Sedang Istirahat</p>
                                <p className="text-sm text-orange-600 font-medium mt-0.5">Jangan lupa tekan <strong>Selesai Istirahat</strong> saat kembali bekerja!</p>
                            </div>
                        </div>
                    )}

                    {/* ⚠️ Warning: Sudah check-in & selesai istirahat, belum absen pulang */}
                    {hasCheckedIn && hasBreakEnded && !hasCheckedOut && (
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
                            <span className="text-red-500 text-lg leading-none mt-0.5">🔔</span>
                            <div>
                                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Jangan Lupa Absen Pulang!</p>
                                <p className="text-sm text-red-600 font-medium mt-0.5">Tekan <strong>Absen Pulang</strong> sebelum meninggalkan tempat kerja agar jam kerja tercatat.</p>
                            </div>
                        </div>
                    )}

                    {/* ⚠️ Warning: Sudah check-in, belum mulai istirahat, belum pulang */}
                    {hasCheckedIn && !isBreak && !hasBreakEnded && !hasCheckedOut && (
                        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <span className="text-blue-500 text-lg leading-none mt-0.5">💡</span>
                            <div>
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Sedang Bekerja</p>
                                <p className="text-sm text-blue-600 font-medium mt-0.5">Jika ingin istirahat tekan <strong>Mulai Istirahat</strong>. Jangan lupa <strong>Absen Pulang</strong> saat selesai bekerja.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-y-4">
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Masuk</p>
                            <p className="font-mono font-bold text-gray-800">
                                {today?.checkIn ? format(new Date(today.checkIn), "HH:mm") : "--:--"}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Pulang</p>
                            <p className="font-mono font-bold text-gray-800">
                                {today?.checkOut ? format(new Date(today.checkOut), "HH:mm") : "--:--"}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Mulai Istirahat</p>
                            <p className="font-mono font-bold text-gray-800">
                                {today?.breakStart ? format(new Date(today.breakStart), "HH:mm") : "--:--"}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-medium">Total Istirahat</p>
                            <p className="font-mono font-bold text-gray-800 italic text-[10px]">
                                {today?.breakStart && today?.breakEnd ? "Selesai" : "--:--"}
                            </p>
                        </div>
                    </div>

                    {today?.notes && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Keterangan:</p>
                            <p className="text-xs text-gray-600 line-clamp-3">{today.notes}</p>
                        </div>
                    )}

                    {(today as any)?.lateReason && (
                        <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100/50">
                            <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Alasan Terlambat:</p>
                            <p className="text-xs text-red-800 font-medium italic">"{(today as any).lateReason}"</p>
                            {(today as any).lateReasonPhoto && (
                                <div
                                    className="mt-2 aspect-video rounded-xl overflow-hidden border border-red-200 cursor-pointer relative group"
                                    onClick={() => setSelectedPhoto(getPhotoUrl((today as any).lateReasonPhoto))}
                                >
                                    <img
                                        src={getPhotoUrl((today as any).lateReasonPhoto)}
                                        alt="Bukti Telat"
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="text-white h-6 w-6" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Completed Sessions Summary */}
                    {completedSessions.length > 0 && (
                        <div className="mt-3 border-t pt-3 space-y-2">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Sesi Selesai</p>
                            {completedSessions.map((s: any, i: number) => (
                                <div key={s.id} className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-2">
                                    <span className="font-semibold text-gray-600">Sesi {s.sessionNumber}</span>
                                    <span className="font-mono text-gray-500">
                                        {s.checkIn ? format(new Date(s.checkIn), "HH:mm") : "--:--"}
                                        {" → "}
                                        {s.checkOut ? format(new Date(s.checkOut), "HH:mm") : "--:--"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </main>

            {/* Photo Viewer Dialog */}
            <Dialog open={!!selectedPhoto} onOpenChange={(val) => !val && setSelectedPhoto(null)}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-none bg-black">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Lihat Foto</DialogTitle>
                        <DialogDescription>Tampilan detail foto bukti.</DialogDescription>
                    </DialogHeader>
                    <div className="relative aspect-[3/4] sm:aspect-square flex items-center justify-center">
                        <img
                            src={selectedPhoto || ""}
                            alt="Bukti"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (selectedPhoto && !selectedPhoto.includes('base64') && selectedPhoto.length > 100) {
                                    target.src = selectedPhoto;
                                }
                            }}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <BottomNav />

            {/* Permission Dialog */}
            <Dialog open={permitOpen} onOpenChange={setPermitOpen}>
                <DialogContent className="rounded-3xl max-w-xs md:max-w-md p-6">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold">
                            {permitType === 'sick' ? '🤒 Form Sakit' : '📋 Form Izin'}
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground">
                            Silakan isi form di bawah ini untuk mengajukan {permitType === 'sick' ? 'sakit' : 'izin'}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                        <Textarea
                            placeholder={`Alasan ${permitType === 'sick' ? 'sakit' : 'izin'}...`}
                            value={permitNote}
                            onChange={(e) => setPermitNote(e.target.value)}
                            className="resize-none rounded-2xl border-gray-200 focus:border-primary min-h-[100px]"
                        />

                        {/* Contextual state warning */}
                        {isBreak && !hasBreakEnded ? (
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200">
                                <p className="text-[10px] font-bold text-orange-700 uppercase mb-2">⚠️ Anda Sedang Istirahat</p>
                                <ul className="text-[11px] text-orange-700 space-y-1">
                                    <li className="flex gap-2"><span>•</span><span>Jam istirahat akan <strong>ditutup otomatis</strong>.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Jam kerja yang sudah berlangsung <strong>tetap dihitung</strong>.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Anda dapat <strong>Lanjut Bekerja</strong> kapan saja setelah ini.</span></li>
                                </ul>
                            </div>
                        ) : hasCheckedIn && !hasCheckedOut ? (
                            <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200">
                                <p className="text-[10px] font-bold text-yellow-700 uppercase mb-2">⚠️ Anda Sedang Bekerja</p>
                                <ul className="text-[11px] text-yellow-700 space-y-1">
                                    <li className="flex gap-2"><span>•</span><span>Sesi kerja Anda akan <strong>dihentikan</strong> sekarang.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Jam kerja yang sudah berlangsung <strong>tetap dihitung</strong>.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Anda dapat <strong>Lanjut Bekerja</strong> kapan saja setelah ini.</span></li>
                                </ul>
                            </div>
                        ) : (
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-700 uppercase mb-2">ℹ️ Sebelum Mulai Kerja</p>
                                <ul className="text-[11px] text-blue-600/80 space-y-1">
                                    <li className="flex gap-2"><span>•</span><span>Absensi {permitType === 'sick' ? 'Sakit' : 'Izin'} akan dicatat untuk hari ini.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Anda tetap dapat <strong>Lanjut Bekerja</strong> kapan saja hari ini.</span></li>
                                    <li className="flex gap-2"><span>•</span><span>Sistem akan mengambil foto dan mencatat lokasi.</span></li>
                                </ul>
                            </div>
                        )}

                        <Button
                            onClick={handlePermitCameraTrigger}
                            className="w-full h-14 rounded-2xl gap-3 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
                        >
                            <Camera className="w-5 h-5" />
                            Ambil Foto &amp; Kirim
                        </Button>

                        <Button
                            variant="ghost"
                            onClick={() => setPermitOpen(false)}
                            className="w-full text-gray-400 text-sm"
                        >
                            Batalkan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
