import re

with open('app/game/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove states
content = re.sub(r'const \[missesVal, setMissesVal\] = useState\(0\);\n\s*const \[notesLeft, setNotesLeft\] = useState\(0\);\n', '', content)
content = re.sub(r'const \[comboCount, setComboCount\] = useState\(0\);\n', '', content)

# 2. Update gameRef.current
content = re.sub(r'hits: 0, misses: 0,\n\s*hitFrames: 0, totalTargetFrames: 0,\n\s*combo: 0, maxCombo: 0,', 'hits: 0,\n    hitFrames: 0, totalTargetFrames: 0,', content)

# 3. Update db push
content = re.sub(r'hits: G\.hits, misses: G\.misses,', 'hits: G.hits, misses: 0,', content)

# 4. Update setLastResult
content = re.sub(r'total: G\.hits \+ G\.misses,', 'total: G.song.pattern.length,', content)

# 5. gameFrame logic
game_frame_logic = """
    // Process step without failure
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

    if (G.songElapsed > totalDuration) {
      endGame(stability);
      return;
    }
"""

content = re.sub(r'    // Process notes\n.*?    if \(G.songElapsed > totalDuration && G\.notes\.every\(n => n\.state === \'done\'\)\) \{\n\s*endGame\(stability\);\n\s*return;\n\s*\}', game_frame_logic, content, flags=re.DOTALL)

# 6. startGameLoop
content = re.sub(r'G\.hits = 0; G\.misses = 0;\n\s*G\.hitFrames = 0; G\.totalTargetFrames = 0;\n\s*G\.combo = 0; G\.maxCombo = 0;', 'G.hits = 0;\n    G.hitFrames = 0; G.totalTargetFrames = 0;', content)

content = re.sub(r'setHitsVal\(0\); setMissesVal\(0\);\n\s*setNotesLeft\(G\.notes\.length\);\n\s*setComboCount\(0\); setHzDisplay\(\'--\'\);', 'setHitsVal(0);\n    setHzDisplay(\'--\');', content)

# 7. UI changes
content = re.sub(r'\s*<div className="game-combo-badge">.*?</div>', '', content, flags=re.DOTALL)

content = re.sub(r'hitsVal \+ missesVal', 'hitsVal', content)
content = re.sub(r'const isCurrent = i === Math.min\(stepIdx, gridTotal - 1\) && stepIdx < gridTotal;', 'const visualStepIdx = stepIdx % gridTotal;\n                const isCurrent = i === visualStepIdx;', content)
content = re.sub(r'const isPassed = i < stepIdx;', 'const isPassed = i < visualStepIdx;', content)

content = re.sub(r'<div className="mini-stat"><span className="mini-stat-val">\{missesVal\}</span><span className="mini-stat-label">\{t\(\'mini-misses\'\)\}</span></div>\n\s*<div className="mini-stat"><span className="mini-stat-val">\{notesLeft\}</span><span className="mini-stat-label">\{t\(\'mini-left\'\)\}</span></div>', '', content)


with open('app/game/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
