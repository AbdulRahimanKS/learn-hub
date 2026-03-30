import { ChatMessage } from './chat-api';

type MessageCallback = (message: ChatMessage) => void;
type ConnectionStatusCallback = (isConnected: boolean) => void;

class ChatSocketClient {
  private socket: WebSocket | null = null;
  private batchId: number | string | null = null;
  private messageCallbacks: Set<MessageCallback> = new Set();
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

    // Use ws:// for http and wss:// for https
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the standard backend API URL base, but replace http with ws
    // Fallback to localhost if not available
    const host = import.meta.env.VITE_API_URL 
      ? new URL(import.meta.env.VITE_API_URL).host 
      : (window.location.hostname + ':8000');
    
    // Pass token in URL if backend implements JWT auth in ASGI
    const token = localStorage.getItem('access_token') || '';
    const wsUrl = `${protocol}//${host}/ws/chat/batch/${this.batchId}/?token=${token}`;

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
        if (data.id && data.message !== undefined) {
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

  private notifyConnectionSubscribers(isConnected: boolean) {
    this.connectionCallbacks.forEach(callback => callback(isConnected));
  }
}

export const chatSocket = new ChatSocketClient();
