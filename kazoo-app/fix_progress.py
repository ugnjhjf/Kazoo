import re

# 1. Update globals.css
with open('app/globals.css', 'r', encoding='utf-8') as f:
    css = f.read()

css_old = """.thermo-compact { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.thermo-compact-bar {
  width: 18px; height: 60px; background: #e8eaf6;
  border-radius: 9px; border: 2px solid var(--clr-border);
  position: relative; overflow: hidden;
}
.thermo-compact-fill {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(to top, var(--thermo-red), var(--thermo-yellow), var(--thermo-green));
  border-radius: 9px; transition: height 0.3s var(--ease-smooth);
}
.thermo-compact-label { font-size: 0.55rem; font-weight: 800; color: var(--clr-text-dim); text-transform: uppercase; text-align: center; }"""

css_new = """.step-progress-container { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; padding: 0 10px; }
.step-progress-bar {
  width: 100%; height: 24px; background: #e8eaf6;
  border-radius: 12px; border: 2px solid var(--clr-border);
  position: relative; overflow: hidden;
}
.step-progress-fill {
  position: absolute; top: 0; left: 0; bottom: 0;
  background: linear-gradient(to right, var(--clr-primary), var(--clr-accent));
  border-radius: 12px; transition: width 0.1s linear;
}
.step-progress-label { font-size: 0.75rem; font-weight: 800; color: var(--clr-text-dim); text-transform: uppercase; text-align: center; }"""

css = css.replace(css_old, css_new)

with open('app/globals.css', 'w', encoding='utf-8') as f:
    f.write(css)

# 2. Update page.tsx
with open('app/game/page.tsx', 'r', encoding='utf-8') as f:
    tsx = f.read()

# Add stepProgressPct
tsx = tsx.replace("const [stabilityPct, setStabilityPct] = useState(0);", "const [stepProgressPct, setStepProgressPct] = useState(0);")

# Update gameFrame logic
tsx_logic_old = """      if (hz > 60 && isOnPitch(hz, currentTargetPitch.toLowerCase() as any)) {
        G.hitFrames += 2; // Accrue faster on hit
        G.totalTargetFrames++;
        if (G.hitFrames >= 15) {
          G.hits++;
          G.hitFrames = 0;
          setHitsVal(G.hits);
          showToast(t('toast-perfect'));
        }
      } else {
        G.hitFrames = Math.max(0, G.hitFrames - 1); // Decay instead of reset
        if (hz > 60) G.totalTargetFrames++;
      }"""

tsx_logic_new = """      if (hz > 60 && isOnPitch(hz, currentTargetPitch.toLowerCase() as any)) {
        G.hitFrames += dt; // Accrue time in seconds
        G.totalTargetFrames++;
        if (G.hitFrames >= 3.0) { // 3 seconds to complete step
          G.hits++;
          G.hitFrames = 0;
          setHitsVal(G.hits);
          showToast(t('toast-perfect'));
        }
      } else {
        // No decay, just don't accrue
        if (hz > 60) G.totalTargetFrames++;
      }
      setStepProgressPct(Math.min(100, (G.hitFrames / 3.0) * 100));"""

tsx = tsx.replace(tsx_logic_old, tsx_logic_new)

# Remove setStabilityPct
tsx = tsx.replace("const stability = calcStability(G.pitchHistory);\n    setStabilityPct(stability);", "const stability = calcStability(G.pitchHistory);")

# Update render
tsx_render_old = """              <div className="thermo-compact">
                <div className="thermo-compact-bar">
                  <div className="thermo-compact-fill" style={{ height: `${stabilityPct}%` }} />
                </div>
                <span className="thermo-compact-label">{t('thermo-lbl-stable')}</span>
              </div>"""

tsx_render_new = """              <div className="step-progress-container">
                <div className="step-progress-bar">
                  <div className="step-progress-fill" style={{ width: `${stepProgressPct}%` }} />
                </div>
                <span className="step-progress-label">音符进度</span>
              </div>"""

tsx = tsx.replace(tsx_render_old, tsx_render_new)

# Initial state reset
tsx = tsx.replace("setHitsVal(0);\n    setHzDisplay('--');", "setHitsVal(0);\n    setHzDisplay('--');\n    setStepProgressPct(0);")

with open('app/game/page.tsx', 'w', encoding='utf-8') as f:
    f.write(tsx)

