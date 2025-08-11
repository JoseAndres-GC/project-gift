"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  "Feliz Cumpleaños",
  "Que tengas un gran día.",
  "Te quiero mucho, amiga",
];

const PARTICLE_COLOR = "#ffe9ff";
const KEEP_PROB = 0.9;
const FORCE_TWO_LINES_ON_PORTRAIT = true;

const METEOR_MIN_DELAY = 900;
const METEOR_MAX_DELAY = 1800;
const METEOR_BURST_MIN = 1;
const METEOR_BURST_MAX = 2;

type Star = { x: number; y: number; r: number; phase: number; speed: number };
type Meteor = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  a: number;
  phase: "scatter" | "gather";
  age: number;
  scatterFor: number;
};

export default function Home() {
  const [opened, setOpened] = useState(false);
  const [hideEnvelope, setHideEnvelope] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const starsRef = useRef<Star[]>([]);
  const meteorsRef = useRef<Meteor[]>([]);
  const nextMeteorAt = useRef<number>(0);

  const particlesRef = useRef<Particle[]>([]);
  const particleRadiusRef = useRef(1.25);

  const currentMsgIndexRef = useRef(0);

  function buildGrainPoints(message: string) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const isPortrait = H >= W * 1.05;

    const SCALE = 2;
    const PAD_W = Math.max(16, Math.floor(W * 0.06));
    const MIN_FS = 30;
    const LINE_GAP = 0.16;

    const off = document.createElement("canvas");
    const ctx = off.getContext("2d")!;
    off.width = W * SCALE;
    off.height = H * SCALE;

    const setFont = (fs: number) => {
      ctx.font = `900 ${fs}px Arial Black, Impact, system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
    };
    const measure = (text: string) => ctx.measureText(text).width;

    let fs = Math.min(140, Math.floor(W * 0.18), Math.floor(H * 0.22));
    setFont(fs);
    let wText = measure(message);
    while (wText > W - PAD_W * 2 && fs > MIN_FS) {
      fs -= 2;
      setFont(fs);
      wText = measure(message);
    }

    let lines: string[] = [message];
    let yCenter = H / 2;

    const longText = message.length >= 22;
    const needTwoLines =
      fs <= MIN_FS + 2 ||
      (FORCE_TWO_LINES_ON_PORTRAIT && isPortrait) ||
      longText;

    if (needTwoLines && message.includes(" ")) {
      const words = message.split(" ");
      let line1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
      let line2 = words.slice(Math.ceil(words.length / 2)).join(" ");

      if (/^feliz/i.test(message)) {
        line1 = "Feliz";
        line2 = message.replace(/^Feliz\s*/i, "");
      } else if (/^que\s+tengas/i.test(message)) {
        line1 = "Que tengas";
        line2 = message.replace(/^que\s+tengas\s*/i, "");
      }

      lines = [line1, line2];

      fs = Math.min(200, Math.floor(W * 0.28), Math.floor(H * 0.28));
      setFont(fs);
      let maxLine = Math.max(measure(lines[0]), measure(lines[1]));
      while (
        (maxLine > W - PAD_W * 2 || fs * (2 + LINE_GAP) > H * 0.6) &&
        fs > MIN_FS
      ) {
        fs -= 2;
        setFont(fs);
        maxLine = Math.max(measure(lines[0]), measure(lines[1]));
      }
      yCenter = H / 2 - (fs * LINE_GAP) / 2 + fs * 0.02;
    }

    const STEP = Math.max(5, Math.min(10, Math.round(fs / 18)));
    particleRadiusRef.current = fs < 54 ? 1.08 : fs < 80 ? 1.22 : 1.38;

    const ctx2 = ctx;
    ctx2.save();
    ctx2.scale(SCALE, SCALE);
    setFont(fs);
    if (lines.length === 1) {
      ctx2.fillText(lines[0], W / 2, yCenter);
    } else {
      ctx2.fillText(lines[0], W / 2, yCenter);
      ctx2.fillText(lines[1], W / 2, yCenter + fs * (1 + LINE_GAP));
    }
    ctx2.restore();

    const img = ctx2.getImageData(0, 0, off.width, off.height).data;
    const pts: { x: number; y: number }[] = [];
    const yMax = off.height - STEP,
      xMax = off.width - STEP;

    for (let y = STEP; y < yMax; y += STEP) {
      for (let x = STEP; x < xMax; x += STEP) {
        const a = img[(y * off.width + x) * 4 + 3];
        if (a > 20 && Math.random() < KEEP_PROB) {
          pts.push({
            x: x / SCALE + (Math.random() - 0.5) * 0.8,
            y: y / SCALE + (Math.random() - 0.5) * 0.8,
          });
        }
      }
    }
    return pts;
  }

  useEffect(() => {
    if (!opened) return;

    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    const setupScene = (message: string) => {
      const w = window.innerWidth,
        h = window.innerHeight;
      cv.width = w * DPR;
      cv.height = h * DPR;
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      const count = Math.floor((w * h) / 14000);
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
      }));

      const targets = buildGrainPoints(message);

      const cx = w / 2,
        cy = h / 2;

      const diag = Math.hypot(w, h);
      const avgScatterTime = 2400;
      const avgSpeed = (diag * 0.55) / (avgScatterTime / 16);

      particlesRef.current = targets.map((t) => {
        const u1 = Math.random() || 1e-6,
          u2 = Math.random();
        const R =
          Math.sqrt(-2 * Math.log(u1)) *
          (avgSpeed * (0.6 + Math.random() * 0.8));
        const theta = 2 * Math.PI * u2;
        const vx = Math.cos(theta) * R + (Math.random() - 0.5) * 6;
        const vy = Math.sin(theta) * R + (Math.random() - 0.5) * 6;
        return {
          x: cx,
          y: cy,
          vx,
          vy,
          tx: t.x,
          ty: t.y,
          a: 0,
          phase: "scatter" as const,
          age: 0,
          scatterFor: 1500 + Math.random() * 1500,
        };
      });
    };

    setupScene(MESSAGES[currentMsgIndexRef.current]);

    const reformTo = (message: string) => {
      const targets = buildGrainPoints(message);
      const ps = particlesRef.current;
      const w = window.innerWidth,
        h = window.innerHeight;
      const diag = Math.hypot(w, h);
      const avgSpeed = (diag * 0.55) / (2400 / 16);

      const N = Math.max(ps.length, targets.length);
      const originIdx = (i: number) => ps[i % ps.length];
      const targetIdx = (i: number) => targets[i % targets.length];

      const next: Particle[] = [];
      for (let i = 0; i < N; i++) {
        const from = ps[i] ?? originIdx(i);
        const to = targetIdx(i);
        const u1 = Math.random() || 1e-6,
          u2 = Math.random();
        const R =
          Math.sqrt(-2 * Math.log(u1)) *
          (avgSpeed * (0.6 + Math.random() * 0.8));
        const theta = 2 * Math.PI * u2;
        const vx = Math.cos(theta) * R + (Math.random() - 0.5) * 6;
        const vy = Math.sin(theta) * R + (Math.random() - 0.5) * 6;

        next.push({
          x: from.x,
          y: from.y,
          vx,
          vy,
          tx: to.x,
          ty: to.y,
          a: Math.min(1, from.a + 0.2),
          phase: "scatter",
          age: 0,
          scatterFor: 1100 + Math.random() * 900,
        });
      }
      particlesRef.current = next;
    };

    let rId: number | null = null;
    const onResize = () => {
      if (rId) cancelAnimationFrame(rId);
      rId = requestAnimationFrame(() => {
        setupScene(MESSAGES[currentMsgIndexRef.current]);
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const onClick = () => {
      currentMsgIndexRef.current =
        (currentMsgIndexRef.current + 1) % MESSAGES.length;
      reformTo(MESSAGES[currentMsgIndexRef.current]);
    };
    canvasRef.current!.style.cursor = "pointer";
    canvasRef.current!.addEventListener("click", onClick);

    let last = performance.now();
    nextMeteorAt.current = last + METEOR_MIN_DELAY;

    const step = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const frame = dt / 16;

      const w = cv.width / DPR,
        h = cv.height / DPR;

      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#2b0a43");
      g.addColorStop(1, "#18062d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const vignette = ctx.createRadialGradient(
        w * 0.5,
        h * 0.46,
        Math.min(w, h) * 0.25,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.85
      );
      vignette.addColorStop(0, "rgba(255,0,255,0.10)");
      vignette.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      for (const s of starsRef.current) {
        s.phase += s.speed * dt * 0.002;
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "#ffe9ff";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#ffe9ff";
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (now >= nextMeteorAt.current) {
        const burst =
          Math.floor(
            Math.random() * (METEOR_BURST_MAX - METEOR_BURST_MIN + 1)
          ) + METEOR_BURST_MIN;
        for (let b = 0; b < burst; b++) {
          const spawnOnTop = Math.random() < 0.7;
          const mx = spawnOnTop ? Math.random() * (w * 0.35) : -60;
          const my = spawnOnTop ? -40 : Math.random() * (h * 0.45);
          const angle = Math.PI / 4 + (Math.random() - 0.5) * (Math.PI / 18);
          const speed = 4 + Math.random() * 3.5;
          meteorsRef.current.push({ x: mx, y: my, angle, speed, life: 1 });
        }
        nextMeteorAt.current =
          now +
          METEOR_MIN_DELAY +
          Math.random() * (METEOR_MAX_DELAY - METEOR_MIN_DELAY);
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const mKeep: Meteor[] = [];
      for (const m of meteorsRef.current) {
        const vx = Math.cos(m.angle) * m.speed * frame;
        const vy = Math.sin(m.angle) * m.speed * frame;
        m.x += vx;
        m.y += vy;
        m.life -= dt * 0.0007;

        const headR = 2.0,
          tailLen = 150 * m.life,
          tailW = 5.5 * m.life;
        const ax = Math.cos(m.angle),
          ay = Math.sin(m.angle);
        const hx = m.x,
          hy = m.y;
        const bx = m.x - ax * tailLen,
          by = m.y - ay * tailLen;
        const nx = -ay,
          ny = ax;
        const b1x = bx + nx * (tailW * 0.5),
          b1y = by + ny * (tailW * 0.5);
        const b2x = bx - nx * (tailW * 0.5),
          b2y = by - ny * (tailW * 0.5);

        const grad = ctx.createLinearGradient(hx, hy, bx, by);
        grad.addColorStop(0, "rgba(255,230,255,0.95)");
        grad.addColorStop(1, "rgba(255,230,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(b1x, b1y);
        ctx.lineTo(b2x, b2y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#ffd6ff";
        ctx.fillStyle = "#fff";
        ctx.arc(hx, hy, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (m.life > 0 && m.x < w + 100 && m.y < h + 100) mKeep.push(m);
      }
      ctx.restore();
      meteorsRef.current = mKeep;

      const dragScatter = Math.pow(0.985, frame);
      const dragGather = Math.pow(0.9, frame);
      ctx.fillStyle = PARTICLE_COLOR;
      const pr = particleRadiusRef.current;

      for (const p of particlesRef.current) {
        p.age += dt;
        if (p.phase === "scatter") {
          p.vx += (Math.random() - 0.5) * 0.9 * frame;
          p.vy += (Math.random() - 0.5) * 0.9 * frame;
          p.x += p.vx * frame;
          p.y += p.vy * frame;
          p.vx *= dragScatter;
          p.vy *= dragScatter;
          p.a = Math.min(1, p.a + 0.08 * frame);
          if (p.age >= p.scatterFor) p.phase = "gather";
        } else {
          const dx = p.tx - p.x,
            dy = p.ty - p.y;
          p.vx += dx * 0.05 * frame;
          p.vy += dy * 0.05 * frame;
          p.vx *= dragGather;
          p.vy *= dragGather;
          p.x += p.vx * frame;
          p.y += p.vy * frame;
          p.a = Math.min(1, p.a + 0.05 * frame);
        }

        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        ctx.fill();
        for (let k = 0; k < 2; k++) {
          const ox = (Math.random() - 0.5) * 2.0;
          const oy = (Math.random() - 0.5) * 2.0;
          ctx.beginPath();
          ctx.arc(p.x + ox, p.y + oy, pr * 0.72, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      canvasRef.current?.removeEventListener("click", onClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [opened]);

  useEffect(() => {
    if (!opened) return;
    const t = setTimeout(() => setHideEnvelope(true), 420);
    return () => clearTimeout(t);
  }, [opened]);

  return (
    <main
      className="relative w-full min-h-[100svh] overflow-hidden flex flex-col items-center justify-center"
      style={{ background: opened ? "transparent" : "#17062b" }}
    >
      {!opened && (
        <>
          <h1 className="text-white text-lg sm:text-xl md:text-2xl mb-4 text-center">
            Para: Andrea Michel Rios
          </h1>
          {!hideEnvelope && (
            <button
              aria-label="Abrir carta"
              onClick={() => setOpened(true)}
              disabled={opened}
              className={`relative z-10 select-none transition-transform ${
                opened ? "" : "animate-bounce hover:scale-110"
              }`}
              style={{ outline: "none", display: "block", margin: "0 auto" }}
            >
              {/* Escala */}
              <svg
                className={`envSvg ${opened ? "is-open" : ""}`}
                viewBox="0 0 260 180"
                style={{
                  width: "clamp(160px, 40vw, 360px)",
                  height: "auto",
                  display: "block",
                  margin: "0 auto",
                }}
              >
                <defs>
                  <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff79b4" />
                    <stop offset="100%" stopColor="#ff5aa4" />
                  </linearGradient>
                  <linearGradient id="flapGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff1f8e" />
                    <stop offset="100%" stopColor="#ff2f9a" />
                  </linearGradient>
                </defs>
                <rect
                  x="20"
                  y="70"
                  width="220"
                  height="100"
                  rx="22"
                  fill="url(#bodyGrad)"
                />
                <rect
                  x="36"
                  y="82"
                  width="188"
                  height="76"
                  rx="14"
                  fill="#fff"
                  className="cardRect"
                />
                <path
                  d="M30 170 L130 112 L230 170"
                  fill="none"
                  stroke="rgba(255,255,255,.82)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <g className="flapGroup">
                  <path d="M20 70 L240 70 L130 120 Z" fill="url(#flapGrad)" />
                  <path
                    d="M28 70 H232"
                    stroke="rgba(255,255,255,.25)"
                    strokeWidth="2"
                  />
                </g>
                <rect
                  x="20"
                  y="70"
                  width="220"
                  height="100"
                  rx="22"
                  fill="none"
                  stroke="rgba(255,255,255,.25)"
                />
              </svg>
            </button>
          )}
        </>
      )}

      {opened && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-0"
        />
      )}

      <style jsx>{`
        .envSvg {
          overflow: visible;
          filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.28));
        }
        .cardRect {
          transition: transform 520ms ease 80ms;
          transform: translateY(6px);
        }
        .flapGroup {
          transform-box: fill-box;
          transform-origin: 50% 0%;
          transform: rotateX(0);
          transform-style: preserve-3d;
        }
        .envSvg.is-open .flapGroup {
          animation: flapUp 700ms cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
        }
        @keyframes flapUp {
          0% {
            transform: rotateX(0);
          }
          68% {
            transform: rotateX(-172deg);
          }
          100% {
            transform: rotateX(-160deg);
          }
        }
        .envSvg.is-open .cardRect {
          transform: translateY(-4px);
        }
      `}</style>
    </main>
  );
}
