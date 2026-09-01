from pathlib import Path
from PIL import Image
import re

root = Path(__file__).resolve().parents[1]
checks = []
def check(name, condition):
    checks.append((name, bool(condition)))
    print(('PASS' if condition else 'FAIL'), name)

color = Image.open(root / 'shared/assets/408-farmers-logo.png').convert('RGBA')
white = Image.open(root / 'shared/assets/408-farmers-logo-white.png').convert('RGBA')
icon = Image.open(root / 'shared/assets/408-farmers-icon.png').convert('RGBA')
check('full-color logo is transparent RGBA', color.mode == 'RGBA' and color.getextrema()[3][0] == 0 and color.getextrema()[3][1] == 255)
check('full-color logo is tightly cropped and horizontal', color.width > 900 and color.height < 240 and color.width / color.height > 4)
check('white footer logo preserves transparency', white.mode == 'RGBA' and white.getextrema()[3] == color.getextrema()[3])
check('shield icon is compact', icon.width < 240 and icon.height < 240)
check('favicon exists', (root / 'favicon.ico').is_file())
check('32px favicon exists', (root / 'favicon-32x32.png').is_file())
check('apple touch icon exists', (root / 'apple-touch-icon.png').is_file())

html_files = list(root.rglob('*.html'))
logo_pages = [p for p in html_files if '408-farmers-logo' in p.read_text(encoding='utf-8')]
check('logo is used across site routes', len(logo_pages) >= 10)
check('logo alt text is standardized', all('alt="408FARMERS Insurance Text Line"' in p.read_text(encoding='utf-8') for p in logo_pages))
index = (root / 'index.html').read_text(encoding='utf-8')
check('footer uses white logo asset', 'shared/assets/408-farmers-logo-white.png' in index)
home = (root / 'home/index.html').read_text(encoding='utf-8')
check('Home hero duplicate wordmark removed', 'home-hero-brand' not in home and 'home-brand-408' not in home)
styles = (root / 'shared/styles.css').read_text(encoding='utf-8')
check('desktop header sizing updated', 'max-width:min(355px,56vw);height:54px' in styles)
check('mobile header sizing updated', 'max-width:min(245px,62vw);height:42px' in styles)
root_css = (root / 'shared/root.css').read_text(encoding='utf-8')
check('footer inversion filter removed', '.footer-brand img{width:min(300px,100%);filter:none}' in root_css)

failed = [name for name, passed in checks if not passed]
print(f"\n{len(checks)-len(failed)}/{len(checks)} logo integration checks passed")
raise SystemExit(1 if failed else 0)
