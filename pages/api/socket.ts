import { Server } from "socket.io";

export default function handler(req: any, res: any) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server);
    io.on("connection", (socket) => {
      socket.on("message", (msg) => {
        io.emit("message", msg);
      });
    });
    res.socket.server.io = io;
  }
  res.end();
}