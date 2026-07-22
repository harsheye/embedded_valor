import React, { useRef, useEffect, useCallback } from 'react';

export type SpinnerPreset = 'fire-circle' | 'fire-ring' | 'flame-burst';

export const SPINNER_PRESETS: { id: SpinnerPreset; name: string; emoji: string }[] = [
  { id: 'fire-circle', name: 'Fire Circle', emoji: '🔥' },
  { id: 'fire-ring', name: 'Flame Ring', emoji: '🌀' },
  { id: 'flame-burst', name: 'Flame Burst', emoji: '💥' },
];

interface LoadingSpinnerProps {
  customLoaderUrl?: string;
  customLoaderType?: 'default' | 'image' | 'video' | 'gif';
  preset?: SpinnerPreset;
}

/* ═══════════════════════════════════════════════════════════════════
   1. FIRE CIRCLE — Dense particle ring with heat glow
   ═══════════════════════════════════════════════════════════════════ */
const FireCircle: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const S = 180;
    canvas.width = S; canvas.height = S;
    const cx = S / 2, cy = S / 2, R = 48;

    interface P {
      a: number; r: number; s: number; l: number; ml: number;
      va: number; vr: number; h: number; bright: number;
    }

    const ps: P[] = [];
    let rot = 0;

    const draw = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.clearRect(0, 0, S, S);

      rot += 0.028;

      // Spawn dense ring particles
      for (let i = 0; i < 12; i++) {
        const a = rot + Math.random() * Math.PI * 2;
        ps.push({
          a,
          r: R + (Math.random() - 0.5) * 14,
          s: 1.5 + Math.random() * 6,
          l: 0,
          ml: 12 + Math.random() * 25,
          va: (Math.random() - 0.5) * 0.015,
          vr: (Math.random() - 0.5) * 1.5 + (Math.random() > 0.5 ? -0.3 : 0.3),
          h: Math.random(),
          bright: 0.4 + Math.random() * 0.6,
        });
      }

      // Background glow
      const bg = ctx.createRadialGradient(cx, cy, R - 18, cx, cy, R + 28);
      bg.addColorStop(0, 'rgba(255,50,0,0)');
      bg.addColorStop(0.4, 'rgba(255,60,0,0.06)');
      bg.addColorStop(0.7, 'rgba(255,30,0,0.03)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      // Subtle ring track
      ctx.strokeStyle = 'rgba(255,60,0,0.08)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalCompositeOperation = 'lighter';

      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.l++;
        p.a += p.va;
        p.r += p.vr * 0.3;
        p.s *= 0.985;
        p.vr *= 0.96;

        if (p.l > p.ml || p.s < 0.2) { ps.splice(i, 1); continue; }

        const t = p.l / p.ml;
        const fade = t < 0.1 ? t * 10 : Math.pow(1 - t, 1.2);
        const alpha = fade * p.bright;
        const px = cx + Math.cos(p.a) * p.r;
        const py = cy + Math.sin(p.a) * p.r;

        const g = ctx.createRadialGradient(px, py, 0, px, py, p.s);
        if (p.h > 0.6) {
          g.addColorStop(0, `rgba(255,255,180,${alpha})`);
          g.addColorStop(0.25, `rgba(255,200,50,${alpha * 0.85})`);
          g.addColorStop(0.6, `rgba(255,100,0,${alpha * 0.5})`);
          g.addColorStop(1, 'rgba(255,30,0,0)');
        } else if (p.h > 0.3) {
          g.addColorStop(0, `rgba(255,160,20,${alpha * 0.95})`);
          g.addColorStop(0.3, `rgba(255,80,0,${alpha * 0.7})`);
          g.addColorStop(0.7, `rgba(200,20,0,${alpha * 0.3})`);
          g.addColorStop(1, 'rgba(120,0,0,0)');
        } else {
          g.addColorStop(0, `rgba(255,80,0,${alpha * 0.8})`);
          g.addColorStop(0.4, `rgba(180,20,0,${alpha * 0.5})`);
          g.addColorStop(1, 'rgba(80,0,0,0)');
        }

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, p.s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      if (ps.length > 500) ps.splice(0, ps.length - 400);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: 140, height: 140 }} />;
};

/* ═══════════════════════════════════════════════════════════════════
   2. FIRE RING — Thick flame arc with head-to-tail gradient,
      purple core, flying embers, organic turbulence
   ═══════════════════════════════════════════════════════════════════ */
const FireRing: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const S = 200;
    canvas.width = S; canvas.height = S;
    const cx = S / 2, cy = S / 2, R = 60;
    const ARC_LEN = Math.PI * 1.3; // ~235° of arc

    interface P {
      a: number; rOff: number; s: number; l: number; ml: number;
      vr: number; va: number; type: 'body' | 'core' | 'purple' | 'ember' | 'tip';
    }

    const ps: P[] = [];
    let head = 0;

    // Simple noise-like function
    const noise = (x: number) => Math.sin(x * 1.7) * 0.5 + Math.sin(x * 3.1) * 0.3 + Math.sin(x * 7.3) * 0.2;

    const draw = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, S, S);
      head += 0.038;

      // Spawn particles along the arc
      for (let i = 0; i < 18; i++) {
        const pos = Math.random(); // 0 = head, 1 = tail
        const a = head - pos * ARC_LEN;
        const turb = noise(a * 5 + head * 3);
        const widthAtPos = (1 - pos * 0.6) * 22; // wider at head, narrower at tail

        // Main body particle
        ps.push({
          a: a + turb * 0.08,
          rOff: (Math.random() - 0.5) * widthAtPos + turb * 3,
          s: 2 + Math.random() * 7 * (1 - pos * 0.4),
          l: 0,
          ml: 6 + Math.random() * 14,
          vr: (Math.random() - 0.5) * 1.8 + turb * 0.5,
          va: (Math.random() - 0.5) * 0.006,
          type: 'body',
        });

        // Bright core (denser near head)
        if (pos < 0.4 && Math.random() < 0.5) {
          ps.push({
            a: a + turb * 0.04,
            rOff: (Math.random() - 0.5) * 6,
            s: 1.5 + Math.random() * 4,
            l: 0,
            ml: 5 + Math.random() * 8,
            vr: (Math.random() - 0.5) * 0.6,
            va: (Math.random() - 0.5) * 0.003,
            type: 'core',
          });
        }

        // Purple inner (sparse, center line)
        if (Math.random() < 0.15) {
          ps.push({
            a: a + turb * 0.03,
            rOff: (Math.random() - 0.5) * 8,
            s: 1.5 + Math.random() * 3.5,
            l: 0,
            ml: 5 + Math.random() * 10,
            vr: (Math.random() - 0.5) * 0.4,
            va: (Math.random() - 0.5) * 0.002,
            type: 'purple',
          });
        }
      }

      // Ember spawning
      if (Math.random() < 0.6) {
        const ePos = Math.random() * 1.4; // can extend past tail
        const ea = head - ePos * ARC_LEN;
        const dir = Math.random() > 0.5 ? 1 : -1;
        ps.push({
          a: ea,
          rOff: dir * (18 + Math.random() * 22),
          s: 1 + Math.random() * 3,
          l: 0,
          ml: 15 + Math.random() * 25,
          vr: dir * (1 + Math.random() * 2.5),
          va: (Math.random() - 0.5) * 0.02,
          type: 'ember',
        });
      }

      // Flame tip particles at the leading edge
      for (let i = 0; i < 3; i++) {
        const ta = head + (Math.random() - 0.3) * 0.3;
        ps.push({
          a: ta,
          rOff: (Math.random() - 0.5) * 12,
          s: 1.5 + Math.random() * 3.5,
          l: 0,
          ml: 4 + Math.random() * 8,
          vr: (Math.random() - 0.5) * 2,
          va: 0.01 + Math.random() * 0.015,
          type: 'tip',
        });
      }

      // Ambient glow
      const bg = ctx.createRadialGradient(cx, cy, R - 25, cx, cy, R + 40);
      bg.addColorStop(0, 'rgba(255,50,0,0)');
      bg.addColorStop(0.4, 'rgba(255,40,0,0.04)');
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S, S);

      ctx.globalCompositeOperation = 'lighter';

      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.l++;
        p.rOff += p.vr * 0.4;
        p.a += p.va;
        p.vr *= 0.97;

        if (p.l > p.ml) { ps.splice(i, 1); continue; }

        const t = p.l / p.ml;
        const fade = t < 0.08 ? t * 12.5 : Math.pow(1 - t, 0.8);
        const px = cx + Math.cos(p.a) * (R + p.rOff);
        const py = cy + Math.sin(p.a) * (R + p.rOff);
        const sz = p.s * (1 - t * 0.3);

        // Determine color based on position along arc
        const headDist = ((head - p.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const arcPos = Math.min(headDist / ARC_LEN, 1.2); // 0=head, 1=tail

        const g = ctx.createRadialGradient(px, py, 0, px, py, sz);

        if (p.type === 'core') {
          g.addColorStop(0, `rgba(255,255,230,${fade * 0.95})`);
          g.addColorStop(0.2, `rgba(255,240,120,${fade * 0.85})`);
          g.addColorStop(0.5, `rgba(255,180,30,${fade * 0.6})`);
          g.addColorStop(1, 'rgba(255,80,0,0)');
        } else if (p.type === 'purple') {
          g.addColorStop(0, `rgba(180,100,255,${fade * 0.85})`);
          g.addColorStop(0.4, `rgba(130,50,230,${fade * 0.55})`);
          g.addColorStop(1, 'rgba(80,0,180,0)');
        } else if (p.type === 'ember') {
          g.addColorStop(0, `rgba(255,180,50,${fade * 0.9})`);
          g.addColorStop(0.4, `rgba(255,80,0,${fade * 0.5})`);
          g.addColorStop(1, 'rgba(180,0,0,0)');
        } else if (p.type === 'tip') {
          g.addColorStop(0, `rgba(255,230,100,${fade * 0.9})`);
          g.addColorStop(0.3, `rgba(255,160,0,${fade * 0.65})`);
          g.addColorStop(1, 'rgba(255,60,0,0)');
        } else {
          // Body — color depends on arc position
          if (arcPos < 0.25) {
            g.addColorStop(0, `rgba(255,220,60,${fade * 0.9})`);
            g.addColorStop(0.3, `rgba(255,140,0,${fade * 0.7})`);
            g.addColorStop(0.7, `rgba(255,60,0,${fade * 0.35})`);
            g.addColorStop(1, 'rgba(200,20,0,0)');
          } else if (arcPos < 0.55) {
            g.addColorStop(0, `rgba(255,100,0,${fade * 0.85})`);
            g.addColorStop(0.35, `rgba(230,40,0,${fade * 0.6})`);
            g.addColorStop(0.7, `rgba(180,10,0,${fade * 0.3})`);
            g.addColorStop(1, 'rgba(120,0,0,0)');
          } else if (arcPos < 0.8) {
            g.addColorStop(0, `rgba(200,30,0,${fade * 0.7})`);
            g.addColorStop(0.4, `rgba(150,0,30,${fade * 0.4})`);
            g.addColorStop(1, 'rgba(80,0,60,0)');
          } else {
            g.addColorStop(0, `rgba(140,10,40,${fade * 0.5})`);
            g.addColorStop(0.5, `rgba(90,0,80,${fade * 0.25})`);
            g.addColorStop(1, 'rgba(40,0,40,0)');
          }
        }

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      if (ps.length > 800) ps.splice(0, ps.length - 600);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: 160, height: 160 }} />;
};


/* ═══════════════════════════════════════════════════════════════════
   3. FLAME BURST — Full-screen edge overlay. Flames spawn from
      all 4 edges of the player viewport and lick inward.
   ═══════════════════════════════════════════════════════════════════ */
const FlameBurst: React.FC<{ fullscreen?: boolean }> = ({ fullscreen = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 180, h: 180 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true })!;

    // Resize canvas to fill parent
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent && fullscreen) {
        const rect = parent.getBoundingClientRect();
        sizeRef.current = { w: Math.round(rect.width), h: Math.round(rect.height) };
      } else {
        sizeRef.current = { w: 180, h: 180 };
      }
      canvas.width = sizeRef.current.w;
      canvas.height = sizeRef.current.h;
    };
    resize();

    let resizeObserver: ResizeObserver | null = null;
    if (fullscreen && canvas.parentElement) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas.parentElement);
    }

    interface P {
      x: number; y: number; s: number; l: number; ml: number;
      vx: number; vy: number; h: number; bright: number;
    }

    const ps: P[] = [];

    const spawnEdge = (edge: number) => {
      const { w, h } = sizeRef.current;
      let x = 0, y = 0, vx = 0, vy = 0;
      const spread = 2 + Math.random() * 3;
      // Bigger particles for fullscreen
      const baseSize = fullscreen ? 4 + Math.random() * 14 : 2 + Math.random() * 7;
      const edgeDepth = fullscreen ? 20 : 12;
      // Deeper inward travel for fullscreen
      const inSpeed = fullscreen ? (0.5 + Math.random() * spread * 0.8) : (0.3 + Math.random() * spread * 0.6);

      switch (edge) {
        case 0: // top
          x = Math.random() * w;
          y = -2 + Math.random() * edgeDepth;
          vx = (Math.random() - 0.5) * spread * 0.4;
          vy = inSpeed;
          break;
        case 1: // right
          x = w + 2 - Math.random() * edgeDepth;
          y = Math.random() * h;
          vx = -inSpeed;
          vy = (Math.random() - 0.5) * spread * 0.4;
          break;
        case 2: // bottom
          x = Math.random() * w;
          y = h + 2 - Math.random() * edgeDepth;
          vx = (Math.random() - 0.5) * spread * 0.4;
          vy = -inSpeed;
          break;
        case 3: // left
          x = -2 + Math.random() * edgeDepth;
          y = Math.random() * h;
          vx = inSpeed;
          vy = (Math.random() - 0.5) * spread * 0.4;
          break;
      }

      ps.push({
        x, y, s: baseSize, l: 0, ml: 12 + Math.random() * 30,
        vx, vy,
        h: Math.random(),
        bright: 0.5 + Math.random() * 0.5,
      });
    };

    const draw = () => {
      const { w, h } = sizeRef.current;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      // Spawn rate scales with perimeter
      const perimFactor = fullscreen ? Math.max(1, (w + h) / 300) : 1;
      const spawnsPerEdge = Math.round(5 * perimFactor);
      for (let e = 0; e < 4; e++) {
        for (let i = 0; i < spawnsPerEdge; i++) {
          spawnEdge(e);
        }
      }

      ctx.globalCompositeOperation = 'lighter';

      // Edge glow strips
      const glowDepth = fullscreen ? Math.min(80, w * 0.08) : 40;

      const gt = ctx.createLinearGradient(0, 0, 0, glowDepth);
      gt.addColorStop(0, 'rgba(255,60,0,0.1)');
      gt.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gt;
      ctx.fillRect(0, 0, w, glowDepth);

      const gb = ctx.createLinearGradient(0, h, 0, h - glowDepth);
      gb.addColorStop(0, 'rgba(255,60,0,0.1)');
      gb.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gb;
      ctx.fillRect(0, h - glowDepth, w, glowDepth);

      const gl = ctx.createLinearGradient(0, 0, glowDepth, 0);
      gl.addColorStop(0, 'rgba(255,60,0,0.1)');
      gl.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, glowDepth, h);

      const gr = ctx.createLinearGradient(w, 0, w - glowDepth, 0);
      gr.addColorStop(0, 'rgba(255,60,0,0.1)');
      gr.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(w - glowDepth, 0, glowDepth, h);

      // Corner glow hotspots
      const corners = [[0, 0], [w, 0], [w, h], [0, h]];
      for (const [cxp, cyp] of corners) {
        const cg = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, glowDepth * 1.5);
        cg.addColorStop(0, 'rgba(255,80,0,0.08)');
        cg.addColorStop(1, 'rgba(255,30,0,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(cxp, cyp, glowDepth * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update and draw particles
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.l++;
        p.x += p.vx * 0.4;
        p.y += p.vy * 0.4;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.s *= 0.985;

        if (p.l > p.ml || p.s < 0.3) { ps.splice(i, 1); continue; }

        const t = p.l / p.ml;
        const fade = t < 0.1 ? t * 10 : Math.pow(1 - t, 1.0);
        const alpha = fade * p.bright;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);

        if (p.h > 0.65) {
          g.addColorStop(0, `rgba(255,240,80,${alpha})`);
          g.addColorStop(0.25, `rgba(255,200,20,${alpha * 0.85})`);
          g.addColorStop(0.55, `rgba(255,100,0,${alpha * 0.5})`);
          g.addColorStop(1, 'rgba(220,30,0,0)');
        } else if (p.h > 0.35) {
          g.addColorStop(0, `rgba(255,140,10,${alpha * 0.95})`);
          g.addColorStop(0.3, `rgba(255,70,0,${alpha * 0.7})`);
          g.addColorStop(0.65, `rgba(200,20,0,${alpha * 0.35})`);
          g.addColorStop(1, 'rgba(120,0,0,0)');
        } else {
          g.addColorStop(0, `rgba(240,50,0,${alpha * 0.85})`);
          g.addColorStop(0.35, `rgba(180,15,0,${alpha * 0.55})`);
          g.addColorStop(0.7, `rgba(120,0,0,${alpha * 0.2})`);
          g.addColorStop(1, 'rgba(60,0,0,0)');
        }

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      const maxP = fullscreen ? 1500 : 900;
      if (ps.length > maxP) ps.splice(0, ps.length - Math.round(maxP * 0.8));

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver?.disconnect();
    };
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    );
  }

  return <canvas ref={canvasRef} style={{ width: 150, height: 150 }} />;
};


/* ─── Preset Router ─── */
const PresetSpinner: React.FC<{ preset: SpinnerPreset; fullscreen?: boolean }> = ({ preset, fullscreen }) => {
  switch (preset) {
    case 'fire-ring': return <FireRing />;
    case 'flame-burst': return <FlameBurst fullscreen={fullscreen} />;
    case 'fire-circle':
    default: return <FireCircle />;
  }
};

/* ─── Main Export ─── */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  customLoaderUrl,
  customLoaderType = 'default',
  preset = 'fire-circle'
}) => {
  const isCustomActive = customLoaderType !== 'default' && customLoaderUrl;

  if (isCustomActive) {
    if (customLoaderType === 'video') {
      return (
        <div className="custom-loader-wrapper">
          <video src={customLoaderUrl} autoPlay loop muted playsInline
            style={{ width: '120px', height: '120px', objectFit: 'contain', borderRadius: '50%' }}
          />
        </div>
      );
    }
    return (
      <div className="custom-loader-wrapper">
        <img src={customLoaderUrl} alt="Loading..."
          style={{ width: '120px', height: '120px', objectFit: 'contain' }}
        />
      </div>
    );
  }

  // Flame Burst is special — it fills the entire parent overlay
  if (preset === 'flame-burst') {
    return <PresetSpinner preset={preset} fullscreen={true} />;
  }

  return <PresetSpinner preset={preset} />;
};

/* ─── Gallery Thumbnail (always small preview, never fullscreen) ─── */
export const SpinnerThumbnail: React.FC<{ preset: SpinnerPreset; size?: number }> = ({ preset, size = 64 }) => (
  <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
    <div style={{ transform: `scale(${size / 160})`, transformOrigin: 'center' }}>
      <PresetSpinner preset={preset} fullscreen={false} />
    </div>
  </div>
);

