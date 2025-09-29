import os
import sys
import threading
import asyncio
import time
from typing import List, Dict, Any
from collections import defaultdict
import traci
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

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
        disconnected_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except (WebSocketDisconnect, RuntimeError) as e:
                print(f"Error sending to a client: {e}. Marking for removal.")
                disconnected_connections.append(connection)
        
        for connection in disconnected_connections:
            self.disconnect(connection)

manager = ConnectionManager()
main_loop = None # To hold the main asyncio event loop

# --- FastAPI App ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Adjust if your frontend is on a different port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare the environment variable 'SUMO_HOME'")

sumo_binary = "sumo-gui" # or "sumo" for no GUI
# !!! IMPORTANT: Make sure this path is correct for your project !!!
sumo_config_file = "map6/RL.sumocfg"

# --- SUMO Simulation Thread ---
def run_sumo():
    global main_loop
    try:
        traci.start([sumo_binary, "-c", sumo_config_file])
        print("SUMO simulation started successfully.")
    except traci.TraCIException as e:
        print(f"Error starting SUMO. Check path: {sumo_config_file}. Error: {e}")
        return

    step = 0
    last_update_time = -1 
    # Main simulation loop
    while step < 50000: # Increase steps for a longer simulation
        try:
            traci.simulationStep()
            step += 1
            current_time = traci.simulation.getTime()

            # Broadcast data every 1 simulation second
            if current_time - last_update_time >= 1:
                if manager.active_connections:
                    data = collect_all_intersections_data()
                    future = asyncio.run_coroutine_threadsafe(manager.broadcast(data), main_loop)
                    future.result() # Wait for the broadcast to complete
                
                last_update_time = current_time

        except traci.TraCIException as e:
            print(f"A TraCI error occurred at step {step}: {e}")
            break
        except Exception as e:
            print(f"An unexpected error occurred in the simulation loop at step {step}: {e}")
            break
            
    traci.close()
    print("SUMO simulation finished.")

# --- FastAPI WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print(f"Client connected: {websocket.client}")
    try:
        while True:
            # Keep connection alive by waiting for any message (or just pass)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"Client disconnected: {websocket.client}")

# --- FastAPI Startup Event ---
@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()
    # Run the SUMO simulation in a separate thread
    sumo_thread = threading.Thread(target=run_sumo, daemon=True)
    sumo_thread.start()

# --- HELPER FUNCTIONS ---

def group_lanes_by_approach(lanes: List[str]) -> Dict[str, List[str]]:
    """
    Groups lanes by their approach edge ID prefix.
    Example: '16_50_0' and '16_50_1' are grouped under '16'.
    """
    grouped = defaultdict(list)
    for lane_id in lanes:
        # Assuming lane/edge IDs are in the format 'prefix_junction_...'
        prefix = lane_id.split('_')[0]
        grouped[prefix].append(lane_id)
    return dict(grouped)


def calculate_time_to_green(tls_id: str, lane_id: str, controlled_lanes: List[str], phases: List[Any]) -> float:
    """Calculates the time remaining until a specific lane turns green."""
    try:
        lane_index = controlled_lanes.index(lane_id)
        current_time = traci.simulation.getTime()
        next_switch_time = traci.trafficlight.getNextSwitch(tls_id)
        time_until_green = next_switch_time - current_time
        
        current_phase_index = traci.trafficlight.getPhase(tls_id)
        num_phases = len(phases)

        for i in range(1, num_phases + 1):
            next_phase_index = (current_phase_index + i) % num_phases
            phase_state_string = phases[next_phase_index].state
            
            if lane_index < len(phase_state_string):
                lane_state_in_phase = phase_state_string[lane_index].lower()
                if 'g' in lane_state_in_phase:
                    return time_until_green
            
            time_until_green += phases[next_phase_index].duration
            
        return -1.0
    except (traci.TraCIException, ValueError):
        return -1.0

# =================================================================================
# MODIFIED DATA COLLECTION LOGIC TO MATCH TARGET FORMAT
# =================================================================================

def collect_all_intersections_data() -> Dict[str, Any]:
    """
    Gathers data from e2LaneArea detectors and structures it by intersection
    to match the specified JSON format.
    """
    detectors_by_junction = defaultdict(list)
    try:
        all_detectors = traci.lanearea.getIDList()
        for det_id in all_detectors:
            lane_id = traci.lanearea.getLaneID(det_id)
            edge_id = traci.lane.getEdgeID(lane_id)
            junction_id = traci.edge.getToJunction(edge_id)
            if not junction_id.startswith(':'):
                detectors_by_junction[junction_id].append(det_id)
    except traci.TraCIException as e:
        print(f"Error getting detector list: {e}")
        return {"time": -1, "intersections": [], "error": str(e)}

    all_intersections_list = []
    current_time = traci.simulation.getTime()
    
    for junction_id, detector_ids in detectors_by_junction.items():
        tls_id = junction_id

        try:
            controlled_lanes = traci.trafficlight.getControlledLanes(tls_id)
            if not controlled_lanes:
                continue

            logic = traci.trafficlight.getCompleteRedYellowGreenDefinition(tls_id)
            program = logic[0] if logic else None
            light_state_string = traci.trafficlight.getRedYellowGreenState(tls_id)
            lanes_by_approach = group_lanes_by_approach(controlled_lanes)
            # Map each approach prefix (e.g., '16') to its first controlled lane (e.g., '16_50_0')
            approach_to_rep_lane = {direction: lanes[0] for direction, lanes in lanes_by_approach.items()}

        except traci.TraCIException:
            continue

        intersection_data = {"id": junction_id, "total-vehicles": 0}
        # This dict will temporarily hold data for each side before being nested
        sides_data_temp = defaultdict(lambda: {"number-of-vehicles": 0})
        total_halting_vehicles = 0
        all_roads = set()

        for det_id in detector_ids:
            det_lane_id = traci.lanearea.getLaneID(det_id)
            det_edge_id = traci.lane.getEdgeID(det_lane_id)
            all_roads.add(det_edge_id)
            # The direction key is now just the edge prefix, e.g., '16'
            direction_key = det_edge_id.split('_')[0]
            vehicle_count = traci.lanearea.getLastStepVehicleNumber(det_id)
            total_halting_vehicles += traci.lanearea.getLastStepHaltingNumber(det_id)
            
            light_color, time_until_change = "unknown", -1.0
            if direction_key in approach_to_rep_lane:
                rep_lane = approach_to_rep_lane[direction_key]
                lane_index = controlled_lanes.index(rep_lane)
                state_char = light_state_string[lane_index].lower()
                
                if 'g' in state_char:
                    light_color = "green"
                    time_until_change = round(traci.trafficlight.getNextSwitch(tls_id) - current_time, 2)
                elif 'y' in state_char:
                    light_color = "yellow"
                    time_until_change = round(traci.trafficlight.getNextSwitch(tls_id) - current_time, 2)
                else:
                    light_color = "red"
                    if program:
                        time_to_green = calculate_time_to_green(tls_id, rep_lane, controlled_lanes, program.phases)
                        time_until_change = round(time_to_green, 2) if time_to_green != -1 else -1.0

            sides_data_temp[direction_key]["light"] = light_color
            sides_data_temp[direction_key]["time"] = time_until_change
            sides_data_temp[direction_key]["number-of-vehicles"] += vehicle_count
            intersection_data["total-vehicles"] += vehicle_count

        intersection_data["roads"] = sorted(list(all_roads))
        intersection_data["halting-vehicles"] = total_halting_vehicles
        
        # --- KEY CHANGE START ---
        # Create the final "sides" object that matches the target format
        final_sides_object = {}
        for direction, data in sides_data_temp.items():
            # The logic to set green lane vehicle count to 0 remains
            if data.get("light") == "green":
                data["number-of-vehicles"] = 0
            # The key in the final object is formatted as "side-PREFIX"
            final_sides_object[f"side-{direction}"] = data
        
        # Add the completed sides object to the main intersection data under the "sides" key
        intersection_data["sides"] = final_sides_object
        # --- KEY CHANGE END ---
        
        all_intersections_list.append(intersection_data)

    # --- KEY CHANGE: "intersection" key is now plural "intersections" ---
    return {
        "time": round(current_time, 2),
        "intersections": all_intersections_list
    }


# --- Main Entry Point ---
if __name__ == "__main__":
    print("Starting FastAPI server...")
    print("WebSocket endpoint will be available at ws://127.0.0.1:8000/ws")
    uvicorn.run(app, host="0.0.0.0", port=8000)