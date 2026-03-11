import api from './api';

export interface ChatMessage {
  id: number;
  batch: number;
  sender: {
    id: number;
    email: string;
    fullname: string;
    role: string;
    profile_picture?: string | null;
  };
  message: string;
  attachment: string | null;
  attachment_name: string | null;
  sent_at: string;
  is_current_user: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const chatApi = {
  getBatches: async (page = 1, search = '') => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', '20'); // More batches for the sidebar
    if (search) params.append('search', search);

    const response = await api.get(`/api/courses/v1/chat/batches/?${params.toString()}`);
    return response.data; // Expected format: format_success_response wrap
  },

  getMessages: async (batchId: number | string, page = 1) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', '50');

    const response = await api.get(`/api/courses/v1/chat/batches/${batchId}/messages/?${params.toString()}`);
    return response.data;
  },

  sendMessage: async (
    batchId: number | string, 
    message: string, 
    attachment?: File,
    onUploadProgress?: (progressEvent: any) => void
  ) => {
    const formData = new FormData();
    if (message) formData.append('message', message);
    if (attachment) formData.append('attachment', attachment);

    const response = await api.post(`/api/courses/v1/chat/batches/${batchId}/messages/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  },

  markAsRead: async (batchId: number | string) => {
    const response = await api.post(`/api/courses/v1/chat/batches/${batchId}/mark-read/`);
    return response.data;
  }
};
