import React, { useState, useEffect } from 'react';
import './Lights.css';

// Custom hook for WebSocket connection
const useWebSocket = (url) => {
  const [socket, setSocket] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnectionStatus('CONNECTED');
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch {
        // Ignore invalid JSON
      }
    };

    ws.onclose = () => {
      setConnectionStatus('DISCONNECTED');
      setSocket(null);
    };

    ws.onerror = () => {
      setConnectionStatus('ERROR');
    };

    return () => {
      ws.close();
    };
  }, [url]);

  return { socket, lastMessage, connectionStatus };
};

// Individual Traffic Light Component
const TrafficLight = ({ laneNumber, status, timestamp }) => {
  const statusLower = status.toLowerCase();

  return (
    <div className={`traffic-light ${statusLower}`}>
      <h3>Lane {laneNumber}</h3>
      <div className="lights">
        {['red', 'yellow', 'green'].map(color => (
          <div
            key={color}
            className={`light ${color} ${statusLower === color ? 'active' : ''}`}
          />
        ))}
      </div>
      <div className={`status ${statusLower}`}>{status}</div>
      {timestamp && <div className="timestamp">Updated: {new Date(timestamp).toLocaleTimeString()}</div>}
    </div>
  );
};

// Info Card
const InfoCard = ({ title, value, success }) => (
  <div className={`info-card ${success ? 'success' : ''}`}>
    <div className="title">{title}</div>
    <div className="value">{value}</div>
  </div>
);

// Legend Item
const LegendItem = ({ color, label }) => (
  <div className="legend-item">
    <div className="legend-color" style={{ backgroundColor: color }} />
    <span>{label}</span>
  </div>
);

// Main Dashboard
const Lights = () => {
  const [trafficData, setTrafficData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const { lastMessage, connectionStatus } = useWebSocket('ws://localhost:3001');

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'traffic_update' && lastMessage.data) {
        const intersectionData = Array.isArray(lastMessage.data.intersection)
          ? lastMessage.data.intersection
          : [];
        setTrafficData(intersectionData);
        setLastUpdate(lastMessage.data.timestamp || new Date().toISOString());
        setIsConnected(true);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    setIsConnected(connectionStatus === 'CONNECTED');
  }, [connectionStatus]);

  const defaultTrafficData = [
    { lane: 1, status: 'RED' },
    { lane: 2, status: 'RED' },
    { lane: 3, status: 'RED' },
    { lane: 4, status: 'RED' }
  ];

  const displayData = trafficData.length > 0 ? trafficData : defaultTrafficData;

  return (
    <div className="dashboard">
      <header className="header">
        <h1 style={{margin: "0 auto"}}> Traffic Light Control System</h1>
      </header>

      <section className="intersection-section">
        <h2 style={{marginBottom: "1rem"}}>4-Way Intersection Status</h2>
        <div className="traffic-lights">
          {displayData.map(({ lane, status }, idx) => (
            <TrafficLight
              key={lane || idx}
              laneNumber={lane || idx + 1}
              status={status}
            />
          ))}
        </div>

        <div className="info-cards">
          <InfoCard title="Connection Status" value={connectionStatus} success={isConnected} />
          <InfoCard title="Active Lanes" value={displayData.filter(light => light.status !== 'RED').length} />
          <InfoCard title="Total Lanes" value={displayData.length} />
        </div>
      </section>
    </div>
  );
};

export default Lights;
