import { useAuth } from "@/hooks/use-auth";
import { CompanyHeader } from "@/components/CompanyHeader";
import { BottomNav } from "@/components/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Newspaper, Calendar, Download, Share2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { motion } from "framer-motion";
import { useState } from "react";

interface Announcement {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

export default function InfoPage() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/announcements"],
  });

  const handleDownload = async (announcement: Announcement) => {
    if (!announcement.imageUrl) return;
    try {
      const response = await fetch(announcement.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${announcement.title.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const handleShareWhatsApp = (announcement: Announcement) => {
    const text = `📢 *${announcement.title}*\n\n${announcement.content}\n\n— PT ELOK JAYA ABADHI`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <CompanyHeader />

      <main className="px-4 -mt-8 max-w-lg mx-auto space-y-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-2"
        >
          <Newspaper className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-gray-800">Papan Informasi</h2>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100"
          >
            <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Belum ada pengumuman</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {announcements.map((ann, i) => (
              <motion.article
                key={ann.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedAnnouncement(ann)}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
              >
                {ann.imageUrl && (
                  <div className="relative overflow-hidden">
                    <img
                      src={ann.imageUrl}
                      alt={ann.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <h3 className="absolute bottom-3 left-4 right-4 text-white font-bold text-base leading-tight drop-shadow-lg">
                      {ann.title}
                    </h3>
                  </div>
                )}
                <div className="p-4">
                  {!ann.imageUrl && (
                    <h3 className="font-bold text-gray-800 text-base mb-2">{ann.title}</h3>
                  )}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{ann.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {ann.createdAt && format(new Date(ann.createdAt), "dd MMM yyyy", { locale: idLocale })}
                    </span>
                    <span className="text-[10px] text-primary font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Baca Selengkapnya <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Detail Dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="rounded-3xl max-w-sm md:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {selectedAnnouncement?.imageUrl && (
            <div className="relative">
              <img
                src={selectedAnnouncement.imageUrl}
                alt={selectedAnnouncement.title}
                className="w-full h-56 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <h2 className="absolute bottom-4 left-5 right-5 text-white font-bold text-lg leading-tight drop-shadow-lg">
                {selectedAnnouncement.title}
              </h2>
            </div>
          )}
          <div className="p-5 space-y-4">
            {!selectedAnnouncement?.imageUrl && (
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">{selectedAnnouncement?.title}</DialogTitle>
              </DialogHeader>
            )}
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {selectedAnnouncement?.createdAt &&
                format(new Date(selectedAnnouncement.createdAt), "EEEE, dd MMMM yyyy • HH:mm", { locale: idLocale })}
            </span>
            <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {selectedAnnouncement?.content}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 border-t pt-4">
              {selectedAnnouncement?.imageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(selectedAnnouncement);
                  }}
                  className="flex-1 rounded-xl text-xs"
                >
                  <Download className="w-3 h-3 mr-1" /> Download
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedAnnouncement) handleShareWhatsApp(selectedAnnouncement);
                }}
                className="flex-1 rounded-xl text-xs text-green-600 border-green-200 hover:bg-green-50"
              >
                <Share2 className="w-3 h-3 mr-1" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
