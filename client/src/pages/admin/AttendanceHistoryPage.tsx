import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Attendance } from "@shared/schema";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfDay, endOfDay, subMonths, addMonths, isAfter, isBefore, isEqual } from "date-fns";
import { id } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Menu, Users, Clock, CalendarDays, LogOut, FileText, MessageSquare, History, Image as ImageIcon, MapPin, ChevronLeft, ChevronRight, FileDown, ArrowUpDown
} from "lucide-react";

// Helper: resolve photo URL — handles both local uploads and Google Drive File IDs
function getPhotoUrl(value: string | null): string {
    if (!value) return '';
    // Base64 data URI
    if (value.startsWith('data:')) return value;
    // Full URL
    if (value.startsWith('http')) return value;
    // Google Drive File ID: no dots, no slashes, length > 20 — use server proxy to avoid CORS/auth issues
    if (!value.includes('/') && !value.includes('.') && value.length > 20) {
        return `/api/images/${value}`;
    }
    // Local file
    return `/uploads/${value}`;
}

export default function AttendanceHistoryPage() {
    const [, setLocation] = useLocation();
    const { logout } = useAuth();
    const [targetDate, setTargetDate] = useState(new Date());
    const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
    const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [searchName, setSearchName] = useState("");
    const [sortField, setSortField] = useState<'date' | 'name'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [isExporting, setIsExporting] = useState(false);

    const toggleSort = (field: 'date' | 'name') => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder(field === 'date' ? 'desc' : 'asc');
        }
    };

    const { data: attendanceHistory, isLoading: isLoadingAttendance } = useQuery<Attendance[]>({
        queryKey: ["/api/attendance"],
        refetchInterval: 10000,
    });

    const { data: users } = useQuery<User[]>({
        queryKey: ["/api/admin/users"],
    });

    let startDate: Date;
    let endDate: Date;

    if (reportType === "daily") {
        startDate = startOfDay(targetDate);
        endDate = endOfDay(targetDate);
    } else if (reportType === "weekly") {
        startDate = startOfWeek(targetDate, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(targetDate, { weekStartsOn: 1 });
    } else if (reportType === "custom") {
        startDate = startOfDay(new Date(customStartDate));
        endDate = endOfDay(new Date(customEndDate));
    } else {
        // Default: 26th of previous month to 25th of current month
        startDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 26);
        endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 25);
    }

    const getEmployee = (userId: number) => {
        return users?.find(user => user.id === userId);
    };

    // Parses GPS metadata JSON and returns a suspicious flag + summary string
    const parseMetadataForSuspicion = (metadataJson: string | null | undefined): { isSuspicious: boolean; summary: string } => {
        if (!metadataJson) return { isSuspicious: false, summary: '' };
        try {
            const m = JSON.parse(metadataJson);
            const reasons: string[] = [];
            if (m.accuracy !== null && m.accuracy !== undefined) {
                if (Number.isInteger(m.accuracy) && m.accuracy < 50) reasons.push(`Akurasi bulat: ${m.accuracy}m`);
                if (m.accuracy < 1.0) reasons.push(`Akurasi terlalu tinggi: ${m.accuracy}m`);
                if (m.altitude === null && m.accuracy < 10) reasons.push(`Tidak ada data ketinggian`);
                if (m.speed === 0 && m.accuracy < 5) reasons.push(`Kecepatan tepat 0 & akurasi tinggi`);
            }
            return {
                isSuspicious: reasons.length > 0,
                summary: reasons.length > 0 ? `⚠️ GPS Mencurigakan: ${reasons.join(', ')}` : `✅ GPS Normal (accuracy: ${m.accuracy}m)`
            };
        } catch {
            return { isSuspicious: false, summary: '' };
        }
    };

    const filteredRecords = attendanceHistory?.filter(att => {
        const emp = getEmployee(att.userId);
        if (!emp) return false;

        // Name Filter
        if (searchName && !emp.fullName.toLowerCase().includes(searchName.toLowerCase())) return false;

        const attDate = new Date(att.date);
        const d = new Date(attDate);
        d.setHours(0, 0, 0, 0);
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return (isAfter(d, s) || isEqual(d, s)) && (isBefore(d, e) || isEqual(d, e));
    }).sort((a, b) => {
        const dateA = new Date(a.date).setHours(0, 0, 0, 0);
        const dateB = new Date(b.date).setHours(0, 0, 0, 0);
        const nameA = getEmployee(a.userId)?.fullName || '';
        const nameB = getEmployee(b.userId)?.fullName || '';

        if (sortField === 'date') {
            // Primary: Date (Order based on sortOrder)
            if (dateA !== dateB) return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            // Secondary: Name (Always ASC for grouping consistency)
            if (nameA !== nameB) return nameA.localeCompare(nameB);
            // Tertiary: Check-In (Always ASC for cronology within day)
            const timeA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
            const timeB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
            return timeA - timeB;
        } else {
            // Primary: Name (Order based on sortOrder)
            if (nameA !== nameB) return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
            // Secondary: Date (Always DESC for recent-first within name group)
            if (dateA !== dateB) return dateB - dateA;
            // Tertiary: Check-In (Always ASC for cronology within day)
            const timeA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
            const timeB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
            return timeA - timeB;
        }
    }) || [];

    const getDriveViewLink = (url: string | null) => {
        if (!url) return null;
        if (url.includes('drive.google.com')) return url;
        if (!url.includes('/') && url.length > 15) {
            return `https://drive.google.com/file/d/${url}/view`;
        }
        return getPhotoUrl(url);
    };

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

    const handleExport = async () => {
        let periodStr = '';
        if (reportType === 'daily') {
            periodStr = format(targetDate, "dd MMMM yyyy", { locale: id }).toUpperCase();
        } else if (reportType === 'weekly') {
            periodStr = `${format(startDate, "dd MMM")} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else if (reportType === 'custom') {
            periodStr = `${format(startDate, "dd MMM yyyy", { locale: id })} - ${format(endDate, "dd MMM yyyy", { locale: id })}`.toUpperCase();
        } else {
            periodStr = format(targetDate, "MMMM yyyy", { locale: id }).toUpperCase();
        }

        const fileName = `LAPORAN RIWAYAT ABSENSI & FOTO PT EJA - ${periodStr}.html`;

        const imageCache: Record<string, string> = {};
        const fetchImageBase64 = async (url: string) => {
            if (!url) return '';
            if (url.startsWith('data:')) return url;
            let resolvedUrl = url;
            if (!url.includes('/') && !url.includes('.') && url.length > 20) {
                resolvedUrl = `/api/images/${url}`;
            } else if (!url.startsWith('http')) {
                resolvedUrl = `/uploads/${url}`;
            }
            if (imageCache[resolvedUrl]) return imageCache[resolvedUrl];
            try {
                const res = await fetch(resolvedUrl);
                const blob = await res.blob();
                const b64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                imageCache[resolvedUrl] = b64;
                return b64;
            } catch (e) {
                return '';
            }
        };

        setIsExporting(true);
        try {
            // Fetch logo
            let logoDataUrl = '';
            try {
                const logoRes = await fetch('/logo_elok_buah.jpg');
                const logoBlob = await logoRes.blob();
                logoDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(logoBlob);
                });
            } catch (_) { /* skip logo if unavailable */ }

            // Collect all unique URLs
            const uniqueUrls = new Set<string>();
            filteredRecords.forEach(r => {
                if (r.checkInPhoto) uniqueUrls.add(r.checkInPhoto);
                if (r.breakStartPhoto) uniqueUrls.add(r.breakStartPhoto);
                if (r.breakEndPhoto) uniqueUrls.add(r.breakEndPhoto);
                if (r.checkOutPhoto) uniqueUrls.add(r.checkOutPhoto);
                if ((r as any).lateReasonPhoto) uniqueUrls.add((r as any).lateReasonPhoto);
            });

            // Parallel fetch all images
            await Promise.all(Array.from(uniqueUrls).map(url => fetchImageBase64(url)));

            // Prepare HTML
            let html = `<!DOCTYPE html>
<html>
<head>
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1e293b; background: white; padding: 28px 36px; }
    
    .letterhead { display: flex; align-items: center; gap: 16px; padding-bottom: 10px; }
    .logo-img { width: 60px; height: 60px; object-fit: contain; }
    .company-block h1 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; }
    .company-block .tagline { font-size: 10px; color: #64748b; margin-top: 2px; }
    .hr-thick { border: none; border-top: 2px solid #cbd5e1; margin: 6px 0 2px; }
    .hr-thin  { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 18px; }

    .report-meta { text-align: center; margin-bottom: 20px; }
    .report-meta h2 { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; }
    .report-meta .sub { font-size: 10.5px; margin-top: 4px; color: #475569; }

    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background-color: #f8fafc; }
    th { color: #374151; font-weight: 700; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #1e293b; border-right: 1px solid #e2e8f0; }
    th.c { text-align: center; }
    td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; vertical-align: top; }
    tbody tr:nth-child(even) { background-color: #f8fafc; }

    .photo-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .photo-item { width: 75px; text-align: center; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px; background: white; }
    .photo-img { width: 100%; height: 65px; object-fit: cover; border-radius: 2px; }
    .photo-label { font-size: 8px; font-weight: bold; color: #64748b; margin-top: 2px; text-transform: uppercase; }
    
    .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; text-transform: uppercase; margin-bottom: 4px; }
    .st-hadir { background: #dcfce7; color: #16a34a; }
    .st-telat { background: #ffedd5; color: #ea580c; }
    .st-sakit { background: #dbeafe; color: #2563eb; }
    .st-izin  { background: #f3e8ff; color: #7c3aed; }
    .st-cuti  { background: #ccfbf1; color: #0d9488; }
    .st-alpha { background: #fee2e2; color: #dc2626; }
    .st-unknown { background: #f1f5f9; color: #475569; }

    .btn-wrap { text-align: center; margin-top: 20px; }
    .download-btn { display: inline-flex; align-items: center; gap: 8px; background: #1d4ed8; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; }
    
    @media print {
      body { padding: 12px 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .btn-wrap { display: none !important; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <img src="${logoDataUrl}" class="logo-img" alt="Logo" />
    <div class="company-block">
      <h1>PT Elok Jaya Abadhi</h1>
      <p class="tagline">Sistem Manajemen Kehadiran Digital</p>
    </div>
  </div>
  <hr class="hr-thick" />
  <hr class="hr-thin" />

  <div class="report-meta">
    <h2>Laporan Riwayat & Foto Absensi</h2>
    <p class="sub">Tipe: ${reportType === 'daily' ? 'Harian' : reportType === 'weekly' ? 'Mingguan' : reportType === 'custom' ? 'Kustom' : 'Bulanan'}</p>
    <p class="sub">Periode: ${format(startDate, "EEEE, d MMM yyyy", { locale: id })} - ${format(endDate, "EEEE, d MMM yyyy", { locale: id })}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th class="c" style="width:24px;">No</th>
        <th style="width:65px;">Tanggal</th>
        <th style="width:110px;">Nama Karyawan</th>
        <th style="width:95px;">Waktu Absen</th>
        <th style="width:120px;">Status & Keterangan</th>
        <th>Bukti Foto (Visual)</th>
      </tr>
    </thead>
    <tbody>`;

            if (filteredRecords.length === 0) {
                html += `<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">Tidak ada data absensi</td></tr>`;
            }

            let lastShownName = "";
            let lastShownDate = "";
            for (let i = 0; i < filteredRecords.length; i++) {
                const r = filteredRecords[i];
                const emp = getEmployee(r.userId);
                const currentName = emp?.fullName || '-';
                const currentDateStr = format(new Date(r.date), 'dd/MM/yyyy');

                // Grouping logic: Same as UI
                const isContinuation = currentName === lastShownName && currentDateStr === lastShownDate;
                lastShownName = currentName;
                lastShownDate = currentDateStr;

                const sts = isContinuation && r.status === 'late' ? 'present' : (r.status || '-');
                const statusLabel = sts === 'present' ? 'Hadir' : sts === 'late' ? 'Telat' : sts === 'sick' ? 'Sakit' : sts === 'permission' ? 'Izin' : sts === 'cuti' ? 'Cuti' : sts === 'absent' ? 'Alpha' : sts;
                const statusClass = sts === 'present' ? 'st-hadir' : sts === 'late' ? 'st-telat' : sts === 'sick' ? 'st-sakit' : sts === 'permission' ? 'st-izin' : sts === 'cuti' ? 'st-cuti' : sts === 'absent' ? 'st-alpha' : 'st-unknown';

                const tIn = r.checkIn ? format(new Date(r.checkIn), 'HH:mm') : '-';
                const tBrkS = r.breakStart ? format(new Date(r.breakStart), 'HH:mm') : '-';
                const tBrkE = r.breakEnd ? format(new Date(r.breakEnd), 'HH:mm') : '-';
                const tOut = r.checkOut ? format(new Date(r.checkOut), 'HH:mm') : '-';

                let photosHtml = '<div class="photo-grid">';
                const addPhoto = (url: string | null, label: string) => {
                    if (url) {
                        let resolvedUrl = url;
                        if (!url.includes('/') && !url.includes('.') && url.length > 20) {
                            resolvedUrl = `/api/images/${url}`;
                        } else if (!url.startsWith('http') && !url.startsWith('data:')) {
                            resolvedUrl = `/uploads/${url}`;
                        }

                        const b64 = imageCache[resolvedUrl] || (url.startsWith('data:') ? url : '');
                        if (b64) {
                            photosHtml += `<div class="photo-item"><img src="${b64}" class="photo-img"/><div class="photo-label">${label}</div></div>`;
                        } else {
                            photosHtml += `<div class="photo-item"><div style="height:65px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9px;">No Image</div><div class="photo-label">${label}</div></div>`;
                        }
                    }
                };

                addPhoto(r.checkInPhoto, 'Masuk');
                addPhoto(r.breakStartPhoto, 'Mulai Ist.');
                addPhoto(r.breakEndPhoto, 'Selesai Ist.');
                addPhoto(r.checkOutPhoto, 'Pulang');
                addPhoto((r as any).lateReasonPhoto, 'Bukti Telat');
                photosHtml += '</div>';

                if (photosHtml === '<div class="photo-grid"></div>') {
                    photosHtml = '<span style="color:#94a3b8;font-style:italic;font-size:9px;">Tidak ada bukti foto</span>';
                }

                let extraNotes = '';
                if (r.notes) extraNotes += `<div style="margin-top:2px;color:#475569;font-size:9.5px;line-height:1.3;"><b>Cat:\n</b> ${r.notes}</div>`;
                if (sts === 'late' && (r as any).lateReason) extraNotes += `<div style="margin-top:2px;color:#c2410c;font-size:9.5px;line-height:1.3;"><b>Alasan Telat:\n</b> ${(r as any).lateReason}</div>`;

                html += `<tr>
                <td class="c">${isContinuation ? '<span style="color:#cbd5e1;font-weight:bold;">↳</span>' : (i + 1)}</td>
                <td>${isContinuation ? '' : currentDateStr}</td>
                <td>${isContinuation ? `<span style="color:#94a3b8; font-style: italic;">Sesi ${r.sessionNumber}</span>` : `<b style="color:#1d4ed8;">${currentName}</b>`}</td>
                <td style="font-family:monospace;font-size:11px;line-height:1.4;">
                  IN : <span style="color:#16a34a;font-weight:bold;">${tIn}</span><br/>
                  BRK: <span style="color:#d97706;font-weight:bold;">${tBrkS}</span> - <span style="color:#2563eb;font-weight:bold;">${tBrkE}</span><br/>
                  OUT: <span style="color:#dc2626;font-weight:bold;">${tOut}</span>
                </td>
                <td>
                  <span class="status-badge ${statusClass}">${statusLabel}</span>
                  ${extraNotes}
                </td>
                <td>${photosHtml}</td>
            </tr>`;
            }

            html += `
    </tbody>
  </table>

  <div class="btn-wrap">
    <a id="dl-btn" class="download-btn" href="#">&#11015;&nbsp; Download File</a>
  </div>

  <script>
    var _fn = "${fileName}";
    document.title = _fn;
    window.onload = function() {
      var btn = document.getElementById('dl-btn');
      if (btn) {
        btn.href = window.location.href;
        btn.download = _fn;
      }
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body>
</html>`;

            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } finally {
            setIsExporting(false);
        }
    };

    const SidebarContent = () => (
        <>
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                <img src="/logo_elok_buah.jpg" alt="Logo" className="w-12 h-12 object-contain" />
                <div>
                    <h1 className="text-xl font-bold text-green-600">Admin Panel</h1>
                    <p className="text-xs text-gray-400">PT ELOK JAYA ABADHI</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <nav className="p-4 space-y-2">
                    <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin")}>
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
                    <Button variant="ghost" className="w-full justify-start text-green-600 bg-green-50 font-medium">
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Riwayat Absensi
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/leave")}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Manajemen Cuti
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/leave-history")}>
                        <History className="mr-2 h-4 w-4" />
                        Riwayat Cuti
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/info-board")}>
                        <FileText className="mr-2 h-4 w-4" />
                        Papan Informasi
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-green-600 hover:bg-green-50" onClick={() => setLocation("/admin/complaints")}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Pengaduan Karyawan
                    </Button>
                </nav>
            </div>
            <div className="p-4 border-t border-gray-100">
                <Button variant="outline" className="w-full text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </>
    );

    const PhotoThumbnail = ({ url, label, location }: { url: string | null, label: string, location?: string | null }) => {
        if (!url) return null;

        const isDriveId = !url.includes('/') && url.length > 15;
        // In Drive V3, we can often view thumbnail with a special URL, but for reliability, we'll just show an icon
        // Or if it's a relative URL, we can show the image tag.

        const viewLink = getDriveViewLink(url);

        return (
            <div className="flex flex-col items-center gap-1 p-2 border border-gray-100 rounded-lg bg-gray-50/50">
                <p className="text-[10px] font-bold text-gray-500">{label}</p>
                <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-200 border border-gray-300 flex items-center justify-center relative group">
                    <img src={getPhotoUrl(url)} alt={label} className="w-full h-full object-cover" />
                    <a
                        href={viewLink || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold"
                    >
                        Lihat<br />File
                    </a>
                </div>
                {location && (
                    <div className="flex items-center gap-0.5 text-[9px] text-gray-400 max-w-[70px] mt-1" title={location}>
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{location}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            {/* Mobile Header / Sidebar Toggle */}
            <div className="md:hidden flex items-center justify-between bg-white p-4 border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <img src="/logo_elok_buah.jpg" alt="Logo" className="w-8 h-8 object-contain" />
                    <h1 className="text-lg font-bold text-green-600">Admin Panel</h1>
                </div>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 flex flex-col w-72">
                        <SidebarContent />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-screen sticky top-0">
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Riwayat Absensi & Foto</h2>
                        <p className="text-sm text-gray-500">Lihat detail waktu, status, foto bukti absensi, dan cetak laporan.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        {/* Sorting Dropdowns removed as per request to use header sorting */}

                        <div className="flex items-center gap-2 bg-white border rounded-md p-1">
                            <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
                                <SelectTrigger className="w-[120px] h-8 border-none bg-transparent">
                                    <SelectValue placeholder="Tipe Laporan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Harian</SelectItem>
                                    <SelectItem value="weekly">Mingguan</SelectItem>
                                    <SelectItem value="monthly">Bulanan</SelectItem>
                                    <SelectItem value="custom">Kustom Pilihan</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                            {reportType === 'custom' ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="date"
                                        className="h-8 text-xs py-0 px-2 min-w-[130px] w-auto"
                                        value={customStartDate}
                                        onChange={e => setCustomStartDate(e.target.value)}
                                    />
                                    <span className="text-gray-400 text-xs">-</span>
                                    <Input
                                        type="date"
                                        className="h-8 text-xs py-0 px-2 min-w-[130px] w-auto"
                                        value={customEndDate}
                                        onChange={e => setCustomEndDate(e.target.value)}
                                    />
                                </div>
                            ) : (
                                <>
                                    <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm font-medium min-w-[120px] text-center">
                                        {reportType === 'daily' ? format(targetDate, "d MMM yyyy", { locale: id }) :
                                            reportType === 'weekly' ? `${format(startDate, "d MMM")} - ${format(endDate, "d MMM yyyy", { locale: id })} ` :
                                                format(targetDate, "MMMM yyyy", { locale: id })}
                                    </span>
                                    <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                        <Button variant="outline" className="gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" onClick={handleExport}>
                            <FileDown className="h-4 w-4" /> Export HTML
                        </Button>
                    </div>
                </header>

                <Card className="border-none shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="bg-white border-b border-gray-100 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg text-gray-800 flex flex-col md:flex-row gap-2 md:items-center">
                            <span>Data Periode: {format(startDate, 'dd MMM yyyy', { locale: id })} - {format(endDate, 'dd MMM yyyy', { locale: id })}</span>
                            <div className="relative md:ml-4">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                    placeholder="Cari Nama Karyawan..."
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                    className="h-8 text-xs pl-9 w-full md:w-64"
                                />
                            </div>
                        </CardTitle>
                        <div className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                            {filteredRecords.length} Data Absensi
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoadingAttendance ? (
                            <div className="p-12 text-center text-gray-400">Memuat data...</div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">
                                <History className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p>Tidak ada data absensi untuk tanggal ini.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('date')}>
                                                <div className="flex items-center gap-1">
                                                    Tanggal <ArrowUpDown className={`h-3 w-3 ${sortField === 'date' ? 'text-green-600' : 'text-gray-400'}`} />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('name')}>
                                                <div className="flex items-center gap-1">
                                                    Nama Karyawan <ArrowUpDown className={`h-3 w-3 ${sortField === 'name' ? 'text-green-600' : 'text-gray-400'}`} />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 font-bold text-center">Waktu Absen</th>
                                            <th className="px-6 py-4 font-bold">Foto Bukti</th>
                                            <th className="px-6 py-4 font-bold">Status & Keterangan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {filteredRecords.map((record, index) => {
                                            const emp = getEmployee(record.userId);
                                            const recordDateStr = format(new Date(record.date), 'dd/MM/yyyy');

                                            // Grouping logic: Hide name if same as previous row AND SAME DATE
                                            const prevRecord = index > 0 ? filteredRecords[index - 1] : null;
                                            const prevEmpName = prevRecord ? getEmployee(prevRecord.userId)?.fullName : null;
                                            const prevDateStr = prevRecord ? format(new Date(prevRecord.date), 'dd/MM/yyyy') : null;
                                            const isContinuation = emp?.fullName === prevEmpName && recordDateStr === prevDateStr;

                                            // Status Override: If it's a continuation row, and status is "late", 
                                            // we might want to show it as "present" if the first session was captured properly.
                                            // For sub-rows, let's override 'late' to 'present' to avoid confusion.
                                            const effectiveStatus = isContinuation && record.status === 'late' ? 'present' : record.status;

                                            return (
                                                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-semibold text-gray-500">
                                                            {isContinuation ? '' : recordDateStr}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {isContinuation ? (
                                                            <div className="flex items-center gap-3 ml-6 opacity-40">
                                                                <span className="text-gray-400">↳</span>
                                                                <span className="text-xs italic text-gray-400">Sesi {record.sessionNumber}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm shrink-0">
                                                                    {emp?.fullName?.charAt(0) || '?'}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-900">{emp?.fullName || 'Unknown'}</p>
                                                                    <p className="text-[11px] text-gray-500">{emp?.nik || emp?.username}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1 text-[11px] font-mono">
                                                            <div className="flex justify-between w-32">
                                                                <span className="text-gray-500">Masuk:</span>
                                                                <span className="font-bold text-green-600">{record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : '-'}</span>
                                                            </div>
                                                            <div className="flex justify-between w-32">
                                                                <span className="text-gray-500">Istirahat:</span>
                                                                <span className="font-bold text-orange-600">{record.breakStart ? format(new Date(record.breakStart), 'HH:mm') : '-'}</span>
                                                            </div>
                                                            <div className="flex justify-between w-32">
                                                                <span className="text-gray-500">Selesai:</span>
                                                                <span className="font-bold text-blue-600">{record.breakEnd ? format(new Date(record.breakEnd), 'HH:mm') : '-'}</span>
                                                            </div>
                                                            <div className="flex justify-between w-32">
                                                                <span className="text-gray-500">Pulang:</span>
                                                                <span className="font-bold text-red-600">{record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : '-'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-2">
                                                            <PhotoThumbnail url={record.checkInPhoto} label="Masuk" location={record.checkInLocation} />
                                                            <PhotoThumbnail url={record.breakStartPhoto} label="Mulai Ist" location={record.breakStartLocation} />
                                                            <PhotoThumbnail url={record.breakEndPhoto} label="Slsai Ist" location={record.breakEndLocation} />
                                                            <PhotoThumbnail url={record.checkOutPhoto} label="Pulang" location={record.checkOutLocation} />
                                                            <PhotoThumbnail url={record.lateReasonPhoto} label="Bukti Telat" />

                                                            {!record.checkInPhoto && !record.checkOutPhoto && !record.breakStartPhoto && !record.breakEndPhoto && !record.lateReasonPhoto && (
                                                                <div className="flex items-center justify-center p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50 w-full min-w-[120px]">
                                                                    <span className="text-xs text-gray-400 italic">Tidak ada foto</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-2 items-start max-w-[200px]">
                                                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase
                                                                ${effectiveStatus === 'present' ? 'bg-green-100 text-green-700' :
                                                                    effectiveStatus === 'late' ? 'bg-orange-100 text-orange-700' :
                                                                        effectiveStatus === 'sick' ? 'bg-blue-100 text-blue-700' :
                                                                            effectiveStatus === 'permission' ? 'bg-purple-100 text-purple-700' :
                                                                                effectiveStatus === 'cuti' ? 'bg-teal-100 text-teal-700' :
                                                                                    'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {effectiveStatus === 'present' ? 'Hadir' :
                                                                    effectiveStatus === 'late' ? 'Telat' :
                                                                        effectiveStatus === 'sick' ? 'Sakit' :
                                                                            effectiveStatus === 'permission' ? 'Izin' :
                                                                                effectiveStatus === 'cuti' ? 'Cuti' :
                                                                                    effectiveStatus === 'absent' ? 'Alpha' : effectiveStatus}
                                                            </span>

                                                            {record.notes && (
                                                                <p className="text-xs text-gray-600 whitespace-normal bg-gray-50 p-2 rounded border border-gray-100 w-full" style={{ wordBreak: 'break-word' }}>
                                                                    <span className="font-semibold block mb-0.5">Catatan:</span>
                                                                    {record.notes}
                                                                </p>
                                                            )}
                                                            {(effectiveStatus === 'late' && (record as any).lateReason) && (
                                                                <p className="text-xs text-orange-700 whitespace-normal bg-orange-50 p-2 rounded border border-orange-100 w-full" style={{ wordBreak: 'break-word' }}>
                                                                    <span className="font-semibold block mb-0.5">Alasan Telat:</span>
                                                                    {(record as any).lateReason}
                                                                </p>
                                                            )}
                                                            {(() => {
                                                                const meta = parseMetadataForSuspicion((record as any).checkInMetadata);
                                                                if (!meta.isSuspicious) return null;
                                                                return (
                                                                    <div className="flex items-start gap-1.5 bg-orange-50 border border-orange-200 rounded-md p-2 w-full" title={meta.summary}>
                                                                        <span className="text-orange-500 text-sm leading-none mt-0.5">⚠️</span>
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-orange-700 uppercase">GPS Mencurigakan</p>
                                                                            <p className="text-[9px] text-orange-600 mt-0.5">{meta.summary.replace('⚠️ GPS Mencurigakan: ', '')}</p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
