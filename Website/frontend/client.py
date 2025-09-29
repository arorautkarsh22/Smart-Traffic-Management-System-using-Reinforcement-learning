import asyncio
import websockets
import datetime

HOST = '0.0.0.0'  # Listen on all interfaces
PORT = 9999

async def send_status(websocket, path):
    """
    An async function to handle WebSocket connections.
    """
    print(f"Client connected from {websocket.remote_address}")
    try:
        # This loop will run as long as the client is connected.
        while True:
            # Create a message to send
            current_time = datetime.datetime.now().isoformat()
            message = f"Server status OK at {current_time}"
            
            # Send the message to the client
            await websocket.send(message)
            print(f"Sent: {message}")
            
            # Wait for 2 seconds before sending the next message
            await asyncio.sleep(2)
    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected from {websocket.remote_address}")

async def start_server():
    """
    Starts the WebSocket server.
    """
    # The 'with' statement ensures the server is properly closed.
    async with websockets.serve(send_status, HOST, PORT):
        print(f"WebSocket server listening on ws://{HOST}:{PORT}...")
        await asyncio.Future()  # This will run forever

if __name__ == "__main__":
    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        print("Server shutting down.")