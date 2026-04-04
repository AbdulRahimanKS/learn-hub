import { ChatMessage } from './chat-api';

/**
 * WebSocket origin (scheme + host + port, no path).
 * 1) VITE_WS_BASE_URL if set — e.g. wss://api.example.com or ws://178.104.111.10:8000
 * 2) Else derive from VITE_API_BASE_URL (http→ws, https→wss, same host/port as REST)
 * 3) Else page origin host with :8000 and ws/wss from the page
 */
function getWebSocketBaseUrl(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const apiBase =
    import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000';
  try {
    const u = new URL(apiBase);
    const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${u.host}`;
  } catch {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:8000`;
  }
}

type MessageCallback = (message: ChatMessage) => void;
type MessageDeletedCallback = (messageId: number) => void;
type ConnectionStatusCallback = (isConnected: boolean) => void;

class ChatSocketClient {
  private socket: WebSocket | null = null;
  private batchId: number | string | null = null;
  private messageCallbacks: Set<MessageCallback> = new Set();
  private messageDeletedCallbacks: Set<MessageDeletedCallback> = new Set();
  private connectionCallbacks: Set<ConnectionStatusCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;

  connect(batchId: number | string) {
    if (this.socket && this.batchId === batchId) return;

    this.disconnect();
    this.batchId = batchId;
    this.reconnectAttempts = 0;
    this.initSocket();
  }

  private initSocket() {
    if (!this.batchId) return;

    const base = getWebSocketBaseUrl();
    const token = localStorage.getItem('access_token') || '';
    const wsUrl = `${base}/ws/chat/batch/${this.batchId}/?token=${encodeURIComponent(token)}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log(`WebSocket connected for batch ${this.batchId}`);
      this.reconnectAttempts = 0;
      this.isConnected = true;
      this.notifyConnectionSubscribers(true);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.deleted === true && typeof data.message_id === 'number') {
          this.notifyDeleteSubscribers(data.message_id);
          return;
        }
        if (data.id != null && data.message !== undefined) {
          // This matches the ChatMessage structure we broadcast from backend
          this.notifySubscribers(data as ChatMessage);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message', e);
      }
    };

    this.socket.onclose = (event) => {
        console.log(`WebSocket disconnected.`, event);
        this.isConnected = false;
        this.notifyConnectionSubscribers(false);
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.batchId) {
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`Reconnecting (attempt ${this.reconnectAttempts})...`);
                this.initSocket();
            }, 2000 * Math.pow(2, this.reconnectAttempts)); // Exponential backoff
        }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnected = false;
      this.notifyConnectionSubscribers(false);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.batchId = null;
    this.isConnected = false;
    this.notifyConnectionSubscribers(false);
  }

  subscribe(callback: MessageCallback) {
    this.messageCallbacks.add(callback);
    return () => this.unsubscribe(callback); // Return unsubscribe function
  }

  unsubscribe(callback: MessageCallback) {
    this.messageCallbacks.delete(callback);
  }

  subscribeMessageDeleted(callback: MessageDeletedCallback) {
    this.messageDeletedCallbacks.add(callback);
    return () => this.messageDeletedCallbacks.delete(callback);
  }

  subscribeConnectionStatus(callback: ConnectionStatusCallback) {
    this.connectionCallbacks.add(callback);
    callback(this.isConnected);
    return () => this.unsubscribeConnectionStatus(callback);
  }

  unsubscribeConnectionStatus(callback: ConnectionStatusCallback) {
    this.connectionCallbacks.delete(callback);
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  private notifySubscribers(message: ChatMessage) {
    this.messageCallbacks.forEach(callback => callback(message));
  }

  private notifyDeleteSubscribers(messageId: number) {
    this.messageDeletedCallbacks.forEach(callback => callback(messageId));
  }

  private notifyConnectionSubscribers(isConnected: boolean) {
    this.connectionCallbacks.forEach(callback => callback(isConnected));
  }
}

export const chatSocket = new ChatSocketClient();
