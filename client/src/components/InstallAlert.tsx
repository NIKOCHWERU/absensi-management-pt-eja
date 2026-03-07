import { usePWAInstall } from "@/hooks/use-pwa-install";
import { Button } from "./ui/button";
import { X, Download, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function InstallAlert() {
    const { isInstallable, installApp, isIOS } = usePWAInstall();

    if (!isInstallable) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-20 left-4 right-4 z-50 md:bottom-24 md:left-auto md:right-8 md:w-80"
            >
                <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-white/20">
                    <div className="bg-white/20 p-2 rounded-xl">
                        {isIOS ? <Smartphone className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                    </div>

                    <div className="flex-1">
                        <h3 className="font-bold text-sm">Instal Aplikasi (PWA)</h3>
                        <p className="text-xs text-white/80 leading-relaxed mb-3">
                            Gunakan aplikasi untuk akses lebih cepat dan mudah dari layar utama HP Anda.
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={installApp}
                                className="w-full bg-white text-green-700 hover:bg-white/90 text-sm h-10 rounded-xl font-bold shadow-sm"
                            >
                                Instal Sekarang
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
