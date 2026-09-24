import { apiRequest } from "@/services/api";
import { getStoredToken } from "@/services/auth.service";

export interface DashboardSummary {
  events: {
    active: number;
    draft: number;
    scheduled: number;
    hidden: number;
    failedScheduled: number;
  };
  tickets: {
    issued: number;
  };
  checkins: {
    todaySuccess: number;
  };
  staff: {
    activeOnDuty: number;
    pendingApproval: number;
  };
  orders: {
    confirmed: number;
    pending: number;
    totalRevenue: number;
  };
  refunds: {
    pendingCount: number;
    pendingAmount: number;
  };
  alerts: {
    unstaffedUpcomingEvents: Array<{
      id: number;
      name: string;
      slug: string;
      startTime: string;
      endTime: string;
      status: string;
    }>;
    scheduledPublishFailedEvents: Array<{
      id: number;
      name: string;
      slug: string;
      scheduledPublishAt: string | null;
      lastPublishAttemptAt: string | null;
      publishFailureReason: string | null;
    }>;
  };
}

export async function getAdminDashboardSummary(): Promise<DashboardSummary> {
  const token = getStoredToken();
  const res = await apiRequest<DashboardSummary>("/admin/dashboard/summary", {}, token);
  return res.data;
}

