// hooks/useRoomEvents.ts
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";
import { useEffect, useState } from "react";

export interface SocketEvent {
  id: string;
  event: string;
  data: any;
}

export function useSocketEvents(
  event: string,
  id: string | null = null,
  broadcast: boolean = false,
) {
  const [socketEvent, setSocketEvent] = useState<SocketEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleMessage = (data: SocketEvent) => {
      const idToCheck = id ?? user?.tenantId;
      console.log("kileha-data", data)
      if (broadcast || data.id === "*" || (idToCheck && data.id === idToCheck)) {
        setSocketEvent(data);
      }
    };

    // Connect to socket if not connected
    SocketClient.connect().then(() => {
      setIsConnected(true);
      SocketClient.on(event, handleMessage);
    });

    return () => {
      SocketClient.off(event, handleMessage);
    };
  }, [event]);

  return { socketEvent, isConnected };
}
