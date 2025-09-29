import cv2
import asyncio
import websockets
import base64
import numpy as np

async def receive_video():
    uri = "ws://10.12.2.229:8765"  # Replace SERVER_IP with actual server IP
    async with websockets.connect(uri) as websocket:
        print("✅ Connected to video server")

        try:
            while True:
                data = await websocket.recv()

                # Decode base64 -> numpy array -> OpenCV image
                jpg_bytes = base64.b64decode(data)
                np_arr = np.frombuffer(jpg_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if frame is not None:
                    cv2.imshow("Remote Stream", frame)

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        except websockets.exceptions.ConnectionClosed:
            print("❌ Server closed connection")

    cv2.destroyAllWindows()

if __name__ == "__main__":
    asyncio.run(receive_video())