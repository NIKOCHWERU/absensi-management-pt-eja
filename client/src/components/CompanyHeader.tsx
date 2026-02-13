import { Building2 } from "lucide-react";

interface CompanyHeaderProps {
  name?: string;
  logoUrl?: string;
}

export function CompanyHeader({ name = "PT ELOK JAYA ABADHI (MANAGEMENT)", logoUrl = "/logo_elok_buah.jpg" }: CompanyHeaderProps) {
  return (
    <header className="bg-green-600 text-white shadow-lg pb-12 pt-6 px-6 rounded-b-[2.5rem]">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display tracking-tight text-shadow-sm">
            {name}
          </h1>
          <p className="text-white/80 text-xs md:text-sm font-medium tracking-wide">
            Absensi Management PT ELOK JAYA ABADHI
          </p>
        </div>
        <div className="w-16 h-16 md:w-18 md:h-18 bg-white rounded-2xl flex items-center justify-center border border-white/20 shadow-lg p-1">
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
