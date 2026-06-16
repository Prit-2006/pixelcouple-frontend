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

// Full outfit catalog — slot: head | body | neck | face | back
const OUTFITS = {
  // HEAD
  top_hat:      { cost:80,  slot:"head", emoji:"🎩", name:"Top Hat" },
  crown:        { cost:150, slot:"head", emoji:"👑", name:"Crown" },
  party_hat:    { cost:50,  slot:"head", emoji:"🎉", name:"Party Hat" },
  bow:          { cost:40,  slot:"head", emoji:"🎀", name:"Hair Bow" },
  santa_hat:    { cost:60,  slot:"head", emoji:"🎅", name:"Santa Hat" },
  flower_crown: { cost:55,  slot:"head", emoji:"🌸", name:"Flower Crown" },
  cap:          { cost:45,  slot:"head", emoji:"🧢", name:"Cap" },
  // FACE
  sunglasses:   { cost:60,  slot:"face", emoji:"🕶️", name:"Sunglasses" },
  heart_glasses:{ cost:65,  slot:"face", emoji:"🥰", name:"Heart Glasses" },
  // NECK
  bandana:      { cost:35,  slot:"neck", emoji:"🧣", name:"Bandana" },
  bow_tie:      { cost:40,  slot:"neck", emoji:"🎗️", name:"Bow Tie" },
  collar_bell:  { cost:30,  slot:"neck", emoji:"🔔", name:"Bell Collar" },
  scarf:        { cost:45,  slot:"neck", emoji:"🧤", name:"Scarf" },
  // BODY
  hoodie:       { cost:90,  slot:"body", emoji:"👕", name:"Hoodie" },
  jacket:       { cost:100, slot:"body", emoji:"🧥", name:"Jacket" },
  tshirt:       { cost:70,  slot:"body", emoji:"👔", name:"T-Shirt" },
  cape:         { cost:110, slot:"body", emoji:"🦸", name:"Cape" },
  // BACK
  backpack:     { cost:75,  slot:"back", emoji:"🎒", name:"Backpack" },
  wings:        { cost:120, slot:"back", emoji:"🦋", name:"Fairy Wings" },
};

// Training tricks
const TRICKS = ["sit","shake","roll over","spin","stay","high five"];

// ─── Beagle SVG Component ──────────────────────────────────────────────────────
function BeagleSVG({ state, outfit, onZoneClick, petted }) {
  // state: "stand" | "sit" | "belly" | "yawn" | "spin" | "shake"
  // petted: "head"|"belly"|"back"|"snout"|null

  const tailAngle = petted ? 45 : 20;
  const bodyY = state === "sit" ? 10 : 0;
  const legsHidden = state === "sit";
  const bellyUp = state === "belly";
  const eyeHappy = petted === "head" || petted === "belly";
  const mouthOpen = petted === "snout" || state === "yawn";
  const spinning = state === "spin";

  // Outfit items
  const headItem  = outfit.head  ? OUTFITS[outfit.head]  : null;
  const faceItem  = outfit.face  ? OUTFITS[outfit.face]  : null;
  const neckItem  = outfit.neck  ? OUTFITS[outfit.neck]  : null;
  const bodyItem  = outfit.body  ? OUTFITS[outfit.body]  : null;
  const backItem  = outfit.back  ? OUTFITS[outfit.back]  : null;

  return (
    <svg
      viewBox="0 0 200 220"
      className={`beagle-svg ${spinning ? "beagle-spin" : ""}`}
      style={{ width: "100%", maxWidth: 280, overflow: "visible" }}
    >
      <defs>
        <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#e8c89a"/>
          <stop offset="100%" stopColor="#c8985a"/>
        </radialGradient>
        <radialGradient id="darkGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6b3a1f"/>
          <stop offset="100%" stopColor="#3d1e08"/>
        </radialGradient>
      </defs>

      {/* ── TAIL ── */}
      {!bellyUp && (
        <g className={petted === "back" ? "tail-wag-fast" : "tail-wag"}>
          <ellipse cx="158" cy={130 + bodyY} rx="8" ry="22" fill="#c8985a"
            transform={`rotate(${tailAngle} 158 ${152 + bodyY})`} />
          <ellipse cx="163" cy={110 + bodyY} rx="5" ry="10" fill="#fff"
            transform={`rotate(${tailAngle - 10} 158 ${152 + bodyY})`} />
        </g>
      )}

      {/* ── BACK ITEM ── */}
      {backItem && !bellyUp && (
        <text x="148" y={110 + bodyY} fontSize="28" textAnchor="middle">{backItem.emoji}</text>
      )}

      {/* ── BODY ── */}
      {!bellyUp ? (
        <g>
          {/* Main body */}
          <ellipse cx="100" cy={145 + bodyY} rx="52" ry="42" fill="url(#bodyGrad)" />
          {/* Saddle marking (classic beagle brown) */}
          <ellipse cx="100" cy={135 + bodyY} rx="38" ry="26" fill="#6b3a1f" opacity="0.55" />
          {/* White chest/belly */}
          <ellipse cx="100" cy={158 + bodyY} rx="32" ry="22" fill="#f5f0e8" />

          {/* BODY OUTFIT */}
          {bodyItem && (
            <text x="100" y={155 + bodyY} fontSize="36" textAnchor="middle">{bodyItem.emoji}</text>
          )}

          {/* Belly touch zone (invisible, big) */}
          <ellipse cx="100" cy={158 + bodyY} rx="40" ry="28" fill="transparent"
            onClick={() => onZoneClick("belly")} style={{cursor:"pointer"}} />

          {/* Back touch zone */}
          <ellipse cx="100" cy={130 + bodyY} rx="38" ry="18" fill="transparent"
            onClick={() => onZoneClick("back")} style={{cursor:"pointer"}} />
        </g>
      ) : (
        /* BELLY UP state */
        <g>
          <ellipse cx="100" cy="160" rx="52" ry="30" fill="url(#bodyGrad)" />
          <ellipse cx="100" cy="158" rx="34" ry="20" fill="#f5f0e8" />
          {/* Legs in air */}
          <ellipse cx="70" cy="130" rx="8" ry="22" fill="#c8985a" transform="rotate(-40 70 150)" />
          <ellipse cx="130" cy="130" rx="8" ry="22" fill="#c8985a" transform="rotate(40 130 150)" />
          <ellipse cx="60" cy="145" rx="8" ry="22" fill="#c8985a" transform="rotate(-20 60 165)" />
          <ellipse cx="140" cy="145" rx="8" ry="22" fill="#c8985a" transform="rotate(20 140 165)" />
          {/* Paws */}
          <ellipse cx="58" cy="115" rx="10" ry="8" fill="#c8985a" />
          <ellipse cx="142" cy="115" rx="10" ry="8" fill="#c8985a" />
          <ellipse cx="50" cy="130" rx="10" ry="8" fill="#c8985a" />
          <ellipse cx="150" cy="130" rx="10" ry="8" fill="#c8985a" />
        </g>
      )}

      {/* ── LEGS (standing) ── */}
      {!legsHidden && !bellyUp && (
        <g>
          {/* Front legs */}
          <rect x="74" y={183 + bodyY} width="14" height="30" rx="7" fill="#c8985a" />
          <rect x="112" y={183 + bodyY} width="14" height="30" rx="7" fill="#c8985a" />
          {/* Paws */}
          <ellipse cx="81" cy={215 + bodyY} rx="10" ry="7" fill="#b07840" />
          <ellipse cx="119" cy={215 + bodyY} rx="10" ry="7" fill="#b07840" />
          {/* Back legs (slightly visible) */}
          <rect x="60" y={178 + bodyY} width="14" height="28" rx="7" fill="#b07840" />
          <rect x="126" y={178 + bodyY} width="14" height="28" rx="7" fill="#b07840" />
          <ellipse cx="67" cy={208 + bodyY} rx="10" ry="7" fill="#9a6830" />
          <ellipse cx="133" cy={208 + bodyY} rx="10" ry="7" fill="#9a6830" />
        </g>
      )}

      {/* ── SITTING BACK LEGS ── */}
      {legsHidden && !bellyUp && (
        <g>
          <ellipse cx="68" cy={195 + bodyY} rx="18" ry="12" fill="#b07840" />
          <ellipse cx="132" cy={195 + bodyY} rx="18" ry="12" fill="#b07840" />
          <rect x="74" y={185 + bodyY} width="14" height="24" rx="7" fill="#c8985a" />
          <rect x="112" y={185 + bodyY} width="14" height="24" rx="7" fill="#c8985a" />
          <ellipse cx="81" cy={210 + bodyY} rx="10" ry="7" fill="#b07840" />
          <ellipse cx="119" cy={210 + bodyY} rx="10" ry="7" fill="#b07840" />
        </g>
      )}

      {/* ── NECK ── */}
      {!bellyUp && (
        <ellipse cx="100" cy={103 + bodyY} rx="22" ry="16" fill="#d4a373" />
      )}

      {/* ── NECK ITEM ── */}
      {neckItem && !bellyUp && (
        <text x="100" y={108 + bodyY} fontSize="22" textAnchor="middle">{neckItem.emoji}</text>
      )}

      {/* ── HEAD ── */}
      <g onClick={() => onZoneClick("head")} style={{cursor:"pointer"}}>
        {/* Skull */}
        <ellipse cx="100" cy={bellyUp ? 188 : 72 + bodyY} rx="38" ry="34" fill="url(#bodyGrad)" />
        {/* Brown cap marking (beagle saddle on head) */}
        <ellipse cx="100" cy={bellyUp ? 175 : 60 + bodyY} rx="28" ry="18" fill="#6b3a1f" opacity="0.6" />
        {/* White muzzle */}
        <ellipse cx="100" cy={bellyUp ? 198 : 82 + bodyY} rx="22" ry="18" fill="#f5f0e8" />
        {/* Snout */}
        <ellipse cx="100" cy={bellyUp ? 200 : 84 + bodyY} rx="14" ry="10" fill="#e8c89a" />
      </g>

      {/* ── EARS ── */}
      {!bellyUp && (
        <>
          <g className="ear-left">
            <ellipse cx="66" cy={78 + bodyY} rx="16" ry="32" fill="#6b3a1f"
              transform={`rotate(-15 66 ${62 + bodyY})`} />
          </g>
          <g className="ear-right">
            <ellipse cx="134" cy={78 + bodyY} rx="16" ry="32" fill="#6b3a1f"
              transform={`rotate(15 134 ${62 + bodyY})`} />
          </g>
        </>
      )}

      {/* ── EYES ── */}
      {eyeHappy ? (
        /* Happy squint */
        <>
          <path d={`M ${bellyUp ? 84 : 84} ${bellyUp ? 180 : 68 + bodyY} q 4 -5 8 0`}
            stroke="#3d1e08" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <path d={`M ${bellyUp ? 108 : 108} ${bellyUp ? 180 : 68 + bodyY} q 4 -5 8 0`}
            stroke="#3d1e08" strokeWidth="3" fill="none" strokeLinecap="round"/>
        </>
      ) : (
        /* Normal eyes */
        <>
          <ellipse cx={bellyUp ? 88 : 88} cy={bellyUp ? 180 : 68 + bodyY} rx="7" ry="7" fill="#3d1e08" />
          <ellipse cx={bellyUp ? 112 : 112} cy={bellyUp ? 180 : 68 + bodyY} rx="7" ry="7" fill="#3d1e08" />
          <ellipse cx={bellyUp ? 90 : 90} cy={bellyUp ? 177 : 65 + bodyY} rx="2.5" ry="2.5" fill="#fff" />
          <ellipse cx={bellyUp ? 114 : 114} cy={bellyUp ? 177 : 65 + bodyY} rx="2.5" ry="2.5" fill="#fff" />
        </>
      )}

      {/* ── NOSE ── */}
      <ellipse cx="100" cy={bellyUp ? 196 : 86 + bodyY} rx="9" ry="6" fill="#2c1a0e" />
      <ellipse cx="98" cy={bellyUp ? 194 : 84 + bodyY} rx="2.5" ry="2" fill="#6b4a3a" />

      {/* ── MOUTH ── */}
      {mouthOpen ? (
        <g>
          <path d={`M 90 ${bellyUp ? 204 : 94 + bodyY} q 10 12 20 0`}
            stroke="#2c1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          {/* Tongue */}
          <ellipse cx="100" cy={bellyUp ? 210 : 100 + bodyY} rx="9" ry="7" fill="#e87878" />
          <line x1="100" y1={bellyUp ? 204 : 100 + bodyY}
                x2="100" y2={bellyUp ? 212 : 107 + bodyY}
                stroke="#c85858" strokeWidth="1.5" />
        </g>
      ) : (
        <>
          <path d={`M 91 ${bellyUp ? 202 : 92 + bodyY} q 9 6 18 0`}
            stroke="#2c1a0e" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <line x1="100" y1={bellyUp ? 198 : 88 + bodyY}
                x2="100" y2={bellyUp ? 202 : 92 + bodyY}
                stroke="#2c1a0e" strokeWidth="2" />
        </>
      )}

      {/* ── SNOUT TOUCH ZONE ── */}
      <ellipse cx="100" cy={bellyUp ? 198 : 88 + bodyY} rx="18" ry="14" fill="transparent"
        onClick={() => onZoneClick("snout")} style={{cursor:"pointer"}} />

      {/* ── FACE ITEM ── */}
      {faceItem && !bellyUp && (
        <text x="100" y={75 + bodyY} fontSize="26" textAnchor="middle">{faceItem.emoji}</text>
      )}

      {/* ── HEAD ITEM ── */}
      {headItem && !bellyUp && (
        <text x="100" y={bellyUp ? 160 : 38 + bodyY} fontSize="34" textAnchor="middle">{headItem.emoji}</text>
      )}
    </svg>
  );
}

// ─── Pet Screen ────────────────────────────────────────────────────────────────
function PetScreen({ appState, onPet, onFeed, onEquip, onBuy }) {
  const [showShop, setShowShop] = useState(false);
  const [, forceTick] = useState(0);
  const mouthRef = useRef(null);

  const coins = appState?.coins || 0;
  const pet = appState?.pet || {
    hunger:70, happiness:70,
    stats_updated_at: new Date().toISOString(),
    equipped_head:null, equipped_face:null,
    equipped_neck:null, equipped_body:null, equipped_back:null,
  };
  const inventory = appState?.inventory || { foods:{}, outfits:[] };

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t+1), 30_000);
    return () => clearInterval(id);
  }, []);

  const eff = getEffectivePet(pet);
  const isSleeping = eff.hunger <= 15;

  const [petState, setPetState] = useState("stand"); // stand|sit|belly|yawn|spin|shake
  const [pettedZone, setPettedZone] = useState(null);
  const [floaters, setFloaters] = useState([]);
  const [reaction, setReaction] = useState(""); // text reaction above dog

  const triggerFloaters = (emojis) => {
    const items = emojis.map((e,i) => ({
      id: Date.now()+i, emoji: e,
      x: 30 + Math.random()*40,
      tx: (Math.random()-0.5)*60,
      ty: -(30+Math.random()*40),
    }));
    setFloaters(items);
    setTimeout(() => setFloaters([]), 1000);
  };

  const showReaction = (text, ms=1500) => {
    setReaction(text);
    setTimeout(() => setReaction(""), ms);
  };

  const handleZone = (zone) => {
    if (isSleeping && zone !== "belly") return;
    setPettedZone(zone);
    setTimeout(() => setPettedZone(null), 1200);
    onPet();

    if (zone === "head") {
      triggerFloaters(["❤️","⭐","✨","💛"]);
      showReaction("Good boy! 🥰");
    } else if (zone === "belly") {
      if (isSleeping) {
        showReaction("Still sleeping... 😴");
        return;
      }
      setPetState("belly");
      setTimeout(() => setPetState(prev => prev==="belly" ? "stand" : prev), 2500);
      triggerFloaters(["😂","🤣","💖","✨"]);
      showReaction("hehehe 😂");
    } else if (zone === "back") {
      triggerFloaters(["💜","🐾","⭐"]);
      showReaction("*tail wags faster* 🐾");
    } else if (zone === "snout") {
      triggerFloaters(["😤","💨","🌟"]);
      showReaction("*boop* 🤧");
    }
  };

  const handleSitStand = () => {
    if (isSleeping) return;
    setPetState(s => s === "sit" ? "stand" : "sit");
    showReaction(petState === "sit" ? "Standing! 🐾" : "Sitting! 🐕");
  };

  const handleSpin = () => {
    if (isSleeping) return;
    setPetState("spin");
    triggerFloaters(["🌀","⭐","✨"]);
    showReaction("Spinning! 🌀");
    setTimeout(() => setPetState("stand"), 800);
  };

  const handleYawn = () => {
    setPetState("yawn");
    showReaction("*yawn* 😪");
    setTimeout(() => setPetState("stand"), 1500);
  };

  // Drag-to-feed
  const startDragFood = (itemKey) => (e) => {
    if ((inventory.foods[itemKey]||0) <= 0) return;
    e.preventDefault();
    const getP = ev => {
      const t = ev.touches ? ev.touches[0] : ev;
      return { x:t.clientX, y:t.clientY };
    };
    const pt = getP(e);
    const ghost = document.createElement("div");
    ghost.textContent = SHOP_FOODS[itemKey].emoji;
    ghost.style.cssText = `position:fixed;font-size:36px;z-index:9999;pointer-events:none;left:${pt.x-18}px;top:${pt.y-18}px;`;
    document.body.appendChild(ghost);

    // Find dog mouth position
    const dogEl = document.querySelector(".beagle-svg");

    const move = ev => {
      const p = getP(ev);
      ghost.style.left=(p.x-18)+"px";
      ghost.style.top=(p.y-18)+"px";
    };
    const end = ev => {
      const p = ev.changedTouches
        ? {x:ev.changedTouches[0].clientX,y:ev.changedTouches[0].clientY}
        : getP(ev);
      if (dogEl) {
        const r = dogEl.getBoundingClientRect();
        const cx = r.left + r.width*0.5;
        const cy = r.top + r.height*0.62; // mouth is ~62% down
        const dist = Math.sqrt((p.x-cx)**2+(p.y-cy)**2);
        if (dist < 70) {
          onFeed(itemKey);
          setPetState("yawn"); // open mouth to eat
          showReaction(`Yum! ${SHOP_FOODS[itemKey].emoji}`, 1200);
          triggerFloaters(["😋","❤️","✨"]);
          setTimeout(() => setPetState("stand"), 1500);
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

  const outfit = {
    head:  pet.equipped_head  || null,
    face:  pet.equipped_face  || null,
    neck:  pet.equipped_neck  || null,
    body:  pet.equipped_body  || null,
    back:  pet.equipped_back  || null,
  };

  return (
    <div className="pet-screen">
      <div className="coin-row">
        <div className="coin-badge">🪙 {coins}</div>
        <button className="shop-btn" onClick={() => setShowShop(true)}>🛍️ Shop</button>
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

      {/* Reaction text */}
      <div className="pet-reaction">{reaction || "\u00a0"}</div>

      {/* Dog stage */}
      <div className="pet-stage" style={{position:"relative"}}>
        {/* Floating emojis */}
        {floaters.map(f => (
          <div key={f.id} className="pet-floater"
            style={{left:`${f.x}%`, "--tx":`${f.tx}px`, "--ty":`${f.ty}px`}}>
            {f.emoji}
          </div>
        ))}
        {isSleeping && <div className="dog-zzz">💤</div>}

        <BeagleSVG
          state={isSleeping ? "belly" : petState}
          outfit={outfit}
          onZoneClick={handleZone}
          petted={pettedZone}
        />
      </div>

      {/* Gesture hint */}
      <p className="pet-hint">
        {isSleeping
          ? "Asleep 😴 — drag food to wake up"
          : "Tap head · belly · snout · back for different reactions"}
      </p>

      {/* Action buttons */}
      {!isSleeping && (
        <div className="pet-actions">
          <button className="pet-action-btn" onClick={handleSitStand}>
            {petState==="sit" ? "🐕 Stand" : "🐾 Sit"}
          </button>
          <button className="pet-action-btn" onClick={handleSpin}>🌀 Spin</button>
          <button className="pet-action-btn" onClick={handleYawn}>😪 Yawn</button>
        </div>
      )}

      {/* Food tray */}
      <div className="food-tray">
        {Object.entries(SHOP_FOODS).map(([key,food]) => {
          const count = inventory.foods[key]||0;
          return (
            <div key={key} className={`food-item ${count===0?"food-item--empty":""}`}>
              <div className="food-emoji"
                onMouseDown={count>0 ? startDragFood(key) : undefined}
                onTouchStart={count>0 ? startDragFood(key) : undefined}>
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
          onBuy={onBuy} onEquip={onEquip}
          onClose={() => setShowShop(false)}
        />
      )}
    </div>
  );
}


// ─── Pet Shop Modal ───────────────────────────────────────────────────────────
function PetShopModal({ coins, inventory, pet, onBuy, onEquip, onClose }) {
  const [section, setSection] = useState("food");

  const slots = ["head","face","neck","body","back"];
  const slotLabels = { head:"🎩 Head", face:"🕶️ Face", neck:"🧣 Neck", body:"👕 Body", back:"🎒 Back" };

  return (
    <div className="compliment-overlay" onClick={onClose}>
      <div className="shop-card" onClick={e => e.stopPropagation()}>
        <div className="shop-header">
          <p className="shop-title">🛍️ Pet Shop</p>
          <div className="coin-badge">🪙 {coins}</div>
        </div>

        {/* Section tabs */}
        <div className="shop-tabs">
          <button className={`shop-tab ${section==="food"?"shop-tab--active":""}`} onClick={()=>setSection("food")}>🍖 Food</button>
          {slots.map(s => (
            <button key={s} className={`shop-tab ${section===s?"shop-tab--active":""}`} onClick={()=>setSection(s)}>
              {slotLabels[s]}
            </button>
          ))}
        </div>

        <div className="shop-list">
          {section === "food" && Object.entries(SHOP_FOODS).map(([key,food]) => {
            const owned = inventory.foods[key]||0;
            const canAfford = coins >= food.cost;
            return (
              <div key={key} className="shop-item">
                <div className="shop-item-emoji">{food.emoji}</div>
                <div className="shop-item-info">
                  <p className="shop-item-name">{food.name}</p>
                  <p className="shop-item-effect">+{food.hunger} hunger{food.happiness>0?`, +${food.happiness} happy`:""}</p>
                  {owned>0 && <p className="shop-item-owned">Owned: {owned}</p>}
                </div>
                <button className="shop-buy-btn" disabled={!canAfford} onClick={()=>onBuy("food",key)}>
                  🪙 {food.cost}
                </button>
              </div>
            );
          })}

          {slots.includes(section) && Object.entries(OUTFITS)
            .filter(([,item]) => item.slot === section)
            .map(([key,item]) => {
              const owned = inventory.outfits.includes(key);
              const canAfford = coins >= item.cost;
              const isEquipped = pet[`equipped_${section}`] === key;
              return (
                <div key={key} className="shop-item">
                  <div className="shop-item-emoji">{item.emoji}</div>
                  <div className="shop-item-info">
                    <p className="shop-item-name">{item.name}</p>
                    <p className="shop-item-effect">{slotLabels[section]} slot</p>
                  </div>
                  {owned ? (
                    <button
                      className={`shop-equip-btn ${isEquipped?"shop-equip-btn--active":""}`}
                      onClick={()=>onEquip(section, isEquipped ? null : key)}
                    >
                      {isEquipped ? "On ✓" : "Equip"}
                    </button>
                  ) : (
                    <button className="shop-buy-btn" disabled={!canAfford} onClick={()=>onBuy("outfit",key)}>
                      🪙 {item.cost}
                    </button>
                  )}
                </div>
              );
          })}
        </div>

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
  const handleEquipItem = useCallback((slot, itemKey) => { if (!socketRef.current) return; socketRef.current.emit("equip_item", { slot, itemKey }); }, []);
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
        {tab === "pet" && <PetScreen appState={appState} onPet={handlePetTap} onFeed={handleFeedPet} onEquip={handleEquipItem} onBuy={handleBuyItem} />}
      </div>
    </div>

  );
}

export default function App() {
  const [myId, setMyId] = useState(() => localStorage.getItem("pixelcouple_role") || null);
  const handleRoleSelect = (id) => { localStorage.setItem("pixelcouple_role", id); setMyId(id); };
  return myId ? <MainApp myId={myId} /> : <RoleScreen onSelect={handleRoleSelect} />;
}
