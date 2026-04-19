// hooks/useRoomEvents.ts
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";
import { useEffect, useState } from "react";

export interface SocketEvent {
  event: string;
  data: any;
}

export function useSocketEvents(
  eventType: string,
  match?: (data: any) =>  boolean,
  broadcast: boolean = false,
) {
  const [socketEvent, setSocketEvent] = useState<SocketEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleMessage = (event: SocketEvent) => {
      console.dir({label:"kileha-soclet", event})
      const matched = (match && match(event) || broadcast || event.data === "*") && event.event === eventType;
      if (matched) setSocketEvent(event);
    };

    // Connect to socket if not connected
    SocketClient.connect().then(() => {
      setIsConnected(true);
      SocketClient.on(eventType, handleMessage);
    });

    return () => {
      SocketClient.off(eventType, handleMessage);
    };
  }, [eventType]);

  return { socketEvent, isConnected };
}
