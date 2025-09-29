🚦 Smart Traffic Management System using Reinforcement Learning
✨ Overview
This project implements an Adaptive Traffic Management System (ATMS) utilizing Reinforcement Learning (RL) to dynamically optimize traffic signal timings in real-time. The primary goal is to minimize congestion, reduce vehicle waiting times, and enhance overall urban mobility efficiency compared to traditional fixed-time or loop-detector-based signal systems.

The system is developed and tested within the SUMO (Simulation of Urban MObility) environment, allowing for realistic simulation of various traffic scenarios and evaluation of the RL agent's performance. The model is trained using Deep Q-Learning (DQN) to learn optimal control policies.

💡 Key Features
Dynamic Signal Control: The RL agent continuously learns and adjusts traffic light phases and durations based on real-time traffic density and flow observed in the simulation.

Congestion Reduction: Aims to significantly reduce average vehicle waiting time, queue length, and overall travel delay across the network.

Emergency Vehicle Prioritization: Designed to detect and prioritize emergency vehicles, striving for minimal or near-zero waiting time for critical transit.

SUMO Integration: Leverages the robust SUMO platform for accurate microscopic traffic simulation and performance evaluation.

Adaptive Learning: The RL approach allows the system to adapt automatically to unpredictable traffic disruptions like accidents or roadblocks without manual intervention.

🛠️ Technologies Used
Category

Technology

Purpose

Simulation

SUMO (Simulation of Urban MObility)

Provides a realistic traffic environment for training and testing.

Core

Python 3.x

Primary programming language for the RL logic and integration.

Reinforcement Learning

Deep Q-Learning (DQN)

Algorithm used to train the agent to select optimal signal actions.

Libraries

TensorFlow/PyTorch, NumPy

Used for neural network implementation and data handling.

⚙️ Installation
To set up the project locally, you will need SUMO and the necessary Python libraries.

Prerequisites
SUMO Simulation Package: Download and install the latest version of SUMO. Ensure the necessary environment paths are set up for tools like traci.

Python 3.8+

Steps
Clone the Repository:

git clone [https://github.com/arorautkarsh22/Smart-Traffic-Management-System-using-Reinforcement-learning.git](https://github.com/arorautkarsh22/Smart-Traffic-Management-System-using-Reinforcement-learning.git)
cd Smart-Traffic-Management-System-using-Reinforcement-learning

Install Dependencies:

pip install -r requirements.txt

🚀 Usage and Simulation
Training the RL Agent
To begin training the deep Q-learning model:

python train.py --episodes <NUMBER_OF_EPISODES>

This script initiates the SUMO environment and starts the iterative training process.

Running a Trained Model
To visualize and evaluate the performance of a previously trained model:

python simulate.py --model_path <PATH_TO_SAVED_MODEL.h5> --gui

Use the --gui flag to open the SUMO-GUI window and watch the intelligent traffic signal controller in action.

📊 Performance Evaluation
Performance is assessed based on significant improvements over conventional signal control:

Reduced Waiting Time: The average waiting time for vehicles is reduced.

Queue Length: Minimization of queue buildup at intersections.

Throughput: Increased vehicle throughput across the road network.

🤝 Contributing
We welcome contributions! Please feel free to open issues to report bugs or suggest features, or submit pull requests for code improvements.
