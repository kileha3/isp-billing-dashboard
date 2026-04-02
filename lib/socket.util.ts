// socket.client.ts
import { io, Socket } from "socket.io-client";

class SocketClient {
  private static socket: Socket

  // initialize connection
   static async connect(options: any = {}) {
    const server = `${process.env.NEXT_PUBLIC_API_URL}`.split("/v")[0];
    console.log("socket", server)
    return new Promise((resolve) => {
      if (!this.socket) {
      this.socket = io(server, {
        transports: ["websocket"],
        autoConnect: true,
        ...options,
      })

      this.socket.on("connect", () => {
        console.log("socket","Connection established successfully")
        resolve(this.socket)
      })

      this.socket.on("disconnect", () => {
        resolve(null)
      })
    }
    })
  }

  // get instance
  static getSocket(): Socket | null {
    if (!this.socket) return null;
    return this.socket
  }

  // listen to event
  static on(event: string, callback: (data: any) => void) {
    this.getSocket()?.on(event, callback)
  }

  // stop listening
  static off(event: string, callback?: (data: any) => void) {
    this.getSocket()?.off(event, callback)
  }

  // emit event
  static emit(event: string, data?: any) {
    this.getSocket()?.emit(event, data)
  }

  // join room (optional pattern)
  static join(room: string) {
    this.emit("register", room)
  }
}

export default SocketClient