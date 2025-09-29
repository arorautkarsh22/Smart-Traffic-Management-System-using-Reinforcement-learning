import os
import sys
import traci

# Check for SUMO_HOME environment variable
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare the environment variable 'SUMO_HOME'")

def get_average_waiting_time(sumo_cfg_file, steps=50000):
    """
    Calculates the average waiting time of all vehicles in a SUMO simulation.

    Args:
        sumo_cfg_file (str): The path to the SUMO configuration file (.sumocfg).
        steps (int): The number of simulation steps to run.

    Returns:
        float: The average waiting time of all vehicles in seconds.
               Returns 0.0 if no vehicles are loaded.
    """
    
    Sumo_config = [
        'sumo-gui',
        '-c', 'C:/Users/Utkarsh/Documents/RML/RL.sumocfg',
        '--step-length', '0.10',
        '--delay', '0',
        '--lateral-resolution', '0'
    ]
    try:
        # Start the SUMO simulation with the provided configuration file.
        traci.start(Sumo_config)
        traci.gui.setSchema("View #0", "real world")
    except Exception as e:
        print(f"Error starting SUMO: {e}")
        print("Please ensure your .sumocfg file is valid and the path is correct.")
        return 0.0

    vehicle_waiting_times = {}
    vehicle_ids_seen = set()

    # Run the simulation for the specified number of steps.
    for step in range(steps):
        traci.simulationStep()
        
        # Get the IDs of all vehicles currently in the simulation.
        current_vehicle_ids = traci.vehicle.getIDList()

        # Update the accumulated waiting time for each vehicle.
        for veh_id in current_vehicle_ids:
            # Get the vehicle's accumulated waiting time since it was spawned.
            waiting_time = traci.vehicle.getAccumulatedWaitingTime(veh_id)
            vehicle_waiting_times[veh_id] = waiting_time
            vehicle_ids_seen.add(veh_id)

    # Close the TraCI connection.
    traci.close()

    # Calculate the total waiting time for all vehicles seen during the simulation.
    total_waiting_time = sum(vehicle_waiting_times.values())
    
    # Calculate the average waiting time.
    if vehicle_ids_seen:
        average_waiting_time = total_waiting_time / len(vehicle_ids_seen)
    else:
        average_waiting_time = 0.0

    return average_waiting_time

if __name__ == '__main__':
    # This is a runnable example. You will need to replace 'your_sumo_file.sumocfg' 
    # with the actual path to your SUMO configuration file.
    # A simple .sumocfg file contains references to a .rou.xml (routes) and .net.xml (network) file.
    
    # Example usage:
    sumo_config_file_path = "C:/Users/Utkarsh/Documents/RML/RL.sumocfg"

    print(f"Starting simulation and calculating average waiting time for '{sumo_config_file_path}'...")
    avg_wait_time = get_average_waiting_time(sumo_config_file_path)

    if avg_wait_time > 0.0:
        print(f"Simulation finished.")
        print(f"Average waiting time: {avg_wait_time:.2f} seconds.")
    else:
        print("Could not calculate average waiting time. Check your SUMO configuration file and simulation.")
