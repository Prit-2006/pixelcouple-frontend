/**
 * PixelCouple — App.jsx
 * Features: Status, Mood Note, Streak, Flowers, Compliments, Canvas, Playlist, Coins, Pet
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

// Shop catalog — must match server.js SHOP_FOODS / SHOP_OUTFITS
const SHOP_FOODS = {
  bone:     { cost: 10, hunger: 20, happiness: 0,  emoji: "🦴", name: "Bone" },
  burger:   { cost: 20, hunger: 35, happiness: 2,  emoji: "🍔", name: "Burger" },
  cake:     { cost: 40, hunger: 60, happiness: 10, emoji: "🎂", name: "Cake" },
  icecream: { cost: 15, hunger: 10, happiness: 15, emoji: "🍦", name: "Ice Cream" },
};
const HUNGER_DECAY_PER_HOUR = 4;
const HAPPINESS_DECAY_PER_HOUR = 3;

function clamp(v) { return Math.max(0, Math.min(100, v)); }

// Computes current pet stats factoring in time-based decay since last update
function getEffectivePet(pet) {
  if (!pet) return { hunger: 70, happiness: 70 };
  const hours = Math.max(0, (Date.now() - new Date(pet.stats_updated_at).getTime()) / 3600000);
  return {
    hunger: clamp(pet.hunger - hours * HUNGER_DECAY_PER_HOUR),
    happiness: clamp(pet.happiness - hours * HAPPINESS_DECAY_PER_HOUR),
  };
}

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
  const partnerName = appState?.[partnerId]?.name || (myId === "user_1" ? "WHITE" : "DARK");

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
          ✏️ My Board
        </button>
        <button className={`board-toggle-btn ${viewMode === "partner" ? "board-toggle-btn--active" : ""}`} onClick={() => setViewMode("partner")}>
          👀 {partnerName}'s Board
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

// ─── Beagle SVG + Pet Screen ──────────────────────────────────────────────────

// ─── Beagle SVG ───────────────────────────────────────────────────────────────
// Proper tricolor beagle: black saddle, tan/brown sides, white belly + chest
// state: "stand" | "sit" | "belly" | "nap" | "zoomies" | "shake"
// petted: "head"|"belly"|"back"|"snout"|null
function BeagleSVG({ state, onZoneClick, petted, zoomOffset }) {
  const sit     = state === "sit";
  const belly   = state === "belly";
  const nap     = state === "nap";
  const happy   = petted === "head" || petted === "belly";
  const openMouth = petted === "snout" || state === "shake" || state === "yawn";
  const tailFast  = petted === "back" || state === "zoomies";

  // Body Y shift when sitting
  const bY = sit ? 14 : 0;

  if (nap) return (
    <svg viewBox="0 0 220 160" className="beagle-svg" style={{width:"100%",maxWidth:280,overflow:"visible"}}>
      <defs>
        <radialGradient id="tanG" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#e8c07a"/>
          <stop offset="100%" stopColor="#c48a40"/>
        </radialGradient>
      </defs>
      {/* Curled sleeping body */}
      <ellipse cx="110" cy="110" rx="72" ry="38" fill="url(#tanG)"/>
      <ellipse cx="110" cy="108" rx="50" ry="24" fill="#1a1008" opacity="0.5"/>
      <ellipse cx="110" cy="118" rx="46" ry="20" fill="#f5f0e8"/>
      {/* Tail curled around */}
      <path d="M 170 105 Q 185 80 165 72 Q 148 66 152 85" stroke="#c48a40" strokeWidth="12" fill="none" strokeLinecap="round"/>
      {/* Head resting down */}
      <ellipse cx="62" cy="100" rx="32" ry="26" fill="url(#tanG)"/>
      <ellipse cx="62" cy="92" rx="22" ry="16" fill="#1a1008" opacity="0.5"/>
      <ellipse cx="62" cy="108" rx="20" ry="14" fill="#f5f0e8"/>
      {/* Sleeping eyes — just lines */}
      <path d="M 52 96 Q 57 92 62 96" stroke="#2c1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M 62 96 Q 67 92 72 96" stroke="#2c1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* Ear flopped down */}
      <ellipse cx="40" cy="103" rx="12" ry="22" fill="#6b3a1f" transform="rotate(30 40 103)"/>
      {/* Nose */}
      <ellipse cx="56" cy="112" rx="7" ry="5" fill="#2c1a0e"/>
      {/* Zzz */}
      <text x="100" y="60" fontSize="22" fill="#d46ef3" opacity="0.9" className="nap-zzz-1">z</text>
      <text x="118" y="44" fontSize="28" fill="#d46ef3" opacity="0.7" className="nap-zzz-2">z</text>
      <text x="140" y="26" fontSize="34" fill="#d46ef3" opacity="0.5" className="nap-zzz-3">z</text>
    </svg>
  );

  if (belly) return (
    <svg viewBox="0 0 220 200" className="beagle-svg" style={{width:"100%",maxWidth:280,overflow:"visible"}}>
      <defs>
        <radialGradient id="tanG2" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#e8c07a"/>
          <stop offset="100%" stopColor="#c48a40"/>
        </radialGradient>
      </defs>
      {/* Body on back */}
      <ellipse cx="110" cy="130" rx="62" ry="38" fill="url(#tanG2)"/>
      <ellipse cx="110" cy="122" rx="46" ry="26" fill="#1a1008" opacity="0.45"/>
      <ellipse cx="110" cy="138" rx="44" ry="26" fill="#f5f0e8"/>
      {/* Legs up in air */}
      <rect x="68" y="72" width="16" height="42" rx="8" fill="#c48a40" transform="rotate(-20 68 100)"/>
      <rect x="136" y="72" width="16" height="42" rx="8" fill="#c48a40" transform="rotate(20 152 100)"/>
      <rect x="58" y="88" width="16" height="38" rx="8" fill="#c48a40" transform="rotate(-35 58 108)"/>
      <rect x="146" y="88" width="16" height="38" rx="8" fill="#c48a40" transform="rotate(35 162 108)"/>
      {/* Paws */}
      <ellipse cx="58" cy="68" rx="12" ry="9" fill="#b07840"/>
      <ellipse cx="162" cy="68" rx="12" ry="9" fill="#b07840"/>
      <ellipse cx="44" cy="80" rx="12" ry="9" fill="#b07840"/>
      <ellipse cx="176" cy="80" rx="12" ry="9" fill="#b07840"/>
      {/* Head */}
      <ellipse cx="110" cy="56" rx="36" ry="32" fill="url(#tanG2)"/>
      <ellipse cx="110" cy="45" rx="26" ry="18" fill="#1a1008" opacity="0.45"/>
      <ellipse cx="110" cy="66" rx="22" ry="18" fill="#f5f0e8"/>
      {/* Ears flopped sideways */}
      <ellipse cx="74" cy="55" rx="12" ry="28" fill="#6b3a1f" transform="rotate(60 74 55)"/>
      <ellipse cx="146" cy="55" rx="12" ry="28" fill="#6b3a1f" transform="rotate(-60 146 55)"/>
      {/* Happy squint eyes */}
      <path d="M 97 50 q 5 -7 10 0" stroke="#2c1a0e" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M 113 50 q 5 -7 10 0" stroke="#2c1a0e" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* Nose */}
      <ellipse cx="110" cy="67" rx="9" ry="6" fill="#2c1a0e"/>
      {/* Open mouth + tongue */}
      <path d="M 100 74 q 10 10 20 0" stroke="#2c1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <ellipse cx="110" cy="80" rx="9" ry="7" fill="#e87878"/>
      <line x1="110" y1="74" x2="110" y2="82" stroke="#c85858" strokeWidth="1.5"/>
      {/* Tail wagging */}
      <g className="tail-wag-fast">
        <path d="M 160 125 Q 185 100 175 82 Q 166 68 155 78" stroke="#c48a40" strokeWidth="13" fill="none" strokeLinecap="round"/>
        <ellipse cx="158" cy="78" rx="9" ry="7" fill="#f5f0e8"/>
      </g>
    </svg>
  );

  // ── STANDING / SITTING ──
  return (
    <svg viewBox="0 0 220 250" className={`beagle-svg ${state === "shake" ? "beagle-shake" : ""}`}
      style={{width:"100%", maxWidth:280, overflow:"visible",
        transform: state==="zoomies" ? `translateX(${zoomOffset}px)` : "none",
        transition: state==="zoomies" ? "transform 0.08s linear" : "transform 0.3s ease"
      }}>
      <defs>
        <radialGradient id="tanG3" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ecca82"/>
          <stop offset="100%" stopColor="#c48a40"/>
        </radialGradient>
        <radialGradient id="headG" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ecc882"/>
          <stop offset="100%" stopColor="#c48a40"/>
        </radialGradient>
      </defs>

      {/* ── TAIL ── */}
      <g className={tailFast ? "tail-wag-fast" : "tail-wag"} style={{transformOrigin:"155px 165px"}}>
        <path d={`M 155 ${165+bY} Q 185 ${140+bY} 178 ${118+bY} Q 172 ${100+bY} 158 ${112+bY}`}
          stroke="#c48a40" strokeWidth="14" fill="none" strokeLinecap="round"/>
        <ellipse cx="158" cy={112+bY} rx="9" ry="7" fill="#f5f0e8"/>
      </g>

      {/* ── BODY ── */}
      <ellipse cx="104" cy={168+bY} rx="58" ry="50" fill="url(#tanG3)"/>
      {/* Black saddle marking */}
      <ellipse cx="104" cy={152+bY} rx="44" ry="30" fill="#1a1008" opacity="0.52"/>
      {/* White chest/belly */}
      <ellipse cx="104" cy={180+bY} rx="38" ry="28" fill="#f5f0e8"/>

      {/* ── BACK LEGS ── */}
      {!sit ? (
        <>
          <rect x="60" y={208+bY} width="18" height="34" rx="9" fill="#b07840"/>
          <rect x="126" y={208+bY} width="18" height="34" rx="9" fill="#b07840"/>
          <ellipse cx="69" cy={244+bY} rx="13" ry="9" fill="#9a6830"/>
          <ellipse cx="135" cy={244+bY} rx="13" ry="9" fill="#9a6830"/>
        </>
      ) : (
        <>
          <ellipse cx="66" cy={224+bY} rx="22" ry="14" fill="#b07840"/>
          <ellipse cx="142" cy={224+bY} rx="22" ry="14" fill="#b07840"/>
        </>
      )}

      {/* ── FRONT LEGS ── */}
      <rect x="74" y={204+bY} width="18" height="36" rx="9" fill="#c48a40"/>
      <rect x="112" y={204+bY} width="18" height="36" rx="9" fill="#c48a40"/>
      <ellipse cx="83" cy={242+bY} rx="13" ry="9" fill="#b07840"/>
      <ellipse cx="121" cy={242+bY} rx="13" ry="9" fill="#b07840"/>

      {/* Touch zones (invisible) */}
      <ellipse cx="104" cy={180+bY} rx="46" ry="34" fill="transparent"
        onClick={()=>onZoneClick("belly")} style={{cursor:"pointer"}}/>
      <ellipse cx="104" cy={148+bY} rx="40" ry="22" fill="transparent"
        onClick={()=>onZoneClick("back")} style={{cursor:"pointer"}}/>

      {/* ── NECK ── */}
      <ellipse cx="104" cy={120+bY} rx="24" ry="18" fill="#d4a060"/>

      {/* ── HEAD ── */}
      <g onClick={()=>onZoneClick("head")} style={{cursor:"pointer"}}>
        <ellipse cx="104" cy={82+bY} rx="42" ry="38" fill="url(#headG)"/>
        {/* Black top of head — beagle tricolor */}
        <ellipse cx="104" cy={66+bY} rx="30" ry="20" fill="#1a1008" opacity="0.52"/>
        {/* White muzzle */}
        <ellipse cx="104" cy={96+bY} rx="26" ry="22" fill="#f5f0e8"/>
        <ellipse cx="104" cy={98+bY} rx="18" ry="14" fill="#e8d8b8"/>
      </g>

      {/* ── EARS ── */}
      <g className="ear-left" style={{transformOrigin:`68px ${72+bY}px`}}>
        <ellipse cx="65" cy={90+bY} rx="18" ry="36" fill="#6b3a1f"
          transform={`rotate(-18 65 ${68+bY})`}/>
        {/* Inner ear highlight */}
        <ellipse cx="65" cy={92+bY} rx="10" ry="24" fill="#8b4e28" opacity="0.5"
          transform={`rotate(-18 65 ${68+bY})`}/>
      </g>
      <g className="ear-right" style={{transformOrigin:`143px ${72+bY}px`}}>
        <ellipse cx="143" cy={90+bY} rx="18" ry="36" fill="#6b3a1f"
          transform={`rotate(18 143 ${68+bY})`}/>
        <ellipse cx="143" cy={92+bY} rx="10" ry="24" fill="#8b4e28" opacity="0.5"
          transform={`rotate(18 143 ${68+bY})`}/>
      </g>

      {/* ── EYES ── */}
      {happy ? (
        <>
          <path d={`M 88 ${72+bY} q 7 -9 14 0`} stroke="#2c1a0e" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d={`M 106 ${72+bY} q 7 -9 14 0`} stroke="#2c1a0e" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <ellipse cx="92" cy={75+bY} rx="9" ry="9" fill="#2c1a0e"/>
          <ellipse cx="116" cy={75+bY} rx="9" ry="9" fill="#2c1a0e"/>
          {/* Eye shine */}
          <ellipse cx="95" cy={72+bY} rx="3" ry="3" fill="#fff"/>
          <ellipse cx="119" cy={72+bY} rx="3" ry="3" fill="#fff"/>
          {/* Iris */}
          <ellipse cx="92" cy={76+bY} rx="5" ry="5" fill="#5c3018"/>
          <ellipse cx="116" cy={76+bY} rx="5" ry="5" fill="#5c3018"/>
        </>
      )}

      {/* ── NOSE ── */}
      <ellipse cx="104" cy={100+bY} rx="10" ry="7" fill="#2c1a0e"/>
      <ellipse cx="101" cy={98+bY} rx="3" ry="2.5" fill="#6b4a3a"/>

      {/* ── MOUTH ── */}
      {openMouth ? (
        <g>
          <path d={`M 92 ${108+bY} q 12 14 24 0`}
            stroke="#2c1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <ellipse cx="104" cy={117+bY} rx="10" ry="8" fill="#e87878"/>
          <line x1="104" y1={108+bY} x2="104" y2={118+bY} stroke="#c85858" strokeWidth="1.5"/>
        </g>
      ) : (
        <>
          <path d={`M 94 ${106+bY} q 10 8 20 0`}
            stroke="#2c1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <line x1="104" y1={100+bY} x2="104" y2={106+bY}
            stroke="#2c1a0e" strokeWidth="2"/>
        </>
      )}

      {/* Snout touch zone */}
      <ellipse cx="104" cy={104+bY} rx="22" ry="16" fill="transparent"
        onClick={()=>onZoneClick("snout")} style={{cursor:"pointer"}}/>
    </svg>
  );
}

// ─── Pet Screen ────────────────────────────────────────────────────────────────
function PetScreen({ appState, onPet, onFeed, onBuy }) {
  const [showShop, setShowShop] = useState(false);
  const [, forceTick] = useState(0);

  const coins   = appState?.coins || 0;
  const pet     = appState?.pet || {
    hunger:70, happiness:70,
    stats_updated_at: new Date().toISOString(),
  };
  const inventory = appState?.inventory || { foods:{}, outfits:[] };

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t+1), 30_000);
    return () => clearInterval(id);
  }, []);

  const eff       = getEffectivePet(pet);
  const isSleeping = eff.hunger <= 15;

  const [petState,   setPetState]   = useState("stand");
  const [pettedZone, setPettedZone] = useState(null);
  const [floaters,   setFloaters]   = useState([]);
  const [reaction,   setReaction]   = useState("");
  const [zoomOffset, setZoomOffset] = useState(0);
  const zoomRef   = useRef(null);
  const zoomDir   = useRef(1);

  const triggerFloaters = (emojis) => {
    const items = emojis.map((e,i) => ({
      id: Date.now()+i, emoji:e,
      x: 25+Math.random()*50,
      tx: (Math.random()-.5)*70,
      ty: -(25+Math.random()*50),
    }));
    setFloaters(items);
    setTimeout(()=>setFloaters([]), 1000);
  };

  const showReaction = (text, ms=1600) => {
    setReaction(text);
    setTimeout(()=>setReaction(""), ms);
  };

  // Zoomies: dog runs left ↔ right fast
  const startZoomies = () => {
    if (isSleeping) return;
    setPetState("zoomies");
    showReaction("ZOOMIES!! 🏃💨", 2400);
    triggerFloaters(["💨","💨","⭐","🏃"]);
    zoomDir.current = 1;
    let ticks = 0;
    const totalTicks = 24;
    zoomRef.current = setInterval(() => {
      ticks++;
      setZoomOffset(prev => {
        const next = prev + zoomDir.current * 22;
        if (next > 60 || next < -60) zoomDir.current *= -1;
        return next;
      });
      if (ticks >= totalTicks) {
        clearInterval(zoomRef.current);
        setZoomOffset(0);
        setPetState("stand");
      }
    }, 100);
  };

  // Shake: whole body shakes like after getting wet
  const startShake = () => {
    if (isSleeping) return;
    setPetState("shake");
    showReaction("*shaking off* 💦", 1600);
    triggerFloaters(["💦","💦","✨","💦"]);
    setTimeout(() => setPetState("stand"), 1600);
  };

  // Nap: curl up and sleep briefly
  const startNap = () => {
    setPetState("nap");
    showReaction("Taking a little nap 😴", 3000);
    setTimeout(() => { setPetState("stand"); setReaction(""); }, 3000);
  };

  const handleZone = (zone) => {
    if (petState === "nap") return;
    if (isSleeping && zone !== "belly") { showReaction("Shh... sleeping 😴"); return; }
    setPettedZone(zone);
    setTimeout(() => setPettedZone(null), 1200);
    onPet();

    if (zone === "head") {
      triggerFloaters(["❤️","⭐","✨","💛","💜"]);
      showReaction("Good boy! 🥰");
    } else if (zone === "belly") {
      if (isSleeping) { showReaction("Still sleeping... 😴"); return; }
      setPetState("belly");
      setTimeout(() => setPetState("stand"), 2500);
      triggerFloaters(["😂","🤣","💖","✨","😝"]);
      showReaction("Hahaha tickles! 😂");
    } else if (zone === "back") {
      triggerFloaters(["💜","🐾","⭐","🐾"]);
      showReaction("Tail going crazy! 🐾");
    } else if (zone === "snout") {
      triggerFloaters(["😤","💨","🌟","😮"]);
      showReaction("*boop* 🐽");
    }
  };

  const handleSitStand = () => {
    if (isSleeping || petState==="nap") return;
    if (petState === "sit") {
      setPetState("stand"); showReaction("Standing! 🐾");
    } else {
      setPetState("sit");   showReaction("Sitting! 🐕");
    }
  };

  // Drag-to-feed
  const startDragFood = (itemKey) => (e) => {
    if ((inventory.foods[itemKey]||0) <= 0) return;
    e.preventDefault();
    const getP = ev => {
      const t = ev.touches ? ev.touches[0] : ev;
      return {x:t.clientX, y:t.clientY};
    };
    const pt = getP(e);
    const ghost = document.createElement("div");
    ghost.textContent = SHOP_FOODS[itemKey].emoji;
    ghost.style.cssText = `position:fixed;font-size:40px;z-index:9999;pointer-events:none;left:${pt.x-20}px;top:${pt.y-20}px;`;
    document.body.appendChild(ghost);

    const move = ev => {
      const p = getP(ev);
      ghost.style.left=(p.x-20)+"px";
      ghost.style.top=(p.y-20)+"px";
    };
    const end = ev => {
      const p = ev.changedTouches
        ? {x:ev.changedTouches[0].clientX,y:ev.changedTouches[0].clientY}
        : getP(ev);
      const dogEl = document.querySelector(".beagle-svg");
      if (dogEl) {
        const r = dogEl.getBoundingClientRect();
        const cx = r.left + r.width * 0.5;
        const cy = r.top  + r.height * 0.6;
        const dist = Math.sqrt((p.x-cx)**2+(p.y-cy)**2);
        if (dist < 80) {
          onFeed(itemKey);
          setPetState("nap"); // mouth opens to eat then relaxes
          showReaction(`Yum! ${SHOP_FOODS[itemKey].emoji} 😋`, 1200);
          triggerFloaters(["😋","❤️","✨","😍"]);
          setTimeout(()=>setPetState("stand"), 1400);
        }
      }
      ghost.remove();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, {passive:false});
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
  };

  const displayState = isSleeping ? "nap" : petState;

  return (
    <div className="pet-screen">
      <div className="coin-row">
        <div className="coin-badge">🪙 {coins}</div>
        <button className="shop-btn" onClick={()=>setShowShop(true)}>🛍️ Shop</button>
      </div>

      {/* Bars */}
      <div className="pet-bars">
        <div className="pet-bar-wrap">
          <div className="pet-bar-label">🍖 hunger</div>
          <div className="pet-bar-track">
            <div className="pet-bar-fill" style={{
              width:`${eff.hunger}%`,
              background: eff.hunger<30?"#f87171":eff.hunger<60?"#f59e0b":"#4ade80"
            }}/>
          </div>
        </div>
        <div className="pet-bar-wrap">
          <div className="pet-bar-label">💜 happiness</div>
          <div className="pet-bar-track">
            <div className="pet-bar-fill" style={{
              width:`${eff.happiness}%`,
              background: eff.happiness<30?"#f87171":"#d46ef3"
            }}/>
          </div>
        </div>
      </div>

      {/* Reaction */}
      <div className="pet-reaction">{reaction || "\u00a0"}</div>

      {/* Dog stage */}
      <div className="pet-stage">
        {floaters.map(f=>(
          <div key={f.id} className="pet-floater"
            style={{left:`${f.x}%`,"--tx":`${f.tx}px`,"--ty":`${f.ty}px`}}>
            {f.emoji}
          </div>
        ))}
        <BeagleSVG
          state={displayState}
          onZoneClick={handleZone}
          petted={pettedZone}
          zoomOffset={zoomOffset}
        />
      </div>

      <p className="pet-hint">
        {isSleeping
          ? "Hungry and asleep 😴 — drag food to wake up"
          : petState==="zoomies"
          ? "ZOOMIES!! 🏃💨"
          : "Tap head · belly · snout · back"}
      </p>

      {/* Action buttons */}
      {!isSleeping && petState !== "nap" && petState !== "belly" && (
        <div className="pet-actions">
          <button className="pet-action-btn" onClick={handleSitStand}>
            {petState==="sit"?"🐕 Stand":"🐾 Sit"}
          </button>
          <button className="pet-action-btn" onClick={startZoomies}
            disabled={petState==="zoomies"}>
            🏃 Zoomies
          </button>
          <button className="pet-action-btn" onClick={startShake}>💦 Shake</button>
          <button className="pet-action-btn" onClick={startNap}>😴 Nap</button>
        </div>
      )}

      {/* Food tray */}
      <div className="food-tray">
        {Object.entries(SHOP_FOODS).map(([key,food])=>{
          const count = inventory.foods[key]||0;
          return (
            <div key={key} className={`food-item ${count===0?"food-item--empty":""}`}>
              <div className="food-emoji"
                onMouseDown={count>0?startDragFood(key):undefined}
                onTouchStart={count>0?startDragFood(key):undefined}>
                {food.emoji}
              </div>
              <span className="food-count">x{count}</span>
            </div>
          );
        })}
      </div>

      {showShop && (
        <PetShopModal
          coins={coins} inventory={inventory} pet={pet}
          onBuy={onBuy} onClose={()=>setShowShop(false)}
        />
      )}
    </div>
  );
}

// ─── Pet Shop Modal (food only now — no outfits) ──────────────────────────────
function PetShopModal({ coins, inventory, onBuy, onClose }) {
  return (
    <div className="compliment-overlay" onClick={onClose}>
      <div className="shop-card" onClick={e=>e.stopPropagation()}>
        <div className="shop-header">
          <p className="shop-title">🛍️ Food Shop</p>
          <div className="coin-badge">🪙 {coins}</div>
        </div>
        <div className="shop-list">
          {Object.entries(SHOP_FOODS).map(([key,food])=>{
            const owned = inventory.foods[key]||0;
            const canAfford = coins >= food.cost;
            return (
              <div key={key} className="shop-item">
                <div className="shop-item-emoji">{food.emoji}</div>
                <div className="shop-item-info">
                  <p className="shop-item-name">{food.name}</p>
                  <p className="shop-item-effect">+{food.hunger} hunger{food.happiness>0?`, +${food.happiness} happy`:""}</p>
                  {owned>0&&<p className="shop-item-owned">Owned: {owned}</p>}
                </div>
                <button className="shop-buy-btn" disabled={!canAfford} onClick={()=>onBuy("food",key)}>
                  🪙 {food.cost}
                </button>
              </div>
            );
          })}
        </div>
        <p className="shop-item-effect" style={{textAlign:"center",padding:"4px 0"}}>
          Earn coins by updating status, sending drawings, adding songs & more!
        </p>
        <button className="compliment-cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}



function RoleScreen({ onSelect }) {
  return (
    <div className="role-screen">
      <div className="role-inner">
        <div className="pixel-heart">❤️</div>
        <h1 className="app-title">PixelCouple</h1>
        <p className="role-sub">Who are you?</p>
        <div className="role-buttons">
          <button className="role-btn" onClick={() => onSelect("user_1")}><span className="role-emoji">👦</span><span>DARK</span></button>
          <button className="role-btn" onClick={() => onSelect("user_2")}><span className="role-emoji">👧</span><span>WHITE</span></button>
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

  const handlePetTap = useCallback(() => { if (!socketRef.current) return; socketRef.current.emit("pet_pet"); }, []);
  const handleFeedPet = useCallback((itemKey) => { if (!socketRef.current) return; socketRef.current.emit("feed_pet", { itemKey }); }, []);
  const handleBuyItem = useCallback((itemType, itemKey) => { if (!socketRef.current) return; socketRef.current.emit("buy_item", { itemType, itemKey }); }, []);

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
        <button className={`tab-btn ${tab === "pet" ? "tab-btn--active" : ""}`} onClick={() => setTab("pet")}>🐶</button>
      </nav>

      <div className="tab-content">
        {tab === "partner" && <PartnerView partnerData={partnerData} streak={streak} onSendFlowers={handleSendFlowers} onSendCompliment={handleSendCompliment} />}
        {tab === "me" && <MyController myData={myData} onUpdate={handleUpdate} onMoodSend={handleMoodSend} isSending={isSending} streak={streak} />}
        {tab === "board" && <CanvasBoard myId={myId} appState={appState} onSendCanvas={handleSendCanvas} onClearCanvas={handleClearCanvas} />}
        {tab === "playlist" && <PlaylistScreen myId={myId} playlist={playlist} onAddSong={handleAddSong} onDeleteSong={handleDeleteSong} />}
        {tab === "pet" && <PetScreen appState={appState} onPet={handlePetTap} onFeed={handleFeedPet} onBuy={handleBuyItem} />}
      </div>
    </div>

  );
}

export default function App() {
  const [myId, setMyId] = useState(() => localStorage.getItem("pixelcouple_role") || null);
  const handleRoleSelect = (id) => { localStorage.setItem("pixelcouple_role", id); setMyId(id); };
  return myId ? <MainApp myId={myId} /> : <RoleScreen onSelect={handleRoleSelect} />;
}
