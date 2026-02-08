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
        console.log("Attempting token refresh with:", refreshToken ? "Token present" : "No token");

        if (refreshToken) {
            // Use a fresh axios instance to avoid interceptor loops
            const refreshResponse = await axios.post(`${API_BASE_URL}/api/users/v1/token/refresh/`, {
                refresh: refreshToken,
            });

            console.log("Token refresh successful, status:", refreshResponse.status);
            
            // The backend returns { data: { access: "..." }, ... } layout
            // So we need to access refreshResponse.data.data.access
            const responseBody = refreshResponse.data;
            const newAccessToken = responseBody.data?.access || responseBody.access || responseBody.data?.access_token || responseBody.access_token;

            if (newAccessToken) {
                console.log("New access token received");
                localStorage.setItem('access_token', newAccessToken);
                
                // Update header for original request
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
                 console.error("No access token found in refresh response:", refreshResponse.data);
                 // If token is missing, we should probably fail.
            }
        } else {
            console.error("No refresh token available in localStorage");
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

    // Handle 401 (if not retried or retry failed) or 403
    if (error.response?.status === 401) {
        // Only redirect if this wasn't a retry attempt that just failed (handled above somewhat, but fallback)
        // Or if we didn't have a refresh token.
        console.warn("401 Error - Redirecting to login");
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        if (window.location.pathname !== '/login') {
             window.location.href = '/login';
        }
    } else if (error.response?.status === 403) {
      if (window.location.pathname !== '/access-denied') {
        window.location.href = '/access-denied';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
