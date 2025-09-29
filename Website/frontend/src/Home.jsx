import React from 'react';
import { Link } from 'react-router-dom';
import "./Home.css";

const HomeComponent = () => {
  const features = [
    {
      title: 'Real-Time Analytics',
      description: 'Monitor traffic patterns and congestion levels in real-time with comprehensive data visualization and interactive charts.',
      highlights: ['Live traffic monitoring', 'Real-time alerts']
    },
    {
      title: 'Intersection Management',
      description: 'Advanced intersection monitoring with detailed analysis of vehicle counts, traffic light timing, and flow optimization.',
      highlights: ['Multi-intersection tracking', 'Traffic lights real-time updations']
    },
    {
      title: 'Historical Data Analysis',
      description: 'Comprehensive historical traffic data with trend analysis, peak hour identification, and performance tracking.',
      highlights: ['Data for analysis', 'Publicly avaliable']
    },
    {
      title: 'Performance Insights',
      description: 'Detailed performance metrics and efficiency scoring to identify bottlenecks and optimization opportunities.',
      highlights: ['Traffic density detection', 'Traffic cognetion indication']
    },
    {
      // icon: '📱',
      title: 'Modern Interface',
      description: 'Clean, responsive web interface with intuitive navigation and professional data visualization.',
      highlights: ['Better UI/UX', 'Cross-platform compatibility']
    },
    {
      title: 'High Performance',
      description: 'Fast data processing and visualization with real-time updates and efficient data handling.',
      highlights: ['Real-time updates', 'Data handling']
    }
  ];

  const stats = [
    { number: '100+', label: 'Data Points per Hour' },
    { number: '24/7', label: 'Continuous Monitoring' },
    { number: '5+', label: 'Analysis Metrics' },
    { number: '∞', label: 'Scalable Intersections' }
  ];

  return (
    <div style={{
      background: '#ffffff',
      color: '#F8FAFC',
      minHeight: '100vh',
      fontFamily: "'Inter', 'system-ui', '-apple-system', sans-serif"
    }}>
      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">
          Smart Traffic Management System
        </h1>
        <p className="hero-subtitle">
          Advanced analytics and monitoring for intelligent traffic control
        </p>
        <p className="hero-description">
          A comprehensive traffic management solution featuring real-time monitoring, 
          historical analysis, and performance optimization tools. Built for modern 
          traffic control systems with advanced data visualization capabilities.
        </p>
        
        <div className="cta-buttons">
          <Link to="/analytics" className="primary-btn">
            View Analytics
          </Link>
          <Link to="/data" className="secondary-btn">
            Historical Data
          </Link>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-number">{stat.number}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">System Features</h2>
        <p className="section-subtitle">
          Comprehensive tools for traffic monitoring, analysis, and optimization
        </p>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <span className="feature-icon">{feature.icon}</span>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <div className="feature-highlights">
                {feature.highlights.map((highlight, i) => (
                  <span key={i} className="highlight-tag">{highlight}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="tech-section">
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 className="section-title">Built With Modern Technology</h2>
          <p className="section-subtitle">
            Powered by cutting-edge web technologies for optimal performance
          </p>
        </div>
        
        <div className="tech-grid">
          <div className="tech-item">
            <div className="tech-icon"><img src="./react_svgrepo.svg" width="50px" /></div>
            <h4 style={{ color: '#F8FAFC', marginBottom: '0.5rem' }}>React</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Modern frontend framework</p>
          </div>
          <div className="tech-item">
            <div className="tech-icon"><img src="./nodejs-svgrepo-com.svg" width="50px" /></div>
            <h4 style={{ color: '#F8FAFC', marginBottom: '0.5rem' }}>Node.js</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Powerful backend server</p>
          </div>
          <div className="tech-item">
            <div className="tech-icon">🍃</div>
            <h4 style={{ color: '#F8FAFC', marginBottom: '0.5rem' }}>MongoDB</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Flexible data storage</p>
          </div>
          <div className="tech-item">
            <div className="tech-icon">🔄</div>
            <h4 style={{ color: '#F8FAFC', marginBottom: '0.5rem' }}>WebSocket</h4>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Real-time communication</p>
          </div>
        </div>
      </section>

      {/* Call to Action Footer */}
      <footer className="footer-section">
        <h3 className="footer-title">Start Monitoring Traffic</h3>
        <p className="footer-description">
          Experience the power of advanced traffic analytics and intelligent monitoring 
          with our comprehensive dashboard system.
        </p>
        <div className="cta-buttons">
          <Link to="/analytics" className="primary-btn">
            Continue
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default HomeComponent;
