import React, { useState, useEffect, useCallback } from 'react';
import "./Analysis.css";

const TrafficAnalyticsComponent = () => {
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Simplified filter state - only date range
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    customStartDate: '',
    customEndDate: ''
  });

  // Initial data fetch
  useEffect(() => {
    fetchHistoricalData();
  }, [filters]);

  // Fetch historical data with only date filter
  const fetchHistoricalData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: 1,
        limit: 500, // Get more data for better analytics
        sort: 'latest',
      });

      // Add date filter
      if (filters.dateRange && filters.dateRange !== 'all') {
        params.append('date', filters.dateRange);
        if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
          params.append('start', filters.customStartDate);
          params.append('end', filters.customEndDate);
        }
      }

      console.log('Fetching with URL:', `http://localhost:5000/historical-data?${params.toString()}`);
      
      const response = await fetch(`http://localhost:5000/historical-data?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiResponse = await response.json();
      console.log('API Response:', apiResponse);
      
      let dataArray = apiResponse.data || [];
      
      // Filter out invalid data
      const validData = dataArray.filter(item => {
        return item && 
               item.intersections && 
               Array.isArray(item.intersections) && 
               item.intersections.length > 0;
      });

      console.log('Valid data items:', validData.length, 'out of', dataArray.length);
      
      if (validData.length === 0) {
        setAnalytics(null);
        setChartData(null);
        setHistoricalData([]);
        return;
      }
      
      setHistoricalData(validData);
      processAdvancedAnalytics(validData);
      generateAdvancedChartData(validData);
      
    } catch (err) {
      console.error('Error fetching historical data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced analytics processing with more detailed metrics
  const processAdvancedAnalytics = (data) => {
    try {
      if (!data || data.length === 0) {
        setAnalytics(null);
        return;
      }

      console.log('Processing advanced analytics for', data.length, 'snapshots');

      const timeSeriesData = data.map((snapshot, index) => {
        const intersections = snapshot.intersections || [];
        const timestamp = new Date(snapshot.createdAt || Date.now());
        
        if (!Array.isArray(intersections)) {
          return {
            timestamp,
            time: snapshot.time || 0,
            totalVehicles: 0,
            totalHalting: 0,
            intersections: [],
            hour: timestamp.getHours(),
            dayOfWeek: timestamp.getDay(),
            date: timestamp.toISOString().split('T')[0]
          };
        }

        const totalVehicles = intersections.reduce((sum, int) => sum + (int['total-vehicles'] || 0), 0);
        const totalHalting = intersections.reduce((sum, int) => sum + (int['halting-vehicles'] || 0), 0);

        return {
          timestamp,
          time: snapshot.time || 0,
          totalVehicles,
          totalHalting,
          intersections,
          hour: timestamp.getHours(),
          dayOfWeek: timestamp.getDay(),
          date: timestamp.toISOString().split('T')[0],
          congestionRate: totalVehicles > 0 ? (totalHalting / totalVehicles * 100) : 0,
          snapshotIndex: index
        };
      }).filter(item => item !== null);

      if (timeSeriesData.length === 0) {
        setAnalytics(null);
        return;
      }

      // Basic metrics
      const totalSnapshots = timeSeriesData.length;
      const avgVehicles = timeSeriesData.reduce((sum, d) => sum + d.totalVehicles, 0) / totalSnapshots;
      const avgHalting = timeSeriesData.reduce((sum, d) => sum + d.totalHalting, 0) / totalSnapshots;
      const avgCongestion = avgVehicles > 0 ? (avgHalting / avgVehicles * 100) : 0;
      const peakVehicles = Math.max(...timeSeriesData.map(d => d.totalVehicles));
      const peakSnapshot = timeSeriesData.find(d => d.totalVehicles === peakVehicles);

      // Hourly analysis
      const hourlyStats = {};
      for (let hour = 0; hour < 24; hour++) {
        const hourlyData = timeSeriesData.filter(d => d.hour === hour);
        if (hourlyData.length > 0) {
          hourlyStats[hour] = {
            avgVehicles: hourlyData.reduce((sum, d) => sum + d.totalVehicles, 0) / hourlyData.length,
            avgCongestion: hourlyData.reduce((sum, d) => sum + d.congestionRate, 0) / hourlyData.length,
            totalSnapshots: hourlyData.length,
            peakVehicles: Math.max(...hourlyData.map(d => d.totalVehicles))
          };
        }
      }

      // Daily analysis
      const dailyStats = {};
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (let day = 0; day < 7; day++) {
        const dailyData = timeSeriesData.filter(d => d.dayOfWeek === day);
        if (dailyData.length > 0) {
          dailyStats[day] = {
            name: dayNames[day],
            avgVehicles: dailyData.reduce((sum, d) => sum + d.totalVehicles, 0) / dailyData.length,
            avgCongestion: dailyData.reduce((sum, d) => sum + d.congestionRate, 0) / dailyData.length,
            totalSnapshots: dailyData.length,
            peakVehicles: Math.max(...dailyData.map(d => d.totalVehicles))
          };
        }
      }

      // Intersection detailed analysis
      const intersectionStats = {};
      const lightingStats = {
        red: { count: 0, totalTime: 0 },
        green: { count: 0, totalTime: 0 },
        yellow: { count: 0, totalTime: 0 }
      };

      timeSeriesData.forEach(snapshot => {
        if (snapshot.intersections && Array.isArray(snapshot.intersections)) {
          snapshot.intersections.forEach(int => {
            if (!int || !int.id) return;
            
            if (!intersectionStats[int.id]) {
              intersectionStats[int.id] = {
                totalVehicles: [],
                haltingVehicles: [],
                congestionRates: [],
                lightStates: { red: 0, green: 0, yellow: 0 },
                roadSides: {}
              };
            }
            
            const vehicles = int['total-vehicles'] || 0;
            const halting = int['halting-vehicles'] || 0;
            const congestionRate = vehicles > 0 ? (halting / vehicles * 100) : 0;
            
            intersectionStats[int.id].totalVehicles.push(vehicles);
            intersectionStats[int.id].haltingVehicles.push(halting);
            intersectionStats[int.id].congestionRates.push(congestionRate);

            // Analyze traffic light patterns
            if (int.sides && typeof int.sides === 'object') {
              Object.entries(int.sides).forEach(([sideId, sideData]) => {
                if (sideData && sideData.light) {
                  const light = sideData.light.toLowerCase();
                  if (lightingStats[light]) {
                    lightingStats[light].count++;
                    lightingStats[light].totalTime += (sideData.time || 0);
                  }
                  
                  intersectionStats[int.id].lightStates[light]++;
                  
                  if (!intersectionStats[int.id].roadSides[sideId]) {
                    intersectionStats[int.id].roadSides[sideId] = {
                      vehicles: [],
                      lights: { red: 0, green: 0, yellow: 0 }
                    };
                  }
                  
                  intersectionStats[int.id].roadSides[sideId].vehicles.push(sideData['number-of-vehicles'] || 0);
                  intersectionStats[int.id].roadSides[sideId].lights[light]++;
                }
              });
            }
          });
        }
      });

      // Calculate intersection analytics
      const intersectionAnalytics = Object.keys(intersectionStats).map(id => {
        const stats = intersectionStats[id];
        const roadSideAnalytics = Object.entries(stats.roadSides).map(([sideId, sideData]) => ({
          id: sideId,
          avgVehicles: sideData.vehicles.length > 0 ? sideData.vehicles.reduce((a, b) => a + b, 0) / sideData.vehicles.length : 0,
          maxVehicles: sideData.vehicles.length > 0 ? Math.max(...sideData.vehicles) : 0,
          lightDistribution: sideData.lights
        }));

        return {
          id,
          avgVehicles: stats.totalVehicles.length > 0 ? stats.totalVehicles.reduce((a, b) => a + b, 0) / stats.totalVehicles.length : 0,
          avgHalting: stats.haltingVehicles.length > 0 ? stats.haltingVehicles.reduce((a, b) => a + b, 0) / stats.haltingVehicles.length : 0,
          avgCongestion: stats.congestionRates.length > 0 ? stats.congestionRates.reduce((a, b) => a + b, 0) / stats.congestionRates.length : 0,
          maxVehicles: stats.totalVehicles.length > 0 ? Math.max(...stats.totalVehicles) : 0,
          maxCongestion: stats.congestionRates.length > 0 ? Math.max(...stats.congestionRates) : 0,
          minVehicles: stats.totalVehicles.length > 0 ? Math.min(...stats.totalVehicles) : 0,
          minCongestion: stats.congestionRates.length > 0 ? Math.min(...stats.congestionRates) : 0,
          lightDistribution: stats.lightStates,
          roadSides: roadSideAnalytics,
          efficiency: stats.congestionRates.length > 0 ? 100 - (stats.congestionRates.reduce((a, b) => a + b, 0) / stats.congestionRates.length) : 0
        };
      });

      // Traffic flow patterns
      const flowPatterns = {
        peakHours: Object.entries(hourlyStats)
          .sort(([,a], [,b]) => b.avgVehicles - a.avgVehicles)
          .slice(0, 3)
          .map(([hour, stats]) => ({ hour: parseInt(hour), ...stats })),
        offPeakHours: Object.entries(hourlyStats)
          .sort(([,a], [,b]) => a.avgVehicles - b.avgVehicles)
          .slice(0, 3)
          .map(([hour, stats]) => ({ hour: parseInt(hour), ...stats }))
      };

      // Congestion distribution
      const congestionDistribution = {
        low: timeSeriesData.filter(d => d.congestionRate < 20).length,
        medium: timeSeriesData.filter(d => d.congestionRate >= 20 && d.congestionRate < 50).length,
        high: timeSeriesData.filter(d => d.congestionRate >= 50).length
      };

      const analyticsResult = {
        summary: {
          totalSnapshots,
          avgVehicles: Math.round(avgVehicles * 10) / 10,
          avgHalting: Math.round(avgHalting * 10) / 10,
          avgCongestion: Math.round(avgCongestion * 10) / 10,
          peakVehicles,
          peakTime: peakSnapshot?.timestamp,
          dateRange: filters.dateRange,
          intersectionCount: intersectionAnalytics.length,
          systemEfficiency: Math.round((100 - avgCongestion) * 10) / 10,
          dataQuality: Math.round((totalSnapshots / (totalSnapshots + 0)) * 100) // Simple quality metric
        },
        timeSeriesData,
        intersectionAnalytics,
        hourlyStats,
        dailyStats,
        lightingStats,
        flowPatterns,
        congestionDistribution,
        trends: {
          vehicleTrend: timeSeriesData.length > 1 ? 
            ((timeSeriesData[timeSeriesData.length - 1].totalVehicles - timeSeriesData[0].totalVehicles) / timeSeriesData[0].totalVehicles * 100) : 0,
          congestionTrend: timeSeriesData.length > 1 ? 
            ((timeSeriesData[timeSeriesData.length - 1].congestionRate - timeSeriesData[0].congestionRate)) : 0
        }
      };

      console.log('Advanced analytics processed successfully:', analyticsResult);
      setAnalytics(analyticsResult);

    } catch (err) {
      console.error('Error processing analytics:', err);
      setError('Error processing analytics: ' + err.message);
    }
  };

  // Generate advanced chart data
  const generateAdvancedChartData = (data) => {
    try {
      if (!data || data.length === 0) {
        setChartData(null);
        return;
      }

      const timeSeriesData = data.map((snapshot, index) => {
        const intersections = snapshot.intersections || [];
        const timestamp = new Date(snapshot.createdAt || Date.now());
        
        const totalVehicles = Array.isArray(intersections) 
          ? intersections.reduce((sum, int) => sum + ((int && int['total-vehicles']) || 0), 0)
          : 0;
          
        const totalHalting = Array.isArray(intersections)
          ? intersections.reduce((sum, int) => sum + ((int && int['halting-vehicles']) || 0), 0)
          : 0;

        return {
          index,
          time: snapshot.time || 0,
          timestamp,
          totalVehicles,
          totalHalting,
          congestionRate: totalVehicles > 0 ? (totalHalting / totalVehicles * 100) : 0,
          hour: timestamp.getHours(),
          dayOfWeek: timestamp.getDay()
        };
      });

      // Hourly aggregation for better visualization
      const hourlyData = {};
      timeSeriesData.forEach(point => {
        if (!hourlyData[point.hour]) {
          hourlyData[point.hour] = { vehicles: [], congestion: [], count: 0 };
        }
        hourlyData[point.hour].vehicles.push(point.totalVehicles);
        hourlyData[point.hour].congestion.push(point.congestionRate);
        hourlyData[point.hour].count++;
      });

      const hourlyAverages = Object.entries(hourlyData).map(([hour, data]) => ({
        hour: parseInt(hour),
        avgVehicles: data.vehicles.reduce((a, b) => a + b, 0) / data.vehicles.length,
        avgCongestion: data.congestion.reduce((a, b) => a + b, 0) / data.congestion.length,
        maxVehicles: Math.max(...data.vehicles),
        minVehicles: Math.min(...data.vehicles)
      }));

      setChartData({
        timeSeriesData,
        hourlyAverages,
        maxVehicles: Math.max(...timeSeriesData.map(d => d.totalVehicles)),
        maxCongestion: Math.max(...timeSeriesData.map(d => d.congestionRate)),
        avgVehicles: timeSeriesData.reduce((sum, d) => sum + d.totalVehicles, 0) / timeSeriesData.length,
        avgCongestion: timeSeriesData.reduce((sum, d) => sum + d.congestionRate, 0) / timeSeriesData.length
      });

    } catch (err) {
      console.error('Error generating chart data:', err);
    }
  };

  // Filter handlers
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      dateRange: 'last7days',
      customStartDate: '',
      customEndDate: ''
    });
  };

  // Helper functions
  const getColorByValue = (value, max) => {
    if (!value || !max || max === 0) return '#6B7280';
    
    const ratio = value / max;
    if (ratio > 0.7) return '#EF4444'; // Red
    if (ratio > 0.4) return '#F59E0B'; // Yellow
    return '#22C55E'; // Green
  };

  const formatHour = (hour) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}${ampm}`;
  };

  const isCustomDateValid = () => {
    if (filters.dateRange !== 'custom') return true;
    if (!filters.customStartDate || !filters.customEndDate) return false;
    return new Date(filters.customStartDate) <= new Date(filters.customEndDate);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <div>Loading traffic analytics...</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>
            Processing insights and patterns...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">❌</div>
          <h2>Analytics Error</h2>
          <div className="error-message">{error}</div>
          <button className="retry-button" onClick={fetchHistoricalData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <h1 className="main-title">Comprehensive Traffic Analytics</h1>
      </header>

      {/* Simplified Filter Panel - Only Time Filter */}
      <div className="filter-panel">
        <h3 className="filter-title">
          Time Period Filter
        </h3>
        
        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Select Time Range</label>
            <select
              className="select-input"
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            >
              <option value="all">All Available Data</option>
              <option value="last24hours">Last 24 Hours</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div className="filter-group">
                <label className="filter-label">Start Date</label>
                <input
                  type="date"
                  className="date-input"
                  value={filters.customStartDate}
                  onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
                  max={filters.customEndDate || new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">End Date</label>
                <input
                  type="date"
                  className="date-input"
                  value={filters.customEndDate}
                  onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
                  min={filters.customStartDate}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </>
          )}

          <button className="secondary-button" onClick={clearAllFilters}>
            Reset Filter
          </button>

          <div className="status-info">
            {historicalData.length > 0 && (
              <>
                <span className="status-badge">{historicalData.length} records</span>
                <span className="status-badge">{analytics?.summary?.intersectionCount || 0} intersections</span>
                <span>Showing {filters.dateRange}</span>
              </>
            )}
          </div>
        </div>

        {filters.dateRange === 'custom' && !isCustomDateValid() && (
          <div className="validation-error">
            End date must be after start date
          </div>
        )}
      </div>

      {/* No Data Message */}
      {!loading && (!analytics || historicalData.length === 0) && (
        <div className="no-data-container">
          <h3 className="no-data-title">No Traffic Data Available</h3>
          <p className="no-data-text">
            No traffic data found for the selected time period. Try selecting a different time range or check if data is being collected.
          </p>
          <button className="primary-button" onClick={clearAllFilters}>
            Show All Data
          </button>
        </div>
      )}

      {/* Analytics Content */}
      {analytics && (
        <>
          {/* Tab Navigation */}
          <div className="tab-navigation">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'patterns', label: 'Patterns & Trends' },
              { id: 'intersections', label: 'Intersection Analysis' },
              { id: 'performance', label: 'Performance Metrics' }
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              {/* Key Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: '#3B82F6' }}>
                    {analytics.summary.totalSnapshots}
                  </div>
                  <div className="metric-label">Data Points</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: '#10B981' }}>
                    {analytics.summary.avgVehicles}
                  </div>
                  <div className="metric-label">Avg Vehicles</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ 
                    color: analytics.summary.avgCongestion > 30 ? "#EF4444" : 
                           analytics.summary.avgCongestion > 15 ? "#F59E0B" : "#22C55E" 
                  }}>
                    {analytics.summary.avgCongestion}%
                  </div>
                  <div className="metric-label">Avg Congestion</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: '#8B5CF6' }}>
                    {analytics.summary.peakVehicles}
                  </div>
                  <div className="metric-label">Peak Traffic</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: '#06B6D4' }}>
                    {analytics.summary.systemEfficiency}%
                  </div>
                  <div className="metric-label">System Efficiency</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: '#F59E0B' }}>
                    {analytics.summary.intersectionCount}
                  </div>
                  <div className="metric-label">Active Intersections</div>
                </div>
              </div>

              {/* Real-time Traffic Flow */}
              <div className="chart-container">
                <h4 className="chart-title">Traffic Flow Over Time</h4>
                <div style={{
                  height: '300px',
                  background: '#ffffff',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'end',
                  padding: '1rem',
                  gap: '1px'
                }}>
                  {chartData && chartData.timeSeriesData.map((point, index) => (
                    <div
                      key={index}
                      style={{
                        flex: 1,
                        background: `linear-gradient(to top, #3B82F6, #60A5FA)`,
                        height: `${chartData.maxVehicles > 0 ? Math.max(3, (point.totalVehicles / chartData.maxVehicles * 100)) : 3}%`,
                        borderRadius: '1px',
                        opacity: 0.8,
                        transition: 'opacity 0.2s'
                      }}
                      title={`Time: ${new Date(point.timestamp).toLocaleTimeString()}\nVehicles: ${point.totalVehicles}\nCongestion: ${point.congestionRate.toFixed(1)}%`}
                      onMouseEnter={(e) => e.target.style.opacity = 1}
                      onMouseLeave={(e) => e.target.style.opacity = 0.8}
                    />
                  ))}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#94A3B8'
                }}>
                  <span>Start: {chartData?.timeSeriesData[0]?.totalVehicles || 0} vehicles</span>
                  <span>Average: {Math.round(chartData?.avgVehicles || 0)} vehicles</span>
                  <span>Peak: {chartData?.maxVehicles || 0} vehicles</span>
                </div>
              </div>

              {/* Congestion Distribution */}
              <div className="chart-container">
                <h4 className="chart-title">Congestion Level Distribution</h4>
                <div style={{
                  display: 'flex',
                  height: '100px',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  background: 'rgba(0,0,0,0.2)'
                }}>
                  {analytics.congestionDistribution && (
                    <>
                      <div
                        style={{
                          flex: analytics.congestionDistribution.low,
                          background: '#22C55E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                        title={`Low Congestion: ${analytics.congestionDistribution.low} instances`}
                      >
                        {analytics.congestionDistribution.low > 0 && `${analytics.congestionDistribution.low}`}
                      </div>
                      <div
                        style={{
                          flex: analytics.congestionDistribution.medium,
                          background: '#F59E0B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                        title={`Medium Congestion: ${analytics.congestionDistribution.medium} instances`}
                      >
                        {analytics.congestionDistribution.medium > 0 && `${analytics.congestionDistribution.medium}`}
                      </div>
                      <div
                        style={{
                          flex: analytics.congestionDistribution.high,
                          background: '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                        title={`High Congestion: ${analytics.congestionDistribution.high} instances`}
                      >
                        {analytics.congestionDistribution.high > 0 && `${analytics.congestionDistribution.high}`}
                      </div>
                    </>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '0.5rem',
                  fontSize: '0.9rem'
                }}>
                  <span style={{ color: '#22C55E' }}>Low (&lt;20%): {analytics.congestionDistribution?.low || 0}</span>
                  <span style={{ color: '#F59E0B' }}>Medium (20-50%): {analytics.congestionDistribution?.medium || 0}</span>
                  <span style={{ color: '#EF4444' }}>High (&gt;50%): {analytics.congestionDistribution?.high || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Patterns & Trends Tab */}
          {activeTab === 'patterns' && (
            <div>
              <div className="chart-grid">
                {/* Hourly Traffic Patterns */}
                <div className="chart-container">
                  <h4 className="chart-title">24-Hour Traffic Pattern</h4>
                  <div style={{
                    height: '200px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'end',
                    padding: '1rem',
                    gap: '2px'
                  }}>
                    {chartData && chartData.hourlyAverages && chartData.hourlyAverages.map((hour, index) => (
                      <div
                        key={index}
                        style={{
                          flex: 1,
                          background: getColorByValue(hour.avgVehicles, Math.max(...chartData.hourlyAverages.map(h => h.avgVehicles))),
                          height: `${Math.max(5, (hour.avgVehicles / Math.max(...chartData.hourlyAverages.map(h => h.avgVehicles)) * 100))}%`,
                          borderRadius: '2px',
                          opacity: 0.8
                        }}
                        title={`${formatHour(hour.hour)}: ${hour.avgVehicles.toFixed(1)} avg vehicles`}
                      />
                    ))}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.5rem',
                    fontSize: '0.7rem',
                    color: '#94A3B8'
                  }}>
                    <span>12AM</span>
                    <span>6AM</span>
                    <span>12PM</span>
                    <span>6PM</span>
                    <span>12AM</span>
                  </div>
                </div>

                {/* Peak Hours Analysis */}
                <div className="chart-container">
                  <h4 className="chart-title">Peak vs Off-Peak Hours</h4>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div>
                      <h5 style={{ color: '#EF4444', marginBottom: '0.5rem' }}>Peak Hours</h5>
                      {analytics.flowPatterns?.peakHours.map((hour, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          borderRadius: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span>{formatHour(hour.hour)}</span>
                          <span>{hour.avgVehicles.toFixed(1)} vehicles</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h5 style={{ color: '#22C55E', marginBottom: '0.5rem' }}>Off-Peak Hours</h5>
                      {analytics.flowPatterns?.offPeakHours.map((hour, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span>{formatHour(hour.hour)}</span>
                          <span>{hour.avgVehicles.toFixed(1)} vehicles</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Weekly Pattern */}
                <div className="chart-container">
                  <h4 className="chart-title">Weekly Traffic Pattern</h4>
                  <div style={{
                    height: '150px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'end',
                    padding: '1rem',
                    gap: '5px'
                  }}>
                    {analytics.dailyStats && Object.values(analytics.dailyStats).map((day, index) => (
                      <div
                        key={index}
                        style={{
                          flex: 1,
                          background: `linear-gradient(to top, #8B5CF6, #A78BFA)`,
                          height: `${day.avgVehicles > 0 ? Math.max(10, (day.avgVehicles / Math.max(...Object.values(analytics.dailyStats).map(d => d.avgVehicles)) * 100)) : 10}%`,
                          borderRadius: '3px',
                          opacity: 0.8,
                          display: 'flex',
                          alignItems: 'end',
                          justifyContent: 'center',
                          paddingBottom: '0.5rem',
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: 'bold'
                        }}
                        title={`${day.name}: ${day.avgVehicles.toFixed(1)} avg vehicles`}
                      >
                        {day.name.slice(0, 3)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Traffic Light Analysis */}
                <div className="chart-container">
                  <h4 className="chart-title">Traffic Light Distribution</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {analytics.lightingStats && Object.entries(analytics.lightingStats).map(([light, stats]) => (
                      <div key={light} style={{
                        background: light === 'red' ? 'rgba(239, 68, 68, 0.2)' : 
                                   light === 'green' ? 'rgba(34, 197, 94, 0.2)' : 
                                   'rgba(245, 158, 11, 0.2)',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          fontSize: '2rem',
                          fontWeight: 'bold',
                          color: light === 'red' ? '#EF4444' : 
                                 light === 'green' ? '#22C55E' : '#F59E0B',
                          marginBottom: '0.5rem'
                        }}>
                          {stats.count}
                        </div>
                        <div style={{ textTransform: 'capitalize', color: '#94A3B8' }}>
                          {light} Lights
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          Avg: {stats.count > 0 ? (stats.totalTime / stats.count).toFixed(1) : 0}s
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trend Indicators */}
              <div className="chart-container">
                <h4 className="chart-title">Traffic Trends</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div style={{
                    padding: '1.5rem',
                    background: analytics.trends?.vehicleTrend >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '0.5rem',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '2rem',
                      color: analytics.trends?.vehicleTrend >= 0 ? '#22C55E' : '#EF4444',
                      marginBottom: '0.5rem'
                    }}>
                      {analytics.trends?.vehicleTrend >= 0 ? '📈' : '📉'}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {analytics.trends?.vehicleTrend.toFixed(1)}%
                    </div>
                    <div style={{ color: '#94A3B8' }}>Vehicle Trend</div>
                  </div>
                  <div style={{
                    padding: '1.5rem',
                    background: analytics.trends?.congestionTrend <= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '0.5rem',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '2rem',
                      color: analytics.trends?.congestionTrend <= 0 ? '#22C55E' : '#EF4444',
                      marginBottom: '0.5rem'
                    }}>
                      {analytics.trends?.congestionTrend <= 0 ? '📉' : '📈'}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {analytics.trends?.congestionTrend.toFixed(1)}%
                    </div>
                    <div style={{ color: '#94A3B8' }}>Congestion Trend</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Intersection Analysis Tab */}
          {activeTab === 'intersections' && analytics.intersectionAnalytics && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '2rem'
              }}>
                {analytics.intersectionAnalytics.map(intersection => (
                  <div key={intersection.id} className="chart-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h4>Intersection {intersection.id}</h4>
                      <span style={{
                        background: intersection.avgCongestion < 20 ? '#22C55E' : intersection.avgCongestion < 50 ? '#F59E0B' : '#EF4444',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                      }}>
                        {intersection.avgCongestion < 20 ? 'EXCELLENT' : intersection.avgCongestion < 50 ? 'MODERATE' : 'NEEDS ATTENTION'}
                      </span>
                    </div>
                    
                    {/* Detailed Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3B82F6' }}>
                          {intersection.avgVehicles.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Avg Vehicles</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#F59E0B' }}>
                          {intersection.avgHalting.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Avg Halting</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8B5CF6' }}>
                          {intersection.maxVehicles}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Peak Vehicles</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#06B6D4' }}>
                          {intersection.efficiency.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Efficiency</div>
                      </div>
                    </div>

                    {/* Range Indicators */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>Vehicle Range</span>
                        <span style={{ fontSize: '0.9rem', color: '#94A3B8' }}>
                          {intersection.minVehicles} - {intersection.maxVehicles}
                        </span>
                      </div>
                      <div style={{
                        height: '8px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '4px',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          position: 'absolute',
                          left: `${intersection.minVehicles / intersection.maxVehicles * 100}%`,
                          right: '0',
                          height: '100%',
                          background: 'linear-gradient(to right, #22C55E, #3B82F6)',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>

                    {/* Road Side Analysis */}
                    {intersection.roadSides && intersection.roadSides.length > 0 && (
                      <div>
                        <h5 style={{ marginBottom: '1rem', color: '#94A3B8' }}>Road Side Breakdown</h5>
                        {intersection.roadSides.map((side, index) => (
                          <div key={side.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '0.5rem',
                            marginBottom: '0.5rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <span style={{ fontWeight: '500' }}>
                              Road {side.id.replace('side-', '')}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span style={{ fontSize: '0.9rem' }}>
                                {side.avgVehicles.toFixed(1)} avg
                              </span>
                              <span style={{ fontSize: '0.9rem', color: '#94A3B8' }}>
                                {side.maxVehicles} peak
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Performance Bar */}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Overall Performance</span>
                        <span>{intersection.efficiency.toFixed(1)}%</span>
                      </div>
                      <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '1rem',
                        height: '15px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.max(0, intersection.efficiency)}%`,
                          height: '100%',
                          background: intersection.efficiency > 80 ? 'linear-gradient(to right, #22C55E, #16A34A)' : 
                                     intersection.efficiency > 60 ? 'linear-gradient(to right, #F59E0B, #D97706)' : 
                                     'linear-gradient(to right, #EF4444, #DC2626)',
                          borderRadius: '1rem',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Metrics Tab */}
          {activeTab === 'performance' && (
            <div>
              <div className="chart-grid">
                {/* System Health Overview */}
                <div className="chart-container">
                  <h4 className="chart-title">System Health Metrics</h4>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '0.5rem'
                    }}>
                      <span>System Efficiency</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3B82F6' }}>
                        {analytics.summary.systemEfficiency}%
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '0.5rem'
                    }}>
                      <span>Data Quality</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10B981' }}>
                        {analytics.summary.dataQuality}%
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: 'rgba(139, 92, 246, 0.1)',
                      borderRadius: '0.5rem'
                    }}>
                      <span>Active Monitoring</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#8B5CF6' }}>
                        {analytics.summary.intersectionCount} Intersections
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Rankings */}
                <div className="chart-container">
                  <h4 className="chart-title">Intersection Performance Ranking</h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {analytics.intersectionAnalytics
                      .sort((a, b) => b.efficiency - a.efficiency)
                      .map((intersection, index) => (
                        <div key={intersection.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem',
                          marginBottom: '0.5rem',
                          background: index < 3 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '0.5rem',
                          border: index < 3 ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ 
                              fontSize: '1.2rem',
                              color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#94A3B8'
                            }}>
                            </span>
                            <span style={{ fontWeight: '500' }}>Intersection {intersection.id}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold', color: getColorByValue(intersection.efficiency, 100) }}>
                              {intersection.efficiency.toFixed(1)}%
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                              {intersection.avgVehicles.toFixed(1)} avg vehicles
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Detailed Performance Analysis */}
              <div className="chart-container">
                <h4 className="chart-title">Performance Analysis & Recommendations</h4>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {analytics.summary.avgCongestion > 40 && (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid #EF4444',
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span>🚨</span>
                        <strong style={{ color: '#EF4444' }}>Critical: High System Congestion</strong>
                      </div>
                      <p style={{ margin: 0, color: '#94A3B8' }}>
                        Average congestion rate is {analytics.summary.avgCongestion.toFixed(1)}%. 
                        Consider implementing adaptive traffic light control and optimizing signal timing.
                      </p>
                    </div>
                  )}
                  
                  {analytics.intersectionAnalytics.some(int => int.maxCongestion > 80) && (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid #F59E0B',
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span>⚠️</span>
                        <strong style={{ color: '#F59E0B' }}>Warning: Intersection Bottlenecks</strong>
                      </div>
                      <p style={{ margin: 0, color: '#94A3B8' }}>
                        Some intersections show peak congestion above 80%. Review traffic light timing and consider 
                        infrastructure improvements for these hotspots.
                      </p>
                    </div>
                  )}

                  {analytics.flowPatterns?.peakHours && (
                    <div style={{
                      padding: '1rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid #3B82F6',
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#3B82F6' }}>Optimization Opportunity</strong>
                      </div>
                      <p style={{ margin: 0, color: '#94A3B8' }}>
                        Peak hours identified: {analytics.flowPatterns.peakHours.map(h => formatHour(h.hour)).join(', ')}. 
                        Consider implementing dynamic scheduling and predictive traffic management during these periods.
                      </p>
                    </div>
                  )}

                  <div style={{
                    padding: '1rem',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid #22C55E',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#22C55E' }}>System Status</strong>
                    </div>
                    <p style={{ margin: 0, color: '#94A3B8' }}>
                      Monitoring {analytics.summary.intersectionCount} intersections with {analytics.summary.totalSnapshots} data points. 
                      System efficiency: {analytics.summary.systemEfficiency}%. Continue monitoring for optimal performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Summary Card Component remains the same
const SummaryCard = ({ title, value, subtitle, color }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '1rem',
    padding: '2rem',
    border: `2px solid ${color}20`,
    backdropFilter: 'blur(10px)'
  }}>
    <div style={{ fontSize: '0.9rem', color: '#94A3B8', marginBottom: '0.5rem' }}>
      {title}
    </div>
    <div style={{ 
      fontSize: '2.5rem', 
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

export default TrafficAnalyticsComponent;
