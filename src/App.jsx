/**
 * PixelCouple — App.jsx
 *
 * Single-file React app.  Clean pixel-art aesthetic with a dark theme.
 *
 * Screens:
 *   1. RoleScreen   — pick "Boyfriend" or "Girlfriend" once (stored in localStorage)
 *   2. MainApp      — two tabs:
 *        • PartnerView   — live animated GIF + status of the OTHER partner
 *        • MyController  — grid of status buttons to update YOUR own status
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";

// ─── 🔧 CONFIG — swap BACKEND_URL to your Render.com URL before deploying ───
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// ─── Status definitions ───────────────────────────────────────────────────────
// gif_url: hosted on Imgur / ImageKit / any CDN.
// Replace these placeholder GIFs with your actual pixel-art GIF URLs.
const STATUSES = [
  {
    key: "chilling",
    label: "Chilling",
    emoji: "🛋️",
    location: "Home",
    gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    color: "#7C5CBF",
  },
  {
    key: "working",
    label: "Working",
    emoji: "💻",
    location: "Work / Study",
    gif_url: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif",
    color: "#3B82F6",
  },
  {
    key: "gym",
    label: "Gym",
    emoji: "🏋️",
    location: "Gym",
    gif_url: "https://media.giphy.com/media/3oEjI105rmEC22CJFK/giphy.gif",
    color: "#EF4444",
  },
  {
    key: "driving",
    label: "Driving",
    emoji: "🚗",
    location: "On the road",
    gif_url: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif",
    color: "#F59E0B",
  },
  {
    key: "eating",
    label: "Eating",
    emoji: "🍜",
    location: "Home",
    gif_url: "https://media.giphy.com/media/WoWm8YzFQJg28/giphy.gif",
    color: "#10B981",
  },
  {
    key: "sleeping",
    label: "Sleeping",
    emoji: "🌙",
    location: "Home",
    gif_url: "https://media.giphy.com/media/ftAyb0CG1FNAIZt4SO/giphy.gif",
    color: "#6366F1",
  },
  {
    key: "out",
    label: "Out & About",
    emoji: "🚶",
    location: "Outside",
    gif_url: "https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif",
    color: "#14B8A6",
  },
  {
    key: "gaming",
    label: "Gaming",
    emoji: "🎮",
    location: "Home",
    gif_url: "https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif",
    color: "#8B5CF6",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(isoString) {
  if (!isoString) return "just now";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── RoleScreen ───────────────────────────────────────────────────────────────
function RoleScreen({ onSelect }) {
  return (
    <div className="role-screen">
      <div className="role-inner">
        <div className="pixel-heart">❤️</div>
        <h1 className="app-title">PixelCouple</h1>
        <p className="role-sub">Who are you?</p>
        <div className="role-buttons">
          <button className="role-btn" onClick={() => onSelect("user_1")}>
            <span className="role-emoji">👦</span>
            <span>Boyfriend</span>
          </button>
          <button className="role-btn" onClick={() => onSelect("user_2")}>
            <span className="role-emoji">👧</span>
            <span>Girlfriend</span>
          </button>
        </div>
        <p className="role-note">Only need to pick this once.</p>
      </div>
    </div>
  );
}

// ─── PartnerView ──────────────────────────────────────────────────────────────
function PartnerView({ partnerData }) {
  const [tick, setTick] = useState(0);

  // Refresh the "X ago" timestamp every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!partnerData) {
    return (
      <div className="partner-loading">
        <div className="pulse-dot" />
        <p>Waiting for partner…</p>
      </div>
    );
  }

  return (
    <div className="partner-view">
      <p className="partner-name">{partnerData.name}</p>

      <div className="gif-frame">
        {partnerData.gif_url ? (
          <img
            src={partnerData.gif_url}
            alt={partnerData.status}
            className="partner-gif"
          />
        ) : (
          <div className="gif-placeholder">🎮</div>
        )}
        <div className="gif-glow" />
      </div>

      <div className="status-pill">{partnerData.status}</div>

      <div className="meta-row">
        <span className="meta-item">
          📍 {partnerData.location}
        </span>
        <span className="meta-sep">·</span>
        <span className="meta-item">
          🕐 {timeAgo(partnerData.updated_at)}
        </span>
      </div>
    </div>
  );
}

// ─── MyController ─────────────────────────────────────────────────────────────
function MyController({ myData, onUpdate, isSending }) {
  const activeKey = STATUSES.find((s) => s.label === myData?.status)?.key;

  return (
    <div className="controller">
      <p className="controller-title">Your Status</p>
      <p className="controller-sub">
        Currently: <strong>{myData?.status || "—"}</strong>
      </p>
      <div className="status-grid">
        {STATUSES.map((s) => {
          const isActive = s.key === activeKey;
          return (
            <button
              key={s.key}
              className={`status-btn ${isActive ? "status-btn--active" : ""}`}
              style={{ "--accent": s.color }}
              onClick={() => onUpdate(s)}
              disabled={isSending}
            >
              <span className="status-btn-emoji">{s.emoji}</span>
              <span className="status-btn-label">{s.label}</span>
              {isActive && <div className="active-ring" />}
            </button>
          );
        })}
      </div>
      {isSending && <p className="sending-text">Sending…</p>}
    </div>
  );
}

// ─── Connection Badge ─────────────────────────────────────────────────────────
function ConnectionBadge({ connected, reconnecting }) {
  if (connected) return null;
  return (
    <div className={`conn-badge ${reconnecting ? "conn-badge--reconnecting" : "conn-badge--offline"}`}>
      {reconnecting ? "⟳ Reconnecting…" : "⚠ Offline"}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function MainApp({ myId }) {
  const partnerId = myId === "user_1" ? "user_2" : "user_1";

  const [appState, setAppState] = useState(() => {
    // Seed from localStorage for instant display while backend wakes up
    try {
      const cached = localStorage.getItem("pixelcouple_state");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [tab, setTab] = useState("partner");
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const socketRef = useRef(null);

  // ── REST fallback — fetch latest state via HTTP ──────────────────────────
  const fetchLatestState = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`);
      if (!res.ok) return;
      const data = await res.json();
      setAppState(data);
      localStorage.setItem("pixelcouple_state", JSON.stringify(data));
    } catch {
      // Backend still sleeping — cached state stays in UI
    }
  }, []);

  // ── Socket.io setup ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10_000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      // Always re-fetch on connect so iOS resuming from background gets fresh data
      fetchLatestState();
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setReconnecting(true);
    });

    socket.on("connect_error", () => {
      setReconnecting(true);
    });

    socket.on("state_update", (newState) => {
      setAppState(newState);
      localStorage.setItem("pixelcouple_state", JSON.stringify(newState));
    });

    // Initial REST fetch in case socket takes a moment
    fetchLatestState();

    return () => {
      socket.disconnect();
    };
  }, [fetchLatestState]);

  // ── Handle status button tap ─────────────────────────────────────────────
  const handleUpdate = useCallback(
    (statusDef) => {
      if (!socketRef.current) return;
      setIsSending(true);

      socketRef.current.emit("update_status", {
        userId: myId,
        status: statusDef.label,
        gif_url: statusDef.gif_url,
        location: statusDef.location,
      });

      // Optimistic local update so UI feels instant
      setAppState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          [myId]: {
            ...prev[myId],
            status: statusDef.label,
            gif_url: statusDef.gif_url,
            location: statusDef.location,
            updated_at: new Date().toISOString(),
          },
        };
        localStorage.setItem("pixelcouple_state", JSON.stringify(next));
        return next;
      });

      setTimeout(() => setIsSending(false), 600);
    },
    [myId]
  );

  const myData = appState?.[myId] || null;
  const partnerData = appState?.[partnerId] || null;

  return (
    <div className="main-app">
      <ConnectionBadge connected={connected} reconnecting={reconnecting} />

      {/* Tab bar */}
      <nav className="tab-bar">
        <button
          className={`tab-btn ${tab === "partner" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("partner")}
        >
          💌 Partner
        </button>
        <button
          className={`tab-btn ${tab === "me" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("me")}
        >
          🎮 My Status
        </button>
      </nav>

      <div className="tab-content">
        {tab === "partner" ? (
          <PartnerView partnerData={partnerData} />
        ) : (
          <MyController
            myData={myData}
            onUpdate={handleUpdate}
            isSending={isSending}
          />
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [myId, setMyId] = useState(() => {
    return localStorage.getItem("pixelcouple_role") || null;
  });

  const handleRoleSelect = (id) => {
    localStorage.setItem("pixelcouple_role", id);
    setMyId(id);
  };

  return myId ? <MainApp myId={myId} /> : <RoleScreen onSelect={handleRoleSelect} />;
}
