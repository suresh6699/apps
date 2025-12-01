import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Switch } from "./switch";
import { useTheme } from "../../App";
import { SunIcon, MoonIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export default function ThemeSwitchFlowGlassPro({
  className,
  intensity = 1,
  ...props
}) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [checked, setChecked] = useState(false);

  // Motion preference
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    [],
  );

  // Shader refs
  const canvasRef = useRef(null);
  const progRef = useRef(null);
  const glRef = useRef(null);
  const vaoRef = useRef(null);
  const vboRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  // Interactivity state (kept outside React for perf)
  const hoverRef = useRef({ x: 0.5, y: 0.5 });
  const clickRef = useRef({ x: 0.5, y: 0.5, t: 0 });      // last click center + timestamp seconds
  const toggleRef = useRef({ t: 0, v: 0 });               // last toggle timestamp + value (0/1)

  // Uniform locations
  const u = useRef({});

  useEffect(() => setMounted(true), []);
  useEffect(() => setChecked(theme === "dark"), [theme]);

  const onChange = useCallback(
    (v) => {
      setChecked(v);
      toggleTheme();
      // mark toggle event for shader pulse
      toggleRef.current.t = performance.now() / 1000;
      toggleRef.current.v = v ? 1 : 0;
    },
    [toggleTheme],
  );

  // Pointer interactions
  const containerRef = useRef(null);
  useEffect(() => {
    if (!mounted) return;
    const el = containerRef.current;
    if (!el) return;

    const toUV = (e) => {
      const r = el.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / Math.max(1, r.width),
        y: (e.clientY - r.top) / Math.max(1, r.height),
      };
    };

    const onMove = (e) => {
      const uv = toUV(e);
      hoverRef.current.x += (uv.x - hoverRef.current.x) * 0.22;
      hoverRef.current.y += (uv.y - hoverRef.current.y) * 0.22;
    };

    const onLeave = () => {
      hoverRef.current.x += (0.5 - hoverRef.current.x) * 0.22;
      hoverRef.current.y += (0.5 - hoverRef.current.y) * 0.22;
    };

    const onDown = (e) => {
      const uv = toUV(e);
      clickRef.current.x = uv.x;
      clickRef.current.y = uv.y;
      clickRef.current.t = performance.now() / 1000; // seconds
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("pointerdown", onDown);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
    };
  }, [mounted]);

  // --- WebGL setup & render loop ---
  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) return;
    glRef.current = gl;

    const vs = `#version 300 es
      precision highp float;
      layout(location=0) in vec2 a_pos;
      out vec2 v_uv;
      void main(){
        v_uv = a_pos*0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }`;

    // Flow + turbulence + sheen + interactive ripple + toggle pulse
    const fs = `#version 300 es
      precision highp float;
      out vec4 fragColor;
      in vec2 v_uv;

      uniform vec2  iResolution;
      uniform float iTime;
      uniform int   iTheme;  // 0 light, 1 dark
      uniform vec2  iMouse;  // 0..1 smooth hover pos
      uniform float iPower;  // intensity 0.5..2
      uniform vec2  iClick;  // last click center 0..1
      uniform float iClickT; // seconds of last click
      uniform float iToggleV;// 0/1 last toggle target
      uniform float iToggleT;// seconds of last toggle

      float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i);
        float b=hash(i+vec2(1.,0.));
        float c=hash(i+vec2(0.,1.));
        float d=hash(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float s=0.0, a=0.5;
        for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.0; a*=0.5; }
        return s;
      }

      // curl-ish flow
      vec2 flow(vec2 p){
        float e=0.015;
        float n = fbm(p);
        float nx = fbm(p+vec2(e,0.0));
        float ny = fbm(p+vec2(0.0,e));
        vec2 g = (vec2(nx,ny)-vec2(n))/e;
        return vec2(-g.y, g.x);
      }

      vec3 srgb(vec3 c){ return pow(c, vec3(1.0/2.2)); }
      vec3 tonemap(vec3 c){ return c/(c+vec3(1.0)); }

      void main(){
        vec2 res = iResolution;
        vec2 uv  = v_uv;

        float t = iTime * (0.7 + 0.6*iPower);
        float ar = res.x/max(res.y,1.0);

        // center follows mouse slightly (parallax)
        vec2 center = mix(vec2(0.5), iMouse, 0.38);
        vec2 p = uv - center;
        p.x *= ar;

        // base flow domain
        vec2 q = p * (2.1 + 0.3*iPower);
        q += 0.12*flow(q + vec2(t*0.20, -t*0.17));
        q += 0.10*flow(q*1.9 + vec2(-t*0.19, t*0.23));

        // turbulence layers
        float f1 = fbm(q*2.2 + vec2(t*0.10, -t*0.13));
        float f2 = fbm(q*3.4 + vec2(-t*0.09, t*0.07));
        float ink = smoothstep(0.30, 0.85, 0.55*f1 + 0.45*f2);

        // Theme palettes (calmer, professional)
        vec3 bgLight = vec3(0.97,0.98,1.00);
        vec3 bgDark  = vec3(0.10,0.12,0.16);
        vec3 paper   = vec3(1.00,0.99,0.96);
        vec3 inkC    = vec3(0.17,0.21,0.28); // inky blue-gray
        vec3 cyCyan  = vec3(0.40,0.85,1.00); // sheen color
        vec3 cyGold  = vec3(1.00,0.90,0.60);

        vec3 bg   = mix(bgLight, bgDark, float(iTheme));
        vec3 base = mix(paper, vec3(0.86,0.92,1.00), float(iTheme));
        vec3 tint = mix(cyGold, cyCyan, float(iTheme));

        vec3 col = mix(bg, mix(base, inkC, 0.30), ink);

        // Interactive click ripple (smooth ring decays over ~1.3s)
        float age = max(0.0, iTime - iClickT);
        if(age < 1.3){
          float r = length(uv - iClick);
          float wave = 1.0 - smoothstep(age*0.65, age*0.65 + 0.015, r);
          float fade = smoothstep(1.3, 0.0, age);
          col += tint * wave * 0.18 * fade;
        }

        // Toggle pulse from current thumb center
        float tage = max(0.0, iTime - iToggleT);
        if(tage < 0.9){
          float leftC  = 22.0 / res.x;         // 22px / width
          float rightC = 78.0 / res.x;         // 78px / width
          float cx = mix(leftC, rightC, iToggleV);
          vec2  c = vec2(cx, 0.5);
          float rr = length(uv - c);
          float pulse = exp(-12.0*rr) * exp(-3.0*tage);
          col += tint * pulse * 0.28;
        }

        // Spectral sheen (animated highlight)
        float sweep = 0.25 + 0.25*sin(t*0.9 + uv.x*7.0 - uv.y*3.2);
        float hl = smoothstep(0.04, 0.0, abs(length(p*vec2(1.3,1.8)) - sweep));
        vec3 spec = mix(vec3(1.0,0.97,0.90), vec3(0.82,0.90,1.0), float(iTheme));
        col += spec * hl * 0.18;

        // Rim + vignette
        float edge = smoothstep(0.0, 0.24, 1.0 - distance(uv, vec2(0.5)));
        vec3 rim = mix(vec3(1.0,0.96,0.86), vec3(0.76,0.86,1.0), float(iTheme));
        col = mix(col, col*rim, (1.0-edge)*0.10);
        float vig = smoothstep(0.78, 0.36, length(p));
        col *= mix(1.0, 0.93, vig);

        // Tone/gamma & glass alpha
        col = tonemap(col);
        fragColor = vec4(srgb(col), 0.90);
      }`;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("[FlowGlass.Pro] shader error:", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vsh = compile(gl.VERTEX_SHADER, vs);
    const fsh = compile(gl.FRAGMENT_SHADER, fs);
    if (!vsh || !fsh) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.bindAttribLocation(prog, 0, "a_pos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[FlowGlass.Pro] link error:", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return;
    }
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    progRef.current = prog;

    // quad
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    vaoRef.current = vao;

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    vboRef.current = vbo;
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    u.current.res = gl.getUniformLocation(prog, "iResolution");
    u.current.time = gl.getUniformLocation(prog, "iTime");
    u.current.theme = gl.getUniformLocation(prog, "iTheme");
    u.current.mouse = gl.getUniformLocation(prog, "iMouse");
    u.current.power = gl.getUniformLocation(prog, "iPower");
    u.current.click = gl.getUniformLocation(prog, "iClick");
    u.current.clickT = gl.getUniformLocation(prog, "iClickT");
    u.current.toggleV = gl.getUniformLocation(prog, "iToggleV");
    u.current.toggleT = gl.getUniformLocation(prog, "iToggleT");

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };

    const render = (ts) => {
      if (!progRef.current) return;
      if (!startRef.current) startRef.current = ts;
      const t = prefersReducedMotion ? 0 : (ts - startRef.current) / 1000;

      resize();
      gl.useProgram(progRef.current);
      gl.uniform2f(u.current.res, canvas.width, canvas.height);
      gl.uniform1f(u.current.time, t);
      gl.uniform1i(u.current.theme, theme === "dark" ? 1 : 0);
      gl.uniform2f(u.current.mouse, hoverRef.current.x, hoverRef.current.y);
      gl.uniform1f(u.current.power, Math.max(0.5, Math.min(2, intensity)));
      gl.uniform2f(u.current.click, clickRef.current.x, clickRef.current.y);
      gl.uniform1f(u.current.clickT, clickRef.current.t);
      gl.uniform1f(u.current.toggleV, toggleRef.current.v);
      gl.uniform1f(u.current.toggleT, toggleRef.current.t);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      if (progRef.current) {
        gl.deleteProgram(progRef.current);
        progRef.current = null;
      }
      if (vboRef.current) {
        gl.deleteBuffer(vboRef.current);
        vboRef.current = null;
      }
      if (vaoRef.current) {
        gl.deleteVertexArray(vaoRef.current);
        vaoRef.current = null;
      }
      glRef.current = null;
    };
  }, [mounted, theme, intensity, prefersReducedMotion]);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-11 w-[100px] select-none",
        "transition-transform duration-150 will-change-transform",
        "hover:scale-[1.02] active:scale-[0.985]",
        className,
      )}
      {...props}
    >
      {/* Shader background */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>

      {/* Glass overlay & inner ring */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full",
          "border border-white/20 bg-background/15 backdrop-blur-md",
          "before:absolute before:inset-[3px] before:rounded-full before:border before:border-white/10",
        )}
        style={{ zIndex: 5 }}
      />

      {/* Real shadcn/ui Switch (transparent track; just the thumb is visible) */}
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className={cn(
          "peer absolute inset-0 h-full w-full rounded-full !bg-transparent !border-0 focus-visible:outline-none",
          // Thumb geometry & visual
          "[&>span]:absolute [&>span]:top-[6px] [&>span]:left-[6px]",
          "[&>span]:h-8 [&>span]:w-8 [&>span]:rounded-full [&>span]:z-30",
          // Thumb style: neutral base with glow that changes by state
          "data-[state=unchecked]:[&>span]:bg-white/90 data-[state=checked]:[&>span]:bg-slate-900/90",
          "data-[state=unchecked]:[&>span]:shadow-[0_6px_18px_rgba(255,255,255,0.35)]",
          "data-[state=checked]:[&>span]:shadow-[0_6px_18px_rgba(56,189,248,0.35)]",
          // Motion
          "[&>span]:transition-transform [&>span]:duration-220",
          "hover:[&>span]:scale-[1.03] active:[&>span]:scale-[0.97]",
          // Travel
          "data-[state=unchecked]:[&>span]:translate-x-0",
          "data-[state=checked]:[&>span]:translate-x-[56px]",
        )}
        style={{ zIndex: 10 }}
      />

      {/* Icons aligned to thumb centers */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[22px] -translate-x-1/2 z-20 flex items-center"
      >
        <SunIcon
          size={16}
          className={cn(
            "transition-all duration-300",
            checked ? "opacity-45" : "opacity-100 rotate-12",
          )}
        />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[78px] -translate-x-1/2 z-20 flex items-center"
      >
        <MoonIcon
          size={16}
          className={cn(
            "transition-all duration-300",
            checked ? "opacity-100 -rotate-12" : "opacity-45",
          )}
        />
      </span>
    </div>
  );
}
