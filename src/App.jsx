/**
 * PixelCouple — App.jsx
 * Features: Status, Mood Note, Streak, Flowers, Compliments, Canvas, Playlist
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const STATUSES = [
  { key: "chilling",  label: "Chilling",    emoji: "🛋️", location: "Home",        gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", color: "#7C5CBF" },
  { key: "working",   label: "Working",     emoji: "💻", location: "Work / Study", gif_url: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif",    color: "#3B82F6" },
  { key: "gym",       label: "Gym",         emoji: "🏋️", location: "Gym",          gif_url: "https://media.giphy.com/media/3oEjI105rmEC22CJFK/giphy.gif", color: "#EF4444" },
  { key: "driving",   label: "Driving",     emoji: "🚗", location: "On the road",  gif_url: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif", color: "#F59E0B" },
  { key: "eating",    label: "Eating",      emoji: "🍜", location: "Home",         gif_url: "https://media.giphy.com/media/WoWm8YzFQJg28/giphy.gif",      color: "#10B981" },
  { key: "sleeping",  label: "Sleeping",    emoji: "🌙", location: "Home",         gif_url: "https://media.giphy.com/media/ftAyb0CG1FNAIZt4SO/giphy.gif", color: "#6366F1" },
  { key: "out",       label: "Out & About", emoji: "🚶", location: "Outside",      gif_url: "https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif",  color: "#14B8A6" },
  { key: "gaming",    label: "Gaming",      emoji: "🎮", location: "Home",         gif_url: "https://media.giphy.com/media/LmNwrBhejkK9EFP504/giphy.gif", color: "#8B5CF6" },
  { key: "lipgloss",  label: "Lip Gloss",   emoji: "💄", location: "Home",         gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", color: "#FF69B4" },
  { key: "potty",     label: "On the Pot",  emoji: "🚽", location: "Bathroom",     gif_url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", color: "#8B4513" },
];

const FLOWER_EMOJIS = ["🌸", "🌹", "🌺", "🌻", "💐", "🌷", "🌼"];
const COLORS = ["#e8e8f0", "#d46ef3", "#ff6fb0", "#f87171", "#fbbf24", "#4ade80", "#60a5fa", "#a78bfa"];

function timeAgo(isoString) {
  if (!isoString) return "just now";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString([], { day: "numeric", month: "short" });
}

// ─── Flower Rain ──────────────────────────────────────────────────────────────
function FlowerRain({ senderGender, onDone }) {
  const message = senderGender === "user_1" ? "He sent you flowers! 💐" : "She sent you flowers! 💐";
  const petals = Array.from({ length: 30 }, (_, i) => ({
    id: i, emoji: FLOWER_EMOJIS[Math.floor(Math.random() * FLOWER_EMOJIS.length)],
    left: Math.random() * 100, delay: Math.random() * 2,
    size: 1.2 + Math.random() * 1.6, duration: 2.5 + Math.random() * 2,
  }));
  useEffect(() => { const t = setTimeout(onDone, 4500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="flower-overlay" onClick={onDone}>
      {petals.map((p) => (
        <div key={p.id} className="flower-petal" style={{ left: `${p.left}%`, fontSize: `${p.size}rem`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}>{p.emoji}</div>
      ))}
      <div className="flower-message">{message}</div>
    </div>
  );
}

// ─── Flower Notification ──────────────────────────────────────────────────────
function FlowerNotification({ senderGender, sentAt, onView, onDismiss }) {
  const who = senderGender === "user_1" ? "He" : "She";
  return (
    <div className="flower-notif">
      <span className="flower-notif-icon">🌸</span>
      <div className="flower-notif-text"><strong>{who} sent you flowers!</strong><span>at {formatTime(sentAt)}</span></div>
      <button className="flower-notif-view" onClick={onView}>View 💐</button>
      <button className="flower-notif-dismiss" onClick={onDismiss}>✕</button>
    </div>
  );
}

// ─── Compliment Popup ─────────────────────────────────────────────────────────
function ComplimentPopup({ compliment, myId, onDismiss }) {
  if (compliment.to !== myId) return null;
  const who = compliment.from === "user_1" ? "He" : "She";
  return (
    <div className="compliment-overlay">
      <div className="compliment-card">
        <div className="compliment-emoji">💌</div>
        <p className="compliment-from">{who} wrote you something special</p>
        <p className="compliment-text">"{compliment.text}"</p>
        <p className="compliment-time">at {formatTime(compliment.sentAt)}</p>
        <button className="compliment-dismiss" onClick={onDismiss}>Aww, thanks! 🥺</button>
      </div>
    </div>
  );
}

// ─── Send Compliment Modal ────────────────────────────────────────────────────
function SendComplimentModal({ onSend, onClose }) {
  const [text, setText] = useState("");
  return (
    <div className="compliment-overlay">
      <div className="compliment-card">
        <div className="compliment-emoji">✍️</div>
        <p className="compliment-from">Write something special 💕</p>
        <textarea className="compliment-input" placeholder="Type your compliment here... be sweet 🥺" value={text} maxLength={150} onChange={(e) => setText(e.target.value)} rows={4} />
        <p className="compliment-chars">{text.length}/150</p>
        <button className="compliment-dismiss" onClick={() => { if (text.trim()) onSend(text.trim()); }} disabled={!text.trim()}>Send 💌</button>
        <button className="compliment-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Streak Banner ────────────────────────────────────────────────────────────
function StreakBanner({ streak }) {
  const count = streak?.count || 0;
  if (count === 0) return <div className="streak-bar streak-zero">🌱 Open the app together daily for a streak!</div>;
  return <div className="streak-bar">🔥 {count} day streak — keep it going!</div>;
}

// ─── Canvas Board ─────────────────────────────────────────────────────────────
function CanvasBoard({ myId, appState, onSendCanvas, onClearCanvas }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const [color, setColor] = useState("#e8e8f0");
  const [brushSize, setBrushSize] = useState(4);
  const [viewMode, setViewMode] = useState("mine");
  const [sendStatus, setSendStatus] = useState("idle"); // idle | sending | sent
  const partnerId = myId === "user_1" ? "user_2" : "user_1";
  const partnerName = myId === "user_1" ? "Girlfriend" : "Boyfriend";

  // Load my saved canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#16161f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const savedCanvas = appState?.[myId]?.canvas;
    if (savedCanvas) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = savedCanvas;
    }
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDraw = (e) => {
    if (viewMode !== "mine") return;
    e.preventDefault();
    isDrawing.current = true;
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  const draw = (e) => {
    if (!isDrawing.current || viewMode !== "mine") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { isDrawing.current = false; lastPos.current = null; };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSendStatus("sending");
    // Small timeout so UI updates before heavy toDataURL call
    setTimeout(() => {
      const data = canvas.toDataURL("image/jpeg", 0.7); // jpeg smaller than png
      onSendCanvas(data);
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 2500);
    }, 50);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#16161f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onClearCanvas();
  };

  const partnerCanvas = appState?.[partnerId]?.canvas;

  return (
    <div className="board-screen">
      {/* Toggle */}
      <div className="board-toggle">
        <button className={`board-toggle-btn ${viewMode === "mine" ? "board-toggle-btn--active" : ""}`} onClick={() => setViewMode("mine")}>
           My Board
        </button>
        <button className={`board-toggle-btn ${viewMode === "partner" ? "board-toggle-btn--active" : ""}`} onClick={() => setViewMode("partner")}>
           {partnerName}'s Board
        </button>
      </div>

      {viewMode === "mine" ? (
        <>
          {/* Color picker */}
          <div className="color-row">
            {COLORS.map((c) => (
              <button key={c} className={`color-dot ${color === c ? "color-dot--active" : ""}`} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>

          {/* Brush size */}
          <div className="brush-row">
            <span className="brush-label">Size</span>
            {[2, 4, 8, 14].map((s) => (
              <button key={s} className={`brush-btn ${brushSize === s ? "brush-btn--active" : ""}`} onClick={() => setBrushSize(s)}>
                <div style={{ width: s * 2, height: s * 2, borderRadius: "50%", background: color }} />
              </button>
            ))}
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={600} height={600}
            className="draw-canvas"
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />

          {/* Actions */}
          <div className="board-actions">
            <button className="board-clear-btn" onClick={handleClear}>🗑️ Clear</button>
            <button
              className={`board-send-btn ${sendStatus === "sent" ? "board-send-btn--sent" : ""}`}
              onClick={handleSend}
              disabled={sendStatus === "sending"}
            >
              {sendStatus === "idle" && "Send Drawing ✉️"}
              {sendStatus === "sending" && "Sending…"}
              {sendStatus === "sent" && "Sent! ✓"}
            </button>
          </div>
        </>
      ) : (
        <div className="partner-board-view">
          {partnerCanvas ? (
            <>
              <img src={partnerCanvas} alt="Partner's drawing" className="partner-canvas-img" />
              <p className="partner-board-hint">Tap drawing to view full size</p>
            </>
          ) : (
            <div className="partner-board-empty">
              <p>🎨</p>
              <p>{partnerName} hasn't drawn anything yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Playlist ─────────────────────────────────────────────────────────────────
function PlaylistScreen({ myId, playlist, onAddSong, onDeleteSong }) {
  const [showForm, setShowForm] = useState(false);
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [note, setNote] = useState("");

  const handleAdd = () => {
    if (!song.trim() || !youtubeUrl.trim()) return;
    onAddSong({ song: song.trim(), artist: artist.trim(), youtubeUrl: youtubeUrl.trim(), note: note.trim() });
    setSong(""); setArtist(""); setYoutubeUrl(""); setNote("");
    setShowForm(false);
  };

  const openYoutube = (url) => {
    window.open(url, "_blank");
  };

  return (
    <div className="playlist-screen">
      <div className="playlist-header">
        <p className="playlist-title">🎵 Our Playlist</p>
        <button className="playlist-add-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? "✕ Cancel" : "+ Add Song"}
        </button>
      </div>

      {showForm && (
        <div className="song-form">
          <input className="song-input" placeholder="Song name *" value={song} onChange={(e) => setSong(e.target.value)} />
          <input className="song-input" placeholder="Artist name" value={artist} onChange={(e) => setArtist(e.target.value)} />
          <input className="song-input" placeholder="YouTube link * (paste URL)" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
          <input className="song-input" placeholder="Why does this remind you of them? 🥺" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="song-submit-btn" onClick={handleAdd} disabled={!song.trim() || !youtubeUrl.trim()}>
            Add to Playlist 🎵
          </button>
        </div>
      )}

      {playlist.length === 0 ? (
        <div className="playlist-empty">
          <p>🎵</p>
          <p>No songs yet!</p>
          <p>Add songs that remind you of each other 🥺</p>
        </div>
      ) : (
        <div className="song-list">
          {playlist.map((s) => (
            <div key={s.id} className="song-card">
              <div className="song-card-top">
                <div className="song-info">
                  <p className="song-name">{s.song}</p>
                  {s.artist && <p className="song-artist">{s.artist}</p>}
                </div>
                <div className="song-card-actions">
                  <button className="song-play-btn" onClick={() => openYoutube(s.youtubeUrl)}>▶ Play</button>
                  {s.addedBy === myId && (
                    <button className="song-delete-btn" onClick={() => onDeleteSong(s.id)}>🗑️</button>
                  )}
                </div>
              </div>
              {s.note && <p className="song-note">"{s.note}"</p>}
              <p className="song-meta">
                Added by {s.addedBy === myId ? "You" : (myId === "user_1" ? "Her" : "Him")} · {formatDate(s.addedAt)}
              </p>
            </div>
          ))}
        </div>
      )}
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
          <button className="role-btn" onClick={() => onSelect("user_1")}><span className="role-emoji">👦</span><span>Boyfriend</span></button>
          <button className="role-btn" onClick={() => onSelect("user_2")}><span className="role-emoji">👧</span><span>Girlfriend</span></button>
        </div>
        <p className="role-note">Only need to pick this once.</p>
      </div>
    </div>
  );
}

// ─── Partner View ─────────────────────────────────────────────────────────────
function PartnerView({ partnerData, streak, onSendFlowers, onSendCompliment }) {
  const [flowerSent, setFlowerSent] = useState(false);
  const [showComplimentModal, setShowComplimentModal] = useState(false);

  const handleSendFlowers = () => { onSendFlowers(); setFlowerSent(true); setTimeout(() => setFlowerSent(false), 3000); };

  if (!partnerData) return <div className="partner-loading"><div className="pulse-dot" /><p>Waiting for partner…</p></div>;

  return (
    <div className="partner-view">
      {showComplimentModal && (
        <SendComplimentModal onSend={(text) => { onSendCompliment(text); setShowComplimentModal(false); }} onClose={() => setShowComplimentModal(false)} />
      )}
      <StreakBanner streak={streak} />
      <p className="partner-name">{partnerData.name}</p>
      <div className="gif-frame">
        {partnerData.gif_url ? <img src={partnerData.gif_url} alt={partnerData.status} className="partner-gif" /> : <div className="gif-placeholder">🎮</div>}
        <div className="gif-glow" />
      </div>
      <div className="status-pill">{partnerData.status}</div>
      <div className="meta-row">
        <span className="meta-item">📍 {partnerData.location}</span>
        <span className="meta-sep">·</span>
        <span className="meta-item">🕐 {timeAgo(partnerData.updated_at)}</span>
      </div>
      {partnerData.mood_note ? (
        <div className="mood-display"><span className="mood-icon">💭</span><span className="mood-text">"{partnerData.mood_note}"</span></div>
      ) : null}
      <div className="action-row">
        <button className={`flower-btn ${flowerSent ? "flower-btn--sent" : ""}`} onClick={handleSendFlowers} disabled={flowerSent}>
          {flowerSent ? "Sent! 💐" : "🌸 Flowers"}
        </button>
        <button className="compliment-btn" onClick={() => setShowComplimentModal(true)}>💌 Compliment</button>
      </div>
    </div>
  );
}

// ─── My Controller ────────────────────────────────────────────────────────────
function MyController({ myData, onUpdate, onMoodSend, isSending, streak }) {
  const [moodInput, setMoodInput] = useState(myData?.mood_note || "");
  const [moodSent, setMoodSent] = useState(false);
  const activeKey = STATUSES.find((s) => s.label === myData?.status)?.key;

  useEffect(() => { if (myData?.mood_note !== undefined) setMoodInput(myData.mood_note); }, [myData?.mood_note]);

  const handleMoodSend = () => { if (!moodInput.trim()) return; onMoodSend(moodInput.trim()); setMoodSent(true); setTimeout(() => setMoodSent(false), 2000); };
  const handleMoodClear = () => { setMoodInput(""); onMoodSend(""); };

  return (
    <div className="controller">
      <StreakBanner streak={streak} />
      <p className="controller-title">Your Status</p>
      <p className="controller-sub">Currently: <strong>{myData?.status || "—"}</strong></p>
      <div className="status-grid">
        {STATUSES.map((s) => {
          const isActive = s.key === activeKey;
          return (
            <button key={s.key} className={`status-btn ${isActive ? "status-btn--active" : ""}`} style={{ "--accent": s.color }} onClick={() => onUpdate(s)} disabled={isSending}>
              <span className="status-btn-emoji">{s.emoji}</span>
              <span className="status-btn-label">{s.label}</span>
              {isActive && <div className="active-ring" />}
            </button>
          );
        })}
      </div>
      <div className="mood-section">
        <p className="mood-label">💭 Mood Note</p>
        <p className="mood-hint">Stays until you change or clear it</p>
        <div className="mood-input-row">
          <input className="mood-input" type="text" placeholder="e.g. stressed today 😔" value={moodInput} maxLength={60} onChange={(e) => setMoodInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleMoodSend()} />
          <button className={`mood-send-btn ${moodSent ? "mood-send-btn--sent" : ""}`} onClick={handleMoodSend}>{moodSent ? "✓" : "Set"}</button>
        </div>
        {myData?.mood_note ? (
          <div className="mood-current-row">
            <p className="mood-current">"{myData.mood_note}"</p>
            <button className="mood-clear-btn" onClick={handleMoodClear}>✕ Clear</button>
          </div>
        ) : <p className="mood-empty">No mood note set</p>}
      </div>
      {isSending && <p className="sending-text">Sending…</p>}
    </div>
  );
}

// ─── Connection Badge ─────────────────────────────────────────────────────────
function ConnectionBadge({ connected, reconnecting }) {
  if (connected) return null;
  return <div className={`conn-badge ${reconnecting ? "conn-badge--reconnecting" : "conn-badge--offline"}`}>{reconnecting ? "⟳ Reconnecting…" : "⚠ Offline"}</div>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function MainApp({ myId }) {
  const partnerId = myId === "user_1" ? "user_2" : "user_1";

  const [appState, setAppState] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pixelcouple_state")) || null; } catch { return null; }
  });

  const [tab, setTab] = useState("partner");
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [flowerAnim, setFlowerAnim] = useState(null);
  const [showFlowerNotif, setShowFlowerNotif] = useState(false);
  const socketRef = useRef(null);
  const shownFlowerRef = useRef(null);

  const fetchLatestState = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`);
      if (!res.ok) return;
      const data = await res.json();
      setAppState(data);
      localStorage.setItem("pixelcouple_state", JSON.stringify(data));
    } catch { }
  }, []);

  const checkPendingFlowers = useCallback((state) => {
    if (!state?.pending_flowers) return;
    const pf = state.pending_flowers;
    if (pf.toUserId !== myId) return;
    if (shownFlowerRef.current === pf.sentAt) return;
    shownFlowerRef.current = pf.sentAt;
    setShowFlowerNotif(true);
  }, [myId]);

  useEffect(() => {
    const socket = io(BACKEND_URL, { reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 10_000 });
    socketRef.current = socket;

    socket.on("connect", () => { setConnected(true); setReconnecting(false); fetchLatestState(); socket.emit("user_active", { userId: myId }); });
    socket.on("disconnect", () => { setConnected(false); setReconnecting(true); });
    socket.on("connect_error", () => setReconnecting(true));
    socket.on("state_update", (newState) => { setAppState(newState); localStorage.setItem("pixelcouple_state", JSON.stringify(newState)); checkPendingFlowers(newState); });
    socket.on("send_flowers", ({ fromUserId, toUserId }) => { if (toUserId === myId) { setShowFlowerNotif(false); setFlowerAnim({ senderGender: fromUserId }); } });

    fetchLatestState();
    return () => socket.disconnect();
  }, [fetchLatestState, myId, checkPendingFlowers]);

  useEffect(() => { if (appState) checkPendingFlowers(appState); }, [appState, checkPendingFlowers]);

  const handleUpdate = useCallback((statusDef) => {
    if (!socketRef.current) return;
    setIsSending(true);
    socketRef.current.emit("update_status", { userId: myId, status: statusDef.label, gif_url: statusDef.gif_url, location: statusDef.location });
    setAppState((prev) => { if (!prev) return prev; const next = { ...prev, [myId]: { ...prev[myId], status: statusDef.label, gif_url: statusDef.gif_url, location: statusDef.location, updated_at: new Date().toISOString() } }; localStorage.setItem("pixelcouple_state", JSON.stringify(next)); return next; });
    setTimeout(() => setIsSending(false), 600);
  }, [myId]);

  const handleMoodSend = useCallback((mood_note) => {
    if (!socketRef.current) return;
    socketRef.current.emit("update_mood", { userId: myId, mood_note });
  }, [myId]);

  const handleSendFlowers = useCallback(() => { if (!socketRef.current) return; socketRef.current.emit("send_flowers", { fromUserId: myId, toUserId: partnerId }); }, [myId, partnerId]);
  const handleSendCompliment = useCallback((text) => { if (!socketRef.current) return; socketRef.current.emit("send_compliment", { fromUserId: myId, toUserId: partnerId, text }); }, [myId, partnerId]);
  const handleDismissCompliment = useCallback((key) => { if (!socketRef.current) return; socketRef.current.emit("dismiss_compliment", { key }); }, []);

  const handleViewFlowers = () => { setShowFlowerNotif(false); setFlowerAnim({ senderGender: appState?.pending_flowers?.fromUserId }); if (socketRef.current) socketRef.current.emit("clear_flowers"); };
  const handleDismissFlowerNotif = () => { setShowFlowerNotif(false); if (socketRef.current) socketRef.current.emit("clear_flowers"); };

  const handleSendCanvas = useCallback((canvasData) => { if (!socketRef.current) return; socketRef.current.emit("update_canvas", { userId: myId, canvasData }); }, [myId]);
  const handleClearCanvas = useCallback(() => { if (!socketRef.current) return; socketRef.current.emit("clear_canvas", { userId: myId }); }, [myId]);

  const handleAddSong = useCallback((songData) => { if (!socketRef.current) return; socketRef.current.emit("add_song", { addedBy: myId, ...songData }); }, [myId]);
  const handleDeleteSong = useCallback((songId) => { if (!socketRef.current) return; socketRef.current.emit("delete_song", { songId, userId: myId }); }, [myId]);

  const myData = appState?.[myId] || null;
  const partnerData = appState?.[partnerId] || null;
  const streak = appState?.streak || { count: 0 };
  const incomingComplimentKey = myId === "user_1" ? "user_2_to_1" : "user_1_to_2";
  const incomingCompliment = appState?.compliments?.[incomingComplimentKey];
  const playlist = appState?.playlist || [];

  return (
    <div className="main-app">
      {flowerAnim && <FlowerRain senderGender={flowerAnim.senderGender} onDone={() => setFlowerAnim(null)} />}
      {incomingCompliment && <ComplimentPopup compliment={incomingCompliment} myId={myId} onDismiss={() => handleDismissCompliment(incomingComplimentKey)} />}
      {showFlowerNotif && appState?.pending_flowers && <FlowerNotification senderGender={appState.pending_flowers.fromUserId} sentAt={appState.pending_flowers.sentAt} onView={handleViewFlowers} onDismiss={handleDismissFlowerNotif} />}

      <ConnectionBadge connected={connected} reconnecting={reconnecting} />

      <nav className="tab-bar">
        <button className={`tab-btn ${tab === "partner" ? "tab-btn--active" : ""}`} onClick={() => setTab("partner")}>💌</button>
        <button className={`tab-btn ${tab === "me" ? "tab-btn--active" : ""}`} onClick={() => setTab("me")}>🎮</button>
        <button className={`tab-btn ${tab === "board" ? "tab-btn--active" : ""}`} onClick={() => setTab("board")}>🎨</button>
        <button className={`tab-btn ${tab === "playlist" ? "tab-btn--active" : ""}`} onClick={() => setTab("playlist")}>🎵</button>
      </nav>

      <div className="tab-content">
        {tab === "partner" && <PartnerView partnerData={partnerData} streak={streak} onSendFlowers={handleSendFlowers} onSendCompliment={handleSendCompliment} />}
        {tab === "me" && <MyController myData={myData} onUpdate={handleUpdate} onMoodSend={handleMoodSend} isSending={isSending} streak={streak} />}
        {tab === "board" && <CanvasBoard myId={myId} appState={appState} onSendCanvas={handleSendCanvas} onClearCanvas={handleClearCanvas} />}
        {tab === "playlist" && <PlaylistScreen myId={myId} playlist={playlist} onAddSong={handleAddSong} onDeleteSong={handleDeleteSong} />}
      </div>
    </div>
  );
}

export default function App() {
  const [myId, setMyId] = useState(() => localStorage.getItem("pixelcouple_role") || null);
  const handleRoleSelect = (id) => { localStorage.setItem("pixelcouple_role", id); setMyId(id); };
  return myId ? <MainApp myId={myId} /> : <RoleScreen onSelect={handleRoleSelect} />;
}
