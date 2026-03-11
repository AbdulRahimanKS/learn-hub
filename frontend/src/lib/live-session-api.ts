import api from './api';

export interface LiveSession {
  id: number;
  batch: number;
  title: string;
  description: string;
  scheduled_at: string;
  duration_mins: number;
  end_time: string;
  meeting_room: string;
  hosted_by: number;
  hosted_by_details?: any;
  is_live: boolean;
  can_join: boolean;
  created_at: string;
  updated_at: string;
}

export const liveSessionApi = {
  getSessions: async (batchId: number, params: { tab?: string; page?: number; page_size?: number } = {}) => {
    const res = await api.get(`/api/courses/v1/batches/${batchId}/live-sessions/`, { params });
    return res.data;
  },

  createSession: async (batchId: number, data: Partial<LiveSession>) => {
    const res = await api.post(`/api/courses/v1/batches/${batchId}/live-sessions/`, data);
    return res.data;
  },

  updateSession: async (batchId: number, sessionId: number, data: Partial<LiveSession>) => {
    const res = await api.patch(`/api/courses/v1/batches/${batchId}/live-sessions/${sessionId}/`, data);
    return res.data;
  },

  deleteSession: async (batchId: number, sessionId: number) => {
    const res = await api.delete(`/api/courses/v1/batches/${batchId}/live-sessions/${sessionId}/`);
    return res.data;
  },
};
