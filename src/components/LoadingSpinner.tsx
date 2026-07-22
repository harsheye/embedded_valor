import React, { useId } from 'react';

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
   1. FIRE CIRCLE — Multi-layered counter-rotating flame rings
   ═══════════════════════════════════════════════════════════════════ */
const FireCircle: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  return (
    <>
      <style>{`
        .fc-wrap-${uid} { display:block; filter:drop-shadow(0 0 15px rgba(255,69,0,.85)); }
        .fc-o-${uid} { animation: fc-cw-${uid} 3s linear infinite; }
        .fc-m-${uid} { animation: fc-ccw-${uid} 2s linear infinite; }
        .fc-i-${uid} { animation: fc-cw-${uid} 1.3s linear infinite; }
        @keyframes fc-cw-${uid}  { from{transform:rotate(0)}to{transform:rotate(360deg)} }
        @keyframes fc-ccw-${uid} { from{transform:rotate(360deg)}to{transform:rotate(0)} }
      `}</style>
      <svg className={`fc-wrap-${uid}`} viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <linearGradient id={`fc-og-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff1a00"/><stop offset="45%" stopColor="#ff5e00"/><stop offset="100%" stopColor="#ff9a00"/>
          </linearGradient>
          <linearGradient id={`fc-ig-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff5e00"/><stop offset="60%" stopColor="#ffcc00"/><stop offset="100%" stopColor="#ffffcc"/>
          </linearGradient>
          <filter id={`fc-gl-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4.5" result="b"/>
            <feComponentTransfer in="b" result="k"><feFuncA type="linear" slope="1.4"/></feComponentTransfer>
            <feMerge><feMergeNode in="k"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g className={`fc-o-${uid}`} style={{transformOrigin:'60px 60px'}}>
          <circle cx="60" cy="60" r="40" fill="none" stroke={`url(#fc-og-${uid})`} strokeWidth="7" filter={`url(#fc-gl-${uid})`} strokeDasharray="16 6 24 9 18 7 32 10" strokeLinecap="round"/>
          <path d="M60,12C64,12 67,17 64,21C60,24 56,20 54,16C56,14 58,12 60,12Z" fill={`url(#fc-og-${uid})`}/>
          <path d="M108,60C108,64 103,67 99,64C96,60 100,56 104,54C106,56 108,58 108,60Z" fill={`url(#fc-og-${uid})`}/>
          <path d="M60,108C56,108 53,103 56,99C60,96 64,100 66,104C64,106 62,108 60,108Z" fill={`url(#fc-og-${uid})`}/>
          <path d="M12,60C12,56 17,53 21,56C24,60 20,64 18,66C16,64 12,62 12,60Z" fill={`url(#fc-og-${uid})`}/>
        </g>
        <g className={`fc-m-${uid}`} style={{transformOrigin:'60px 60px'}}>
          <circle cx="60" cy="60" r="38" fill="none" stroke={`url(#fc-og-${uid})`} strokeWidth="5.5" strokeDasharray="20 10 14 6 26 8" strokeLinecap="round"/>
          <path d="M85,35C88,32 91,37 87,41C84,44 80,40 82,36Z" fill={`url(#fc-og-${uid})`}/>
          <path d="M35,85C32,88 37,91 41,87C44,84 40,80 36,82Z" fill={`url(#fc-og-${uid})`}/>
        </g>
        <g className={`fc-i-${uid}`} style={{transformOrigin:'60px 60px'}}>
          <circle cx="60" cy="60" r="36" fill="none" stroke={`url(#fc-ig-${uid})`} strokeWidth="4" strokeDasharray="10 5 18 5 12 7" strokeLinecap="round" filter={`url(#fc-gl-${uid})`}/>
          <path d="M60,19C62,19 63,22 61,24C60,26 58,24 58,22Z" fill={`url(#fc-ig-${uid})`}/>
          <path d="M91,50C93,50 94,53 92,55C90,57 88,55 88,53Z" fill={`url(#fc-ig-${uid})`}/>
        </g>
      </svg>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   2. FIRE RING — Thick realistic flame arc rotating with embers,
      purple/blue inner core, organic flickering shapes
   ═══════════════════════════════════════════════════════════════════ */
const FireRing: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  return (
    <>
      <style>{`
        .fr-wrap-${uid} { display:block; }
        .fr-main-${uid} { animation: fr-spin-${uid} 1.4s linear infinite; }
        .fr-embers-${uid} { animation: fr-spin-${uid} 2.2s linear infinite reverse; }
        @keyframes fr-spin-${uid} { from{transform:rotate(0)}to{transform:rotate(360deg)} }
        /* Ember flicker */
        .fr-e1-${uid} { animation: fr-flk-${uid} .8s ease-in-out infinite alternate; }
        .fr-e2-${uid} { animation: fr-flk-${uid} 1.1s ease-in-out infinite alternate .3s; }
        .fr-e3-${uid} { animation: fr-flk-${uid} .6s ease-in-out infinite alternate .5s; }
        .fr-e4-${uid} { animation: fr-flk-${uid} .9s ease-in-out infinite alternate .15s; }
        .fr-e5-${uid} { animation: fr-flk-${uid} .7s ease-in-out infinite alternate .7s; }
        .fr-e6-${uid} { animation: fr-flk-${uid} 1.3s ease-in-out infinite alternate .4s; }
        @keyframes fr-flk-${uid} { 0%{opacity:1;transform:scale(1)}100%{opacity:.15;transform:scale(.4) translate(var(--dx,0),var(--dy,0))} }
        /* Flame tip flicker */
        .fr-tip-${uid} { animation: fr-tip-a-${uid} .5s ease-in-out infinite alternate; }
        @keyframes fr-tip-a-${uid} { 0%{opacity:1;transform:scale(1)}100%{opacity:.3;transform:scale(.6) translateY(-4px)} }
      `}</style>
      <svg className={`fr-wrap-${uid}`} viewBox="0 0 140 140" width="130" height="130">
        <defs>
          {/* Main flame gradient: yellow → orange → red → purple */}
          <linearGradient id={`fr-g1-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb300"/>
            <stop offset="25%" stopColor="#ff6600"/>
            <stop offset="55%" stopColor="#ff2200"/>
            <stop offset="85%" stopColor="#cc1100"/>
            <stop offset="100%" stopColor="#7c3aed"/>
          </linearGradient>
          {/* Inner bright core */}
          <linearGradient id={`fr-g2-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffee00"/><stop offset="40%" stopColor="#ff8800"/><stop offset="100%" stopColor="#ff3300"/>
          </linearGradient>
          {/* Ambient glow */}
          <radialGradient id={`fr-glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff6600" stopOpacity=".18"/><stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          {/* Soft blur for glow */}
          <filter id={`fr-blur-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Turbulence for organic flame edges */}
          <filter id={`fr-turb-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="5" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="8" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>

        {/* Background glow */}
        <circle cx="70" cy="70" r="52" fill={`url(#fr-glow-${uid})`} opacity=".5"/>

        {/* Main flame body — thick arc with turbulence for organic look */}
        <g className={`fr-main-${uid}`} style={{transformOrigin:'70px 70px'}} filter={`url(#fr-turb-${uid})`}>
          {/* Wide outer flame — the main visible arc */}
          <path d="M 70,18 C 90,16 112,30 120,50 C 126,66 124,84 114,96 C 104,108 88,114 74,112"
            fill="none" stroke={`url(#fr-g1-${uid})`} strokeWidth="14" strokeLinecap="round" filter={`url(#fr-blur-${uid})`}/>
          {/* Bright orange/yellow inner core */}
          <path d="M 70,24 C 86,22 106,34 112,50 C 118,64 116,80 108,90 C 100,100 86,106 76,106"
            fill="none" stroke={`url(#fr-g2-${uid})`} strokeWidth="6" strokeLinecap="round"/>
          {/* Purple/blue inner edge along the arc */}
          <path d="M 72,28 C 84,26 100,36 108,48 C 114,58 114,70 110,80 C 106,90 96,98 84,102"
            fill="none" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round" opacity=".65"/>
        </g>

        {/* Flame tip shapes — leading edge (organic teardrops) */}
        <g className={`fr-main-${uid}`} style={{transformOrigin:'70px 70px'}}>
          {/* Leading flame tip */}
          <path className={`fr-tip-${uid}`}
            d="M 66,14 C 70,6 76,8 74,16 C 72,22 64,22 66,14 Z" 
            fill="#ffcc00" filter={`url(#fr-blur-${uid})`}/>
          {/* Small drip ahead */}
          <path className={`fr-tip-${uid}`} style={{animationDelay:'.2s'}}
            d="M 58,16 C 60,12 64,14 62,18 C 60,20 56,18 58,16 Z" 
            fill="#ff8800" opacity=".7"/>
          {/* Trailing tail wisps */}
          <path d="M 72,114 C 68,120 64,118 66,112 C 68,108 74,110 72,114 Z" fill="#ff3300" opacity=".5">
            <animate attributeName="opacity" values=".5;.15;.5" dur=".8s" repeatCount="indefinite"/>
          </path>
          <path d="M 60,110 C 56,116 52,112 55,108 C 58,104 62,106 60,110 Z" fill="#cc2200" opacity=".3">
            <animate attributeName="opacity" values=".3;.08;.3" dur="1.1s" repeatCount="indefinite"/>
          </path>
        </g>

        {/* Flying ember particles — orbiting in reverse */}
        <g className={`fr-embers-${uid}`} style={{transformOrigin:'70px 70px'}}>
          {/* Large embers */}
          <path className={`fr-e1-${uid}`} style={{'--dx':'5px','--dy':'-8px'} as any}
            d="M 42,28 C 46,22 50,26 47,30 C 44,34 40,32 42,28 Z" fill="#ff5500"/>
          <path className={`fr-e2-${uid}`} style={{'--dx':'-6px','--dy':'4px'} as any}
            d="M 118,68 C 122,64 124,68 121,72 C 118,74 116,71 118,68 Z" fill="#ff7700"/>
          <path className={`fr-e3-${uid}`} style={{'--dx':'3px','--dy':'7px'} as any}
            d="M 85,118 C 89,116 91,120 87,122 C 84,124 83,120 85,118 Z" fill="#ff4400"/>
          {/* Small spark dots */}
          <circle className={`fr-e4-${uid}`} style={{'--dx':'-4px','--dy':'-6px'} as any}
            cx="30" cy="55" r="2.5" fill="#ffaa00"/>
          <circle className={`fr-e5-${uid}`} style={{'--dx':'6px','--dy':'3px'} as any}
            cx="100" cy="110" r="2" fill="#ff6600"/>
          <circle className={`fr-e6-${uid}`} style={{'--dx':'-3px','--dy':'-5px'} as any}
            cx="55" cy="125" r="1.8" fill="#ff3300"/>
          {/* Tiny sparks */}
          <circle className={`fr-e3-${uid}`} style={{'--dx':'8px','--dy':'-3px'} as any}
            cx="125" cy="45" r="1.5" fill="#ffcc00" opacity=".7"/>
          <circle className={`fr-e5-${uid}`} style={{'--dx':'-5px','--dy':'8px'} as any}
            cx="25" cy="95" r="1.2" fill="#ff5500" opacity=".6"/>
        </g>
      </svg>
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   3. FLAME BURST — Scattered flame shapes around edges, 
      flickering inward. Red/orange outer, yellow inner cores.
   ═══════════════════════════════════════════════════════════════════ */

/* A single flame shape — styled like the reference with orange outer + yellow core */
const FlameShape: React.FC<{
  x: number; y: number; scale: number; rotate: number;
  delay: string; dur: string; uid: string; idx: number;
}> = ({ x, y, scale, rotate, delay, dur, uid, idx }) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
    {/* Orange/red outer flame */}
    <path d="M 0,-12 C 4,-18 8,-14 6,-8 C 10,-4 8,2 4,6 C 2,8 -2,8 -4,6 C -8,2 -10,-4 -6,-8 C -8,-14 -4,-18 0,-12 Z"
      fill="#ff4400" stroke="#e63300" strokeWidth=".5">
      <animate attributeName="d"
        values="M 0,-12 C 4,-18 8,-14 6,-8 C 10,-4 8,2 4,6 C 2,8 -2,8 -4,6 C -8,2 -10,-4 -6,-8 C -8,-14 -4,-18 0,-12 Z;
                M 0,-14 C 5,-20 9,-15 7,-9 C 11,-3 7,3 3,7 C 1,9 -3,7 -5,5 C -9,1 -11,-5 -7,-9 C -9,-16 -5,-20 0,-14 Z;
                M 0,-12 C 4,-18 8,-14 6,-8 C 10,-4 8,2 4,6 C 2,8 -2,8 -4,6 C -8,2 -10,-4 -6,-8 C -8,-14 -4,-18 0,-12 Z"
        dur={dur} begin={delay} repeatCount="indefinite"/>
    </path>
    {/* Yellow inner core */}
    <path d="M 0,-6 C 2,-10 4,-8 3,-5 C 5,-2 4,1 2,3 C 1,4 -1,4 -2,3 C -4,1 -5,-2 -3,-5 C -4,-8 -2,-10 0,-6 Z"
      fill="#ffcc00" opacity=".9">
      <animate attributeName="opacity" values=".9;.5;.9" dur={dur} begin={delay} repeatCount="indefinite"/>
    </path>
  </g>
);

/* Tiny ember/spark (small teardrop) */
const Spark: React.FC<{
  x: number; y: number; rotate: number; scale: number;
  delay: string; dur: string; uid: string;
}> = ({ x, y, rotate, scale, delay, dur }) => (
  <g transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
    <path d="M 0,-4 C 2,-7 3,-5 2,-2 C 3,0 1,2 0,2 C -1,2 -3,0 -2,-2 C -3,-5 -2,-7 0,-4 Z"
      fill="#ff4400">
      <animate attributeName="opacity" values="1;.2;1" dur={dur} begin={delay} repeatCount="indefinite"/>
    </path>
  </g>
);

const FlameBurst: React.FC = () => {
  const uid = useId().replace(/:/g, '');
  
  /* Flame positions: scattered around the edges, pointing roughly toward center */
  const flames = [
    // Top edge
    { x: 15, y: 8,   s: 1.1, r: 160, d: '0s',    dur: '.7s' },
    { x: 35, y: 5,   s: .8,  r: 170, d: '.2s',   dur: '.9s' },
    { x: 55, y: 10,  s: .65, r: 180, d: '.4s',   dur: '.6s' },
    { x: 78, y: 6,   s: .7,  r: 185, d: '.1s',   dur: '.8s' },
    { x: 100, y: 8,  s: .9,  r: 200, d: '.35s',  dur: '.75s' },
    { x: 118, y: 12, s: 1.0, r: 210, d: '.15s',  dur: '.85s' },
    // Right edge
    { x: 125, y: 30, s: .85, r: 240, d: '.5s',   dur: '.7s' },
    { x: 128, y: 55, s: .7,  r: 260, d: '.25s',  dur: '.9s' },
    { x: 126, y: 80, s: .9,  r: 280, d: '.1s',   dur: '.65s' },
    { x: 122, y: 105, s: 1.1, r: 300, d: '.4s',  dur: '.8s' },
    // Bottom edge
    { x: 105, y: 125, s: .95, r: 330, d: '.3s',  dur: '.7s' },
    { x: 82, y: 128,  s: .7,  r: 350, d: '.15s', dur: '.85s' },
    { x: 60, y: 130,  s: .6,  r: 0,   d: '.45s', dur: '.75s' },
    { x: 38, y: 127,  s: .8,  r: 10,  d: '.2s',  dur: '.9s' },
    { x: 15, y: 122,  s: 1.0, r: 30,  d: '.35s', dur: '.65s' },
    // Left edge
    { x: 8, y: 100,  s: .85, r: 60,  d: '.1s',   dur: '.8s' },
    { x: 5, y: 75,   s: .7,  r: 80,  d: '.5s',   dur: '.7s' },
    { x: 7, y: 50,   s: .9,  r: 100, d: '.25s',  dur: '.85s' },
    { x: 10, y: 28,  s: 1.05, r: 130, d: '.4s',  dur: '.75s' },
  ];

  const sparks = [
    { x: 28, y: 18, r: 155, s: .6, d: '.1s', dur: '.5s' },
    { x: 68, y: 15, r: 180, s: .5, d: '.3s', dur: '.6s' },
    { x: 112, y: 22, r: 215, s: .55, d: '.45s', dur: '.55s' },
    { x: 130, y: 48, r: 255, s: .5, d: '.2s', dur: '.7s' },
    { x: 130, y: 92, r: 290, s: .45, d: '.35s', dur: '.6s' },
    { x: 115, y: 118, r: 320, s: .5, d: '.1s', dur: '.5s' },
    { x: 50, y: 132, r: 5, s: .5, d: '.25s', dur: '.65s' },
    { x: 22, y: 115, r: 45, s: .55, d: '.4s', dur: '.55s' },
    { x: 3, y: 88, r: 75, s: .5, d: '.15s', dur: '.7s' },
    { x: 4, y: 38, r: 110, s: .6, d: '.5s', dur: '.5s' },
    // Extra mid-area sparks
    { x: 42, y: 35, r: 155, s: .4, d: '.35s', dur: '.45s' },
    { x: 95, y: 38, r: 220, s: .35, d: '.1s', dur: '.55s' },
    { x: 98, y: 98, r: 310, s: .4, d: '.25s', dur: '.5s' },
    { x: 35, y: 100, r: 50, s: .35, d: '.45s', dur: '.6s' },
  ];

  return (
    <>
      <style>{`
        .fb-wrap-${uid} { display:block; filter:drop-shadow(0 0 6px rgba(255,80,0,.4)); }
        .fb-rot-${uid} { animation: fb-slow-${uid} 8s linear infinite; }
        @keyframes fb-slow-${uid} { from{transform:rotate(0)}to{transform:rotate(360deg)} }
      `}</style>
      <svg className={`fb-wrap-${uid}`} viewBox="0 0 140 140" width="130" height="130">
        <g className={`fb-rot-${uid}`} style={{transformOrigin:'70px 70px'}}>
          {flames.map((f, i) => (
            <FlameShape key={i} x={f.x} y={f.y} scale={f.s} rotate={f.r}
              delay={f.d} dur={f.dur} uid={uid} idx={i}/>
          ))}
          {sparks.map((s, i) => (
            <Spark key={`s${i}`} x={s.x} y={s.y} rotate={s.r} scale={s.s}
              delay={s.d} dur={s.dur} uid={uid}/>
          ))}
        </g>
      </svg>
    </>
  );
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

/* ─── Gallery Thumbnail (smaller, for settings tab) ─── */
export const SpinnerThumbnail: React.FC<{ preset: SpinnerPreset; size?: number }> = ({ preset, size = 64 }) => (
  <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${size / 120})`, transformOrigin: 'center' }}>
    <PresetSpinner preset={preset} />
  </div>
);
