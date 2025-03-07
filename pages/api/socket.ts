import { Server, ServerOptions } from "socket.io";

import { NextApiResponse } from 'next';

import { Server as NetServer, Socket } from 'net';
import { Server as SocketIOServer } from 'socket.io';

interface SocketServer extends NetServer {
  io?: SocketIOServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: Socket & {
    server: SocketServer;
  };
}

export default function handler(res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server as unknown as Partial<ServerOptions>);
    io.on("connection", (socket) => {
      socket.on("message", (msg) => {
        io.emit("message", msg);
      });
    });
    res.socket.server.io = io;
  }
  res.end();
}