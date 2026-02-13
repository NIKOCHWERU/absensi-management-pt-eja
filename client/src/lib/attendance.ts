
import { Attendance } from "@shared/schema";
import { differenceInMinutes } from "date-fns";

export function calculateDuration(start?: string | Date | null, end?: string | Date | null): number {
    if (!start || !end) return 0;
    return differenceInMinutes(new Date(end), new Date(start));
}

export function formatDuration(minutes: number): string {
    if (minutes <= 0) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}j ${m}m`;
}

export function calculateDailyTotal(records: Attendance[]): {
    totalWorkMins: number;
    totalBreakMins: number;
    netWorkMins: number;
} {
    let totalWorkMins = 0;
    let totalBreakMins = 0;

    records.forEach(record => {
        // Basic session duration
        let sessionWork = calculateDuration(record.checkIn, record.checkOut);

        // Adjust for permit if exists (assuming permitExitAt/ResumeAt are in schema, otherwise ignoring)
        // The schema has permitExitAt/ResumeAt.
        if (record.permitExitAt && record.permitResumeAt) {
            const permitMins = calculateDuration(record.permitExitAt, record.permitResumeAt);
            sessionWork = Math.max(0, sessionWork - permitMins);
        }

        const sessionBreak = calculateDuration(record.breakStart, record.breakEnd);

        totalWorkMins += sessionWork;
        totalBreakMins += sessionBreak;
    });

    // Net work is raw work duration minus break duration
    // Wait, usually checkIn to checkOut includes break? 
    // If system logs breakStart/End separately, does checkOut time change?
    // Usually: Work = (CheckOut - CheckIn) - BreakDuration.
    // Unless checkOut is "effective" checkout. 
    // Let's assume standard: Total Time = CheckOut - CheckIn. Net Work = Total Time - Break.

    const netWorkMins = Math.max(0, totalWorkMins - totalBreakMins);

    return { totalWorkMins, totalBreakMins, netWorkMins };
}
