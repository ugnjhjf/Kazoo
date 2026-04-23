import re

with open('app/game/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix contiguous frames and looping
logic_old = """    // Process step without failure
    const currentStep = G.hits;
    const patternLen = G.song.pattern.length;
    if (patternLen > 0) {
      const currentTargetPitch = G.song.pattern[currentStep % patternLen].pitch.toUpperCase() as PitchLabel;
      setTargetPitchLabel(currentTargetPitch);

      if (hz > 60 && isOnPitch(hz, currentTargetPitch.toLowerCase() as any)) {
        G.hitFrames++;
        G.totalTargetFrames++;
        if (G.hitFrames >= 15) {
          G.hits++;
          G.hitFrames = 0;
          setHitsVal(G.hits);
          showToast(t('toast-perfect'));
        }
      } else {
        G.hitFrames = 0;
        if (hz > 60) G.totalTargetFrames++;
      }
    } else {
      setTargetPitchLabel('--');
    }

    const lastNote = G.song.pattern[G.song.pattern.length - 1];
    const totalDuration = lastNote ? lastNote.start + lastNote.duration + 2 : 30;
    const pct = Math.min(100, (G.songElapsed / totalDuration) * 100);
    setProgressPct(pct);

    if (G.songElapsed > totalDuration) {"""

logic_new = """    // Process step without failure
    const currentStep = G.hits;
    const patternLen = G.song.pattern.length;
    if (currentStep < patternLen) {
      const currentTargetPitch = G.song.pattern[currentStep].pitch.toUpperCase() as PitchLabel;
      setTargetPitchLabel(currentTargetPitch);

      if (hz > 60 && isOnPitch(hz, currentTargetPitch.toLowerCase() as any)) {
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
      }
    } else {
      setTargetPitchLabel('--');
    }

    const lastNote = G.song.pattern[G.song.pattern.length - 1];
    const totalDuration = lastNote ? lastNote.start + lastNote.duration + 2 : 30;
    const pct = Math.min(100, (G.songElapsed / totalDuration) * 100);
    setProgressPct(pct);

    if (G.songElapsed > totalDuration || G.hits >= patternLen) {"""

content = content.replace(logic_old, logic_new)

# 2. Fix grid UI wrap around
ui_old = """              {notePattern.map((pitch, i) => {
                const stepIdx = hitsVal;
                const visualStepIdx = stepIdx % gridTotal;
                const isCurrent = i === visualStepIdx;
                const isPassed = i < visualStepIdx;"""

ui_new = """              {notePattern.map((pitch, i) => {
                const stepIdx = hitsVal;
                const isCurrent = i === Math.min(stepIdx, gridTotal - 1) && stepIdx < gridTotal;
                const isPassed = i < stepIdx;"""

content = content.replace(ui_old, ui_new)

with open('app/game/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

