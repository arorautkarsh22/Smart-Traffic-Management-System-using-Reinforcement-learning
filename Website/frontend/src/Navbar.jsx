import React from 'react'
import { Link } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  return (
    <nav id='navbar'>
        <div className="navbar-left">
            <Link to="/">Home</Link>
        </div>
        <div className="navbar-right">
            <Link to="/video">Video</Link>
            <Link to="/lights">Lights</Link>
            <Link to="/data">Data</Link>
            <Link to="/analytics">Analytics</Link>
            <Link to="/dashboard">Dashboard</Link>
        </div>
    </nav>
  )
}
