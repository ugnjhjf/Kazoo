import re

# 1. Update globals.css
with open('app/globals.css', 'r', encoding='utf-8') as f:
    css = f.read()

css_old = """.grid-board {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  align-content: flex-start;
  flex-wrap: wrap;
  gap: 10px;
}
.grid-cell {
  width: calc(20% - 8px);
  aspect-ratio: 1;
  border-radius: var(--radius-md);"""

css_new = """.grid-board {
  flex: 1;
  padding: 16px;
  overflow: hidden;
  display: flex;
  align-content: stretch;
  flex-wrap: wrap;
  gap: 10px;
}
.grid-cell {
  width: calc(20% - 8px);
  border-radius: var(--radius-md);"""

css = css.replace(css_old, css_new)

# Remove feedback-toast visibility style
css = re.sub(r'\.feedback-toast\.visible\s*\{[^}]*\}', '', css)

with open('app/globals.css', 'w', encoding='utf-8') as f:
    f.write(css)

# 2. Update page.tsx
with open('app/game/page.tsx', 'r', encoding='utf-8') as f:
    tsx = f.read()

# Remove toast state
tsx = re.sub(r'const \[toast, setToast\] = useState\(\'\'\);\n\s*const \[toastVisible, setToastVisible\] = useState\(false\);\n', '', tsx)
tsx = re.sub(r'const toastTimer = useRef<ReturnType<typeof setTimeout> \| null>\(null\);\n', '', tsx)

# Remove showToast function
tsx = re.sub(r'const showToast = useCallback\(\(msg: string\) => \{\n.*?\n\s*\}, \[\]\);\n', '', tsx, flags=re.DOTALL)

# Remove showToast calls
tsx = re.sub(r'showToast\(t\(\'toast-perfect\'\)\);', '', tsx)

# Remove showToast from dependency arrays
tsx = re.sub(r'showToast,\s*', '', tsx)

# Remove toast rendering
tsx = re.sub(r'\{\/\* Feedback toast \*\/\}\n\s*<div className=\{`feedback-toast\$\{toastVisible \? \' visible\' : \'\'\}`\}>\{toast\}</div>', '', tsx)

# Remove game-bottom
game_bottom_pattern = r'\{\/\* Song progress & mini stats \*\/\}\n\s*<div className="game-bottom">.*?</div>\n\s*</div>'
tsx = re.sub(game_bottom_pattern, '', tsx, flags=re.DOTALL)

with open('app/game/page.tsx', 'w', encoding='utf-8') as f:
    f.write(tsx)

