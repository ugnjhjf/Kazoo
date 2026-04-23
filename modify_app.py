import re
import os

if os.path.exists('app.js'):
    with open('app.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # i18n
    content = content.replace("'mini-lbl-hits': '命中'", "'mini-lbl-hits': '步数'")
    content = content.replace("'res-notes-lbl': '命中音符'", "'res-notes-lbl': '步数'")
    content = content.replace("'mini-lbl-misses': '未中',", "")
    content = content.replace("'mini-lbl-left': '剩餘',", "")

    # State removal
    content = re.sub(r'combo:\s*\d+,', '', content)
    content = re.sub(r'maxCombo:\s*\d+,', '', content)
    content = re.sub(r'misses:\s*\d+,', 'misses: 0,', content)

    # Game loop combo and misses logic
    content = re.sub(r'G\.combo\s*=\s*0;\s*G\.maxCombo\s*=\s*0;', '', content)
    content = re.sub(r'setText\(\'combo-count\',.*\);', '', content)
    content = re.sub(r'setText\(\'mini-misses\',.*\);', '', content)
    content = re.sub(r'G\.combo\+\+;\n\s*if\s*\(G\.combo > G\.maxCombo\)\s*G\.maxCombo\s*=\s*G\.combo;', '', content)
    content = re.sub(r'G\.combo\s*=\s*0;', '', content)

    # Update misses display
    content = re.sub(r'document\.getElementById\(\'mini-misses\'\)\.parentElement\.style\.display\s*=\s*\'none\';', '', content)

    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(content)

if os.path.exists('index.html'):
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    html = re.sub(r'<div class="game-combo-badge".*?</div>', '', html, flags=re.DOTALL)
    html = re.sub(r'<div class="mini-stat">[\s\n]*<span class="mini-stat-val" id="mini-misses">0</span>.*?</div>', '', html, flags=re.DOTALL)
    html = re.sub(r'<div class="mini-stat">[\s\n]*<span class="mini-stat-val" id="mini-left">0</span>.*?</div>', '', html, flags=re.DOTALL)
    html = html.replace('<div class="result-card-value" id="res-notes">0/0</div>', '<div class="result-card-value" id="res-notes">0</div>')

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
