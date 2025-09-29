# =============================================================================
# FastAPI SUMO TraCI Server (V4: WebSocket Real-Time Communication) - Corrected
# =============================================================================

import os
import sys
import threading
import asyncio
from typing import List

import traci
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# --- Connection Manager for WebSockets ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        # Create a list of connections to remove if they are disconnected
        disconnected_connections = []
        for connection in self.active_connections:
            try:
                # CHANGED: The correct method is send_json(), not json()
                await connection.send_json(data)
            except (WebSocketDisconnect, RuntimeError) as e:
                # ADDED: Gracefully handle clients that disconnected unexpectedly
                print(f"Error sending to a client: {e}. Marking for removal.")
                disconnected_connections.append(connection)
        
        # ADDED: Remove disconnected clients outside the loop
        for connection in disconnected_connections:
            self.disconnect(connection)

manager = ConnectionManager()
main_loop = None # To hold the main asyncio event loop

# --- FastAPI App ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SUMO Configuration and Helpers ---
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare the environment variable 'SUMO_HOME'")

sumo_binary = "sumo-gui"
sumo_config_file = "map2/RL.sumocfg"

detector_groups = {
    "east": ["east_mid_0", "east_mid_1"],
    "north": ["north_mid_0", "north_mid_1"],
    "south": ["south_mid_0", "south_mid_1"],
    "west": ["west_mid_0", "west_mid_1"],
}

# --- SUMO Simulation Thread ---
def run_sumo():
    global main_loop
    try:
        traci.start([sumo_binary, "-c", sumo_config_file])
        print("SUMO simulation started successfully.")
    except traci.TraCIException:
        print(f"Error starting SUMO. Check path: {sumo_config_file}")
        # ADDED: Ensure main_loop is not None before trying to shut down
        if main_loop and main_loop.is_running():
             # Optional: A way to signal the main app to shut down if SUMO fails
             # main_loop.call_soon_threadsafe(main_loop.stop)
             pass
        return

    step = 0
    # Push data every simulation second for a real-time feel
    last_update_time = -1 
    while step < 50000:
        try: # ADDED: Error handling within the loop
            traci.simulationStep()
            step += 1
            current_time = traci.simulation.getTime()

            if current_time - last_update_time >= 1:
                # Only broadcast if there are connected clients
                if manager.active_connections:
                    data = collect_step_data()
                    
                    # Use asyncio.run_coroutine_threadsafe to safely call the async broadcast
                    # function from this synchronous thread.
                    future = asyncio.run_coroutine_threadsafe(manager.broadcast(data), main_loop)
                    
                    # .result() will block this thread until the broadcast is done and
                    # will raise any exceptions that occurred in the broadcast task.
                    future.result() 
                
                last_update_time = current_time

        except traci.TraCIException as e:
            print(f"A TraCI error occurred at step {step}: {e}")
            break # Exit the loop if SUMO connection is lost
        except Exception as e:
            # This will catch the AttributeError from the original code
            # and other potential errors during broadcast.
            print(f"An unexpected error occurred in the simulation loop at step {step}: {e}")
            # Depending on the error, you might want to 'break' or 'continue'
            break 
            
    traci.close()
    print("SUMO simulation finished.")

# --- FastAPI WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print("A client connected.")
    try:
        while True:
            # Keep the connection alive by waiting for a message.
            # A client-side ping/pong mechanism is a good practice.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("A client disconnected.")

# --- FastAPI Startup Event ---
@app.on_event("startup")
async def startup_event():
    """On startup, get the running event loop and start the SUMO thread."""
    global main_loop
    main_loop = asyncio.get_running_loop()
    sumo_thread = threading.Thread(target=run_sumo, daemon=True)
    sumo_thread.start()

# --- Helper Functions (unchanged, place your original functions here) ---
def get_direction_vehicle_count(direction_key):
    vehicle_ids = set()
    for det_id in detector_groups.get(direction_key, []):
        try:
            vehicle_ids.update(traci.lanearea.getLastStepVehicleIDs(det_id))
        except traci.TraCIException: pass
    return len(vehicle_ids)

def calculate_time_to_green(tls_id, lane_id):
    try:
        logic = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls_id)
        if not logic: return -1.0
        program = logic[0]; phases = program.phases
        controlled_lanes = traci.trafficlight.getControlledLanes(tls_id)
        if lane_id not in controlled_lanes: return -1.0
        lane_index = controlled_lanes.index(lane_id)
        current_time = traci.simulation.getTime()
        next_switch_time = traci.trafficlight.getNextSwitch(tls_id)
        time_until_green = next_switch_time - current_time
        current_phase_index = traci.trafficlight.getPhase(tls_id)
        num_phases = len(phases)
        for i in range(1, num_phases + 1):
            next_phase_index = (current_phase_index + i) % num_phases
            phase_state_string = phases[next_phase_index].state
            lane_state_in_phase = phase_state_string[lane_index].lower()
            if 'g' in lane_state_in_phase:
                return time_until_green
            time_until_green += phases[next_phase_index].duration
        return -1.0
    except traci.TraCIException: return -1.0

def collect_step_data():
    step_data = {"current_time": traci.simulation.getTime(), "directions": {}}
    for direction_key in detector_groups:
        step_data["directions"][direction_key.capitalize()] = {"vehicle_count": get_direction_vehicle_count(direction_key)}
    for tls_id in traci.trafficlight.getIDList():
        processed_directions = set()
        for lane in traci.trafficlight.getControlledLanes(tls_id):
            try:
                direction_key = lane.split('_')[0]
                if direction_key in detector_groups and direction_key not in processed_directions:
                    processed_directions.add(direction_key)
                    direction_capitalized = direction_key.capitalize()
                    state_string = traci.trafficlight.getRedYellowGreenState(tls_id)
                    lane_index = traci.trafficlight.getControlledLanes(tls_id).index(lane)
                    state = state_string[lane_index].lower()
                    
                    # Ensure the direction key exists before trying to assign to it
                    if direction_capitalized not in step_data["directions"]:
                        step_data["directions"][direction_capitalized] = {}
                        
                    if 'g' in state:
                        next_switch = traci.trafficlight.getNextSwitch(tls_id)
                        step_data["directions"][direction_capitalized]["state"] = "GREEN"
                        step_data["directions"][direction_capitalized]["time"] = next_switch - traci.simulation.getTime()
                    elif 'r' in state:
                        time_to_green = calculate_time_to_green(tls_id, lane)
                        step_data["directions"][direction_capitalized]["state"] = "RED"
                        step_data["directions"][direction_capitalized]["time_until_green"] = time_to_green
                    elif 'y' in state:
                        next_switch = traci.trafficlight.getNextSwitch(tls_id)
                        step_data["directions"][direction_capitalized]["state"] = "YELLOW"
                        step_data["directions"][direction_capitalized]["time"] = next_switch - traci.simulation.getTime()
            except traci.TraCIException as e:
                print(f"Error processing lane {lane} for TLS {tls_id}: {e}")
                continue # Move to the next lane if one fails
    return step_data


# --- Main Entry Point ---
if __name__ == "__main__":
    print("Starting FastAPI server with WebSocket support at http://0.0.0.0:8000")
    print("WebSocket endpoint is available at ws://127.0.0.1:8000/ws")
    uvicorn.run(app, host="0.0.0.0", port=8000)