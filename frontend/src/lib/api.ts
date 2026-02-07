import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        console.log("Attempting token refresh...");

        if (refreshToken) {
            // Use a fresh axios instance to avoid interceptor loops
            const refreshResponse = await axios.post(`${API_BASE_URL}/api/users/v1/token/refresh/`, {
                refresh: refreshToken,
            });

            console.log("Token refresh successful:", refreshResponse.status);

            const newAccessToken = refreshResponse.data.access;

            if (newAccessToken) {
                localStorage.setItem('access_token', newAccessToken);
                
                // Update header for original request
                // Handle different header formats (Axios v1.x+)
                if (originalRequest.headers) {
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                } else {
                    originalRequest.headers = { Authorization: `Bearer ${newAccessToken}` };
                }
                
                // Update default header for future requests
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                
                console.log("Retrying original request with new token...");
                return apiClient(originalRequest);
            } else {
                 console.error("No access token in refresh response");
            }
        } else {
            console.error("No refresh token available");
        }
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        // Refresh failed - clean up and redirect
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
        // Token expired or invalid and retry failed (or no refresh token)
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    } else if (error.response?.status === 403) {
      // Permission denied - user is authenticated but not authorized
      // Redirect to access denied page if not already there
      if (window.location.pathname !== '/access-denied') {
        window.location.href = '/access-denied';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
