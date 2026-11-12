#!/usr/bin/env python3
"""本站常用字的字型小子集（批 H2，2026-11-12）。不在 npm run build 鏈裡；介面文字大改後手動重跑。

為什麼：正文字體湖文明朝體的共用分片（mx.bdfz.net，90 片）是按多個站的字頻排的，本站首頁的三百多個字
散在二十多片裡，要抓約 1.5 MB 才能把首頁顯示成這個字體。這裡把「首頁會出現的字」與「作答流程會出現的字」
各自切成小檔放在本站 public/fonts/：首頁每種文字只要兩個檔（約 220–250 KB），其餘的字仍由共用分片補上。

用法（需要 fontTools 與 woff2 工具；本機是 Homebrew 的 fonttools 與 woff2）：
  curl -o /tmp/HuWenMingChaoTi.woff2 https://mx.bdfz.net/data/fonts/HuWenMingChaoTi.woff2
  woff2_decompress /tmp/HuWenMingChaoTi.woff2            # 產生 /tmp/HuWenMingChaoTi.ttf
  /opt/homebrew/opt/python@3.14/bin/python3.14 scripts/build_site_font.py /tmp/HuWenMingChaoTi.ttf
  npm run test:first-screen

讀：src/i18n/locales/zh-Hant.json、public/i18n/zh-Hans.json（先跑 npm run data:i18n）、src/i18n/locales/en.json
寫：public/fonts/huwen-nope.<層>.<雜湊>.woff2 與 huwen-nope.<雜湊>.css（先刪掉舊的 huwen-nope.*）、
    src/data/siteFontCss.ts（執行期只需要樣式表的路徑）、src/data/siteFont.ts（完整清單，給測試與查閱用，不進前端包）
決定性：相同的字典與來源字型產生相同的檔案與雜湊；不寫時間。
字型裡沒有的字（例如諺文）不進子集，瀏覽器照舊用後備字型。hinting 捨棄、版面特性保留，與共用分片一致。
"""
import hashlib, json, os, re, subprocess, sys, tempfile

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAMILY = 'HuWenMingChaoNope'
SOURCE_URL = 'https://mx.bdfz.net/data/fonts/HuWenMingChaoTi.woff2'
# 共用分片第 00 片已經涵蓋的基本字元（ASCII 與常用標點）：不放進本站子集，英文介面才不會為了拉丁字母去抓中文字的檔。
BASIC = set(range(0x20, 0x7F)) | {0xB7, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x3000, 0x3001, 0x3002,
                                   0x3008, 0x3009, 0x300A, 0x300B, 0xFF01, 0xFF0C, 0xFF1A, 0xFF1B, 0xFF1F}
# 首頁（含頁頭、頁尾、起點與目的地、載入與同步提示）會用到的字串鍵
LANDING = ['meta.title', 'ui.landing.', 'ui.header.', 'ui.branch.', 'ui.dest.', 'ui.common.', 'ui.theme.', 'ui.locale.',
           'ui.cycle.', 'ui.sync.', 'ui.app.']
LANDING_PATTERNS = [r'^origin\.[a-z-]+\.label$']
# 大陸問卷作答流程（題目、選項、省份、分節、載入失敗與學習記錄提示、非大陸起點的資格選項）
QUESTIONS = ['q.', 'val.', 'ui.runner.', 'ui.evidence.', 'geo.province.', 'section.', 'dim.', 'subject.', 'tag.', 'reason.',
             'program.', 'ui.req.', 'origin.qual.', 'ui.aplus.', 'ui.data.error.']
EXTRA_LANDING = '正體简体'  # 語言切換鈕上的字，不在字典裡


def load(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as fh:
        return json.load(fh)


def text_of(dictionary, prefixes, patterns=()):
    parts = []
    for key, value in dictionary.items():
        if any(key == p or key.startswith(p) for p in prefixes) or any(re.search(p, key) for p in patterns):
            parts.append(re.sub(r'\{\w+\}', '', re.sub(r'</?[a-z0-9]+/?>', '', value)))
    return ''.join(parts)


def codepoints(text):
    return {ord(ch) for ch in text if ord(ch) >= 0x80 and ord(ch) not in BASIC}


def ranges(cps):
    cps = sorted(cps); out = []; start = prev = cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp; continue
        out.append((start, prev)); start = prev = cp
    out.append((start, prev))
    return ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)


def build_face(source_ttf, cps, workdir, name):
    opts = subset.Options(); opts.hinting = False; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    # recalcTimestamp=False：不把「現在」寫進 head 表，重跑才會得到位元組相同的檔
    font = TTFont(source_ttf, recalcTimestamp=False); sub = subset.Subsetter(options=opts); sub.populate(unicodes=sorted(cps)); sub.subset(font)
    ttf = os.path.join(workdir, name + '.ttf'); font.save(ttf)
    subprocess.run(['woff2_compress', ttf], check=True, capture_output=True)
    with open(os.path.join(workdir, name + '.woff2'), 'rb') as fh:
        return fh.read()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source_ttf = sys.argv[1]
    source = TTFont(source_ttf)
    if source.flavor is not None:
        sys.exit('pass the decompressed .ttf (woff2_decompress), not the .woff2')
    cmap = set(source.getBestCmap())
    with open(source_ttf, 'rb') as fh:
        source_sha = hashlib.sha256(fh.read()).hexdigest()
    hant, hans, en = load('src/i18n/locales/zh-Hant.json'), load('public/i18n/zh-Hans.json'), load('src/i18n/locales/en.json')
    if list(hant) != list(hans) or list(hant) != list(en):
        sys.exit('locale key sets differ; run npm run data:i18n first')

    land = {name: codepoints(text_of(d, LANDING, LANDING_PATTERNS)) for name, d in (('hant', hant), ('hans', hans), ('en', en))}
    ques = {name: codepoints(text_of(d, QUESTIONS)) for name, d in (('hant', hant), ('hans', hans), ('en', en))}
    extra = codepoints(EXTRA_LANDING)
    everything = land['hant'] | land['hans'] | land['en'] | ques['hant'] | ques['hans'] | ques['en'] | extra
    missing = sorted(everything - cmap)
    # 非 CJK 的符號（箭頭等）單獨一小片：三種語言都可能用到，英文介面不必為了它去抓中文字的檔
    symbols = {cp for cp in everything if cp < 0x2E80} & cmap
    land_all = ((land['hant'] | land['hans'] | land['en'] | extra) & cmap) - symbols
    ques_all = (((ques['hant'] | ques['hans'] | ques['en']) & cmap) - symbols) - land_all
    tiers = [
        ('sym', symbols),
        ('l-common', {cp for cp in land_all if (cp in land['hant'] and cp in land['hans']) or cp in land['en'] or cp in extra}),
        ('l-hant', {cp for cp in land_all if cp in land['hant'] and cp not in land['hans'] and cp not in land['en'] and cp not in extra}),
        ('l-hans', {cp for cp in land_all if cp in land['hans'] and cp not in land['hant'] and cp not in land['en'] and cp not in extra}),
        ('q-common', {cp for cp in ques_all if (cp in ques['hant'] and cp in ques['hans']) or cp in ques['en']}),
        ('q-hant', {cp for cp in ques_all if cp in ques['hant'] and cp not in ques['hans'] and cp not in ques['en']}),
        ('q-hans', {cp for cp in ques_all if cp in ques['hans'] and cp not in ques['hant'] and cp not in ques['en']}),
    ]
    assigned = set()
    for name, cps in tiers:
        if cps & assigned:
            sys.exit(f'tier {name} overlaps an earlier tier')
        assigned |= cps
    if assigned != (everything & cmap):
        sys.exit('some characters were not assigned to a tier')

    out_dir = os.path.join(ROOT, 'public', 'fonts')
    os.makedirs(out_dir, exist_ok=True)
    for old in os.listdir(out_dir):
        if old.startswith('huwen-nope.'):
            os.remove(os.path.join(out_dir, old))
    faces = []
    with tempfile.TemporaryDirectory() as workdir:
        for name, cps in tiers:
            if not cps:
                continue
            data = build_face(source_ttf, cps, workdir, name)
            file_name = f'huwen-nope.{name}.{hashlib.sha256(data).hexdigest()[:10]}.woff2'
            with open(os.path.join(out_dir, file_name), 'wb') as fh:
                fh.write(data)
            faces.append({'tier': name, 'file': f'/fonts/{file_name}', 'bytes': len(data), 'codepoints': len(cps), 'unicodeRange': ranges(cps)})

    # 樣式表也是內容雜湊檔名的靜態檔：前端只帶它的路徑，unicode-range 清單不進 JavaScript 包
    css = ('/* ' + FAMILY + ': site subsets of HuWenMingChaoTi for nope.bdfz.net (landing and questionnaire characters). '
           'Generated by scripts/build_site_font.py. */\n'
           + '\n'.join(f'@font-face{{font-family:"{FAMILY}";src:url("{f["file"]}") format("woff2");font-style:normal;font-weight:400;'
                       f'font-display:swap;unicode-range:{f["unicodeRange"]}}}' for f in faces) + '\n').encode()
    css_name = f'huwen-nope.{hashlib.sha256(css).hexdigest()[:10]}.css'
    with open(os.path.join(out_dir, css_name), 'wb') as fh:
        fh.write(css)
    with open(os.path.join(ROOT, 'src', 'data', 'siteFontCss.ts'), 'w', encoding='utf-8') as fh:
        fh.write('// Generated by scripts/build_site_font.py. Do not edit by hand.\n'
                 '/** 本站常用字小子集的樣式表（public/fonts/，檔名含內容雜湊）。 */\n'
                 f"export const SITE_FONT_CSS = '/fonts/{css_name}'\n"
                 f"export const SITE_FONT_FAMILY = '{FAMILY}'\n")

    manifest = {
        'family': FAMILY,
        'css': f'/fonts/{css_name}',
        'source': {'url': SOURCE_URL, 'ttfSha256': source_sha, 'codepoints': len(cmap)},
        'keys': {'landing': LANDING, 'landingPatterns': LANDING_PATTERNS, 'questions': QUESTIONS, 'extraLanding': EXTRA_LANDING},
        'missing': ''.join(chr(cp) for cp in missing),
        'faces': faces,
    }
    with open(os.path.join(ROOT, 'src', 'data', 'siteFont.ts'), 'w', encoding='utf-8') as fh:
        fh.write('// Generated by scripts/build_site_font.py. Do not edit by hand.\n'
                 f'export const siteFont = {json.dumps(manifest, ensure_ascii=False, indent=2)} as const\n')
    print(json.dumps({'faces': [(f['tier'], f['codepoints'], f['bytes']) for f in faces], 'missing': manifest['missing'],
                      'total_bytes': sum(f['bytes'] for f in faces)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
