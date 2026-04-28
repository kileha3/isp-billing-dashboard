// socket.client.ts
import { io, Socket } from "socket.io-client";

class SocketClient {
  private static socket: Socket;

  static event_session_sync = "session_sync_completed";

  static event_transaction_sync = "transaction_sync_completed";

  static event_invoice_sync = "invoice_sync_completed";

  static event_router_sync = "router_status_sync_completed";

  static event_voucher_sync = "voucher_status_sync_completed";

  static event_dashboard_sync = "dashboard_sync_triggered";

  static event_payment_completed = "payment_completed";

  static event_invoice_paid = "invoice_paid";

  static event_router_setup_completed = "router_setup_completed";

  static async connect(options: any = {}): Promise<Socket | null> {
    const server = `${process.env.NEXT_PUBLIC_API_URL}`.split("/v")[0];
    
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      this.socket = io(server, {
        transports: ["websocket"],
        autoConnect: true,
        ...options,
      });

      this.socket.on("connect", () => resolve(this.socket));
      this.socket.on("connect_error", () => resolve(null));
    });
  }

  static on(event: string, callback: (data: any) => void): void {
    this.socket?.on(event, callback);
  }

  static off(event: string, callback?: (data: any) => void): void {
    this.socket?.off(event, callback);
  }

  private static emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  private static join(id: string, type: string): void {
    this.emit("join", { id, type });
  }

  private static leave(id: string, type: string): void {
    this.emit("leave", { id, type });
  }

  static async waitFor<T = any>(
    type: string,
    id: string,
    callback: (data: T) => void,
    timeoutMs?: number,
    onTimeout?: () => T | Promise<T>
  ): Promise<() => void> {
    // Ensure connection first
    if (!this.socket?.connected) {
      const socket = await this.connect();
      if (!socket) {
        callback(null as any);
        return () => {};
      }
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let isCompleted = false;

    const handler = (data: any) => {
      if (isCompleted) return;
      isCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      callback(data);
    };

    this.socket!.once(type, handler);
    this.join(id, type);

    if (timeoutMs) {
      timeoutId = setTimeout(async () => {
        if (isCompleted) return;
        isCompleted = true;
        
        // Clean up the event listener
        this.socket?.off(type, handler);
        this.leave(id, type);
        
        // Execute fallback if provided
        if (onTimeout) {
          try {
            const fallbackResult = await onTimeout();
            callback(fallbackResult);
          } catch (error) {
            console.error("Timeout fallback failed:", error);
            callback(null as any);
          }
        } else {
          callback(null as any);
        }
      }, timeoutMs);
    }

    return () => {
      if (isCompleted) return;
      isCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      this.socket?.off(type, handler);
      this.leave(id, type);
    };
  }

  /**
   * Subscribe to ongoing events for a specific entity
   * Returns unsubscribe function
   */
  static async subscribe<T = any>(
    type: string,
    id: string,
    callback: (data: T) => void
  ): Promise<() => void> {
    // Ensure connection first
    if (!this.socket?.connected) {
      const socket = await this.connect();
      if (!socket) {
        console.warn("Cannot subscribe: socket not connected");
        return () => {};
      }
    }

    // Listen to the event
    this.socket!.on(type, callback);
    this.join(id, type);

    // Return unsubscribe function
    return () => {
      this.socket?.off(type, callback);
      this.leave(id, type);
    };
  }

  static disconnect(): void {
    this.socket?.disconnect();
  }
}

export default SocketClient;