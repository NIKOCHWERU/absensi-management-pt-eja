import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold font-display text-foreground">Halaman Tidak Ditemukan</h1>
        <p className="text-muted-foreground">
          Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.
        </p>
        <Link href="/">
          <Button size="lg" className="w-full font-semibold">
            Kembali ke Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
