// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];

wss.on("connection", ws => {
  clients.push(ws);
  ws.on("message", message => {
    clients.forEach(client => {
      if (client !== ws && client.readyState === 1) {
        client.send(message);
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});

app.use(express.static("public"));

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
