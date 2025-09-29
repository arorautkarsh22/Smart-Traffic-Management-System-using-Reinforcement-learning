import os
import sys 
import random
import numpy as np
import matplotlib.pyplot as plt
import traci
import json
import ast # To safely convert string keys back to tuples

# Step 2: Establish path to SUMO (SUMO_HOME)
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare environment variable 'SUMO_HOME'")


# Step 3: Define Sumo configuration
Sumo_config = [
    'sumo-gui',
    '-c', 'C:/Users/Utkarsh/Documents/RML/RL.sumocfg',
    '--step-length', '0.10',
    '--delay', '0',
    '--lateral-resolution', '0'
]

# Step 4: Open connection between SUMO and Traci
traci.start(Sumo_config)
traci.gui.setSchema("View #0", "real world")

# -------------------------
# Step 5: Define Variables
# -------------------------

# Variables for RL State (queue lengths from detectors and current phase)
q_EB = {}
q_SB = {}
q_WB = {}
current_phase = 0

# ---- Reinforcement Learning Hyperparameters ----
TOTAL_STEPS = 50000 # The total number of simulation steps for continuous (online) training.

ALPHA = 0.1 # Learning rate (α) between[0, 1]
GAMMA = 0.9 # Discount factor (γ) between[0, 1]
EPSILON = 0.1  # Exploration rate (ε) between[0, 1]

ACTIONS = [0, 1]# The discrete action space (0 = keep phase, 1 = switch phase)

# Q-table dictionary: key = state tuple, value = numpy array of Q-values for each action
Q_table = {}

# ---- Additional Stability Parameters ----
MIN_GREEN_STEPS = 100
last_switch_step = -MIN_GREEN_STEPS

# ----------------------------------------------------
# New Logic: Load or initialize Q-table
# ----------------------------------------------------
Q_TABLE_FILE = 'q_table.txt'
if os.path.exists(Q_TABLE_FILE):
    try:
        with open(Q_TABLE_FILE, 'r') as f:
            Q_table_serializable = json.load(f)
            # Convert string keys back to tuples and lists back to numpy arrays
            Q_table = {ast.literal_eval(k): np.array(v) for k, v in Q_table_serializable.items()}
        print(f"\nLoaded existing Q-table from {Q_TABLE_FILE}. Size: {len(Q_table)}")
    except (IOError, json.JSONDecodeError) as e:
        print(f"\nError loading Q-table file: {e}. Starting with an empty Q-table.")
        Q_table = {}
else:
    print(f"\n{Q_TABLE_FILE} not found. Starting with an empty Q-table.")
    Q_table = {}

# -------------------------
# Step 6: Define Functions
# -------------------------
def get_max_Q_value_of_state(s):
    """
    Retrieves the maximum Q-value for a given state from the Q-table.
    Initializes a new entry if the state is not found.
    """
    if s not in Q_table:
        Q_table[s] = np.zeros(len(ACTIONS))
    return np.max(Q_table[s])

def get_reward(state):
    """
    Calculates the reward based on the total queue length.
    A negative reward encourages the agent to minimize vehicle queues.
    """
    # The state tuple is now (current_phase, q_EB_0, q_EB_1, q_EB_2, ...)
    # Summing up all queue length variables
    total_queue = sum(state[1:])
    reward = -float(total_queue)
    return reward

def get_state():
    """
    Retrieves the current state of the simulation from SUMO.
    The state is a tuple of the current phase and the queue lengths
    for all lanes.
    """
    global q_EB, q_SB, q_WB, q_NB, current_phase
    
    # Detector IDs
    detector_ids = {
        'EB': ["Node1_2_EB_0", "Node1_2_EB_1", "Node1_2_EB_2"],
        'SB': ["Node2_7_SB_0", "Node2_7_SB_1", "Node2_7_SB_2"],
        'WB': ["Node2_3_WB_0", "Node2_3_WB_1", "Node2_3_WB_2"],
        'NB': ["Node2_5_NB_0", "Node2_5_NB_1", "Node2_5_NB_2"] # Example NB detectors
    }
    
    # Traffic light ID
    traffic_light_id = "Node2"
    
    # Get queue lengths from each detector and store in dictionaries
    q_EB = {det_id: get_queue_length(det_id) for det_id in detector_ids['EB']}
    q_SB = {det_id: get_queue_length(det_id) for det_id in detector_ids['SB']}
    q_WB = {det_id: get_queue_length(det_id) for det_id in detector_ids['WB']}
    q_NB = {det_id: get_queue_length(det_id) for det_id in detector_ids['NB']}
    # Get current phase index
    current_phase = get_current_phase(traffic_light_id)
    
    # Return a single tuple containing all queue lengths and the current phase
    return (current_phase, sum(q_EB.values()), sum(q_SB.values()), sum(q_WB.values()), sum(q_NB.values()))

def apply_action(action, tls_id="Node2"):
    """
    Executes the chosen action on the traffic light.
    Action 0: Keep the current phase.
    Action 1: Switch to the next phase, respecting the minimum green time.
    """
    global last_switch_step
    
    if action == 0:
        # Do nothing (keep current phase)
        return
    
    elif action == 1:
        # Check if minimum green time has passed before switching
        if current_simulation_step - last_switch_step >= MIN_GREEN_STEPS:
            program = traci.trafficlight.getAllProgramLogics(tls_id)[0]
            num_phases = len(program.phases)
            next_phase = (get_current_phase(tls_id) + 1) % num_phases
            traci.trafficlight.setPhase(tls_id, next_phase)
            last_switch_step = current_simulation_step

def update_Q_table(old_state, action, reward, new_state):
    """
    Updates the Q-table using the Q-learning algorithm.
    It applies the Bellman equation to learn the optimal policy.
    """
    if old_state not in Q_table:
        Q_table[old_state] = np.zeros(len(ACTIONS))
    
    # 1) Predict current Q-values from old_state (current state)
    old_q = Q_table[old_state][action]
    # 2) Predict Q-values for new_state to get max future Q (new state)
    best_future_q = get_max_Q_value_of_state(new_state)
    # 3) Incorporate ALPHA to partially update the Q-value and update Q table
    Q_table[old_state][action] = old_q + ALPHA * (reward + GAMMA * best_future_q - old_q)

def get_action_from_policy(state):
    """
    Chooses an action based on the epsilon-greedy policy.
    With probability epsilon, a random action is chosen (exploration).
    Otherwise, the action with the highest Q-value is chosen (exploitation).
    """
    if random.random() < EPSILON:
        return random.choice(ACTIONS)
    else:
        if state not in Q_table:
            Q_table[state] = np.zeros(len(ACTIONS))
        return int(np.argmax(Q_table[state]))

def get_queue_length(detector_id):
    """
    Fetches the number of vehicles currently on the lane
    area detector that have a speed of less than 0.1 m/s.
    """
    return traci.lanearea.getLastStepVehicleNumber(detector_id)

def get_current_phase(tls_id):
    """
    Returns the index of the current traffic light phase.
    """
    return traci.trafficlight.getPhase(tls_id)


# -------------------------
# Step 7: Fully Online Continuous Learning Loop
# -------------------------

# Lists to record data for plotting
step_history = []
reward_history = []
queue_history = []
wait_time_history = []
vehicle_wait_times = {}

cumulative_reward = 0.0

print("\n=== Starting Fully Online Continuous Learning ===")
for step in range(TOTAL_STEPS):
    current_simulation_step = step
    
    state = get_state()
    action = get_action_from_policy(state)
    apply_action(action)
    
    traci.simulationStep() # Advance simulation by one step
    
    new_state = get_state()
    reward = get_reward(new_state)
    cumulative_reward += reward
    
    update_Q_table(state, action, reward, new_state)
    
    # Update and calculate average wait time
    vehicle_ids = traci.vehicle.getIDList()
    
    # Update waiting times for all vehicles in the simulation
    for veh_id in vehicle_ids:
        vehicle_wait_times[veh_id] = traci.vehicle.getWaitingTime(veh_id)
        
    avg_wait_time = None
    if vehicle_wait_times:
        valid_wait_times = [t for t in vehicle_wait_times.values() if t > 0]
        if valid_wait_times:
            avg_wait_time = sum(valid_wait_times) / len(valid_wait_times)

    # Print Q-values for the old_state right after update
    updated_q_vals = Q_table.get(state, np.zeros(len(ACTIONS)))

    # Record data every 100 steps
    if step % 1 == 0:
        # Sum the queue lengths for each direction
        total_q_EB = new_state[1]
        total_q_SB = new_state[2]
        total_q_WB = new_state[3]
        total_q_NB = new_state[4]
        #print(f"Step {step}, Current_Phase: {new_state[0]}, Total_Queue_EB: {total_q_EB}, Total_Queue_SB: {total_q_SB}, Total_Queue_WB: {total_q_WB}, Total_Queue_NB: {total_q_NB}, Reward: {reward:.2f}, Cumulative Reward: {cumulative_reward:.2f}")
        
        step_history.append(step)
        reward_history.append(cumulative_reward)
        queue_history.append(sum(new_state[1:])) # sum of all queue lengths
        if avg_wait_time is not None:
            wait_time_history.append(avg_wait_time)
        #print("Current Q-table:")
        # for st, qvals in Q_table.items(): 
        #     print(f"   {st} -> {qvals}")
      
# -------------------------
# Step 8: Close connection between SUMO and Traci
# -------------------------
traci.close()

# Print final Q-table info
print("\nOnline Training completed. Final Q-table size:", len(Q_table))
for st, actions in Q_table.items():
    print("State:", st, "-> Q-values:", actions)
    
if wait_time_history:
    final_avg_wait_time = sum(wait_time_history) / len(wait_time_history)
    print(f"\nAverage waiting time during the simulation: {final_avg_wait_time:.2f} seconds")

# -------------------------
# Step 9: Save the Q-table to a text file
# -------------------------
# The keys of the dictionary must be strings for JSON serialization, so we convert them.
# The values are numpy arrays, which also need to be converted to lists.
Q_table_serializable = {str(k): v.tolist() for k, v in Q_table.items()}

with open(Q_TABLE_FILE, 'w') as f:
    json.dump(Q_table_serializable, f, indent=4)

print(f"\nQ-table has been saved to {Q_TABLE_FILE}")

# -------------------------
# Visualization of Results
# -------------------------

# # Plot Cumulative Reward over Simulation Steps
# plt.figure(figsize=(10, 6))
# plt.plot(step_history, reward_history, marker='o', linestyle='-', label="Cumulative Reward")
# plt.xlabel("Simulation Step")
# plt.ylabel("Cumulative Reward")
# plt.title("RL Training: Cumulative Reward over Steps")
# plt.legend()
# plt.grid(True)
# plt.show()

# # Plot Total Queue Length over Simulation Steps
# plt.figure(figsize=(10, 6))
# plt.plot(step_history, queue_history, marker='o', linestyle='-', label="Total Queue Length")
# plt.xlabel("Simulation Step")
# plt.ylabel("Total Queue Length")
# plt.title("RL Training: Queue Length over Steps")
# plt.legend()
# plt.grid(True)
# plt.show()

# # Plot Average Wait Time over Simulation Steps
# if wait_time_history:
#     plt.figure(figsize=(10, 6))
#     plt.plot(step_history, wait_time_history, marker='o', linestyle='-', label="Average Wait Time")
#     plt.xlabel("Simulation Step")
#     plt.ylabel("Average Wait Time (s)")
#     plt.title("RL Training: Average Wait Time over Steps")
#     plt.legend()
#     plt.grid(True)
#     plt.show()
