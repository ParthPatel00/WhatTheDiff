import { useState, useEffect, useRef } from "react";

// ─── Design Tokens ───
const T = {
  bg: "#1a1a1a",
  bgSurface: "#242424",
  bgElevated: "#2e2e2e",
  bgCanvas: "#1e1e1e",
  border: "#3a3a3a",
  borderFocus: "#5a5a5a",
  text: "#e8e8e8",
  textMuted: "#888",
  textDim: "#666",
  red: "#e85545",
  redMuted: "#cc4a3c",
  green: "#50dc64",
  greenMuted: "#44b854",
  yellow: "#e8c840",
  blue: "#5082ff",
  orange: "#ffa500",
  accent: "#50dc64",
  mono: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace",
  sans: "'Inter', -apple-system, sans-serif",
};

// ─── Shared Components ───

function ModeBar({ active, onSelect, modes }) {
  return (
    <div style={{ display: "flex", gap: 2, background: T.bg, padding: "10px 16px", borderBottom: `1px solid ${T.border}` }}>
      {modes.map((m) => (
        <button key={m.id} onClick={() => onSelect(m.id)} style={{
          padding: "7px 18px", borderRadius: 4, border: `1px solid ${active === m.id ? T.textMuted : T.border}`,
          background: active === m.id ? T.bgElevated : "transparent", color: active === m.id ? T.text : T.textMuted,
          fontFamily: T.mono, fontSize: 12, cursor: "pointer", letterSpacing: 0.3,
          transition: "all 0.15s ease",
        }}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, onChange, suffix = "" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: T.mono, fontSize: 11, color: T.textMuted }}>
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)}
        style={{ width: 100, accentColor: T.textMuted, height: 3 }} />
      <span style={{ color: T.text, minWidth: 28, textAlign: "right" }}>{value}{suffix}</span>
    </div>
  );
}

function Badge({ type, children }) {
  const colors = { mod: T.yellow, new: T.green, del: T.red, changed: T.red };
  const c = colors[type] || T.textMuted;
  return (
    <span style={{
      fontSize: 10, fontFamily: T.mono, padding: "2px 8px", borderRadius: 10,
      border: `1px solid ${c}40`, color: c, letterSpacing: 0.5,
    }}>
      {children}
    </span>
  );
}

function StatRow({ label, value, delta, deltaColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontFamily: T.mono, fontSize: 12 }}>
      <span style={{ color: T.textMuted }}>{label}</span>
      <span>
        <span style={{ color: T.text }}>{value}</span>
        {delta && <span style={{ color: deltaColor || T.textMuted, marginLeft: 8, fontSize: 11 }}>{delta}</span>}
      </span>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontFamily: T.mono, fontSize: 10, fontWeight: 600, color: T.textMuted,
      letterSpacing: 1.5, textTransform: "uppercase", padding: "12px 0 6px",
      borderTop: `1px solid ${T.border}`, marginTop: 8,
    }}>
      {children}
    </div>
  );
}

function DiffBar({ label, pct }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontFamily: T.mono, fontSize: 11 }}>
      <span style={{ color: T.textMuted, width: 36 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: T.bgCanvas, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct * 4, 100)}%`, height: "100%", background: T.red, borderRadius: 3, transition: "width 0.3s ease" }} />
      </div>
      <span style={{ color: T.text, width: 42, textAlign: "right", fontSize: 11 }}>{pct}%</span>
    </div>
  );
}

function StatsPanel({ compact = false }) {
  return (
    <div style={{
      width: compact ? "100%" : 260, background: T.bgSurface, borderLeft: compact ? "none" : `1px solid ${T.border}`,
      padding: "12px 16px", overflowY: "auto", flexShrink: 0,
    }}>
      <SectionHeader>Geometry</SectionHeader>
      <StatRow label="vertices" value="14,228" delta="-312" deltaColor={T.red} />
      <StatRow label="triangles" value="27,644" delta="-128" deltaColor={T.red} />
      <StatRow label="nodes" value="4" delta="±0" />
      <StatRow label="animations" value="0" delta="±0" />

      <SectionHeader>Bounding Box</SectionHeader>
      <StatRow label="x" value="1.82" delta="~0.01" deltaColor={T.green} />
      <StatRow label="y" value="2.04" delta="±0" />
      <StatRow label="z" value="1.79" delta="±0" />

      <SectionHeader>Materials</SectionHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#8b6b4a" }} />
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text }}>HelmetMaterial</span>
          </div>
          <Badge type="mod">mod</Badge>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#c0c0c0" }} />
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text }}>VisorMaterial</span>
          </div>
          <Badge type="mod">mod</Badge>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#d4a830" }} />
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text }}>GoldTrim_v2</span>
          </div>
          <Badge type="new">new</Badge>
        </div>
      </div>
      <div style={{ padding: "6px 0 2px" }}>
        <StatRow label="baseColorFactor" value="" delta="changed" deltaColor={T.red} />
        <StatRow label="roughness" value="" delta="0.42→0.31" deltaColor={T.text} />
        <StatRow label="metalness" value="" delta="0.88→0.95" deltaColor={T.text} />
      </div>

      <SectionHeader>Per-angle Diff</SectionHeader>
      <DiffBar label="front" pct={12.4} />
      <DiffBar label="back" pct={3.1} />
      <DiffBar label="left" pct={8.7} />
      <DiffBar label="right" pct={4.2} />
      <DiffBar label="top" pct={1.9} />
      <DiffBar label="3/4" pct={15.6} />
    </div>
  );
}

// ─── 3D Canvas Placeholder ───

function Canvas3D({ children, aspectRatio = 1, style = {} }) {
  return (
    <div style={{
      background: T.bgCanvas, position: "relative", display: "flex",
      alignItems: "center", justifyContent: "center", overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}

function HelmetModel({ variant = "original", scale = 1, opacity = 1 }) {
  const s = 60 * scale;
  const isModified = variant === "modified";
  return (
    <svg width={s * 2.4} height={s * 1.6} viewBox="0 0 144 96" style={{ opacity }}>
      {/* Base dome */}
      <ellipse cx="72" cy="58" rx="54" ry="32" fill={isModified ? "#7a6040" : "#6b5535"} stroke="#4a3a25" strokeWidth="1.5" />
      {/* Visor cutout */}
      <ellipse cx="72" cy="52" rx="38" ry="20" fill={isModified ? "#3a3530" : "#2e2a24"} stroke="#4a3a25" strokeWidth="1" />
      {/* Visor inner */}
      <ellipse cx="72" cy="52" rx="30" ry="14" fill="#1a1815" />
      {/* Gold trim */}
      {isModified && (
        <>
          <path d="M 30 65 Q 72 80 114 65" fill="none" stroke="#d4a830" strokeWidth="2.5" />
          <path d="M 40 58 Q 72 68 104 58" fill="none" stroke="#d4a830" strokeWidth="1.5" />
        </>
      )}
      {/* Damage marks */}
      <circle cx="48" cy="44" r="3" fill="#5a4a35" opacity="0.6" />
      <circle cx="90" cy="40" r="2" fill="#5a4a35" opacity="0.5" />
    </svg>
  );
}

// ─── Screen Components ───

// 1. UPLOAD SCREEN
function UploadScreen() {
  const [dragA, setDragA] = useState(false);
  const [dragB, setDragB] = useState(false);

  function DropZone({ label, active, onHover }) {
    return (
      <div onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} style={{
        flex: 1, border: `2px dashed ${active ? T.accent : T.border}`, borderRadius: 8,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 12, padding: 32, cursor: "pointer", background: active ? `${T.accent}08` : "transparent",
        transition: "all 0.2s ease", minHeight: 280,
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={active ? T.accent : T.textDim} strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <div style={{ fontFamily: T.mono, fontSize: 13, color: active ? T.accent : T.textMuted, letterSpacing: 0.3 }}>
          {label}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
          .glb only · max 200 MB
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2">
            <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
          </svg>
          <span style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: 0.5 }}>
            diffglb
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginLeft: 4 }}>v0.1.0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button style={{
            fontFamily: T.mono, fontSize: 11, color: T.textMuted, background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
            </svg>
            accessibility
          </button>
          <a href="#" style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, textDecoration: "none" }}>docs</a>
          <a href="#" style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, textDecoration: "none" }}>github</a>
        </div>
      </div>

      {/* Main upload area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: -0.3 }}>
            Visual diff for 3D models
          </h1>
          <p style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted, marginTop: 8 }}>
            Upload two GLB files to see what changed. Fully client-side, nothing leaves your browser.
          </p>
        </div>

        <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 720 }}>
          <DropZone label="drop original .glb" active={dragA} onHover={setDragA} />
          <div style={{ display: "flex", alignItems: "center", fontFamily: T.mono, fontSize: 11, color: T.textDim }}>vs</div>
          <DropZone label="drop modified .glb" active={dragB} onHover={setDragB} />
        </div>

        {/* Keyboard shortcuts hint */}
        <div style={{
          marginTop: 40, padding: "12px 20px", background: T.bgSurface, borderRadius: 6,
          border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 10, color: T.textDim,
          display: "flex", gap: 20,
        }}>
          <span><kbd style={{ padding: "1px 5px", background: T.bgElevated, borderRadius: 3, border: `1px solid ${T.border}`, color: T.textMuted }}>1-5</kbd> switch modes</span>
          <span><kbd style={{ padding: "1px 5px", background: T.bgElevated, borderRadius: 3, border: `1px solid ${T.border}`, color: T.textMuted }}>S</kbd> toggle sync</span>
          <span><kbd style={{ padding: "1px 5px", background: T.bgElevated, borderRadius: 3, border: `1px solid ${T.border}`, color: T.textMuted }}>←→</kbd> step angles</span>
        </div>
      </div>
    </div>
  );
}

// 2. LOADING SCREEN
function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setProgress((p) => Math.min(p + 2, 78)), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ background: T.bg, minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {[
          { name: "DamagedHelmet_v1.glb", size: "4.2 MB", done: true },
          { name: "DamagedHelmet_v2.glb", size: "4.5 MB", done: false },
        ].map((f, i) => (
          <div key={i} style={{
            width: 200, padding: 20, background: T.bgSurface, borderRadius: 8,
            border: `1px solid ${f.done ? T.accent + "40" : T.border}`, textAlign: "center",
          }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 12px", background: T.bgCanvas, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {f.done ? (
                <HelmetModel variant="original" scale={0.55} />
              ) : (
                <div style={{ width: 24, height: 24, border: `2px solid ${T.textDim}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              )}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text, marginBottom: 4 }}>{f.name}</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{f.size}</div>
            {f.done ? (
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.accent, marginTop: 8 }}>✓ parsed</div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 3, background: T.bgCanvas, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: T.accent, borderRadius: 2, transition: "width 0.1s linear" }} />
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, marginTop: 4 }}>parsing geometry...</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// 3. SIDE BY SIDE VIEW
function SideBySideView() {
  const [synced, setSynced] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Sub-header */}
      <div style={{ display: "flex", background: T.bgSurface, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ flex: 1, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderRight: `1px solid ${T.border}` }}>
          <div>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>original</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text, marginLeft: 12 }}>DamagedHelmet_v1.glb</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>modified</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text, marginLeft: 12 }}>DamagedHelmet_v2.glb</span>
          </div>
          <button onClick={() => setSynced(!synced)} style={{
            fontFamily: T.mono, fontSize: 10, color: synced ? T.accent : T.textDim,
            background: synced ? `${T.accent}15` : "transparent", border: `1px solid ${synced ? T.accent + "40" : T.border}`,
            padding: "3px 10px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {synced ? <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>
                : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
            </svg>
            {synced ? "synced" : "unlocked"}
          </button>
        </div>
      </div>

      {/* Canvases */}
      <div style={{ display: "flex", flex: 1 }}>
        <Canvas3D style={{ flex: 1, borderRight: `1px solid ${T.border}`, minHeight: 320 }}>
          <HelmetModel variant="original" scale={1.1} />
        </Canvas3D>
        <Canvas3D style={{ flex: 1, minHeight: 320 }}>
          <HelmetModel variant="modified" scale={1.1} />
        </Canvas3D>
      </div>
    </div>
  );
}

// 4. GHOST OVERLAY VIEW
function GhostOverlayView() {
  const [opacity, setOpacity] = useState(50);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", background: T.bgSurface, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted }}>ghost overlay
          <span style={{ color: T.textDim, marginLeft: 16, fontSize: 11 }}>red = removed · green = added · overlap = mixed tone</span>
        </span>
        <Slider label="opacity" value={opacity} min={20} max={90} onChange={setOpacity} />
      </div>
      <Canvas3D style={{ flex: 1, minHeight: 360 }}>
        {/* Ghost overlay composite */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, opacity: opacity / 100 }}>
            <HelmetModel variant="original" scale={1.2} />
          </div>
          <div style={{ position: "relative", opacity: opacity / 100, mixBlendMode: "screen" }}>
            <HelmetModel variant="modified" scale={1.2} />
          </div>
        </div>
      </Canvas3D>
      {/* Legend */}
      <div style={{ display: "flex", gap: 20, padding: "8px 16px", background: T.bgSurface, borderTop: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: T.red }} /> only in v1
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: T.green }} /> only in v2
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: T.textDim }} /> overlap (mixed tone)
        </span>
      </div>
    </div>
  );
}

// 5. PIXEL DIFF VIEW
function PixelDiffView() {
  const [tolerance, setTolerance] = useState(29);
  const [angle, setAngle] = useState(0);
  const angles = ["front", "back", "left", "right", "top", "3/4"];
  const pcts = [12.4, 3.1, 8.7, 4.2, 1.9, 15.6];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", background: T.bgSurface, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted }}>pixel diff</span>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent }}>{pcts[angle]}% changed</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 2 }}>
            {angles.map((a, i) => (
              <button key={a} onClick={() => setAngle(i)} style={{
                fontFamily: T.mono, fontSize: 10, padding: "3px 8px", borderRadius: 3,
                border: `1px solid ${angle === i ? T.textMuted : T.border}`,
                background: angle === i ? T.bgElevated : "transparent",
                color: angle === i ? T.text : T.textDim, cursor: "pointer",
              }}>
                {a}
              </button>
            ))}
          </div>
          <Slider label="tolerance" value={tolerance} min={0} max={50} onChange={setTolerance} />
        </div>
      </div>
      <Canvas3D style={{ flex: 1, minHeight: 360 }}>
        <div style={{ position: "relative" }}>
          <HelmetModel variant="original" scale={1.2} opacity={0.4} />
          {/* Diff highlights */}
          <svg style={{ position: "absolute", top: "10%", left: "15%", opacity: 0.7 }} width="100" height="80" viewBox="0 0 100 80">
            <circle cx="30" cy="25" r="18" fill={T.red} opacity="0.6" />
            <circle cx="65" cy="35" r="12" fill={T.red} opacity="0.5" />
            <circle cx="50" cy="55" r="8" fill={T.red} opacity="0.4" />
            <ellipse cx="50" cy="65" rx="40" ry="6" fill={T.red} opacity="0.3" />
          </svg>
        </div>
      </Canvas3D>
    </div>
  );
}

// 6. ALL ANGLES VIEW
function AllAnglesView() {
  const [tolerance, setTolerance] = useState(29);
  const angles = [
    { name: "front", pct: 12.4 }, { name: "back", pct: 3.1 }, { name: "left", pct: 8.7 },
    { name: "right", pct: 4.2 }, { name: "top", pct: 1.9 }, { name: "3/4", pct: 15.6 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", background: T.bgSurface, borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted }}>all angles</span>
        <Slider label="tolerance" value={tolerance} min={0} max={50} onChange={setTolerance} />
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border, padding: 0 }}>
        {angles.map((a) => (
          <div key={a.name} style={{
            background: T.bgCanvas, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 16, cursor: "pointer",
            position: "relative", minHeight: 160,
          }}>
            <HelmetModel variant="modified" scale={0.6} />
            {/* Diff overlay dots */}
            {a.pct > 5 && (
              <svg style={{ position: "absolute", top: "20%", left: "30%" }} width="60" height="50" viewBox="0 0 60 50">
                <circle cx="20" cy="15" r={a.pct * 0.6} fill={T.red} opacity="0.5" />
                <circle cx="40" cy="30" r={a.pct * 0.4} fill={T.red} opacity="0.4" />
              </svg>
            )}
            <div style={{
              position: "absolute", bottom: 8, left: 0, right: 0,
              display: "flex", justifyContent: "space-between", padding: "0 12px",
              fontFamily: T.mono, fontSize: 10,
            }}>
              <span style={{ color: T.textMuted }}>{a.name}</span>
              <span style={{ color: a.pct > 10 ? T.red : T.textMuted }}>{a.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 7. TURNTABLE VIEW
function TurntableView() {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRotation((r) => (r + 1) % 360), 30);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ padding: "8px 16px", background: T.bgSurface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textMuted }}>turntable</span>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>auto-rotating · synced Y axis</span>
        <div style={{ marginLeft: "auto", fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{rotation}°</div>
      </div>
      <div style={{ display: "flex", flex: 1 }}>
        <Canvas3D style={{ flex: 1, borderRight: `1px solid ${T.border}`, minHeight: 320 }}>
          <div style={{ transform: `rotateY(${rotation}deg)`, transition: "transform 0.03s linear" }}>
            <HelmetModel variant="original" scale={1} />
          </div>
          <div style={{ position: "absolute", bottom: 8, left: 12, fontFamily: T.mono, fontSize: 10, color: T.textDim }}>v1</div>
        </Canvas3D>
        <Canvas3D style={{ flex: 1, minHeight: 320 }}>
          <div style={{ transform: `rotateY(${rotation}deg)`, transition: "transform 0.03s linear" }}>
            <HelmetModel variant="modified" scale={1} />
          </div>
          <div style={{ position: "absolute", bottom: 8, left: 12, fontFamily: T.mono, fontSize: 10, color: T.textDim }}>v2</div>
        </Canvas3D>
      </div>
    </div>
  );
}

// 8. NO DIFFERENCES SCREEN
function NoDiffScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: T.bgCanvas }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: `${T.accent}15`,
        border: `2px solid ${T.accent}40`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 15, color: T.text, fontWeight: 600 }}>No differences found</div>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, textAlign: "center", maxWidth: 300 }}>
        Both files produce identical renders across all 6 angles and have matching structural data.
      </div>
      <button style={{
        fontFamily: T.mono, fontSize: 11, color: T.textMuted, background: T.bgSurface,
        border: `1px solid ${T.border}`, padding: "6px 16px", borderRadius: 4, cursor: "pointer", marginTop: 8,
      }}>
        upload different files
      </button>
    </div>
  );
}

// 9. ERROR / CONTEXT LOST SCREEN
function ContextLostScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: T.bgCanvas }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: `${T.red}15`,
        border: `2px solid ${T.red}40`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 15, color: T.text, fontWeight: 600 }}>WebGL context lost</div>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMuted, textAlign: "center", maxWidth: 320 }}>
        The GPU context was interrupted. This can happen from memory pressure, tab backgrounding, or driver resets.
      </div>
      <button style={{
        fontFamily: T.mono, fontSize: 11, color: T.text, background: T.bgElevated,
        border: `1px solid ${T.border}`, padding: "8px 20px", borderRadius: 4, cursor: "pointer", marginTop: 4,
      }}>
        click to restore
      </button>
    </div>
  );
}

// 10. ACCESSIBILITY PANEL
function AccessibilityPanel({ onClose }) {
  const [colorblind, setColorblind] = useState(false);
  return (
    <div style={{
      position: "absolute", top: 48, right: 16, width: 280, background: T.bgSurface,
      border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, zIndex: 100,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.text }}>Accessibility</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text }}>Colorblind-safe mode</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 2 }}>Uses blue/orange instead of red/green</div>
        </div>
        <button onClick={() => setColorblind(!colorblind)} style={{
          width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
          background: colorblind ? T.accent : T.bgElevated, position: "relative", transition: "background 0.2s",
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 2, left: colorblind ? 18 : 2, transition: "left 0.2s",
          }} />
        </button>
      </div>
      <div style={{ padding: "12px 0" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginBottom: 8 }}>Color preview</div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: colorblind ? T.blue : T.red }} />
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>removed</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: colorblind ? T.orange : T.green }} />
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>added</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginBottom: 6 }}>Keyboard shortcuts</div>
        {[
          ["1-5", "switch modes"], ["S", "toggle camera sync"], ["← →", "step angles"],
        ].map(([key, desc]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <kbd style={{ fontFamily: T.mono, fontSize: 10, padding: "1px 6px", background: T.bgElevated, borderRadius: 3, border: `1px solid ${T.border}`, color: T.text }}>{key}</kbd>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMuted }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 11. PARSE ERROR TOAST
function ErrorToast() {
  return (
    <div style={{
      position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
      background: T.bgElevated, border: `1px solid ${T.red}40`, borderRadius: 8,
      padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, zIndex: 100,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <div>
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.text }}>Failed to parse file</div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 2 }}>
          Error: Invalid glTF magic number. Expected .glb binary format.
        </div>
      </div>
      <button style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 16, marginLeft: 8 }}>×</button>
    </div>
  );
}

// 12. ENTIRELY DIFFERENT WARNING
function DifferentModelsWarning() {
  return (
    <div style={{
      position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
      background: T.bgElevated, border: `1px solid ${T.yellow}40`, borderRadius: 8,
      padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, zIndex: 100,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.yellow} strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.yellow }}>
        These models appear to be entirely different. This tool is designed to compare two versions of the same asset.
      </span>
    </div>
  );
}

// 13. DIFF PROGRESS OVERLAY
function DiffProgress() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDone((d) => Math.min(d + 1, 6)), 400);
    return () => clearInterval(id);
  }, []);
  const angles = ["front", "back", "left", "right", "top", "3/4"];
  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(26,26,26,0.92)", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 90,
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 13, color: T.text }}>Computing pixel diff...</div>
      <div style={{ display: "flex", gap: 8 }}>
        {angles.map((a, i) => (
          <div key={a} style={{
            width: 56, padding: "8px 0", textAlign: "center", borderRadius: 4,
            background: i < done ? `${T.accent}15` : T.bgSurface,
            border: `1px solid ${i < done ? T.accent + "40" : T.border}`,
          }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: i < done ? T.accent : T.textDim }}>{a}</div>
            {i < done && <div style={{ fontFamily: T.mono, fontSize: 9, color: T.accent, marginTop: 2 }}>✓</div>}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>{done}/6 angles complete</div>
    </div>
  );
}

// 14. CLI TERMINAL MOCKUP
function CLIMockup() {
  return (
    <div style={{
      background: "#0d1117", borderRadius: 8, padding: 20, fontFamily: T.mono, fontSize: 12,
      lineHeight: 1.8, color: "#c9d1d9", border: `1px solid ${T.border}`, overflow: "hidden",
    }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
      </div>
      <div><span style={{ color: "#7ee787" }}>$</span> git commit -m "update helmet material + gold trim"</div>
      <div style={{ color: "#8b949e" }}>[main a3f2c1d] update helmet material + gold trim</div>
      <div style={{ color: "#8b949e" }}> 1 file changed</div>
      <div style={{ marginTop: 8 }}><span style={{ color: "#79c0ff" }}>diffglb</span> Found 1 changed .glb file</div>
      <div style={{ color: "#8b949e" }}> • assets/DamagedHelmet.glb</div>
      <div style={{ marginTop: 4 }}><span style={{ color: "#79c0ff" }}>diffglb</span> Extracting HEAD~1 and HEAD versions...</div>
      <div><span style={{ color: "#79c0ff" }}>diffglb</span> <span style={{ color: "#7ee787" }}>Serving diff at http://localhost:4242</span></div>
      <div style={{ color: "#8b949e" }}> Opening browser...</div>
    </div>
  );
}

// 15. GITHUB PR COMMENT MOCKUP
function GitHubPRComment() {
  const angles = [
    { name: "front", pct: 12.4 }, { name: "left", pct: 8.7 }, { name: "3/4", pct: 15.6 },
  ];
  return (
    <div style={{
      background: "#0d1117", borderRadius: 8, border: "1px solid #30363d", overflow: "hidden",
    }}>
      {/* PR comment header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#238636", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z" />
          </svg>
        </div>
        <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: "#c9d1d9" }}>diffglb</span>
        <span style={{ fontFamily: T.sans, fontSize: 12, color: "#8b949e" }}>bot commented 2 minutes ago</span>
      </div>
      {/* Comment body */}
      <div style={{ padding: 16 }}>
        <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 600, color: "#c9d1d9", marginBottom: 12 }}>
          GLB visual diff
        </div>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: "#c9d1d9", marginBottom: 8 }}>
          DamagedHelmet
        </div>
        {/* Diff image grid */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {angles.map((a) => (
            <div key={a.name} style={{
              flex: 1, background: "#161b22", borderRadius: 6, border: "1px solid #30363d",
              padding: 8, textAlign: "center",
            }}>
              <div style={{ height: 80, background: "#1e1e1e", borderRadius: 4, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <HelmetModel variant="modified" scale={0.4} />
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: "#8b949e" }}>{a.name}</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: a.pct > 10 ? "#f85149" : "#8b949e" }}>{a.pct}%</div>
            </div>
          ))}
        </div>
        {/* Stats line */}
        <div style={{ fontFamily: T.mono, fontSize: 12, color: "#c9d1d9", display: "flex", gap: 16 }}>
          <span><strong>Vertices:</strong> <span style={{ color: "#f85149" }}>-312</span></span>
          <span><strong>Triangles:</strong> <span style={{ color: "#f85149" }}>-128</span></span>
          <span><strong>Materials changed:</strong> 2</span>
        </div>
      </div>
    </div>
  );
}

// 16. BATCH COMMIT PROMPT
function BatchPrompt() {
  return (
    <div style={{
      background: "#0d1117", borderRadius: 8, padding: 20, fontFamily: T.mono, fontSize: 12,
      lineHeight: 1.8, color: "#c9d1d9", border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
      </div>
      <div><span style={{ color: "#7ee787" }}>$</span> git commit -m "batch asset update for level 3"</div>
      <div style={{ color: "#8b949e" }}>[main f91b3e2] batch asset update for level 3</div>
      <div style={{ color: "#8b949e" }}> 12 files changed</div>
      <div style={{ marginTop: 8 }}><span style={{ color: "#79c0ff" }}>diffglb</span> Found <span style={{ color: T.yellow }}>12</span> changed .glb files (max-files: 3)</div>
      <div style={{ marginTop: 4 }}><span style={{ color: T.yellow }}>?</span> Open diffs for all 12 files? <span style={{ color: "#8b949e" }}>[y/N/pick]</span> <span style={{ color: "#fff" }}>pick</span></div>
      <div style={{ marginTop: 4, color: "#8b949e" }}> Select files to diff (space to toggle, enter to confirm):</div>
      <div> <span style={{ color: T.green }}>◉</span> assets/helmet.glb</div>
      <div> <span style={{ color: T.textDim }}>○</span> assets/sword.glb</div>
      <div> <span style={{ color: T.green }}>◉</span> assets/shield.glb</div>
      <div style={{ color: "#8b949e" }}> ... 9 more</div>
    </div>
  );
}


// ═══════════════════════════════════════
// MAIN APP: Screen Navigator
// ═══════════════════════════════════════

const SCREENS = [
  { id: "upload", label: "Upload" },
  { id: "loading", label: "Loading" },
  { id: "side-by-side", label: "Side by Side" },
  { id: "ghost", label: "Ghost Overlay" },
  { id: "pixel", label: "Pixel Diff" },
  { id: "all-angles", label: "All Angles" },
  { id: "turntable", label: "Turntable" },
  { id: "no-diff", label: "No Diff" },
  { id: "context-lost", label: "WebGL Error" },
  { id: "diff-progress", label: "Diff Progress" },
  { id: "error-toast", label: "Parse Error" },
  { id: "warning", label: "Different Models" },
  { id: "accessibility", label: "Accessibility" },
  { id: "cli", label: "CLI Hook" },
  { id: "cli-batch", label: "CLI Batch" },
  { id: "github-pr", label: "GitHub PR Bot" },
];

const VIEW_MODES = [
  { id: "side by side", label: "side by side" },
  { id: "ghost overlay", label: "ghost overlay" },
  { id: "pixel diff", label: "pixel diff" },
  { id: "turntable", label: "turntable" },
  { id: "all angles", label: "all angles" },
];

export default function DiffGLBMockups() {
  const [screen, setScreen] = useState("upload");
  const [showAccessibility, setShowAccessibility] = useState(false);

  const isViewerScreen = ["side-by-side", "ghost", "pixel", "all-angles", "turntable"].includes(screen);
  const modeMap = { "side-by-side": "side by side", ghost: "ghost overlay", pixel: "pixel diff", turntable: "turntable", "all-angles": "all angles" };
  const reverseMap = { "side by side": "side-by-side", "ghost overlay": "ghost", "pixel diff": "pixel", turntable: "turntable", "all angles": "all-angles" };

  function renderViewer() {
    switch (screen) {
      case "side-by-side": return <SideBySideView />;
      case "ghost": return <GhostOverlayView />;
      case "pixel": return <PixelDiffView />;
      case "all-angles": return <AllAnglesView />;
      case "turntable": return <TurntableView />;
      default: return null;
    }
  }

  function renderScreen() {
    if (isViewerScreen) {
      return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <ModeBar active={modeMap[screen]} onSelect={(id) => setScreen(reverseMap[id])} modes={VIEW_MODES} />
          <div style={{ display: "flex", flex: 1 }}>
            {renderViewer()}
            <StatsPanel />
          </div>
        </div>
      );
    }
    switch (screen) {
      case "upload": return <UploadScreen />;
      case "loading": return <LoadingScreen />;
      case "no-diff": return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <ModeBar active="side by side" onSelect={() => {}} modes={VIEW_MODES} />
          <div style={{ display: "flex", flex: 1 }}>
            <NoDiffScreen />
            <div style={{ width: 260, background: T.bgSurface, borderLeft: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>no data to display</span>
            </div>
          </div>
        </div>
      );
      case "context-lost": return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <ModeBar active="side by side" onSelect={() => {}} modes={VIEW_MODES} />
          <div style={{ display: "flex", flex: 1 }}><ContextLostScreen /></div>
        </div>
      );
      case "diff-progress": return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
          <ModeBar active="pixel diff" onSelect={() => {}} modes={VIEW_MODES} />
          <div style={{ display: "flex", flex: 1, position: "relative" }}>
            <Canvas3D style={{ flex: 1 }}><HelmetModel variant="original" scale={0.8} opacity={0.3} /></Canvas3D>
            <StatsPanel />
            <DiffProgress />
          </div>
        </div>
      );
      case "error-toast": return (
        <div style={{ flex: 1, position: "relative" }}>
          <UploadScreen />
          <ErrorToast />
        </div>
      );
      case "warning": return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
          <ModeBar active="pixel diff" onSelect={() => {}} modes={VIEW_MODES} />
          <div style={{ display: "flex", flex: 1, position: "relative" }}>
            <Canvas3D style={{ flex: 1 }}><HelmetModel variant="original" scale={0.8} /></Canvas3D>
            <StatsPanel />
            <DifferentModelsWarning />
          </div>
        </div>
      );
      case "accessibility": return (
        <div style={{ flex: 1, position: "relative" }}>
          <UploadScreen />
          <AccessibilityPanel onClose={() => setScreen("upload")} />
        </div>
      );
      case "cli": return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: T.bg }}>
          <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>
            Tier 1: Local Git Hook
          </div>
          <div style={{ width: "100%", maxWidth: 600 }}><CLIMockup /></div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 12 }}>
            Post-commit hook auto-opens diff viewer in browser
          </div>
        </div>
      );
      case "cli-batch": return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: T.bg }}>
          <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>
            Batch Commit Protection
          </div>
          <div style={{ width: "100%", maxWidth: 600 }}><BatchPrompt /></div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 12 }}>
            Interactive picker when changed files exceed --max-files threshold
          </div>
        </div>
      );
      case "github-pr": return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, background: T.bg }}>
          <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 16 }}>
            Tier 2: GitHub Actions Bot Comment
          </div>
          <div style={{ width: "100%", maxWidth: 600 }}><GitHubPRComment /></div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 12 }}>
            CI posts diff images + stats to every PR that touches .glb files
          </div>
        </div>
      );
      default: return <UploadScreen />;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text, overflow: "hidden" }}>
      {/* Screen selector strip */}
      <div style={{
        display: "flex", gap: 0, padding: "0 8px", background: "#111",
        borderBottom: `1px solid ${T.border}`, overflowX: "auto", flexShrink: 0,
      }}>
        {SCREENS.map((s) => (
          <button key={s.id} onClick={() => setScreen(s.id)} style={{
            padding: "8px 12px", fontFamily: T.mono, fontSize: 10, border: "none",
            background: screen === s.id ? T.bgSurface : "transparent",
            color: screen === s.id ? T.accent : T.textDim,
            cursor: "pointer", whiteSpace: "nowrap", borderBottom: screen === s.id ? `2px solid ${T.accent}` : "2px solid transparent",
            transition: "all 0.15s",
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Screen content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {renderScreen()}
      </div>
    </div>
  );
}
