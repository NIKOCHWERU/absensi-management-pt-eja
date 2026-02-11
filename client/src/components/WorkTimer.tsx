import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function WorkTimer({ startTime }: { startTime: Date }) {
    const [elapsed, setElapsed] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const diff = now.getTime() - new Date(startTime).getTime();
            
            if (diff < 0) {
                setElapsed("00:00:00");
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setElapsed(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <div className="flex items-center gap-2 mt-2 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-100 shadow-sm animate-pulse">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            <span className="font-mono text-sm font-bold text-orange-600">
                {elapsed || "00:00:00"}
            </span>
        </div>
    );
}
