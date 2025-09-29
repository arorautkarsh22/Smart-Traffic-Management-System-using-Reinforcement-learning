import React, { useState, useEffect, useRef } from 'react';

const TrafficAnalyticsDashboard = () => {
  const [trafficData, setTrafficData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connecting', 'connected', 'disconnected'
  const [selectedIntersection, setSelectedIntersection] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [alertLevel, setAlertLevel] = useState('normal');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = () => {
    try {
      setConnectionStatus('connecting');
      setError(null);
      
      console.log('Connecting to WebSocket: ws://127.0.0.1:8000/ws');
      
      const ws = new WebSocket('ws://127.0.0.1:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnectionStatus('connected');
        setLoading(false);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          console.log('WebSocket message received:', event.data);
          const data = JSON.parse(event.data);
          
          // Handle different message formats
          let processedData = data;
          
          // If the data has the structure we expect
          if (data && data.intersections && Array.isArray(data.intersections)) {
            console.log('Processing traffic data:', data);
            setTrafficData(data);
            setLastUpdated(new Date());
            setMessageCount(prev => prev + 1);
            setError(null);
          } else {
            console.warn('Unexpected data structure:', data);
            // Still try to set it in case the structure is slightly different
            setTrafficData(data);
            setLastUpdated(new Date());
            setMessageCount(prev => prev + 1);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
          console.error('Raw message:', event.data);
          setError('Error parsing WebSocket message: ' + err.message);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setConnectionStatus('disconnected');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
          // Attempt to reconnect
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          console.log(`Attempting to reconnect in ${delay}ms... (attempt ${reconnectAttempts.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          setError('Max reconnection attempts reached. Please refresh the page.');
        }
      };

    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection: ' + err.message);
      setConnectionStatus('disconnected');
      setLoading(false);
    }
  };

  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const reconnectWebSocket = () => {
    disconnectWebSocket();
    reconnectAttempts.current = 0;
    setLoading(true);
    connectWebSocket();
  };

  // Connect on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      disconnectWebSocket();
    };
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate analytics when data changes
  const analytics = React.useMemo(() => {
    if (!trafficData || !trafficData.intersections || !Array.isArray(trafficData.intersections)) {
      return {
        totalVehicles: 0,
        totalHalting: 0,
        congestionRate: 0,
        redLights: 0,
        greenLights: 0,
        activeIntersections: 0,
        alertLevel: 'normal'
      };
    }

    const intersections = trafficData.intersections;
    let totalVehicles = 0;
    let totalHalting = 0;
    let redLights = 0;
    let greenLights = 0;

    intersections.forEach((int) => {
      totalVehicles += int['total-vehicles'] || 0;
      totalHalting += int['halting-vehicles'] || 0;
      
      // Count traffic lights
      if (int.sides && typeof int.sides === 'object') {
        Object.values(int.sides).forEach(side => {
          if (side && side.light) {
            if (side.light === 'red') redLights++;
            else if (side.light === 'green') greenLights++;
          }
        });
      }
    });

    const congestionRate = totalVehicles > 0 ? (totalHalting / totalVehicles * 100) : 0;

    // Alert level logic
    let level = 'normal';
    if (congestionRate > 30) level = 'high';
    else if (congestionRate > 15) level = 'medium';

    return {
      totalVehicles,
      totalHalting,
      congestionRate: Math.round(congestionRate * 10) / 10,
      redLights,
      greenLights,
      activeIntersections: intersections.filter(i => (i['total-vehicles'] || 0) > 0).length,
      alertLevel: level
    };
  }, [trafficData]);

  // Set alert level
  useEffect(() => {
    setAlertLevel(analytics.alertLevel);
  }, [analytics.alertLevel]);

  const getStatusColor = (haltingRate) => {
    if (haltingRate === 0) return '#22C55E'; // green
    if (haltingRate < 50) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  const getLightColor = (light) => {
    return light === 'green' ? '#22C55E' : light === 'red' ? '#EF4444' : '#F59E0B';
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#22C55E';
      case 'connecting': return '#F59E0B';
      case 'disconnected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Loading state
  if (loading && !trafficData) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
        color: '#FFF',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌐</div>
          <div style={{ marginBottom: '1rem' }}>
            {connectionStatus === 'connecting' ? 'Connecting to WebSocket...' : 'Loading traffic data...'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
            WebSocket: ws://127.0.0.1:8000/ws
          </div>
          <div style={{ 
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: `${getConnectionStatusColor()}20`,
            color: getConnectionStatusColor(),
            display: 'inline-block'
          }}>
            Status: {connectionStatus.toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && connectionStatus === 'disconnected' && !trafficData) {
    return (
      <div style={{
        background: '#fff',
        color: '#000',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔌</div>
          <h2>WebSocket Connection Error</h2>
          <div style={{ marginBottom: '1rem', color: '#EF4444' }}>
            {error}
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <div>Reconnection attempts: {reconnectAttempts.current}/{maxReconnectAttempts}</div>
          </div>
          <button
            onClick={reconnectWebSocket}
            style={{
              background: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fff',
      color: '#000',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '1.5rem'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        padding: '1rem 0'
      }}>
        <div>
          <h1 style={{ 
            color: '#000', 
            fontWeight: 'bold', 
            fontSize: '1.8rem',
            margin: '0 0 0.5rem 0'
          }}>
            Traffic Analytics Dashboard - Real-Time
          </h1>
          <div style={{ color: '#94A3B8', fontSize: '0.9rem' }}>
            Simulation Time: {trafficData?.time || 0}s | Current: {currentTime}
            {lastUpdated && (
              <span style={{ marginLeft: '1rem' }}>
                Last Update: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <span style={{ marginLeft: '1rem' }}>
              Messages: {messageCount}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={reconnectWebSocket}
            style={{
              background: connectionStatus === 'connected' ? '#10B981' : '#6B7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer'
            }}
          >
            Reconnect
          </button>
          
          <div style={{
            background: alertLevel === 'high' ? '#DC2626' : alertLevel === 'medium' ? '#D97706' : '#059669',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontWeight: 'bold'
          }}>
            {alertLevel === 'high' ? 'HIGH CONGESTION' : 
             alertLevel === 'medium' ? 'MODERATE TRAFFIC' : 
             'NORMAL FLOW'}
          </div>
        </div>
      </header>

      {/* WebSocket Connection Status */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.9rem'
      }}>
        <div style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: getConnectionStatusColor()
        }} />
        <span>
          WebSocket: {connectionStatus.toUpperCase()} | ws://127.0.0.1:8000/ws
        </span>
        <span style={{ color: '#94A3B8', marginLeft: 'auto' }}>
          Real-time updates | Intersections: {trafficData?.intersections?.length || 0}
        </span>
        {error && connectionStatus === 'connected' && (
          <span style={{ color: '#EF4444', marginLeft: '1rem' }}>{error}</span>
        )}
      </div>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <MetricCard 
          title="Total Vehicles" 
          value={analytics.totalVehicles}
          subtitle="Active in network"
          color="#3B82F6"
        />
        <MetricCard 
          title="Halting Vehicles" 
          value={analytics.totalHalting}
          subtitle={`${analytics.congestionRate}% congestion rate`}
          color={analytics.congestionRate > 20 ? "#EF4444" : "#F59E0B"}
        />
        <MetricCard 
          title="Active Intersections" 
          value={analytics.activeIntersections}
          subtitle={`of ${trafficData?.intersections?.length || 0} total`}
          color="#10B981"
        />
        <MetricCard 
          title="Traffic Lights" 
          value={`${analytics.greenLights}G / ${analytics.redLights}R`}
          subtitle="Green / Red signals"
          color="#8B5CF6"
        />
      </div>

      {/* Intersection Grid */}
      {trafficData?.intersections && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {trafficData.intersections.map(intersection => {
            const totalVehicles = intersection['total-vehicles'] || 0;
            const haltingVehicles = intersection['halting-vehicles'] || 0;
            const haltingRate = totalVehicles > 0 ? (haltingVehicles / totalVehicles * 100) : 0;
            
            return (
              <IntersectionCard
                key={intersection.id}
                intersection={intersection}
                haltingRate={haltingRate}
                isSelected={selectedIntersection === intersection.id}
                onClick={() => setSelectedIntersection(
                  selectedIntersection === intersection.id ? null : intersection.id
                )}
                getStatusColor={getStatusColor}
                getLightColor={getLightColor}
              />
            );
          })}
        </div>
      )}

      {/* Detailed View */}
      {selectedIntersection && trafficData?.intersections && (
        <DetailedIntersectionView
          intersection={trafficData.intersections.find(i => i.id === selectedIntersection)}
          onClose={() => setSelectedIntersection(null)}
          getLightColor={getLightColor}
        />
      )}

      {/* System Recommendations */}
      {trafficData?.intersections && (
        <SystemRecommendations analytics={analytics} intersections={trafficData.intersections} />
      )}

      {/* No Data Message */}
      {!trafficData && connectionStatus === 'connected' && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#fff'
        }}>
          <div>Connected to WebSocket. Waiting for traffic data...</div>
        </div>
      )}
    </div>
  );
};

// Keep all the other components exactly the same (MetricCard, IntersectionCard, etc.)
const MetricCard = ({ title, value, subtitle, color }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    border: `2px solid ${color}20`,
    backdropFilter: 'blur(10px)'
  }}>
    <div style={{ fontSize: '0.9rem', color: '#94A3B8', marginBottom: '0.5rem' }}>
      {title}
    </div>
    <div style={{ 
      fontSize: '2rem', 
      fontWeight: 'bold', 
      color: color,
      marginBottom: '0.5rem'
    }}>
      {value}
    </div>
    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
      {subtitle}
    </div>
  </div>
);

const IntersectionCard = ({ 
  intersection, 
  haltingRate, 
  isSelected, 
  onClick, 
  getStatusColor,
  getLightColor 
}) => {
  const totalVehicles = intersection['total-vehicles'] || 0;
  const haltingVehicles = intersection['halting-vehicles'] || 0;
  
  return (
    <div 
      style={{
        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        border: isSelected ? '2px solid #3B82F6' : '2px solid rgba(255, 255, 255, 0.1)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        backdropFilter: 'blur(10px)'
      }}
      onClick={onClick}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
          Intersection {intersection.id}
        </h3>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(haltingRate)
        }} />
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        <div>Vehicles: {totalVehicles}</div>
        <div>Halting: {haltingVehicles} ({Math.round(haltingRate)}%)</div>
      </div>
      
      {intersection.sides && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem'
        }}>
          {Object.entries(intersection.sides).map(([sideId, sideData]) => (
            <div key={sideId} style={{
              background: getLightColor(sideData.light),
              borderRadius: '4px',
              padding: '0.3rem',
              fontSize: '0.75rem',
              textAlign: 'center',
              color: sideData.light === 'green' ? '#000' : '#FFF'
            }}>
               {sideData.time}s
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DetailedIntersectionView = ({ intersection, onClose, getLightColor }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '0.75rem',
    padding: '2rem',
    marginTop: '2rem',
    border: '2px solid rgba(59, 130, 246, 0.3)',
    backdropFilter: 'blur(10px)'
  }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem'
    }}>
      <h2>Detailed View: Intersection {intersection.id}</h2>
      <button
        onClick={onClose}
        style={{
          background: '#EF4444',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
          cursor: 'pointer'
        }}
      >
        ✕ Close
      </button>
    </div>
    
    {intersection.sides && (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {Object.entries(intersection.sides).map(([sideId, sideData]) => (
          <div key={sideId} style={{
            background: '#fff',
            borderRadius: '0.5rem',
            padding: '1rem',
            // border: `2px solid ${getLightColor(sideData.light)}`
            border: `2px solid black`
          }}>
            <h4>{sideId}</h4>
            <div>Vehicles: {sideData['number-of-vehicles'] || 0}</div>
            <div style={{ color: getLightColor(sideData.light) }}>
              Light: {sideData.light?.toUpperCase() || 'UNKNOWN'} ({sideData.time || 0}s)
            </div>
          </div>
        ))}
      </div>
    )}
    
    <div>
      <h4>Connected Roads:</h4>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {intersection.roads?.map(road => (
          <span key={road} style={{
            background: 'rgba(59, 130, 246, 0.2)',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            fontSize: '0.8rem'
          }}>
            {road}
          </span>
        )) || <span style={{ color: '#94A3B8' }}>No road data available</span>}
      </div>
    </div>
  </div>
);

const SystemRecommendations = ({ analytics, intersections }) => {
  if (!intersections || intersections.length === 0) return null;

  const busiestIntersection = intersections.reduce((max, int) => {
    const maxVehicles = max['total-vehicles'] || 0;
    const intVehicles = int['total-vehicles'] || 0;
    return intVehicles > maxVehicles ? int : max;
  });
  
  const mostCongested = intersections.reduce((max, int) => {
    const intVehicles = int['total-vehicles'] || 0;
    const intHalting = int['halting-vehicles'] || 0;
    const maxVehicles = max['total-vehicles'] || 0;
    const maxHalting = max['halting-vehicles'] || 0;
    
    const currentRate = intVehicles > 0 ? intHalting / intVehicles : 0;
    const maxRate = maxVehicles > 0 ? maxHalting / maxVehicles : 0;
    return currentRate > maxRate ? int : max;
  });

  const busiestVehicles = busiestIntersection['total-vehicles'] || 0;
  const congestedVehicles = mostCongested['total-vehicles'] || 0;
  const congestedHalting = mostCongested['halting-vehicles'] || 0;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '0.75rem',
      padding: '2rem',
      marginTop: '2rem',
      backdropFilter: 'blur(10px)'
    }}>
      <h2 style={{ marginBottom: '1rem' }}>Real-Time System Recommendations</h2>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div>Busiest Intersection: <strong>{busiestIntersection.id}</strong> ({busiestVehicles} vehicles)</div>
        <div>Most Congested: <strong>{mostCongested.id}</strong> ({congestedHalting}/{congestedVehicles} halting)</div>
        <div>System Efficiency: <strong>{(100 - analytics.congestionRate).toFixed(1)}%</strong></div>
        
        {analytics.alertLevel === 'high' && (
          <div style={{ 
            background: 'rgba(220, 38, 38, 0.2)', 
            padding: '1rem', 
            borderRadius: '0.5rem',
            border: '1px solid #DC2626'
          }}>
            <strong>HIGH CONGESTION ALERT</strong> - Consider optimizing traffic light timing and implementing adaptive signal control.
          </div>
        )}
        
        {analytics.alertLevel === 'medium' && (
          <div style={{ 
            background: 'rgba(217, 119, 6, 0.2)', 
            padding: '1rem', 
            borderRadius: '0.5rem',
            border: '1px solid #D97706'
          }}>
             <strong>MODERATE CONGESTION</strong> - Monitor closely and prepare optimization strategies.
          </div>
        )}
      </div>
    </div>
  );
};

export default TrafficAnalyticsDashboard;
