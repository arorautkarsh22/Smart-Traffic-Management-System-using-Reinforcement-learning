# 🚦 Smart Traffic Management System using Reinforcement Learning

## ✨ Overview

This project implements an **Adaptive Traffic Management System (ATMS)** utilizing **Reinforcement Learning (RL)**, specifically **Q-Learning**, to dynamically optimize traffic signal timings in real-time. The system provides dynamic, adaptive control for urban congestion.

The core objective is to minimize congestion, reduce vehicle waiting times, and enhance overall urban mobility efficiency compared to traditional fixed-time or loop-detector-based signal systems.

### 🎯 Key Results

The system is designed to achieve significant performance improvements, including:
* **Reduced Travel Time** (up to 25% reported)
* **Reduced Emissions** (up to 20% reported)
* **Real-time Optimization** of traffic flow.

***

## 💡 Key Features

* **Dynamic Signal Control:** The RL agent continuously learns and adjusts traffic light phases and durations based on real-time traffic density and flow observed in the simulation.
* **Congestion Reduction:** Aims to significantly reduce average vehicle waiting time, queue length, and overall travel delay across the network.
* **Emergency Vehicle Prioritization:** Designed to detect and prioritize emergency vehicles, striving for minimal waiting time for critical transit.
* **SUMO Integration:** Leverages the robust **SUMO (Simulation of Urban MObility)** platform for accurate microscopic traffic simulation and performance evaluation.
* **Adaptive Learning:** The RL approach allows the system to adapt automatically to unpredictable traffic disruptions like accidents or roadblocks.

***

## 🛠️ Technologies Used

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Simulation** | **SUMO** (Simulation of Urban MObility) | Provides a realistic traffic environment for training and testing. |
| **Reinforcement Learning** | **Q-Learning** | Algorithm used to train the agent to select optimal signal actions. |
| **Core** | **Python 3.x** | Primary programming language for the RL logic and simulation integration (`traci`). |
| **Frontend/Hardware** | **React, Node.js, Raspberry Pi (RPi)** | Used for the web interface and hardware integration components of the system. |

***

## ⚙️ Installation

### Prerequisites

You must have the following installed on your system:

1.  **SUMO Simulation Package:** Download and install the latest version of SUMO. Ensure the necessary environment paths are set up for tools like `traci`.
2.  **Python 3.8+**

### Steps

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/arorautkarsh22/Smart-Traffic-Management-System-using-Reinforcement-learning.git](https://github.com/arorautkarsh22/Smart-Traffic-Management-System-using-Reinforcement-learning.git)
    cd Smart-Traffic-Management-System-using-Reinforcement-learning
    ```

2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```


