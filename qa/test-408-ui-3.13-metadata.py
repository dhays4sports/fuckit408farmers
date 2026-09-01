#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import json, sys
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,cond,detail=''):
    checks.append({'name':name,'passed':bool(cond),'detail':'' if cond else str(detail)})
    if not cond: print('FAIL',name,detail)
def soup(rel): return BeautifulSoup((ROOT/rel).read_text(errors='ignore'),'html.parser')
indexable={
 'index.html':'https://408farmers.com/',
 'home/index.html':'https://408farmers.com/home/',
 'auto-bundle/index.html':'https://408farmers.com/auto-bundle/',
 'buyer/index.html':'https://408farmers.com/buyer/',
 'life/index.html':'https://408farmers.com/life/',
 'score/index.html':'https://408farmers.com/score/',
 'healthcare/index.html':'https://408farmers.com/healthcare/',
 'teachers/index.html':'https://408farmers.com/teachers/',
 'tech/index.html':'https://408farmers.com/tech/',
 'engineers/index.html':'https://408farmers.com/engineers/',
 'local/index.html':'https://408farmers.com/local/',
 'local/join/index.html':'https://408farmers.com/local/join/',
 'contact/index.html':'https://408farmers.com/contact/',
 'privacy.html':'https://408farmers.com/privacy.html',
 'terms.html':'https://408farmers.com/terms.html',
}
titles=[]
for rel,url in indexable.items():
    s=soup(rel)
    title=s.title.get_text(' ',strip=True) if s.title else ''
    desc=(s.find('meta',attrs={'name':'description'}) or {}).get('content','').strip() if s.find('meta',attrs={'name':'description'}) else ''
    canon=(s.find('link',rel='canonical') or {}).get('href','').strip() if s.find('link',rel='canonical') else ''
    robots=(s.find('meta',attrs={'name':'robots'}) or {}).get('content','').lower() if s.find('meta',attrs={'name':'robots'}) else ''
    theme=(s.find('meta',attrs={'name':'theme-color'}) or {}).get('content','') if s.find('meta',attrs={'name':'theme-color'}) else ''
    vp=(s.find('meta',attrs={'name':'viewport'}) or {}).get('content','') if s.find('meta',attrs={'name':'viewport'}) else ''
    check(rel+' title present',15<=len(title)<=80,len(title))
    check(rel+' description present',50<=len(desc)<=190,len(desc))
    check(rel+' canonical exact',canon==url,canon)
    check(rel+' canonical https',canon.startswith('https://408farmers.com/'),canon)
    check(rel+' robots indexable','noindex' not in robots,robots)
    check(rel+' theme color present',theme.startswith('#') and len(theme) in (4,7),theme)
    check(rel+' zoom enabled','user-scalable=no' not in vp.lower() and 'maximum-scale=1' not in vp.lower(),vp)
    check(rel+' lang en',s.html is not None and s.html.get('lang')=='en')
    titles.append((rel,title))
    # Product/campaign pages need social contract; legal/contact can use compact social metadata.
    if rel not in ('privacy.html','terms.html'):
        ogt=(s.find('meta',property='og:title') or {}).get('content','') if s.find('meta',property='og:title') else ''
        ogd=(s.find('meta',property='og:description') or {}).get('content','') if s.find('meta',property='og:description') else ''
        ogu=(s.find('meta',property='og:url') or {}).get('content','') if s.find('meta',property='og:url') else ''
        tw=(s.find('meta',attrs={'name':'twitter:card'}) or {}).get('content','') if s.find('meta',attrs={'name':'twitter:card'}) else ''
        check(rel+' og title present',bool(ogt))
        check(rel+' og description present',bool(ogd))
        check(rel+' og url exact',ogu==url,ogu)
        check(rel+' twitter card present',tw in ('summary','summary_large_image'),tw)
    if rel not in ('privacy.html','terms.html','contact/index.html'):
        ogi=(s.find('meta',property='og:image') or {}).get('content','') if s.find('meta',property='og:image') else ''
        check(rel+' og image absolute',ogi.startswith('https://408farmers.com/'),ogi)
check('indexable titles unique',len({t for _,t in titles})==len(titles),titles)

for rel in ['404.html','neighbor/index.html','local/detail/index.html','home/thank-you.html','auto-bundle/thank-you.html','buyer/thank-you.html','tech/thank-you.html','teachers/thank-you.html','engineers/thank-you.html','healthcare/thank-you.html','life/thank-you.html','local/join/thank-you.html']:
    s=soup(rel); r=(s.find('meta',attrs={'name':'robots'}) or {}).get('content','').lower() if s.find('meta',attrs={'name':'robots'}) else ''
    check(rel+' noindex','noindex' in r,r)

robots=(ROOT/'robots.txt').read_text()
sitemap=(ROOT/'sitemap.xml').read_text()
check('robots references sitemap','Sitemap: https://408farmers.com/sitemap.xml' in robots)
check('robots protects life ops','Disallow: /life-ops/' in robots)
check('robots protects neighbor','Disallow: /neighbor/' in robots)
check('sitemap valid root',sitemap.strip().startswith('<?xml') and '<urlset' in sitemap and sitemap.strip().endswith('</urlset>'))
for url in indexable.values(): check('sitemap '+url,url in sitemap)

failed=[c for c in checks if not c['passed']]
out={'sprint':'408-UI-3.13','suite':'production_metadata','total':len(checks),'passed':len(checks)-len(failed),'failed':len(failed),'checks':checks}
(ROOT/'UI3_13_METADATA_QA.json').write_text(json.dumps(out,indent=2)+'\n')
print(f"408-UI-3.13 Metadata QA: {out['passed']}/{out['total']} passed")
sys.exit(1 if failed else 0)
