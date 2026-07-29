// socket.client.ts
import { io, Socket } from "socket.io-client";

class ServerEventClient {
  private static eventSource: EventSource | null = null;

  static event_session_sync = "session_sync_completed";

  static event_transaction_sync = "transaction_sync_completed";

  static event_invoice_sync = "invoice_sync_completed";

  static event_router_sync = "router_status_sync_completed";

  static event_voucher_sync = "voucher_status_sync_completed";

  static event_dashboard_sync = "dashboard_sync_triggered";

  static event_payment_completed = "payment_completed";

  static event_invoice_paid = "invoice_paid";

  static event_router_setup_completed = "router_setup_completed";

  static event_notification_sync = "notification_sync_triggered";

  private static join(id: string, type: string): void {
    const room = `${type}:${id}`;
    this.eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/events?room=${room}`);
  }

  private static dataHandler(handler: any) {
    this.eventSource!.onmessage = (event) => {
      console.log("Filtered event received:", JSON.parse(event.data));
      handler(JSON.parse(event.data));
    };
  }

  static async waitFor<T = any>(
    type: string,
    id: string,
    callback: (data: T) => void,
    timeoutMs?: number,
    onTimeout?: () => T | Promise<T>,
  ): Promise<() => void> {
    let timeoutId: NodeJS.Timeout | null = null;
    let isCompleted = false;

    const handler = (data: any) => {
      if (isCompleted) return;
      isCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      callback(data);
    };

    this.join(id, type);
    if (!this.eventSource) {
      callback(null as any);
      return () => {};
    }
    this.dataHandler(handler);

    if (timeoutMs) {
      timeoutId = setTimeout(async () => {
        if (isCompleted) return;
        isCompleted = true;

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
    };
  }

  /**
   * Subscribe to ongoing events for a specific entity
   * Returns unsubscribe function
   */
  static async subscribe<T = any>(type: string, id: string, callback: (data: T) => void): Promise<() => void> {
    // Listen to the event
    this.join(id, type);

    // Return unsubscribe function
    this.dataHandler(callback);
    return () => {};
  }
}

export default ServerEventClient;
