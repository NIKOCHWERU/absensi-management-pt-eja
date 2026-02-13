import { useQuery } from "@tanstack/react-query";
import { Attendance } from "@shared/schema";

export function useMonthlyAttendance(month: string, userId?: number) {
    return useQuery<Attendance[]>({
        queryKey: [`/api/attendance?month=${month}${userId ? `&userId=${userId}` : ''}`],
        enabled: !!month,
    });
}
