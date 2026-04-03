// hooks/useRoomEvents.ts
import { useAuth } from "@/lib/auth-context";
import SocketClient from "@/lib/socket.util";
import { useEffect, useState } from "react";

export interface RouterEvent {
  tenantId: string;
  event: string;
}

export function useRouterEvents(event: string) {
  const [routerEvent, setRouterEvent] = useState<RouterEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleMessage = (data: RouterEvent) => {
      console.dir({data, user}, {depth: null})
      if (user && data.tenantId === user._id) setRouterEvent(data);
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

  return { routerEvent,isConnected };
}