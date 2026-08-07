// socket.client.ts
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

class ServerEvents {
  // Event constants
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

  // Private static properties
  private static supabase: SupabaseClient | null = null;
  private static channel: RealtimeChannel | null = null;
  private static eventHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private static isSubscribed = false;
  private static subscriptionStatus: 'UNSUBSCRIBED' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'ERROR' = 'UNSUBSCRIBED';
  private static subscriptionCallbacks: Array<() => void> = [];

  /**
   * Initialize the Supabase client (singleton)
   */
  private static getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!url || !key) {
        throw new Error('Missing Supabase environment variables');
      }
      
      this.supabase = createClient(url, key, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    }
    return this.supabase;
  }

  /**
   * Get or create the main channel
   */
  private static getChannel(): RealtimeChannel {
    if (!this.channel) {
      const supabase = this.getSupabase();
      this.channel = supabase.channel("isp-billing-events", {
        config: {
          broadcast: { self: true },
        },
      });

      // Set up the channel to listen for all broadcast events
      this.channel.on('broadcast', { event: '*' }, (payload) => {
        const { event, payload: data } = payload;
        
        // Notify all registered handlers for this event
        const handlers = this.eventHandlers.get(event);
        if (handlers && handlers.size > 0) {
          handlers.forEach(handler => {
            try {
              handler(data);
            } catch {}
          });
        }
      });
    }
    return this.channel;
  }

  /**
   * Subscribe to the channel (only once)
   */
  private static ensureSubscription(): void {
    if (this.isSubscribed) return;
    if (this.subscriptionStatus === 'SUBSCRIBING') {
      return;
    }

    this.subscriptionStatus = 'SUBSCRIBING';
    const channel = this.getChannel();
    
    channel.subscribe((status, err) => {
      
      switch (status) {
        case 'SUBSCRIBED':
          this.isSubscribed = true;
          this.subscriptionStatus = 'SUBSCRIBED';
          this.subscriptionCallbacks.forEach(cb => cb());
          this.subscriptionCallbacks = [];
          break;
          
        case 'CHANNEL_ERROR':
          this.subscriptionStatus = 'ERROR';
          break;
          
        case 'TIMED_OUT':
          this.subscriptionStatus = 'ERROR';
          break;
          
        case 'CLOSED':
          this.isSubscribed = false;
          this.subscriptionStatus = 'UNSUBSCRIBED';
          break;
      }
    });
  }

  /**
   * Wait for subscription to be ready
   */
  private static waitForSubscription(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isSubscribed) {
        resolve();
      } else {
        this.subscriptionCallbacks.push(resolve);
        this.ensureSubscription();
      }
    });
  }

  /**
   * Wait for a specific event with timeout support
   */
  static async waitFor<T = any>(
    type: string,
    id: string,
    callback: (data: T) => void,
    timeoutMs?: number,
    onTimeout?: () => T | Promise<T>,
  ): Promise<() => void> {
    const eventName = this.buildEventName(type, id);
    let timeoutId: NodeJS.Timeout | null = null;
    let isCompleted = false;

    const handler = (data: any) => {
      if (isCompleted) return;
      isCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      console.log(`✅ waitFor completed for event: ${eventName}`);
      callback(data);
    };

    // Register the handler
    this.subscribeToEvent(eventName, handler);

    // Set timeout if provided
    if (timeoutMs) {
      timeoutId = setTimeout(async () => {
        if (isCompleted) return;
        isCompleted = true;
        
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
        
        // Clean up handler on timeout
        this.unsubscribeFromEvent(eventName, handler);
      }, timeoutMs);
    }

    // Return unsubscribe function
    return () => {
      if (isCompleted) return;
      isCompleted = true;
      if (timeoutId) clearTimeout(timeoutId);
      this.unsubscribeFromEvent(eventName, handler);
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
    const eventName = this.buildEventName(type, id);
    this.subscribeToEvent(eventName, callback);
    return () => {
      this.unsubscribeFromEvent(eventName, callback);
    };
  }

  /**
   * Subscribe to a specific event
   */
  private static subscribeToEvent(event: string, handler: (data: any) => void): void {
    // Ensure the channel is subscribed
    this.ensureSubscription();
    console.log(event)

    // Store the handler
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from a specific event
   */
  private static unsubscribeFromEvent(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Build the event name from type and id
   */
  private static buildEventName(type: string, id: string): string {
    return type !== id ? `${type}:${id}`: type;
  }


  /**
   * Get current subscription status
   */
  static getStatus(): {
    isSubscribed: boolean;
    status: string;
    handlerCount: number;
  } {
    let handlerCount = 0;
    this.eventHandlers.forEach(handlers => {
      handlerCount += handlers.size;
    });
    
    return {
      isSubscribed: this.isSubscribed,
      status: this.subscriptionStatus,
      handlerCount,
    };
  }

  /**
   * List all active event handlers
   */
  static listActiveEvents(): string[] {
    return Array.from(this.eventHandlers.keys());
  }

  /**
   * Disconnect and cleanup
   */
  static disconnect(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
      this.isSubscribed = false;
      this.subscriptionStatus = 'UNSUBSCRIBED';
      this.eventHandlers.clear();
      this.subscriptionCallbacks = [];
    }
  }

  /**
   * Reconnect to the channel
   */
  static async reconnect(): Promise<void> {
    this.disconnect();
    await this.waitForSubscription();
  }
}

export default ServerEvents;