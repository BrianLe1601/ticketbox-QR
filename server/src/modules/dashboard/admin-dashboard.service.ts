import {
  getDashboardSummaryCounts,
  getScheduledPublishFailedEvents,
  getUnstaffedUpcomingEvents,
} from "./admin-dashboard.repository.js";

export interface DashboardSummaryData {
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

export async function getAdminDashboardSummary(): Promise<DashboardSummaryData> {
  const [counts, unstaffedEvents, failedEvents] = await Promise.all([
    getDashboardSummaryCounts(),
    getUnstaffedUpcomingEvents(5),
    getScheduledPublishFailedEvents(5),
  ]);

  return {
    events: {
      active: Number(counts?.activeEvents ?? 0),
      draft: Number(counts?.draftEvents ?? 0),
      scheduled: Number(counts?.scheduledEvents ?? 0),
      hidden: Number(counts?.hiddenEvents ?? 0),
      failedScheduled: Number(counts?.failedScheduledEvents ?? 0),
    },
    tickets: {
      issued: Number(counts?.totalIssuedTickets ?? 0),
    },
    checkins: {
      todaySuccess: Number(counts?.todayCheckinSuccess ?? 0),
    },
    staff: {
      activeOnDuty: Number(counts?.activeStaffCount ?? 0),
      pendingApproval: Number(counts?.pendingStaffApprovalCount ?? 0),
    },
    orders: {
      confirmed: Number(counts?.confirmedOrdersCount ?? 0),
      pending: Number(counts?.pendingOrdersCount ?? 0),
      totalRevenue: Number(counts?.totalRevenue ?? 0),
    },
    refunds: {
      pendingCount: Number(counts?.pendingRefundCount ?? 0),
      pendingAmount: Number(counts?.pendingRefundAmount ?? 0),
    },
    alerts: {
      unstaffedUpcomingEvents: unstaffedEvents.map((e) => ({
        id: Number(e.id),
        name: e.name,
        slug: e.slug,
        startTime: e.startTime instanceof Date ? e.startTime.toISOString() : String(e.startTime),
        endTime: e.endTime instanceof Date ? e.endTime.toISOString() : String(e.endTime),
        status: e.status,
      })),
      scheduledPublishFailedEvents: failedEvents.map((e) => ({
        id: Number(e.id),
        name: e.name,
        slug: e.slug,
        scheduledPublishAt: e.scheduledPublishAt
          ? e.scheduledPublishAt instanceof Date
            ? e.scheduledPublishAt.toISOString()
            : String(e.scheduledPublishAt)
          : null,
        lastPublishAttemptAt: e.lastPublishAttemptAt
          ? e.lastPublishAttemptAt instanceof Date
            ? e.lastPublishAttemptAt.toISOString()
            : String(e.lastPublishAttemptAt)
          : null,
        publishFailureReason: e.publishFailureReason,
      })),
    },
  };
}

