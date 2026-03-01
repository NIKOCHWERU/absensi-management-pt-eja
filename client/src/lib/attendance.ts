
import { Attendance } from "@shared/schema";
import { differenceInMinutes, differenceInSeconds } from "date-fns";

export function calculateDuration(start?: string | Date | null, end?: string | Date | null): number {
    if (!start || !end) return 0;

    const startDate = new Date(start);
    startDate.setSeconds(0, 0);
    const endDate = new Date(end);
    endDate.setSeconds(0, 0);

    const diff = differenceInMinutes(endDate, startDate);
    return diff < 0 ? diff + 1440 : diff; // 1440 minutes = 24 hours
}

export function formatDuration(minutes: number): string {
    if (minutes <= 0) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}j ${m}m`;
}

// Returns total seconds (for break display where sub-minute matters)
export function calculateDurationSeconds(start?: string | Date | null, end?: string | Date | null): number {
    if (!start || !end) return 0;
    const diff = differenceInSeconds(new Date(end), new Date(start));
    return diff < 0 ? diff + 86400 : diff;
}

// Formats seconds: "Xj Ym" for >= 60s, "Z detik" for < 60s
export function formatDurationFull(seconds: number): string {
    if (seconds <= 0) return "-";
    if (seconds < 60) return `${seconds} detik`;
    const mins = Math.floor(seconds / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}j ${m}m`;
}

export function calculateDailyTotal(records: Attendance[]): {
    totalWorkMins: number;
    totalBreakMins: number;
    netWorkMins: number;
    hasAllCheckOuts: boolean;
} {
    let totalWorkMins = 0;
    let totalBreakMins = 0;
    // A session is only "countable" if both checkIn AND checkOut exist
    let hasAllCheckOuts = true;

    records.forEach(record => {
        // Only count work time if the session is complete (has both checkIn and checkOut)
        if (!record.checkOut) {
            hasAllCheckOuts = false;
            return; // Skip incomplete sessions entirely
        }

        let sessionWork = calculateDuration(record.checkIn, record.checkOut);

        // Adjust for permit if exists
        if (record.permitExitAt && record.permitResumeAt) {
            const permitMins = calculateDuration(record.permitExitAt, record.permitResumeAt);
            sessionWork = Math.max(0, sessionWork - permitMins);
        }

        totalWorkMins += sessionWork;

        // Only count break duration if BOTH breakStart AND breakEnd exist
        if (record.breakStart && record.breakEnd) {
            const sessionBreak = calculateDuration(record.breakStart, record.breakEnd);
            totalBreakMins += sessionBreak;
        }
    });

    // Net work = total work time minus break time (break is part of work period)
    const netWorkMins = Math.max(0, totalWorkMins - totalBreakMins);

    return { totalWorkMins, totalBreakMins, netWorkMins, hasAllCheckOuts };
}
