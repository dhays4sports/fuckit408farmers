from html.parser import HTMLParser
from pathlib import Path
import sys

class LinkParser(HTMLParser):
    tracked = {'a': 'href', 'img': 'src', 'script': 'src', 'link': 'href'}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.values = []
    def handle_starttag(self, tag, attrs):
        attribute = self.tracked.get(tag)
        if not attribute:
            return
        value = dict(attrs).get(attribute)
        if value:
            self.values.append(value)
root=Path(__file__).resolve().parents[1]
issues=[]; count=0
for html in root.rglob('*.html'):
    if 'qa/fixtures/' in html.relative_to(root).as_posix():
        continue
    parser=LinkParser()
    parser.feed(html.read_text(encoding='utf-8',errors='ignore'))
    for value in parser.values:
        if value.startswith(('#','mailto:','tel:','sms:','javascript:','data:','http://','https://','//')): continue
        clean=value.split('#')[0].split('?')[0]
        if not clean: continue
        count+=1
        target=(root/clean.lstrip('/')) if clean.startswith('/') else (html.parent/clean)
        if clean.endswith('/'):
            target=target/'index.html'
        elif target.is_dir():
            target=target/'index.html'
        if not target.exists(): issues.append(f'{html.relative_to(root)} -> {value}')
print(f'checked={count} broken={len(issues)}')
for x in issues[:100]: print('BROKEN',x)
if issues: sys.exit(1)
