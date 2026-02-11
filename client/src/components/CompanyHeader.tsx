import { Building2 } from "lucide-react";

interface CompanyHeaderProps {
  name?: string;
  logoUrl?: string;
}

export function CompanyHeader({ name = "PT ELOK JAYA ABADHI (MANAGEMENT)", logoUrl }: CompanyHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg pb-12 pt-6 px-6 rounded-b-[2.5rem]">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-bold font-display tracking-tight text-shadow-sm">
            {name}
          </h1>
          <p className="text-white/80 text-xs md:text-sm font-medium tracking-wide">
            Sistem Absensi Karyawan
          </p>
        </div>
        <div className="w-12 h-12 md:w-14 md:h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
            <Building2 className="w-6 h-6 md:w-8 md:h-8 text-white" />
          )}
        </div>
      </div>
    </header>
  );
}
