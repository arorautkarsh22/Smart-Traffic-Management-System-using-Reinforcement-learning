import cv2 as cv
import math
import numpy as np
import time
import json
from ultralytics import YOLO
from sort import Sort

# --- Video Source ---
cap = cv.VideoCapture("http://127.0.0.1:5000/api/stream/0")

model = YOLO("yolov8l.pt", verbose=False)

classNames = ["person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train", "truck", "boat",
              "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
              "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
              "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat",
              "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
              "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange", "broccoli",
              "carrot", "hot dog", "pizza", "donut", "cake", "chair", "sofa", "pottedplant", "bed",
              "diningtable", "toilet", "tvmonitor", "laptop", "mouse", "remote", "keyboard", "cell phone",
              "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors",
              "teddy bear", "hair drier", "toothbrush"]

tracker = Sort(max_age=20, min_hits=3, iou_threshold=0.3)

vehicle_classes = ["car", "bus", "motorbike", "truck"]

# Load mask (white area = ROI, black = ignored)
mask = cv.imread("mask-2.png", cv.IMREAD_GRAYSCALE)

# --- Control processing rate ---
target_fps = 5
frame_interval = 1.0 / target_fps
last_time = 0

while True:
    success, img = cap.read()
    if not success:
        break

    current_time = time.time()
    if current_time - last_time < frame_interval:
        # Skip this frame to maintain ~5 FPS processing
        continue
    last_time = current_time

    # Resize mask to frame size
    if mask is not None:
        mask_resized = cv.resize(mask, (img.shape[1], img.shape[0]))
    else:
        mask_resized = np.ones((img.shape[0], img.shape[1]), dtype=np.uint8) * 255  # full frame if no mask

    results = model(img, stream=True, verbose=False)
    detections = np.empty((0, 5))

    for r in results:
        boxes = r.boxes
        for box in boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            conf = math.ceil((box.conf[0] * 100)) / 100
            cls = int(box.cls[0])
            currentClass = classNames[cls]

            if currentClass in vehicle_classes and conf > 0.3:
                currentArray = np.array([x1, y1, x2, y2, conf])
                detections = np.vstack((detections, currentArray))

    resultsTracker = tracker.update(detections)

    vehicles_in_mask = []
    for result in resultsTracker:
        x1, y1, x2, y2, id = result
        x1, y1, x2, y2, id = int(x1), int(y1), int(x2), int(y2), int(id)
        w, h = x2 - x1, y2 - y1
        cx, cy = x1 + w // 2, y1 + h // 2

        # Check if center is inside masked region
        if mask_resized[cy, cx] > 0:  # white = valid area
            vehicles_in_mask.append({
                "id": int(id),
                "x": cx,
                "y": cy
            })

            # Draw bounding box & ID on frame
            cv.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv.putText(img, f"ID {id}", (x1, y1 - 10), cv.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            cv.circle(img, (cx, cy), 5, (0, 0, 255), -1)

    output_json = {
        "vehicle_count_in_mask": len(vehicles_in_mask),
        "vehicles": vehicles_in_mask
    }

    print(json.dumps(output_json, indent=2))

    # Show video window
    cv.imshow("Vehicle Tracking", img)

    # Exit loop when 'q' is pressed
    key = cv.waitKey(1) & 0xFF
    if key == ord('q'):
        break

cap.release()
cv.destroyAllWindows()
