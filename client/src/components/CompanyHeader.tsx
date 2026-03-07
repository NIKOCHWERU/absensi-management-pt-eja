import { Building2, Download } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Button } from "./ui/button";

interface CompanyHeaderProps {
  name?: string;
  logoUrl?: string;
}

export function CompanyHeader({ name = "PT ELOK JAYA ABADHI (MANAGEMENT)", logoUrl = "/logo_elok_buah.jpg" }: CompanyHeaderProps) {
  const { isInstallable, installApp } = usePWAInstall();

  return (
    <header className="bg-green-600 text-white shadow-lg pb-12 pt-6 px-6 rounded-b-[2.5rem]">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex-1 mr-4">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl md:text-2xl font-bold font-display tracking-tight text-shadow-sm">
              {name}
            </h1>
            {isInstallable && (
              <Button
                variant="secondary"
                size="sm"
                onClick={installApp}
                className="h-7 px-2 text-[10px] bg-white/20 hover:bg-white/30 text-white border-none rounded-full transition-all flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Install App
              </Button>
            )}
          </div>
          <p className="text-white/80 text-xs md:text-sm font-medium tracking-wide">
            Absensi Management PT ELOK JAYA ABADHI
          </p>
        </div>
        <div className="w-16 h-16 md:w-18 md:h-18 bg-white rounded-2xl flex items-center justify-center border border-white/20 shadow-lg p-1 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <Building2 className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
          )}
        </div>
      </div>
    </header>
  );
}
