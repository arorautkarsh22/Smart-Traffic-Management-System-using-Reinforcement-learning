const net = require('net');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

let clients = new Set();
let piSocket = null;  // TCP socket connection to Raspberry Pi

wss.on('connection', (ws) => {
    console.log('[Bridge] WebSocket client connected');
    clients.add(ws);

    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to traffic light bridge server'
    }));

    ws.on('message', (message) => {
        // Receive manual control commands from React clients (WebSocket)
        try {
            const msg = JSON.parse(message);
            if (msg.manual_control !== undefined) {
                if (piSocket && piSocket.writable) {
                    // Forward manual control command to Pi TCP socket with newline delimiter
                    piSocket.write(JSON.stringify(msg) + '\n');
                    console.log('[Bridge] Forwarded manual control command to Pi:', msg);
                } else {
                    console.warn('[Bridge] Pi TCP socket not connected - cannot forward manual command');
                }
            } else {
                console.log('[Bridge] Received unrecognized message from React client:', msg);
            }
        } catch (e) {
            console.error('[Bridge] Failed to parse WebSocket message:', e);
        }
    });

    ws.on('close', () => {
        console.log('[Bridge] WebSocket client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('[Bridge] WebSocket client error:', error);
        clients.delete(ws);
    });
});

function broadcastToClients(data) {
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

const tcpServer = net.createServer((socket) => {
    console.log('[Bridge] Raspberry Pi connected:', socket.remoteAddress);
    piSocket = socket;

    let buffer = '';

    socket.on('data', (data) => {
        buffer += data.toString();
        let lines = buffer.split('\n');
        buffer = lines.pop();

        lines.forEach((line) => {
            if (line.trim()) {
                try {
                    const trafficData = JSON.parse(line);
                    console.log('[Bridge] Received from Pi:', trafficData);
                    // Broadcast received data to all WebSocket clients
                    broadcastToClients({
                        type: 'traffic_update',
                        data: trafficData
                    });
                } catch (e) {
                    console.error('[Bridge] JSON parse error from Pi data:', e);
                }
            }
        });
    });

    socket.on('end', () => {
        console.log('[Bridge] Raspberry Pi disconnected');
        piSocket = null;
    });

    socket.on('error', (error) => {
        console.error('[Bridge] TCP socket error:', error);
        piSocket = null;
    });
});

const TCP_PORT = 9999;  // Pi connection port
const WS_PORT = 3001;   // WebSocket server port

tcpServer.listen(TCP_PORT, () => {
    console.log(`[Bridge] TCP server listening on port ${TCP_PORT} for Raspberry Pi`);
});

server.listen(WS_PORT, () => {
    console.log(`[Bridge] WebSocket server listening on port ${WS_PORT} for React clients`);
});

process.on('SIGINT', () => {
    console.log('[Bridge] Shutting down servers...');
    tcpServer.close();
    server.close();
    process.exit(0);
});
