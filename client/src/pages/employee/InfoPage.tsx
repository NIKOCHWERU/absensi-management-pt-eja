import { useAnnouncements } from "@/hooks/use-announcements";
import { BottomNav } from "@/components/BottomNav";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Bell, Loader2, Calendar, X, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export default function InfoPage() {
  const { announcements, isLoading } = useAnnouncements();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-primary pt-10 pb-20 px-6 rounded-b-[2.5rem] shadow-lg mb-[-3rem]">
        <h1 className="text-2xl font-bold text-white mb-1">Informasi</h1>
        <p className="text-white/80 text-sm">Pengumuman terbaru dari perusahaan</p>
      </div>

      <main className="px-4 max-w-lg mx-auto space-y-4">
        {isLoading ? (
           <div className="flex justify-center pt-10">
             <Loader2 className="w-8 h-8 text-primary animate-spin" />
           </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-border text-center mt-8">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Belum ada pengumuman.</p>
          </div>
        ) : (
          announcements.map((item) => (
            <div 
              key={item.id} 
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedAnnouncement(item)}
            >
              {item.imageUrl && (
                <div className="w-full aspect-video bg-gray-100 flex items-center justify-center">
                    <img src={item.imageUrl} alt={item.title} className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <span className="text-[10px] font-bold text-white bg-primary px-2 py-1 rounded-full uppercase tracking-wide">
                    Info Terbaru
                    </span>
                    {item.createdAt && (
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(item.createdAt), 'dd MMM yyyy', { locale: id })}
                    </span>
                    )}
                </div>
                <h3 className="font-bold text-lg text-foreground mb-2 leading-tight text-gray-800 line-clamp-2">{item.title}</h3>
                <div className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                    {item.content}
                </div>
              </div>
            </div>
          ))
        )}
        
        <div className="h-4"></div> 
      </main>

      <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          {selectedAnnouncement && (
            <div className="flex flex-col max-h-[90vh]">
              <div className="relative">
                {selectedAnnouncement.imageUrl ? (
                  <div className="w-full bg-gray-950 flex items-center justify-center overflow-hidden">
                    <img 
                      src={selectedAnnouncement.imageUrl} 
                      alt={selectedAnnouncement.title} 
                      className="max-w-full max-h-[50vh] object-contain w-auto h-auto"
                    />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-primary flex items-center justify-center">
                    <Bell className="w-12 h-12 text-white/20" />
                  </div>
                )}
                <button 
                  onClick={() => setSelectedAnnouncement(null)}
                  className="absolute top-4 right-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-[10px] font-bold text-white bg-primary px-2 py-1 rounded-full uppercase">
                    Pengumuman
                  </span>
                  {selectedAnnouncement.createdAt && (
                    <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Dibuat: {format(new Date(selectedAnnouncement.createdAt), 'dd MMM yyyy', { locale: id })}
                    </span>
                  )}
                  {selectedAnnouncement.expiresAt && (
                    <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded-full font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Selesai: {format(new Date(selectedAnnouncement.expiresAt), 'dd MMM yyyy', { locale: id })}
                    </span>
                  )}
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
                  {selectedAnnouncement.title}
                </h2>
                
                <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {selectedAnnouncement.content}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

