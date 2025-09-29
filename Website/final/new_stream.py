import cv2
from flask import Flask, Response
import threading
import time

# --- Auto-detect connected cameras ---
def detect_cameras(max_tested=10):
    available = []
    for i in range(max_tested):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)  # Force DirectShow backend
        if cap.isOpened():
            available.append(i)
            cap.release()
    return available

# --- Camera sources (auto-detected) ---
camera_sources = detect_cameras()
caps = [cv2.VideoCapture(src, cv2.CAP_DSHOW) for src in camera_sources]

# Set safe resolution and FPS for each camera
for cap in caps:
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

# --- Flask App ---
app = Flask(__name__)
frames = [None] * len(caps)  # Store latest frames for each camera

# --- Camera capture ---
def capture_camera(i, cap):
    global frames
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps is None:
        fps = 25  # fallback FPS if cannot read from video
    frame_delay = 1 / fps

    while True:
        success, frame = cap.read()
        if not success:
            # Try resetting capture
            cap.release()
            cap.open(camera_sources[i], cv2.CAP_DSHOW)
            continue
        frames[i] = frame
        time.sleep(frame_delay)  # Respect video FPS

# --- MJPEG streaming ---
def generate_mjpeg(camera_index):
    global frames
    while True:
        if frames[camera_index] is None:
            continue
        ret, buffer = cv2.imencode('.jpg', frames[camera_index])
        if not ret:
            continue
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/api/stream/<int:camera_index>')
def mjpeg_stream(camera_index):
    if camera_index >= len(frames):
        return "Camera not found", 404
    return Response(generate_mjpeg(camera_index),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

# --- Start camera threads ---
for i, cap in enumerate(caps):
    t = threading.Thread(target=capture_camera, args=(i, cap))
    t.daemon = True
    t.start()

# --- Run Flask ---
if __name__ == '__main__':
    print(f"Detected cameras: {camera_sources}")
    app.run(host='0.0.0.0', port=5000, threaded=True)
