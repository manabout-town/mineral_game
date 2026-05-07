/**
 * MineralRush.jsx — "The Glowing Depths"
 * Place in: src/view/MineralRush.jsx
 *
 * Stack: React 18 + Tailwind CSS + lucide-react
 * Style: 32-bit Pixel Art  /  Steampunk Mining Idle-Clicker
 * Ref  : Timber Rush UI system (card rarity, HUD, particle feedback)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Pickaxe, Coins, Zap, Shield, Star,
  Cpu, Gem, Wind, RefreshCw, Hammer,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════ */
const UPGRADES = [
  { id: "pickaxe",    name: "Steel Pickaxe",   desc: "Forges a sharper mining edge.",      statKey: "clickPower", delta: 2,  rarity: "common",    Icon: Pickaxe, statLabel: "Click Power" },
  { id: "drone",      name: "Drone Mk.II",     desc: "Autonomous ore excavation unit.",    statKey: "autoRate",   delta: 1,  rarity: "rare",      Icon: Cpu,     statLabel: "Auto/sec" },
  { id: "deepstrike", name: "Deep Strike",     desc: "Uncover the hidden vein layers.",    statKey: "clickPower", delta: 5,  rarity: "legendary", Icon: Zap,     statLabel: "Click Power" },
  { id: "shield",     name: "Ore Shield",      desc: "Reinforces ore integrity.",          statKey: "clickPower", delta: 1,  rarity: "common",    Icon: Shield,  statLabel: "Click Power" },
  { id: "goldvein",   name: "Gold Vein",       desc: "Rich golden seams discovered.",     statKey: "goldBonus",  delta: 2,  rarity: "rare",      Icon: Coins,   statLabel: "Gold/click" },
  { id: "crystal",    name: "Crystal Core",    desc: "Ancient crystal power unleashed.",  statKey: "clickPower", delta: 10, rarity: "legendary", Icon: Star,    statLabel: "Click Power" },
  { id: "gem",        name: "Gem Infusion",    desc: "Imbues strikes with gem energy.",   statKey: "clickPower", delta: 3,  rarity: "common",    Icon: Gem,     statLabel: "Click Power" },
  { id: "windrill",   name: "Wind Drill",      desc: "Penetrating whirlwind bore tech.",  statKey: "autoRate",   delta: 2,  rarity: "rare",      Icon: Wind,    statLabel: "Auto/sec" },
  { id: "hammer",     name: "War Hammer",      desc: "Crushes ore in a single blow.",     statKey: "clickPower", delta: 4,  rarity: "common",    Icon: Hammer,  statLabel: "Click Power" },
];

/* Rarity visual configs — mirrors Timber Rush's card rarity palette */
const RARITY = {
  common: {
    label:       "COMMON",
    border:      "#8B5E1A",
    outerGlow:   "rgba(200,130,50,0.30)",
    headerBg:    "#1C0F03",
    cornerColor: "#C8863A",
    iconRing:    "rgba(200,130,50,0.20)",
    textColor:   "#C8963A",
    pctGlow:     "#44FF88",
    shimmer:     false,
  },
  rare: {
    label:       "RARE",
    border:      "#116688",
    outerGlow:   "rgba(0,180,230,0.35)",
    headerBg:    "#040E18",
    cornerColor: "#22AADD",
    iconRing:    "rgba(30,160,220,0.18)",
    textColor:   "#22BBEE",
    pctGlow:     "#44FF88",
    shimmer:     false,
  },
  legendary: {
    label:       "LEGENDARY",
    border:      "#9B6200",
    outerGlow:   "rgba(255,185,0,0.55)",
    headerBg:    "#1C1000",
    cornerColor: "#FFD700",
    iconRing:    "rgba(255,200,0,0.22)",
    textColor:   "#FFD700",
    pctGlow:     "#44FF88",
    shimmer:     true,
  },
};

const PARTICLE_COLORS = [
  "#00FF88", "#FF6B35", "#CC44FF", "#FFD700", "#00BBFF", "#FF3366", "#55FFAA",
];

const formatNum = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "k";
  return Math.floor(n).toString();
};

/* ═══════════════════════════════════════════════════════════
   CAVERN BACKGROUND  (stalactites + wall gems + lanterns)
═══════════════════════════════════════════════════════════ */
function CavernBG() {
  /* stable refs so the layout doesn't re-randomize on re-render */
  const stalactites = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: `${(i * 7.4 + 2) % 96}%`,
      width: 12 + (i % 5) * 9,
      height: 32 + (i % 4) * 24,
    }))
  ).current;

  const wallGems = useRef(
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      left: `${(i * 3.1 + 1) % 96}%`,
      top: `${8 + (i * 7.7) % 74}%`,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 2 + (i % 3),
      dur: 2 + (i % 3),
      delay: (i * 0.27) % 4,
    }))
  ).current;

  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      {/* ceiling darkening */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%",
        background: "linear-gradient(to bottom, #06030F 0%, transparent 100%)" }} />

      {/* floor darkening */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
        background: "linear-gradient(to top, #06020C 0%, transparent 100%)" }} />

      {/* center ambient glow */}
      <div style={{ position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)",
        width: 480, height: 320, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,200,80,0.06) 0%, transparent 70%)" }} />

      {/* stalactites */}
      {stalactites.map((s) => (
        <div key={s.id} style={{
          position: "absolute", top: 0, left: s.left, transform: "translateX(-50%)",
          width: s.width, height: s.height,
          background: "linear-gradient(180deg, #1C1428 0%, #0D0A18 100%)",
          clipPath: "polygon(20% 0%, 80% 0%, 50% 100%)",
          opacity: 0.88,
        }} />
      ))}

      {/* wall gems */}
      {wallGems.map((g) => (
        <div key={g.id} style={{
          position: "absolute", left: g.left, top: g.top,
          width: g.size, height: g.size, borderRadius: "50%",
          background: g.color,
          boxShadow: `0 0 ${g.size * 3}px ${g.color}`,
          animation: `wsp ${g.dur}s ${g.delay}s ease-in-out infinite`,
        }} />
      ))}

      {/* lanterns */}
      {[10, 90].map((x) => (
        <div key={x} style={{ position: "absolute", left: `${x}%`, top: 8, transform: "translateX(-50%)" }}>
          <div style={{ width: 2, height: 30, background: "#443322", margin: "0 auto" }} />
          <div style={{
            width: 22, height: 28, margin: "0 auto",
            background: "linear-gradient(135deg, #2A1500, #180D00)",
            border: "2px solid #664400", borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "lf 2.5s ease-in-out infinite",
          }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF8800",
              boxShadow: "0 0 12px #FF8800, 0 0 24px rgba(255,140,0,0.4)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HUD  (top bar — wood-framed resource boxes)
═══════════════════════════════════════════════════════════ */
function HUD({ minerals, gold, level, exp, expNeeded, clickPower, autoRate }) {
  const pct = Math.min((exp / expNeeded) * 100, 100);

  const ResourceBox = ({ icon, label, value, color, glowColor, align = "left" }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      flexDirection: align === "right" ? "row-reverse" : "row",
      background: "linear-gradient(135deg, #1C0F03, #110802)",
      border: "2px solid #6B3A18", borderRadius: 6,
      padding: "5px 13px",
      boxShadow: "inset 0 1px 0 rgba(255,170,60,0.08), 0 2px 6px rgba(0,0,0,0.5)",
      minWidth: 130,
    }}>
      <div style={{ color: glowColor, filter: `drop-shadow(0 0 5px ${glowColor})` }}>{icon}</div>
      <div>
        <div style={{ fontSize: 9, color: "#7A5530", letterSpacing: 2, textTransform: "uppercase",
          textAlign: align }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color, lineHeight: 1,
          textShadow: `0 0 8px ${glowColor}`, textAlign: align }}>
          {formatNum(value)}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 66,
      background: "linear-gradient(to bottom, rgba(8,4,18,0.98), rgba(6,3,14,0.82))",
      borderBottom: "2px solid #221535",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", zIndex: 20, gap: 12,
    }}>
      <ResourceBox
        icon={<Pickaxe size={16} />}
        label="MINERAL"
        value={minerals}
        color="#00FF88"
        glowColor="#00FF88"
      />

      {/* Level + EXP bar — center */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
        <div style={{ fontSize: 10, color: "#9944CC", letterSpacing: 3,
          textShadow: "0 0 6px #8800BB" }}>LEVEL {level}</div>
        <div style={{
          width: "100%", maxWidth: 180, height: 7,
          background: "#0C0818", border: "1px solid #261840", borderRadius: 3,
          overflow: "hidden", marginTop: 5,
        }}>
          <div style={{
            height: "100%", width: `${pct}%`, borderRadius: 3,
            background: "linear-gradient(to right, #7700CC, #FF00AA)",
            boxShadow: "0 0 6px #9900FF",
            transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{ fontSize: 9, color: "#3A1A44", marginTop: 2, letterSpacing: 1 }}>
          {exp} / {expNeeded} EXP
        </div>
      </div>

      <ResourceBox
        icon={<Coins size={16} />}
        label="GOLD"
        value={gold}
        color="#FFD700"
        glowColor="#FFD700"
        align="right"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANCIENT ORE  (multi-layer clickable centerpiece)
═══════════════════════════════════════════════════════════ */
function AncientOre({ shaking, clickPower }) {
  const gems = [
    { top: "22%", left: "27%", c: "#00FF88", s: 14, d: "0s" },
    { top: "50%", left: "58%", c: "#FF6B35", s: 11, d: "0.6s" },
    { top: "36%", left: "53%", c: "#CC44FF", s: 9,  d: "1.1s" },
    { top: "63%", left: "30%", c: "#00BBFF", s: 8,  d: "1.7s" },
    { top: "19%", left: "59%", c: "#FFD700", s: 10, d: "0.3s" },
    { top: "55%", left: "44%", c: "#FF3366", s: 7,  d: "0.9s" },
  ];

  return (
    <div style={{
      position: "relative", width: 186, height: 186, cursor: "crosshair",
      animation: shaking ? "shake 0.3s ease" : "gp 2.8s ease-in-out infinite",
      filter: "drop-shadow(0 0 20px rgba(0,255,136,0.3))",
    }}>
      {/* outer ambient glow ring */}
      <div style={{
        position: "absolute", inset: -18, borderRadius: "50%",
        background: "radial-gradient(circle, transparent 30%, rgba(0,180,80,0.07) 65%, transparent 80%)",
        pointerEvents: "none",
      }} />

      {/* ore body */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 38% 32%, #253A25, #0D180D 52%, #05090500)",
        borderRadius: "44% 56% 52% 48% / 38% 48% 62% 52%",
        border: "2px solid #1A3A18",
        boxShadow: "inset 0 0 40px rgba(0,0,0,0.85)",
      }}>
        {/* glowing embedded gems */}
        {gems.map((g, i) => (
          <div key={i} style={{
            position: "absolute", top: g.top, left: g.left,
            width: g.s, height: g.s,
            background: g.c, borderRadius: 2,
            boxShadow: `0 0 ${g.s}px ${g.c}, 0 0 ${g.s * 2}px ${g.c}`,
            transform: "rotate(45deg)",
            animation: `gsp ${1.5 + i * 0.28}s ${g.d} ease-in-out infinite`,
          }} />
        ))}

        {/* stylized crack lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.22 }}
          viewBox="0 0 186 186">
          <path d="M90 38 L100 72 L82 94 L105 128 L90 165" stroke="#00FF88" strokeWidth="1.5" fill="none" />
          <path d="M60 82 L82 97 L72 118"  stroke="#00AA55" strokeWidth="1" fill="none" />
          <path d="M115 62 L102 87 L118 108" stroke="#00AA55" strokeWidth="1" fill="none" />
        </svg>
      </div>

      {/* click-power badge */}
      <div style={{
        position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
        fontSize: 10, color: "#00FF88", textShadow: "0 0 6px #00FF88",
        background: "rgba(0,0,0,0.7)", padding: "1px 8px", borderRadius: 10,
        border: "1px solid rgba(0,255,136,0.25)", letterSpacing: 1, whiteSpace: "nowrap",
      }}>⚡ ×{clickPower}</div>

      {/* "click to mine" hint */}
      <div style={{
        position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)",
        fontSize: 9, color: "rgba(0,255,136,0.38)", letterSpacing: 3, whiteSpace: "nowrap",
        animation: "mi 2s ease-in-out infinite",
      }}>CLICK TO MINE</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DWARF MINER  (CSS pixel-art character on platform)
═══════════════════════════════════════════════════════════ */
function DwarfMiner() {
  return (
    <div style={{ position: "absolute", bottom: "12%", left: "7%",
      animation: "mi 3s ease-in-out infinite" }}>
      {/* wooden platform */}
      <div style={{
        width: 64, height: 9,
        background: "linear-gradient(to bottom, #9B6030, #6A3A18)",
        borderRadius: "2px 2px 0 0", border: "1px solid #BB7A3A",
        boxShadow: "0 3px 8px rgba(0,0,0,0.55)",
      }} />

      <div style={{ position: "relative", width: 64, display: "flex", justifyContent: "center" }}>
        {/* helmet */}
        <div style={{
          position: "absolute", top: -44, left: "50%", transform: "translateX(-50%)",
          width: 34, height: 13,
          background: "linear-gradient(135deg, #7A3515, #5A2010)",
          borderRadius: "3px 3px 0 0", border: "1px solid #AA5520",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* headlamp */}
          <div style={{
            width: 11, height: 7, background: "#FFD700", borderRadius: 1,
            boxShadow: "0 0 10px #FFD700, -10px 0 16px rgba(255,200,0,0.35)",
          }} />
        </div>

        {/* face */}
        <div style={{
          position: "absolute", top: -32, left: "50%", transform: "translateX(-50%)",
          width: 28, height: 22,
          background: "#DDAA77", borderRadius: 4, border: "1px solid #BB8855",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 3,
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 3, height: 3, background: "#331100", borderRadius: 1 }} />
            <div style={{ width: 3, height: 3, background: "#331100", borderRadius: 1 }} />
          </div>
          <div style={{ width: 9, height: 2, background: "#BB5533", borderRadius: 1 }} />
        </div>

        {/* beard */}
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          width: 24, height: 9, background: "#CCBB77", borderRadius: "0 0 6px 6px",
        }} />

        {/* body */}
        <div style={{
          position: "absolute", top: -3, left: "50%", transform: "translateX(-50%)",
          width: 32, height: 26,
          background: "linear-gradient(135deg, #283D55, #182838)",
          border: "1px solid #394F6A", borderRadius: 3,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 8, height: 6, background: "#FFD700", borderRadius: 1,
            boxShadow: "0 0 4px #FFD700" }} />
        </div>

        {/* legs */}
        <div style={{ display: "flex", gap: 3, marginTop: 23, justifyContent: "center" }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              width: 12, height: 18, background: "#0D1A22",
              border: "1px solid #1A2A33", borderRadius: 2,
            }}>
              <div style={{ width: "100%", height: 4, background: "#7A3515",
                borderRadius: "0 0 2px 2px", marginTop: 14 }} />
            </div>
          ))}
        </div>

        {/* steampunk pickaxe */}
        <div style={{
          position: "absolute", top: 2, right: -33,
          transform: "rotate(-32deg)",
          filter: "drop-shadow(0 0 5px rgba(255,140,0,0.6))",
        }}>
          <div style={{ width: 40, height: 4, background: "linear-gradient(to right, #7A4020, #CC8844)", borderRadius: 2 }} />
          <div style={{ width: 15, height: 10, background: "#AA6633",
            borderRadius: "0 3px 3px 0", marginTop: -4, marginLeft: 25,
            border: "1px solid #FF9933" }} />
          <div style={{ width: 7, height: 8, background: "#CC8844",
            borderRadius: "2px 0 0 2px", marginTop: -7, marginLeft: 21 }} />
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 8, color: "#6B3A20",
        marginTop: 2, letterSpacing: 1 }}>THORIN</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DRONE MINER  (hovering, pulses with blue energy)
═══════════════════════════════════════════════════════════ */
function DroneMiner({ active, rate }) {
  return (
    <div style={{
      position: "absolute", bottom: "28%", right: "6%",
      animation: "dh 3.5s ease-in-out infinite",
    }}>
      <div style={{
        width: 62, height: 30,
        background: "linear-gradient(135deg, #09152E, #050E1E)",
        border: `2px solid ${active ? "#0066CC" : "#002244"}`,
        borderRadius: 9, position: "relative",
        boxShadow: active ? "0 0 22px rgba(0,100,255,0.4), inset 0 0 10px rgba(0,0,0,0.6)" : "none",
        animation: active ? "dp 2s ease-in-out infinite" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* rotor arms */}
        {[-1, 1].map((s) => (
          <div key={s} style={{
            position: "absolute", top: -7,
            [s < 0 ? "left" : "right"]: -15,
            width: 24, height: 6,
            background: "#05101C", border: "1px solid #1A3355", borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 18, height: 2, borderRadius: 1,
              background: active ? "#0088FF" : "#001A33",
              animation: active ? "spin 0.09s linear infinite" : "none",
            }} />
          </div>
        ))}

        {/* energy core */}
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: active
            ? "radial-gradient(circle, #00CCFF 0%, #0055AA 100%)"
            : "#001122",
          boxShadow: active ? "0 0 14px #00AAFF, 0 0 28px #0066CC" : "none",
        }} />

        {/* vent slats */}
        <div style={{ position: "absolute", left: 5, display: "flex", flexDirection: "column", gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 3, height: 2, background: "#162640", borderRadius: 1 }} />
          ))}
        </div>
      </div>

      {active && (
        <div style={{
          textAlign: "center", fontSize: 8, color: "#0099FF",
          marginTop: 6, letterSpacing: 1, textShadow: "0 0 5px #0055CC",
        }}>+{rate}/sec</div>
      )}
      <div style={{
        textAlign: "center", fontSize: 8, letterSpacing: 1,
        marginTop: active ? 2 : 8, color: active ? "#003A66" : "#001122",
      }}>DRONE I</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UPGRADE CARD  (Timber Rush ornate style)
   Rarity:  common (bronze)  |  rare (teal)  |  legendary (gold)
═══════════════════════════════════════════════════════════ */
function UpgradeCard({ card, currentVal, onSelect }) {
  const cfg = RARITY[card.rarity];
  const newVal  = currentVal + card.delta;
  const pct     = currentVal > 0 ? Math.round((card.delta / currentVal) * 100) : 100;

  /* ornament diamond shape */
  const Diamond = ({ size = 16, color }) => (
    <div style={{
      width: size, height: size,
      background: color,
      clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
      boxShadow: `0 0 8px ${color}`,
      flexShrink: 0,
    }} />
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Choose ${card.name} upgrade`}
      onClick={() => onSelect(card)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(card)}
      style={{
        width: 168, minHeight: 290,
        background:
          card.rarity === "legendary"
            ? "linear-gradient(160deg, #1A1200, #100C00)"
            : card.rarity === "rare"
            ? "linear-gradient(160deg, #06101C, #030A14)"
            : "linear-gradient(160deg, #180E02, #100800)",
        border: `3px solid ${cfg.border}`,
        borderRadius: 10, cursor: "pointer",
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingBottom: 18,
        boxShadow: `0 0 16px ${cfg.outerGlow}, 0 0 40px ${cfg.outerGlow}, inset 0 0 24px rgba(0,0,0,0.6)`,
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-10px) scale(1.04)";
        e.currentTarget.style.boxShadow =
          `0 0 28px ${cfg.outerGlow}, 0 0 60px ${cfg.outerGlow}, inset 0 0 24px rgba(0,0,0,0.6)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow =
          `0 0 16px ${cfg.outerGlow}, 0 0 40px ${cfg.outerGlow}, inset 0 0 24px rgba(0,0,0,0.6)`;
      }}
    >
      {/* ── top diamond ornament ── */}
      <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)" }}>
        <Diamond size={15} color={cfg.cornerColor} />
      </div>

      {/* ── header band ── */}
      <div style={{
        width: "100%", height: 38, marginTop: 0,
        background: cfg.headerBg,
        borderBottom: `2px solid ${cfg.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {/* corner ornaments */}
        {[[2, "left", 4], [2, "right", 4]].map(([t, side, inset]) => (
          <div key={side} style={{
            position: "absolute", top: t, [side]: inset,
            width: 11, height: 11,
            border: `2px solid ${cfg.cornerColor}`,
            borderRadius: 2, opacity: 0.8,
          }} />
        ))}
        <div style={{
          fontSize: 9, letterSpacing: 3, fontWeight: "bold",
          color: cfg.textColor, textShadow: `0 0 8px ${cfg.textColor}`,
        }}>{cfg.label}</div>
      </div>

      {/* ── icon ── */}
      <div style={{
        width: 66, height: 66, borderRadius: "50%",
        background: cfg.iconRing,
        border: `2px solid ${cfg.cornerColor}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "14px auto 10px",
        color: cfg.textColor,
        filter: `drop-shadow(0 0 8px ${cfg.textColor})`,
      }}>
        <card.Icon size={30} />
      </div>

      {/* ── name ── */}
      <div style={{
        fontSize: 14, fontWeight: "bold", color: "#EEE",
        letterSpacing: 0.8, textAlign: "center",
        marginBottom: 7, padding: "0 12px",
      }}>{card.name}</div>

      {/* ── description ── */}
      <div style={{
        fontSize: 11, color: "#6A7D8A", textAlign: "center",
        lineHeight: 1.45, padding: "0 14px", marginBottom: 12,
        flexGrow: 1,
      }}>{card.desc}</div>

      {/* ── stat before → after ── */}
      <div style={{
        fontSize: 11, color: "#445566", textAlign: "center", marginBottom: 8,
      }}>
        {card.statLabel}:{" "}
        <span style={{ color: "#AABBCC" }}>{currentVal}</span>
        <span style={{ color: "#445566", margin: "0 4px" }}>→</span>
        <span style={{ color: cfg.pctGlow, textShadow: `0 0 6px ${cfg.pctGlow}` }}>{newVal}</span>
      </div>

      {/* ── % increase ── */}
      <div style={{
        fontSize: 20, fontWeight: "bold",
        color: cfg.pctGlow, textShadow: `0 0 12px ${cfg.pctGlow}`,
        letterSpacing: 1,
      }}>+{pct}%</div>

      {/* ── bottom diamond ornament ── */}
      <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)" }}>
        <Diamond size={14} color={cfg.cornerColor} />
      </div>

      {/* legendary shimmer overlay */}
      {cfg.shimmer && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 8,
          background:
            "linear-gradient(115deg, transparent 35%, rgba(255,215,0,0.07) 50%, transparent 65%)",
          animation: "sh 2.4s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LEVEL-UP OVERLAY  (3 cards + reroll button)
═══════════════════════════════════════════════════════════ */
function LevelUpOverlay({ cards, level, gameState, onSelect, onReroll, rerollCost, gold }) {
  const canReroll = gold >= rerollCost;

  return (
    /* faux-viewport wrapper — avoids position:fixed iframe collapse */
    <div style={{
      position: "absolute", inset: 0,
      background: "rgba(4, 2, 12, 0.90)",
      backdropFilter: "blur(2px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: 100,
    }}>
      {/* title */}
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div style={{ fontSize: 11, letterSpacing: 5, color: "#9933CC",
          textShadow: "0 0 10px #6600AA", textTransform: "uppercase" }}>
          Level Up!
        </div>
        <div style={{
          fontSize: 36, fontWeight: "bold", letterSpacing: 3, lineHeight: 1.1,
          background: "linear-gradient(to right, #AA00FF, #FFD700, #FF6600)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>LEVEL {level}</div>
        <div style={{ fontSize: 10, color: "#3A3A4A", letterSpacing: 4, marginTop: 5 }}>
          CHOOSE YOUR UPGRADE
        </div>
      </div>

      {/* cards row */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        {cards.map((card) => {
          const curVal =
            card.statKey === "clickPower" ? gameState.clickPower
            : card.statKey === "autoRate"   ? gameState.autoRate
            : gameState.goldBonus ?? 1;
          return (
            <UpgradeCard key={card.id} card={card} currentVal={curVal} onSelect={onSelect} />
          );
        })}
      </div>

      {/* reroll button — styled like Timber Rush's orange reroll */}
      <button
        disabled={!canReroll}
        onClick={canReroll ? onReroll : undefined}
        style={{
          marginTop: 22,
          display: "flex", alignItems: "center", gap: 9,
          padding: "10px 30px", borderRadius: 8,
          cursor: canReroll ? "pointer" : "not-allowed",
          background: canReroll
            ? "linear-gradient(135deg, #CC6600, #FF8C00)"
            : "#140D00",
          border: `2px solid ${canReroll ? "#FF9933" : "#3A2200"}`,
          opacity: canReroll ? 1 : 0.45,
          transition: "transform 0.1s ease",
        }}
        onMouseEnter={(e) => { if (canReroll) e.currentTarget.style.transform = "scale(0.95)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <RefreshCw size={14} color={canReroll ? "#FFF" : "#4A3000"} />
        <span style={{ fontSize: 14, fontWeight: "bold", letterSpacing: 2,
          color: canReroll ? "#FFF" : "#4A3000" }}>REROLL</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FFD700",
            boxShadow: "0 0 6px #FFD700" }} />
          <span style={{ fontSize: 13, color: "#FFD700", fontWeight: "bold" }}>
            {rerollCost}
          </span>
        </div>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT COMPONENT
═══════════════════════════════════════════════════════════ */
export default function MineralRush() {
  const [minerals,   setMinerals]   = useState(0);
  const [gold,       setGold]       = useState(200);
  const [level,      setLevel]      = useState(1);
  const [exp,        setExp]        = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [autoRate,   setAutoRate]   = useState(0);
  const [goldBonus,  setGoldBonus]  = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpCards, setLevelUpCards] = useState([]);
  const [particles,   setParticles]  = useState([]);
  const [oreShaking,  setOreShaking] = useState(false);
  const [rerollCost,  setRerollCost] = useState(100);

  const pidRef = useRef(0);
  const expNeeded = level * 10;
  const gameState = { clickPower, autoRate, goldBonus };

  /* auto-mine (drone) */
  useEffect(() => {
    if (autoRate <= 0) return;
    const iv = setInterval(() => {
      setMinerals((m) => m + autoRate);
      setGold((g) => g + autoRate * goldBonus);
    }, 1000);
    return () => clearInterval(iv);
  }, [autoRate, goldBonus]);

  /* ore click handler */
  const handleOreClick = useCallback((e) => {
    if (showLevelUp) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;

    setOreShaking(true);
    setTimeout(() => setOreShaking(false), 320);

    setMinerals((m) => m + clickPower);
    setGold((g) => g + clickPower * goldBonus);

    setExp((prev) => {
      const next = prev + 1;
      if (next >= expNeeded) {
        setTimeout(() => {
          setLevel((l) => l + 1);
          const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5);
          setLevelUpCards(shuffled.slice(0, 3));
          setShowLevelUp(true);
        }, 80);
        return 0;
      }
      return next;
    });

    /* spawn particles */
    const np = Array.from({ length: 10 }, () => ({
      id:    pidRef.current++,
      x: cx, y: cy,
      dx: (Math.random() - 0.5) * 170,
      dy: -(Math.random() * 120 + 30),
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      size:  Math.random() * 7 + 3,
    }));
    setParticles((p) => [...p, ...np]);
    const ids = new Set(np.map((p) => p.id));
    setTimeout(() => setParticles((p) => p.filter((pt) => !ids.has(pt.id))), 900);
  }, [clickPower, goldBonus, expNeeded, showLevelUp]);

  /* upgrade selection */
  const handleUpgradeSelect = useCallback((card) => {
    if (card.statKey === "clickPower") setClickPower((c) => c + card.delta);
    if (card.statKey === "autoRate")   setAutoRate((r) => r + card.delta);
    if (card.statKey === "goldBonus")  setGoldBonus((g) => g + card.delta);
    setShowLevelUp(false);
  }, []);

  /* reroll */
  const handleReroll = useCallback(() => {
    setGold((g) => g - rerollCost);
    setRerollCost((c) => Math.floor(c * 1.6));
    const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5);
    setLevelUpCards(shuffled.slice(0, 3));
  }, [rerollCost]);

  /* ── render ── */
  return (
    <div style={{
      position: "relative", width: "100%", height: "100vh",
      background: "radial-gradient(ellipse 80% 55% at 50% 38%, #0A0818 0%, #050310 55%, #020108 100%)",
      overflow: "hidden", fontFamily: '"Courier New", monospace', userSelect: "none",
    }}>
      <h2 className="sr-only">Mineral Rush — The Glowing Depths mining game</h2>

      <CavernBG />
      <HUD
        minerals={minerals} gold={gold}
        level={level} exp={exp} expNeeded={expNeeded}
        clickPower={clickPower} autoRate={autoRate}
      />

      <DwarfMiner />
      <DroneMiner active={autoRate > 0} rate={autoRate} />

      {/* ore click area + particle layer */}
      <div
        role="button"
        aria-label="Click to mine the Ancient Ore"
        onClick={handleOreClick}
        style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -48%)",
          cursor: "crosshair",
        }}
      >
        <AncientOre shaking={oreShaking} clickPower={clickPower} />

        {particles.map((p) => (
          <div key={p.id} style={{
            position: "absolute",
            left: p.x, top: p.y,
            width: p.size, height: p.size, borderRadius: "50%",
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            pointerEvents: "none",
            animation: "pf 0.9s ease-out forwards",
            "--pdx": `${p.dx}px`,
            "--pdy": `${p.dy}px`,
          }} />
        ))}
      </div>

      {/* level-up overlay */}
      {showLevelUp && (
        <LevelUpOverlay
          cards={levelUpCards}
          level={level}
          gameState={gameState}
          onSelect={handleUpgradeSelect}
          onReroll={handleReroll}
          rerollCost={rerollCost}
          gold={gold}
        />
      )}

      {/* ── global keyframe animations ── */}
      <style>{`
        @keyframes pf   { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--pdx),var(--pdy)) scale(0);opacity:0} }
        @keyframes shake{ 0%,100%{transform:translate(0,0)} 20%{transform:translate(-5px,2px)} 40%{transform:translate(5px,-2px)} 60%{transform:translate(-3px,4px)} 80%{transform:translate(3px,-3px)} }
        @keyframes gsp  { 0%,100%{opacity:.28;transform:rotate(45deg) scale(1)} 50%{opacity:1;transform:rotate(45deg) scale(1.55)} }
        @keyframes gp   { 0%,100%{filter:drop-shadow(0 0 18px rgba(0,255,136,.28))} 50%{filter:drop-shadow(0 0 32px rgba(0,255,136,.52))} }
        @keyframes dh   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes dp   { 0%,100%{box-shadow:0 0 22px rgba(0,100,255,.4)} 50%{box-shadow:0 0 44px rgba(0,155,255,.7)} }
        @keyframes spin { 0%{transform:rotateY(0)} 100%{transform:rotateY(360deg)} }
        @keyframes wsp  { 0%,100%{opacity:0;transform:scale(.5)} 50%{opacity:.9;transform:scale(1.35)} }
        @keyframes lf   { 0%,100%{opacity:.6;box-shadow:0 0 8px #FF8800} 50%{opacity:1;box-shadow:0 0 20px #FFAA00} }
        @keyframes mi   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes sh   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
      `}</style>
    </div>
  );
}
