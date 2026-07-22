import React, { useId, useRef, useEffect, useCallback } from 'react';

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
   1. FIRE CIRCLE — Canvas-based glowing fire ring
   ═══════════════════════════════════════════════════════════════════ */
const FireCircle: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 140, H = 140, cx = W / 2, cy = H / 2, R = 42;
    canvas.width = W; canvas.height = H;

    interface Particle {
      angle: number; r: number; size: number; life: number; maxLife: number;
      vAngle: number; vr: number; hue: number; alpha: number;
    }

    const particles: Particle[] = [];
    const spawn = (baseAngle: number) => {
      particles.push({
        angle: baseAngle + (Math.random() - 0.5) * 0.3,
        r: R + (Math.random() - 0.5) * 10,
        size: 2 + Math.random() * 5,
        life: 0,
        maxLife: 20 + Math.random() * 30,
        vAngle: (Math.random() - 0.5) * 0.01,
        vr: (Math.random() - 0.5) * 0.8,
        hue: 10 + Math.random() * 35, // 10-45 (red to orange-yellow)
        alpha: 0.6 + Math.random() * 0.4,
      });
    };

    let rotation = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      rotation += 0.025;

      // Spawn particles along the ring
      for (let i = 0; i < 4; i++) {
        const a = rotation + (i / 4) * Math.PI * 2 + (Math.random() - 0.5) * 1.5;
        spawn(a);
      }

      // Glow layer
      const glowGrad = ctx.createRadialGradient(cx, cy, R - 15, cx, cy, R + 25);
      glowGrad.addColorStop(0, 'rgba(255, 80, 0, 0)');
      glowGrad.addColorStop(0.5, 'rgba(255, 60, 0, 0.08)');
      glowGrad.addColorStop(1, 'rgba(255, 40, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, W, H);

      // Ring base (subtle)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 80, 0, 0.12)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Update & draw particles
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.angle += p.vAngle;
        p.r += p.vr;
        p.size *= 0.98;

        if (p.life > p.maxLife || p.size < 0.3) {
          particles.splice(i, 1);
          continue;
        }

        const lifeRatio = p.life / p.maxLife;
        const fadeAlpha = p.alpha * (1 - lifeRatio);
        const px = cx + Math.cos(p.angle) * p.r;
        const py = cy + Math.sin(p.angle) * p.r;

        const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size);
        if (p.hue > 30) {
          // Yellow-orange core
          grad.addColorStop(0, `rgba(255, 220, 50, ${fadeAlpha})`);
          grad.addColorStop(0.4, `rgba(255, 140, 0, ${fadeAlpha * 0.8})`);
          grad.addColorStop(1, `rgba(255, 50, 0, 0)`);
        } else {
          // Red-orange
          grad.addColorStop(0, `rgba(255, 120, 0, ${fadeAlpha})`);
          grad.addColorStop(0.4, `rgba(255, 40, 0, ${fadeAlpha * 0.7})`);
          grad.addColorStop(1, `rgba(180, 0, 0, 0)`);
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Keep particle count manageable
      if (particles.length > 200) particles.splice(0, particles.length - 200);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: 130, height: 130 }} />;
};

/* ═══════════════════════════════════════════════════════════════════
   2. FIRE RING — Thick flame arc traveling around a circle with
      organic flame shapes, embers, and purple inner core.
      Matches the first reference images (IconScout flame ring).
   ═══════════════════════════════════════════════════════════════════ */
const FireRing: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 160, H = 160, cx = W / 2, cy = H / 2, R = 50;
    canvas.width = W; canvas.height = H;

    interface FlameParticle {
      angle: number; rOffset: number; size: number;
      life: number; maxLife: number;
      vr: number; vAngle: number;
      layer: 'outer' | 'core' | 'inner' | 'ember';
    }

    const particles: FlameParticle[] = [];

    const spawnFlame = (headAngle: number) => {
      // Spawn along the arc (about 200° of trail)
      const arcLen = Math.PI * 1.1; // ~200°
      for (let i = 0; i < 6; i++) {
        const pos = Math.random(); // 0=head, 1=tail
        const a = headAngle - pos * arcLen;
        const spread = (1 - pos) * 18 + 4; // wider at head

        // Outer flame body
        particles.push({
          angle: a + (Math.random() - 0.5) * 0.15,
          rOffset: (Math.random() - 0.5) * spread,
          size: 4 + Math.random() * 8 * (1 - pos * 0.5),
          life: 0,
          maxLife: 8 + Math.random() * 15,
          vr: (Math.random() - 0.5) * 1.2,
          vAngle: (Math.random() - 0.5) * 0.008,
          layer: pos < 0.3 ? 'core' : 'outer',
        });

        // Inner purple/blue core (fewer, only along center line)
        if (Math.random() < 0.3) {
          particles.push({
            angle: a + (Math.random() - 0.5) * 0.08,
            rOffset: (Math.random() - 0.5) * 5,
            size: 2 + Math.random() * 4,
            life: 0,
            maxLife: 6 + Math.random() * 10,
            vr: (Math.random() - 0.5) * 0.5,
            vAngle: (Math.random() - 0.5) * 0.005,
            layer: 'inner',
          });
        }
      }

      // Flying embers
      if (Math.random() < 0.5) {
        const emberAngle = headAngle - Math.random() * arcLen * 1.3;
        particles.push({
          angle: emberAngle,
          rOffset: (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 20),
          size: 1.5 + Math.random() * 3,
          life: 0,
          maxLife: 15 + Math.random() * 20,
          vr: (Math.random() - 0.5) * 2,
          vAngle: (Math.random() - 0.5) * 0.02,
          layer: 'ember',
        });
      }
    };

    let headAngle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      headAngle += 0.04; // rotation speed

      spawnFlame(headAngle);

      // Background glow
      const bgGlow = ctx.createRadialGradient(cx, cy, R - 20, cx, cy, R + 30);
      bgGlow.addColorStop(0, 'rgba(255, 60, 0, 0)');
      bgGlow.addColorStop(0.5, 'rgba(255, 50, 0, 0.05)');
      bgGlow.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, W, H);

      // Draw particles with additive blending for fire glow
      ctx.globalCompositeOperation = 'lighter';

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.rOffset += p.vr;
        p.angle += p.vAngle;

        if (p.life > p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const lifeRatio = p.life / p.maxLife;
        const fade = Math.pow(1 - lifeRatio, 0.7);
        const px = cx + Math.cos(p.angle) * (R + p.rOffset);
        const py = cy + Math.sin(p.angle) * (R + p.rOffset);
        const s = p.size * (1 - lifeRatio * 0.4);

        const grad = ctx.createRadialGradient(px, py, 0, px, py, s);

        if (p.layer === 'core') {
          // Bright yellow/white at the head
          grad.addColorStop(0, `rgba(255, 240, 100, ${fade * 0.9})`);
          grad.addColorStop(0.3, `rgba(255, 180, 0, ${fade * 0.7})`);
          grad.addColorStop(0.7, `rgba(255, 80, 0, ${fade * 0.4})`);
          grad.addColorStop(1, 'rgba(255, 30, 0, 0)');
        } else if (p.layer === 'inner') {
          // Purple/blue inner core
          grad.addColorStop(0, `rgba(160, 80, 255, ${fade * 0.8})`);
          grad.addColorStop(0.5, `rgba(120, 40, 220, ${fade * 0.5})`);
          grad.addColorStop(1, 'rgba(80, 0, 180, 0)');
        } else if (p.layer === 'ember') {
          // Flying embers — orange/red
          grad.addColorStop(0, `rgba(255, 150, 30, ${fade * 0.9})`);
          grad.addColorStop(0.5, `rgba(255, 60, 0, ${fade * 0.5})`);
          grad.addColorStop(1, 'rgba(200, 0, 0, 0)');
        } else {
          // Outer flame body — orange to red
          const headDist = ((headAngle - p.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const normalizedDist = Math.min(headDist / (Math.PI * 1.1), 1); // 0=head, 1=tail
          if (normalizedDist < 0.3) {
            // Near head: orange/yellow
            grad.addColorStop(0, `rgba(255, 200, 30, ${fade * 0.85})`);
            grad.addColorStop(0.4, `rgba(255, 120, 0, ${fade * 0.6})`);
            grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
          } else if (normalizedDist < 0.7) {
            // Mid: red/orange
            grad.addColorStop(0, `rgba(255, 80, 0, ${fade * 0.8})`);
            grad.addColorStop(0.4, `rgba(230, 30, 0, ${fade * 0.5})`);
            grad.addColorStop(1, 'rgba(180, 0, 0, 0)');
          } else {
            // Tail: dark red/purple
            grad.addColorStop(0, `rgba(200, 20, 0, ${fade * 0.6})`);
            grad.addColorStop(0.5, `rgba(140, 0, 60, ${fade * 0.3})`);
            grad.addColorStop(1, 'rgba(80, 0, 80, 0)');
          }
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      // Limit particle count
      if (particles.length > 400) particles.splice(0, particles.length - 350);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: 150, height: 150 }} />;
};


/* ═══════════════════════════════════════════════════════════════════
   3. FLAME BURST — Flame shapes scattered around all edges,
      pointing inward. Red/orange outer with yellow cores.
      Matches the second set of reference images.
   ═══════════════════════════════════════════════════════════════════ */
const FlameBurst: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const drawFlame = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, size: number, angle: number, flicker: number
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const s = size * (0.7 + flicker * 0.3);

    // Outer flame (red/orange)
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.8);
    ctx.bezierCurveTo(s * 0.8, -s * 1.2, s * 0.9, -s * 0.2, s * 0.5, s * 0.6);
    ctx.bezierCurveTo(s * 0.3, s * 0.9, -s * 0.3, s * 0.9, -s * 0.5, s * 0.6);
    ctx.bezierCurveTo(-s * 0.9, -s * 0.2, -s * 0.8, -s * 1.2, 0, -s * 1.8);
    ctx.closePath();

    const outerGrad = ctx.createLinearGradient(0, -s * 1.8, 0, s * 0.6);
    outerGrad.addColorStop(0, `rgba(255, 60, 0, ${0.95 * flicker})`);
    outerGrad.addColorStop(0.4, `rgba(255, 100, 0, ${0.9 * flicker})`);
    outerGrad.addColorStop(1, `rgba(220, 30, 0, ${0.7 * flicker})`);
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // Inner flame (yellow)
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.2);
    ctx.bezierCurveTo(s * 0.4, -s * 0.7, s * 0.4, s * 0.1, s * 0.2, s * 0.4);
    ctx.bezierCurveTo(s * 0.1, s * 0.5, -s * 0.1, s * 0.5, -s * 0.2, s * 0.4);
    ctx.bezierCurveTo(-s * 0.4, s * 0.1, -s * 0.4, -s * 0.7, 0, -s * 1.2);
    ctx.closePath();

    const innerGrad = ctx.createLinearGradient(0, -s * 1.2, 0, s * 0.4);
    innerGrad.addColorStop(0, `rgba(255, 220, 30, ${0.9 * flicker})`);
    innerGrad.addColorStop(0.5, `rgba(255, 200, 0, ${0.8 * flicker})`);
    innerGrad.addColorStop(1, `rgba(255, 160, 0, ${0.4 * flicker})`);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    ctx.restore();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = 160, H = 160;
    canvas.width = W; canvas.height = H;

    // Define flame positions around edges, pointing inward
    interface FlameConfig {
      x: number; y: number; size: number; angle: number;
      speed: number; phase: number;
    }

    const flames: FlameConfig[] = [];
    const addFlame = (x: number, y: number, size: number, angle: number) => {
      flames.push({ x, y, size, angle, speed: 2 + Math.random() * 4, phase: Math.random() * Math.PI * 2 });
    };

    // Top edge — pointing down
    addFlame(12, 6, 10, Math.PI * 0.85);
    addFlame(30, 3, 8, Math.PI * 0.9);
    addFlame(48, 8, 6, Math.PI * 0.8);
    addFlame(65, 5, 7, Math.PI * 0.95);
    addFlame(85, 4, 9, Math.PI * 0.85);
    addFlame(105, 7, 7, Math.PI * 0.9);
    addFlame(125, 3, 10, Math.PI * 0.8);
    addFlame(145, 6, 8, Math.PI * 0.75);

    // Right edge — pointing left
    addFlame(152, 22, 9, Math.PI * 1.3);
    addFlame(155, 45, 7, Math.PI * 1.35);
    addFlame(153, 68, 6, Math.PI * 1.25);
    addFlame(156, 90, 8, Math.PI * 1.3);
    addFlame(154, 112, 7, Math.PI * 1.4);
    addFlame(152, 135, 10, Math.PI * 1.25);

    // Bottom edge — pointing up
    addFlame(140, 152, 9, -Math.PI * 0.85);
    addFlame(120, 155, 7, -Math.PI * 0.9);
    addFlame(100, 153, 8, -Math.PI * 0.8);
    addFlame(78, 156, 6, -Math.PI * 0.95);
    addFlame(55, 154, 9, -Math.PI * 0.85);
    addFlame(35, 152, 7, -Math.PI * 0.9);
    addFlame(15, 155, 10, -Math.PI * 0.8);

    // Left edge — pointing right  
    addFlame(5, 140, 8, -Math.PI * 0.3);
    addFlame(3, 118, 7, -Math.PI * 0.35);
    addFlame(6, 95, 6, -Math.PI * 0.25);
    addFlame(4, 72, 9, -Math.PI * 0.3);
    addFlame(5, 50, 7, -Math.PI * 0.4);
    addFlame(3, 28, 10, -Math.PI * 0.3);

    // Smaller sparks scattered mid-way
    const sparks: FlameConfig[] = [];
    const addSpark = (x: number, y: number, size: number, angle: number) => {
      sparks.push({ x, y, size, angle, speed: 3 + Math.random() * 5, phase: Math.random() * Math.PI * 2 });
    };
    addSpark(35, 20, 3, Math.PI * 0.85);
    addSpark(75, 18, 2.5, Math.PI * 0.9);
    addSpark(115, 15, 3, Math.PI * 0.8);
    addSpark(148, 38, 2.5, Math.PI * 1.3);
    addSpark(150, 78, 2, Math.PI * 1.35);
    addSpark(148, 120, 3, Math.PI * 1.25);
    addSpark(130, 148, 2.5, -Math.PI * 0.85);
    addSpark(88, 150, 3, -Math.PI * 0.9);
    addSpark(45, 148, 2.5, -Math.PI * 0.8);
    addSpark(8, 130, 2, -Math.PI * 0.3);
    addSpark(10, 82, 3, -Math.PI * 0.35);
    addSpark(8, 38, 2.5, -Math.PI * 0.3);
    // Mid sparks
    addSpark(40, 40, 2, Math.PI * 0.7);
    addSpark(120, 35, 2.5, Math.PI * 1.1);
    addSpark(125, 125, 2, -Math.PI * 0.6);
    addSpark(30, 120, 2.5, -Math.PI * 0.1);

    let time = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      time += 0.05;

      // Draw main flames
      for (const f of flames) {
        const flicker = 0.5 + 0.5 * Math.sin(time * f.speed + f.phase);
        const wobbleAngle = f.angle + Math.sin(time * f.speed * 0.7 + f.phase) * 0.15;
        const wobbleX = f.x + Math.sin(time * f.speed * 0.5 + f.phase) * 2;
        const wobbleY = f.y + Math.cos(time * f.speed * 0.6 + f.phase) * 2;
        drawFlame(ctx, wobbleX, wobbleY, f.size * (0.8 + flicker * 0.4), wobbleAngle, 0.5 + flicker * 0.5);
      }

      // Draw sparks (small flames)
      for (const s of sparks) {
        const flicker = 0.3 + 0.7 * Math.sin(time * s.speed + s.phase);
        if (flicker > 0.3) {
          drawFlame(ctx, s.x, s.y, s.size * flicker, s.angle, flicker);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawFlame]);

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
    <div style={{ transform: `scale(${size / 150})`, transformOrigin: 'center' }}>
      <PresetSpinner preset={preset} />
    </div>
  </div>
);
