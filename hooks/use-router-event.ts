// hooks/useRoomEvents.ts
import SocketClient from "@/lib/socket.util";
import { useEffect, useState } from "react";

export interface RouterEvent {
  tenantId: string;
  event: string
}

export function useRouterEvents(listenFor: string, event: string) {
  const [routerEvent, setRouterEvent] = useState<RouterEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to socket if not connected
    SocketClient.connect().then(() => {
      setIsConnected(true);
      console.log('socket', `Listen for ${listenFor}`);
    });

    // Listen for room events
    const handleMessage = (data: RouterEvent) => {
      console.log("socket", data, data.tenantId === listenFor);
      if (data.tenantId === listenFor) {
        setRouterEvent(data);
      }
    };

    SocketClient.on(event, handleMessage);

    return () => SocketClient.off(event, handleMessage);
  }, [listenFor]);

  return { routerEvent , isConnected};
}