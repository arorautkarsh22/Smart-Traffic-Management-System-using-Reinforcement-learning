import RPi.GPIO as GPIO
import time
import socket
import json
import threading

# Pin setup (Lane 1 to Lane 4)
RED1, YELLOW1, GREEN1 = 17, 27, 22
RED2, YELLOW2, GREEN2 = 23, 24, 25
RED3, YELLOW3, GREEN3 = 5, 6, 26
RED4, YELLOW4, GREEN4 = 10, 9, 11
lanes = [
    (RED1, YELLOW1, GREEN1),
    (RED2, YELLOW2, GREEN2),
    (RED3, YELLOW3, GREEN3),
    (RED4, YELLOW4, GREEN4)
]

# TCP Socket Setup
HOST = '10.12.2.255'  # Replace with your bridge server's IP
PORT = 9999
sock = None

# Manual control state
manual_mode = False
manual_lane = None
manual_color = None

lock = threading.Lock()

def setup():
    global sock
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    # Set all lane pins to output and turn all red on initially
    for lane in lanes:
        for light in lane:
            GPIO.setup(light, GPIO.OUT, initial=GPIO.LOW)
    all_red()

    # Setup socket connection to bridge server
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)  # Timeout for connect and send
        sock.connect((HOST, PORT))
        sock.settimeout(None)  # Set blocking mode after connection
        print("[Pi] Connected to bridge server")
    except socket.error as e:
        print(f"[Pi] Socket connection failed: {e}")
        exit(1)

def all_red():
    for lane in lanes:
        GPIO.output(lane[0], GPIO.HIGH)  # RED ON
        GPIO.output(lane[1], GPIO.LOW)   # YELLOW OFF
        GPIO.output(lane[2], GPIO.LOW)   # GREEN OFF

def set_light(lane_index, color):
    """Sets the given lane's light color."""
    red_pin, yellow_pin, green_pin = lanes[lane_index]
    GPIO.output(red_pin, GPIO.HIGH if color != 'RED' else GPIO.LOW)
    GPIO.output(yellow_pin, GPIO.HIGH if color == 'YELLOW' else GPIO.LOW)
    GPIO.output(green_pin, GPIO.HIGH if color == 'GREEN' else GPIO.LOW)
    # Turn on the selected color, turn off others accordingly
    if color == 'RED':
        GPIO.output(red_pin, GPIO.HIGH)
        GPIO.output(yellow_pin, GPIO.LOW)
        GPIO.output(green_pin, GPIO.LOW)
    elif color == 'YELLOW':
        GPIO.output(red_pin, GPIO.LOW)
        GPIO.output(yellow_pin, GPIO.HIGH)
        GPIO.output(green_pin, GPIO.LOW)
    elif color == 'GREEN':
        GPIO.output(red_pin, GPIO.LOW)
        GPIO.output(yellow_pin, GPIO.LOW)
        GPIO.output(green_pin, GPIO.HIGH)
    else:
        # Turn all off if unknown color
        GPIO.output(red_pin, GPIO.LOW)
        GPIO.output(yellow_pin, GPIO.LOW)
        GPIO.output(green_pin, GPIO.LOW)

def get_lane_statuses(active_index=None, active_color="RED"):
    statuses = ["RED"] * 4
    if active_index is not None:
        statuses[active_index] = active_color
    return statuses

def send_all_status(statuses):
    global sock
    message = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "intersection": [
            {"lane": i + 1, "status": status}
            for i, status in enumerate(statuses)
        ]
    }
    try:
        sock.sendall((json.dumps(message) + "\n").encode())
    except socket.error as e:
        print(f"[Pi] Failed to send data: {e}")
        destroy()
        exit(1)

def process_manual_command(cmd):
    global manual_mode, manual_lane, manual_color
    with lock:
        if cmd.get("manual_control", False):
            lane = cmd.get("lane")
            color = cmd.get("color")
            if lane is not None and color in ("RED", "YELLOW", "GREEN"):
                manual_mode = True
                manual_lane = lane - 1  # zero-based index
                manual_color = color
                print(f"[Pi] Manual mode ON: Lane {lane} -> {color}")
                set_light(manual_lane, manual_color)
                send_all_status(get_lane_statuses(manual_lane, manual_color))
            else:
                print("[Pi] Invalid manual command received.")
        else:
            # Disable manual mode and resume automatic cycle
            if manual_mode:
                print("[Pi] Manual mode OFF, resuming automatic cycle.")
            manual_mode = False
            manual_lane = None
            manual_color = None
            all_red()
            send_all_status(get_lane_statuses())  # All red

def listen_for_commands():
    global sock
    buffer = ''
    while True:
        try:
            data = sock.recv(1024)
            if not data:
                print("[Pi] Connection closed by bridge server.")
                break
            buffer += data.decode()
            while '\n' in buffer:
                line, buffer = buffer.split('\n', 1)
                if line.strip():
                    try:
                        cmd = json.loads(line.strip())
                        process_manual_command(cmd)
                    except json.JSONDecodeError:
                        print("[Pi] Received invalid JSON:", line)
        except socket.error as e:
            print(f"[Pi] Socket error when receiving commands: {e}")
            break

def traffic_cycle():
    global manual_mode
    i = 0
    while True:
        with lock:
            if manual_mode:
                # If manual mode is active, pause automatic cycling
                time.sleep(1)
                continue
        lane = lanes[i]
        # Automatic cycle
        all_red()
        GPIO.output(lane[0], GPIO.LOW)    # RED OFF
        GPIO.output(lane[2], GPIO.HIGH)   # GREEN ON
        send_all_status(get_lane_statuses(i, "GREEN"))
        for _ in range(5):
            time.sleep(1)
            with lock:
                if manual_mode:
                    break
        if manual_mode:
            continue

        GPIO.output(lane[2], GPIO.LOW)    # GREEN OFF
        GPIO.output(lane[1], GPIO.HIGH)   # YELLOW ON
        send_all_status(get_lane_statuses(i, "YELLOW"))
        for _ in range(2):
            time.sleep(1)
            with lock:
                if manual_mode:
                    break
        if manual_mode:
            continue

        GPIO.output(lane[1], GPIO.LOW)    # YELLOW OFF
        GPIO.output(lane[0], GPIO.HIGH)   # RED ON
        send_all_status(get_lane_statuses())
        for _ in range(1):
            time.sleep(1)
            with lock:
                if manual_mode:
                    break
        if manual_mode:
            continue

        i = (i + 1) % len(lanes)

def loop():
    thread = threading.Thread(target=listen_for_commands, daemon=True)
    thread.start()
    try:
        traffic_cycle()
    except KeyboardInterrupt:
        destroy()

def destroy():
    global sock
    print("[Pi] Cleaning up GPIO and closing socket...")
    all_red()
    GPIO.cleanup()
    if sock:
        try:
            sock.shutdown(socket.SHUT_RDWR)
            sock.close()
        except Exception:
            pass
        sock = None

if _name_ == "_main_":
    setup()
    loop()