import React, { useEffect, useState } from "react";
import "./Video.css";

export default function Video() {
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    const ws = new WebSocket("ws://10.137.79.133:8765"); // your Python WebSocket server

    ws.onopen = () => {
      console.log("✅ Connected to video WebSocket");
    };

    ws.onmessage = (event) => {
      // Server sends base64-encoded JPEG string
      setFrame("data:image/jpeg;base64," + event.data);
    };

    ws.onclose = () => {
      console.log("❌ Disconnected from video WebSocket");
    };

    return () => ws.close();
  }, []);

  return (
    <div className="video-container">
      {frame ? (
        <img
          src={frame}
          alt="Live Stream"
          className="video-feed"
          width={"500px"}
        />
      ) : (
        <p className="loading-text">Connecting to video feed...</p>
      )}
    </div>
  );
}
