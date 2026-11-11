import { api } from "@shared/api/axiosInstance";
import type { InAppNotificationResponse, Page } from "@shared/types/api";

export const notificationApi = {
  counter: async (): Promise<number> => {
    const response = await api.get<number>("/api/v1/notifications/unread/counter");
    return response.data ?? 0;
  },

  unread: async (size = 20): Promise<InAppNotificationResponse[]> => {
    const response = await api.get<Page<InAppNotificationResponse>>("/api/v1/notifications/unread", {
      params: { page: 0, size },
    });
    return response.data.content ?? [];
  },

  markRead: async (id: string): Promise<void> => {
    await api.post(`/api/v1/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await api.post("/api/v1/notifications/all/read");
  },
};
