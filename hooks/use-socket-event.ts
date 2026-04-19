import { useEffect, useRef, useState } from "react";
import SocketClient from "@/lib/socket.util";

export interface SocketEvent<T = any> {
  event: string;
  data: T;
}

export function useSocketEvents<T = any>(
  eventType: string,
  match?: (data: T) => boolean,
  broadcast: boolean = false
) {
  const [socketEvent, setSocketEvent] = useState<SocketEvent<T> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Keep latest match function without re-subscribing
  const matchRef = useRef(match);
  matchRef.current = match;

  const broadcastRef = useRef(broadcast);
  broadcastRef.current = broadcast;

  useEffect(() => {
    let isMounted = true;

    const handleMessage = (event: SocketEvent<T>) => {
      console.log("kileha-event", event)
      if (event.event !== eventType) return;

      const shouldMatch =
        broadcastRef.current ||
        event.data === "*" ||
        (matchRef.current ? matchRef.current(event.data) : true);

        console.log("kileha-match", shouldMatch)
      if (shouldMatch) {
        setSocketEvent(event);
      }
    };

    const init = async () => {
      await SocketClient.connect();
      if (!isMounted) return;

      setIsConnected(true);
      SocketClient.on(eventType, handleMessage);
    };

    init();

    return () => {
      isMounted = false;
      SocketClient.off(eventType, handleMessage);
    };
  }, [eventType]);

  return { socketEvent, isConnected };
}