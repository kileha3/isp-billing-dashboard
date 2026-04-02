// hooks/useRoomEvents.ts
import SocketClient from "@/lib/socket.util";
import { RouterDevice } from "@/lib/types";
import { useEffect, useState } from "react";

export function useRouterStatus(roomId: string, event: string) {
  const [routerStatus, setRouterStatus] = useState<RouterDevice | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to socket if not connected
    SocketClient.connect().then(() => {
      setIsConnected(true);
      SocketClient.join(roomId);
    });

    // Listen for room events
    const handleMessage = (data: RouterDevice) => {
      console.log("seocket", data);
      if (data.tenantId === roomId) {
        setRouterStatus(data);
      }
    };

    SocketClient.on(event, handleMessage);

    return () => {
      SocketClient.off(event, handleMessage);
    };
  }, [roomId]);

  return { routerStatus, isConnected };
}