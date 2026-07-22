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
   3. FLAME BURST — Edge-based flame particles pointing inward.
      Dense particle spawning from all 4 edges with realistic
      flame body shapes, flickering, and embers.
   ═══════════════════════════════════════════════════════════════════ */
const FlameBurst: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const S = 180;
    canvas.width = S; canvas.height = S;

    interface P {
      x: number; y: number; s: number; l: number; ml: number;
      vx: number; vy: number; h: number; bright: number; edge: number;
    }

    const ps: P[] = [];

    // Edge: 0=top, 1=right, 2=bottom, 3=left
    const spawnEdge = (edge: number) => {
      let x = 0, y = 0, vx = 0, vy = 0;
      const spread = 3 + Math.random() * 4;
      const sz = 2 + Math.random() * 7;

      switch (edge) {
        case 0: // top
          x = Math.random() * S;
          y = -2 + Math.random() * 12;
          vx = (Math.random() - 0.5) * spread * 0.5;
          vy = 0.3 + Math.random() * spread * 0.6;
          break;
        case 1: // right
          x = S + 2 - Math.random() * 12;
          y = Math.random() * S;
          vx = -(0.3 + Math.random() * spread * 0.6);
          vy = (Math.random() - 0.5) * spread * 0.5;
          break;
        case 2: // bottom
          x = Math.random() * S;
          y = S + 2 - Math.random() * 12;
          vx = (Math.random() - 0.5) * spread * 0.5;
          vy = -(0.3 + Math.random() * spread * 0.6);
          break;
        case 3: // left
          x = -2 + Math.random() * 12;
          y = Math.random() * S;
          vx = 0.3 + Math.random() * spread * 0.6;
          vy = (Math.random() - 0.5) * spread * 0.5;
          break;
      }

      ps.push({
        x, y, s: sz, l: 0, ml: 10 + Math.random() * 25,
        vx, vy,
        h: Math.random(),
        bright: 0.5 + Math.random() * 0.5,
        edge,
      });
    };

    const draw = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, S, S);

      // Spawn from all edges
      for (let e = 0; e < 4; e++) {
        for (let i = 0; i < 5; i++) {
          spawnEdge(e);
        }
      }

      // Edge glow
      ctx.globalCompositeOperation = 'lighter';

      // Top glow
      const gt = ctx.createLinearGradient(0, 0, 0, 40);
      gt.addColorStop(0, 'rgba(255,60,0,0.08)');
      gt.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gt;
      ctx.fillRect(0, 0, S, 40);

      // Bottom glow
      const gb = ctx.createLinearGradient(0, S, 0, S - 40);
      gb.addColorStop(0, 'rgba(255,60,0,0.08)');
      gb.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gb;
      ctx.fillRect(0, S - 40, S, 40);

      // Left glow
      const gl = ctx.createLinearGradient(0, 0, 40, 0);
      gl.addColorStop(0, 'rgba(255,60,0,0.08)');
      gl.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, 40, S);

      // Right glow
      const gr = ctx.createLinearGradient(S, 0, S - 40, 0);
      gr.addColorStop(0, 'rgba(255,60,0,0.08)');
      gr.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(S - 40, 0, 40, S);

      // Update and draw particles
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.l++;
        p.x += p.vx * 0.35;
        p.y += p.vy * 0.35;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.s *= 0.98;

        if (p.l > p.ml || p.s < 0.3) { ps.splice(i, 1); continue; }

        const t = p.l / p.ml;
        const fade = t < 0.1 ? t * 10 : Math.pow(1 - t, 1.0);
        const alpha = fade * p.bright;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);

        if (p.h > 0.65) {
          // Bright yellow core
          g.addColorStop(0, `rgba(255,240,80,${alpha})`);
          g.addColorStop(0.25, `rgba(255,200,20,${alpha * 0.85})`);
          g.addColorStop(0.55, `rgba(255,100,0,${alpha * 0.5})`);
          g.addColorStop(1, 'rgba(220,30,0,0)');
        } else if (p.h > 0.35) {
          // Orange
          g.addColorStop(0, `rgba(255,140,10,${alpha * 0.95})`);
          g.addColorStop(0.3, `rgba(255,70,0,${alpha * 0.7})`);
          g.addColorStop(0.65, `rgba(200,20,0,${alpha * 0.35})`);
          g.addColorStop(1, 'rgba(120,0,0,0)');
        } else {
          // Deep red
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
      if (ps.length > 900) ps.splice(0, ps.length - 700);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: 150, height: 150 }} />;
};


/* ─── Preset Router ─── */
const PresetSpinner: React.FC<{ preset: SpinnerPreset }> = ({ preset }) => {
  switch (preset) {
    case 'fire-ring': return <FireRing />;
    case 'flame-burst': return <FlameBurst />;
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

  return <PresetSpinner preset={preset} />;
};

/* ─── Gallery Thumbnail ─── */
export const SpinnerThumbnail: React.FC<{ preset: SpinnerPreset; size?: number }> = ({ preset, size = 64 }) => (
  <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <div style={{ transform: `scale(${size / 160})`, transformOrigin: 'center' }}>
      <PresetSpinner preset={preset} />
    </div>
  </div>
);
