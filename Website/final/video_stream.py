import cv2
from flask import Flask, Response
import threading
import time

# camera_sources = ["Video.mp4", "Video.mp4","Video.mp4","Video.mp4"]  # Can add more video files or webcams like [0, "Video.mp4"]
camera_sources = [1, 2]
caps = [cv2.VideoCapture(src) for src in camera_sources]
# caps = [cv2.VideoCapture(src) for src in [0, 1]]

app = Flask(__name__)
frames = [None] * len(caps)  # Store latest frames for each camera

def capture_camera(i, cap):
    global frames
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0 or fps is None:
        fps = 25
    frame_delay = 1 / fps

    while True:
        success, frame = cap.read()
        if not success:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        frames[i] = frame
        time.sleep(frame_delay) 

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
    return Response(generate_mjpeg(camera_index),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

for i, cap in enumerate(caps):
    t = threading.Thread(target=capture_camera, args=(i, cap))
    t.daemon = True
    t.start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)

# http://127.0.0.1:5000/api/stream/<camera-index>