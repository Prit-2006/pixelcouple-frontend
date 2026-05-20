/**
 * PixelCouple — App.jsx
 * Features: Status Grid, Mood Note, Daily Streak
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const STATUSES = [
  { key: "chilling", label: "Chilling", emoji: "🛋️", location: "Home", gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", color: "#7C5CBF" },
  { key: "working", label: "Working", emoji: "💻", location: "Work / Study", gif_url: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif", color: "#3B82F6" },
  { key: "gym", label: "Gym", emoji: "🏋️", location: "Gym", gif_url: "https://media.giphy.com/media/3oEjI105rmEC22CJFK/giphy.gif", color: "#EF4444" },
  { key: "driving", label: "Driving", emoji: "🚗", location: "On the road", gif_url: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif", color: "#F59E0B" },
  { key: "eating", label: "Eating", emoji: "🍜", location: "Home", gif_url: "https://media.giphy.com/media/WoWm8YzFQJg28/giphy.gif", color: "#10B981" },
  { key: "sleeping", label: "Sleeping", emoji: "🌙", location: "Home", gif_url: "https://media.giphy.com/media/ftAyb0CG1FNAIZt4SO/giphy.gif", color: "#6366F1" },
  { key: "out", label: "Out & About", emoji: "🚶", location: "Outside", gif_url: "https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif", color: "#14B8A6" },
  { key: "gaming", label: "Gaming", emoji: "🎮", location: "Home", gif_url: "https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif", color: "#8B5CF6" },
  { key: "lipgloss", label: "Lip Gloss", emoji: "💄", location: "Home", gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", color: "#FF69B4" },
  { key: "potty", label: "On the Pot", emoji: "🚽", location: "Bathroom", gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", color: "#8B4513" },
];

function timeAgo(isoString) {
  if (!isoString) return "just now";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Streak Banner ────────────────────────────────────────────────────────────
function StreakBanner({ streak }) {
  const count = streak?.count || 0;
  if (count === 0) return (
    <div className="streak-bar streak-zero">
      🌱 No streak yet — open the app daily together!
    </div>
  );
  return (
    <div className="streak-bar">
      🔥 {count} day streak — keep it going!
    </div>
  );
}

// ─── Role Screen ──────────────────────────────────────────────────────────────
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

// ─── Partner View ─────────────────────────────────────────────────────────────
function PartnerView({ partnerData, streak }) {
  const [tick, setTick] = useState(0);
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
      <StreakBanner streak={streak} />
      <p className="partner-name">{partnerData.name}</p>
      <div className="gif-frame">
        {partnerData.gif_url ? (
          <img src={partnerData.gif_url} alt={partnerData.status} className="partner-gif" />
        ) : (
          <div className="gif-placeholder">🎮</div>
        )}
        <div className="gif-glow" />
      </div>
      <div className="status-pill">{partnerData.status}</div>
      <div className="meta-row">
        <span className="meta-item">📍 {partnerData.location}</span>
        <span className="meta-sep">·</span>
        <span className="meta-item">🕐 {timeAgo(partnerData.updated_at)}</span>
      </div>
      {partnerData.mood_note ? (
        <div className="mood-display">
          <span className="mood-icon">💭</span>
          <span className="mood-text">"{partnerData.mood_note}"</span>
        </div>
      ) : null}
    </div>
  );
}

// ─── My Controller ────────────────────────────────────────────────────────────
function MyController({ myData, onUpdate, onMoodSend, isSending, streak }) {
  const [moodInput, setMoodInput] = useState(myData?.mood_note || "");
  const [moodSent, setMoodSent] = useState(false);
  const activeKey = STATUSES.find((s) => s.label === myData?.status)?.key;

  const handleMoodSend = () => {
    if (!moodInput.trim()) return;
    onMoodSend(moodInput.trim());
    setMoodSent(true);
    setTimeout(() => setMoodSent(false), 2000);
  };

  return (
    <div className="controller">
      <StreakBanner streak={streak} />
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

      {/* Mood Note Section */}
      <div className="mood-section">
        <p className="mood-label">💭 Mood Note</p>
        <p className="mood-hint">Let them know how you're feeling</p>
        <div className="mood-input-row">
          <input
            className="mood-input"
            type="text"
            placeholder="e.g. stressed today 😔, so happy rn 🥰"
            value={moodInput}
            maxLength={60}
            onChange={(e) => setMoodInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMoodSend()}
          />
          <button
            className={`mood-send-btn ${moodSent ? "mood-send-btn--sent" : ""}`}
            onClick={handleMoodSend}
          >
            {moodSent ? "✓" : "Send"}
          </button>
        </div>
        {myData?.mood_note && (
          <p className="mood-current">Current: "{myData.mood_note}"</p>
        )}
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
    try {
      const cached = localStorage.getItem("pixelcouple_state");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });

  const [tab, setTab] = useState("partner");
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const socketRef = useRef(null);

  const fetchLatestState = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`);
      if (!res.ok) return;
      const data = await res.json();
      setAppState(data);
      localStorage.setItem("pixelcouple_state", JSON.stringify(data));
    } catch { }
  }, []);

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
      fetchLatestState();
      // Tell server this user is active today (for streak)
      socket.emit("user_active", { userId: myId });
    });

    socket.on("disconnect", () => { setConnected(false); setReconnecting(true); });
    socket.on("connect_error", () => { setReconnecting(true); });
    socket.on("state_update", (newState) => {
      setAppState(newState);
      localStorage.setItem("pixelcouple_state", JSON.stringify(newState));
    });

    fetchLatestState();
    return () => socket.disconnect();
  }, [fetchLatestState, myId]);

  const handleUpdate = useCallback((statusDef) => {
    if (!socketRef.current) return;
    setIsSending(true);
    socketRef.current.emit("update_status", {
      userId: myId,
      status: statusDef.label,
      gif_url: statusDef.gif_url,
      location: statusDef.location,
    });
    setAppState((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        [myId]: { ...prev[myId], status: statusDef.label, gif_url: statusDef.gif_url, location: statusDef.location, updated_at: new Date().toISOString() },
      };
      localStorage.setItem("pixelcouple_state", JSON.stringify(next));
      return next;
    });
    setTimeout(() => setIsSending(false), 600);
  }, [myId]);

  const handleMoodSend = useCallback((mood_note) => {
    if (!socketRef.current) return;
    socketRef.current.emit("update_mood", { userId: myId, mood_note });
    setAppState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [myId]: { ...prev[myId], mood_note, updated_at: new Date().toISOString() } };
      localStorage.setItem("pixelcouple_state", JSON.stringify(next));
      return next;
    });
  }, [myId]);

  const myData = appState?.[myId] || null;
  const partnerData = appState?.[partnerId] || null;
  const streak = appState?.streak || { count: 0 };

  return (
    <div className="main-app">
      <ConnectionBadge connected={connected} reconnecting={reconnecting} />
      <nav className="tab-bar">
        <button className={`tab-btn ${tab === "partner" ? "tab-btn--active" : ""}`} onClick={() => setTab("partner")}>
          💌 Partner
        </button>
        <button className={`tab-btn ${tab === "me" ? "tab-btn--active" : ""}`} onClick={() => setTab("me")}>
          🎮 My Status
        </button>
      </nav>
      <div className="tab-content">
        {tab === "partner" ? (
          <PartnerView partnerData={partnerData} streak={streak} />
        ) : (
          <MyController myData={myData} onUpdate={handleUpdate} onMoodSend={handleMoodSend} isSending={isSending} streak={streak} />
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [myId, setMyId] = useState(() => localStorage.getItem("pixelcouple_role") || null);
  const handleRoleSelect = (id) => { localStorage.setItem("pixelcouple_role", id); setMyId(id); };
  return myId ? <MainApp myId={myId} /> : <RoleScreen onSelect={handleRoleSelect} />;
}
