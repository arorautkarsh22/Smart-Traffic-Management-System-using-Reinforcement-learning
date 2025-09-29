import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import "./App.css"
import Video from "./Video";
import Navbar from "./Navbar";
import Home from "./Home";
import Data from "./Data";
import Lights from "./Lights";
import Alerts from "./Alerts";
import Dashboard from "./Dashboard";
import TrafficAnalyticsComponent from "./Analysis";

export default function App() {
    return (
        <Router>
            <Navbar />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/video" element={<Video />} />
                <Route path="/data" element={<Data />} />
                <Route path="/lights" element={<Lights />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analytics" element={<TrafficAnalyticsComponent />} />
            </Routes>
        </Router>
    );
}
