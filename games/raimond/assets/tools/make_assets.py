"""
Generates/cleans the pixel-art assets for Synchronicity v3.
  python3 tools/make_assets.py
 - hero sheets: cleaned (binary alpha, small palette, selective outline) + rebuilt 4-frame walk cycle
 - NPC sheets:  npc_<id>_<dir>.png   (4 frames each: idle, step, passing, step)
 - NPC portraits: npc_<id>_<emotion>.png (101x105, same format as the hero portraits)
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'assets', 'sprites'); ORIG = os.path.join(ROOT, 'assets', 'sprites_original'); POR = os.path.join(ROOT, 'assets', 'portraits')

def hexc(h):
    if len(h) == 4: h = '#' + ''.join(ch * 2 for ch in h[1:])
    return tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) + (255,)
def shade(c, f): return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)

# ---------------------------------------------------------------- walk cycle + outline
def outline(im, strength=.38):
    """selective outline: 1px border whose colour is a darkened copy of the neighbouring pixel"""
    w, h = im.size; src = im.load(); out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0)); o = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]: o[x + 1, y + 1] = src[x, y]
    snap = out.copy().load()   # read from the untouched silhouette so the border is exactly 1px
    for y in range(h + 2):
        for x in range(w + 2):
            if snap[x, y][3] == 0:
                best = None
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w + 2 and 0 <= yy < h + 2 and snap[xx, yy][3] == 255:
                        c = snap[xx, yy]; best = c if best is None or sum(c[:3]) < sum(best[:3]) else best
                if best: o[x, y] = (int(best[0] * strength), int(best[1] * strength), int(best[2] * strength), 255)
    return out

def shift(im, dx, dy):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (dx, dy)); return out

def walk_sheet(idle, direction):
    """idle -> 4-frame strip [idle, step A, passing, step B]; keeps the feet baseline fixed."""
    w, h = idle.size; a = np.array(idle); ys = np.where(a[:, :, 3] > 0)[0]; bottom = ys.max(); lb = bottom - 3   # leg band = last 4 rows
    def split(im):
        body = im.crop((0, 0, w, lb)); legs = im.crop((0, lb, w, h)); return body, legs
    def compose(body_dy, legs_fn):
        body, legs = split(idle); out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        out.alpha_composite(legs_fn(legs), (0, lb))
        if body_dy < 0: out.alpha_composite(idle.crop((0, lb - 1, w, lb)), (0, lb - 1))   # keep body joined to legs
        out.alpha_composite(body, (0, body_dy)); return out
    def leg_side(left_up, right_up):
        def f(legs):
            lw, lh = legs.size; L = legs.crop((0, 0, lw // 2, lh)); Rr = legs.crop((lw // 2, 0, lw, lh)); o = Image.new('RGBA', legs.size, (0, 0, 0, 0))
            o.alpha_composite(L, (0, -1 if left_up else 0)); o.alpha_composite(Rr, (lw // 2, -1 if right_up else 0)); return o
        return f
    def leg_shift(dx):
        return lambda legs: shift(legs, dx, 0)
    if direction in ('down', 'up'):
        fr = [idle.copy(), compose(0, leg_side(True, False)), compose(-1, lambda l: l), compose(0, leg_side(False, True))]
        # body for stepping frames drops by nothing; passing frame bobs up 1px (body shifted -1 while legs stay planted)
    else:
        sgn = -1 if direction == 'left' else 1
        fr = [idle.copy(), compose(0, leg_shift(sgn)), compose(-1, lambda l: l), compose(0, leg_shift(-sgn))]
    sheet = Image.new('RGBA', (w * 4, h), (0, 0, 0, 0))
    for i, f in enumerate(fr): sheet.paste(f, (i * w, 0))
    return sheet

# ---------------------------------------------------------------- hero sheets: clean + resize + outline + walk cycle
def clean_hero(name, direction):
    src = Image.open(os.path.join(ORIG, f'{name}_{direction}.png')).convert('RGBA'); f0 = src.crop((0, 0, 32, 40))
    a = np.array(f0); mask = a[:, :, 3] > 100; seen = np.zeros_like(mask); best = []
    for y0 in range(mask.shape[0]):
        for x0 in range(mask.shape[1]):
            if mask[y0, x0] and not seen[y0, x0]:
                comp = []; st = [(y0, x0)]; seen[y0, x0] = True
                while st:
                    cy, cx = st.pop(); comp.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
                if len(comp) > len(best): best = comp
    keep = np.zeros_like(mask)
    for cy, cx in best: keep[cy, cx] = True
    a[:, :, 3] = np.where(keep, a[:, :, 3], 0); f0 = Image.fromarray(a)
    ys, xs = np.where(keep); box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1); f0 = f0.crop(box)
    tw = 18; th = round(f0.height * tw / f0.width) if f0.width > f0.height * .8 else 22
    th = min(th, 23); f0 = f0.resize((tw, th), Image.BOX)
    arr = np.array(f0); alpha = arr[:, :, 3] >= 120
    rgb = Image.fromarray(arr[:, :, :3]).quantize(colors=14, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = Image.new('RGBA', (tw, th), (0, 0, 0, 0)); px = out.load(); rp = rgb.load()
    for y in range(th):
        for x in range(tw):
            if alpha[y, x]: px[x, y] = rp[x, y] + (255,)
    canvas = Image.new('RGBA', (20, 25), (0, 0, 0, 0)); canvas.paste(out, ((20 - tw) // 2, 25 - 1 - th)); idle = outline(out)  # 20 x (th+2)
    full = Image.new('RGBA', (20, 25), (0, 0, 0, 0)); full.paste(idle, (0, 25 - idle.height)); return full

# ---------------------------------------------------------------- NPC sprites
NPC = {
 'mo':     dict(skin='#e8c09a', hair='#c9c9d2', style='bald', top='#8a5a38', trim='#e0b84a', pants='#4a3a2e', shoe='#2a2220', acc=['tophat', 'mustache', 'gold'], bg='#b9a98c'),
 'bella':  dict(skin='#f2c8a8', hair='#a8523a', style='bun', top='#c8a6d8', trim='#fff', pants='#7a6a92', shoe='#5a4a52', acc=['apron'], bg='#e2c8d8'),
 'pip':    dict(skin='#e6b88e', hair='#3a2a1a', style='none', top='#4f86c8', trim='#fff', pants='#7a5a3a', shoe='#e8e0d0', acc=['cap', 'pack'], kid=True, bg='#a8c4dc'),
 'finn':   dict(skin='#d8a880', hair='#a8a8a8', style='none', top='#4a7a68', trim='#8ab8a0', pants='#5a4a3a', shoe='#3a2e24', acc=['strawhat', 'beard'], bg='#b8c4a0'),
 'morrow': dict(skin='#9a8aa8', hair='#222', style='none', top='#4a5068', trim='#7a82a0', pants='#2a2a3a', shoe='#1a1a24', acc=['cloak'], bg='#6a6482'),
 'vesper': dict(skin='#e8e2f2', hair='#c4b4ec', style='long', top='#d8d0f4', trim='#fff', pants='#d8d0f4', shoe='#d8d0f4', acc=['dress'], bg='#8a82b0'),
 'rattles':dict(skin='#ece8d4', hair='#222', style='none', top='#7a8098', trim='#a8aec4', pants='#5a6078', shoe='#3a4058', acc=['helm', 'skull'], bg='#8a90a4'),
 'lou':    dict(skin='#c8946a', hair='#2a1a12', style='spiky', top='#e0564a', trim='#fff', pants='#e0564a', shoe='#f0f0f0', acc=['visor', 'whistle'], bg='#d8b08a'),
 'coco':   dict(skin='#f4d2b4', hair='#f08fb8', style='bun', top='#8ad4f4', trim='#fff', pants='#fff', shoe='#f4b8d0', acc=['apron'], bg='#f0c8d8'),
 'dex':    dict(skin='#e0a878', hair='#f2d46a', style='messy', top='#2ab8a8', trim='#fff', pants='#f08a3a', shoe='#e8d8a8', acc=['shades'], bg='#a0d8d0'),
 'chips':  dict(skin='#e8cca8', hair='#14141a', style='slick', top='#1c1c26', trim='#ff3ca0', pants='#14141a', shoe='#0e0e14', acc=['bowtie', 'shades', 'gold'], bg='#6a4a68'),
}
DIRS = ['down', 'left', 'right', 'up']

class Cv:
    def __init__(s, w=22, h=30): s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.px = s.im.load(); s.w = w; s.h = h
    def p(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.px[int(x), int(y)] = c
    def r(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.p(x + i, y + j, c)
    def e(s, cx, cy, rx, ry, c, fn=None):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: s.p(x, y, fn(x, y) if fn else c)

def npc_idle(sp, d):
    cv = Cv(); A = sp['acc']; has = A.__contains__
    skin = hexc(sp['skin']); sk2 = shade(skin, .84); hair = hexc(sp['hair']); hl = shade(hair, 1.4); h2 = shade(hair, .72)
    top = hexc(sp['top']); top2 = shade(top, .74); trim = hexc(sp['trim']); pants = hexc(sp['pants']); shoe = hexc(sp['shoe'])
    kid = sp.get('kid'); off = 2 if kid else 0
    hx, hy = 11, 12 + off; side = d in ('left', 'right'); back = d == 'up'; fl = -1 if d == 'left' else 1
    skull = has('skull'); cloak = has('cloak')
    if skull: skin = hexc('#ece8d4'); sk2 = shade(skin, .84)
    # --- legs / dress
    ly = 24 + off; fy = 0
    if has('dress'):
        for i, (w_, y_) in enumerate(((10, 21), (12, 23), (14, 25))):
            cv.r(11 - w_ // 2, y_ + off - 2, w_, 2, top if i < 2 else top2)
        for i in range(4): cv.r(5 + i * 3, 27 + off - 2, 2, 1, top2)
    elif cloak:
        cv.r(6, 20, 11, 8, hexc('#4a5068')); cv.r(13, 20, 4, 8, hexc('#3a4058')); cv.r(6, 27, 11, 1, hexc('#2a3048'))
    else:
        if side:
            cv.r(9, ly, 4, 3 - (1 if kid else 0), pants); cv.r(8 + (0 if d == 'left' else 1), ly + 3 - (1 if kid else 0), 5, 2, shoe)
        else:
            cv.r(8, ly, 3, 3 - (1 if kid else 0), pants); cv.r(12, ly, 3, 3 - (1 if kid else 0), pants)
            cv.r(7, ly + 3 - (1 if kid else 0), 4, 2, shoe); cv.r(12, ly + 3 - (1 if kid else 0), 4, 2, shoe)
    # --- torso + arms
    ty = 18 + off
    if not cloak:
        cv.r(7, ty, 9, 6, top); cv.r(13, ty, 3, 6, top2)
        if not side: cv.r(7, ty + 4, 9, 1, trim) if sp['trim'] != sp['top'] and not has('apron') else None
        cv.r(5, ty, 2, 5, top); cv.r(16, ty, 2, 5, top2); cv.p(5, ty + 5, skin); cv.p(6, ty + 5, skin); cv.p(16, ty + 5, skin); cv.p(17, ty + 5, skin)
        if side: cv.r(5, ty, 2, 5, 0 or top2)
        if has('apron') and not back: cv.r(8, ty + 1, 7, 5, hexc('#f4f0e8')); cv.r(8, ty + 1, 7, 1, hexc('#dcd4c4'))
        if has('bowtie'): cv.r(9, ty - 1, 5, 2, hexc('#d02030'))
        if has('gold'): cv.p(11, ty + 2, hexc('#ffd23c')); cv.p(11, ty + 4, hexc('#ffd23c'))
        if has('whistle'): cv.r(11, ty + 1, 1, 2, hexc('#ffd23c'))
        if has('pack') and back: cv.r(7, ty, 9, 6, hexc('#e8892a')); cv.r(7, ty, 9, 1, hexc('#f4a84a'))
        if has('pack') and not back: cv.r(7, ty, 1, 5, hexc('#e8892a')); cv.r(15, ty, 1, 5, hexc('#e8892a'))
    # --- hair behind (long)
    if sp['style'] == 'long': cv.r(5, hy - 3, 13, 14, hair); cv.r(5, hy + 9, 13, 1, h2)
    # --- head
    if cloak:
        c = hexc('#4a5068'); cv.e(hx, hy, 7.5, 7, c); cv.e(hx + (fl * 1 if side else 0), hy + 1.5, 4.8, 4.5, hexc('#0a0810'))
        if not back: cv.r(hx - 3 + (fl if side else 0), hy + 1, 2, 2, hexc('#7ff')); cv.r(hx + 1 + (fl if side else 0), hy + 1, 2, 2, hexc('#7ff'))
    else:
        hair_head = sp['style'] not in ('none', 'bald') and not skull
        base = hair if (hair_head or back and sp['style'] != 'bald') else skin
        cv.e(hx, hy, 6.4, 6.2, base, (lambda x, y: base) if base == hair else (lambda x, y: sk2 if (x > hx + 2.5 or y > hy + 4.4) else skin))
        if not back:
            fx = hx + (fl * 1.5 if side else 0)
            cv.e(fx, hy + 1.4, 5.1, 4.8, skin, lambda x, y: sk2 if (x > fx + 2.3 or y > hy + 5) else skin)
            ec = hexc('#1c1624') if not skull else hexc('#111')
            if skull: cv.r(int(fx) - 3, hy + 1, 3, 3, ec); cv.r(int(fx) + 1, hy + 1, 3, 3, ec); cv.r(int(fx) - 2, hy + 5, 5, 1, hexc('#222'))
            elif side: cv.r(int(fx) + (1 if fl > 0 else -2), hy + 1, 1, 3, ec); cv.p(int(fx) + (2 if fl > 0 else -3), hy + 5, hexc('#a05a5a'))
            else:
                cv.r(int(fx) - 3, hy + 1, 1, 3, ec); cv.r(int(fx) + 3, hy + 1, 1, 3, ec); cv.p(int(fx) - 4, hy + 4, hexc('#e8908c')); cv.p(int(fx) + 4, hy + 4, hexc('#e8908c')); cv.r(int(fx), hy + 5, 2, 1, hexc('#9a4a4a'))
            if not side and not skull: cv.p(hx - 7, hy + 1, skin); cv.p(hx + 6, hy + 1, skin)
        if hair_head:
            st = sp['style']
            if not back: cv.r(hx - 6, hy - 4, 13, 3, hair); cv.r(hx - 6, hy - 2, 2, 5, hair); cv.r(hx + 5, hy - 2, 2, 5, hair)
            cv.r(hx - 3, hy - 5, 4, 1, hl)
            if st == 'spiky':
                for x0, h0 in ((-6, 3), (-3, 4), (0, 4), (3, 4), (5, 3)): cv.r(hx + x0, hy - 6 - h0 + 1, 3, h0, hair)
            if st == 'messy':
                for x0, h0 in ((-6, 3), (-4, 4), (-1, 3), (2, 5), (5, 3)): cv.r(hx + x0, hy - 6 - h0 + 1, 2, h0, hair)
            if st == 'bun': cv.e(hx, hy - 7, 3.2, 3, hair); cv.p(hx - 1, hy - 8, hl)
            if st == 'long' and not back: cv.r(hx - 7, hy - 2, 2, 11, hair); cv.r(hx + 5, hy - 2, 2, 11, hair)
        if sp['style'] == 'bald' and not back: cv.r(hx - 7, hy - 1, 2, 4, hair); cv.r(hx + 6, hy - 1, 2, 4, hair)
    # --- accessories
    if has('tophat'): cv.r(hx - 6, hy - 6, 13, 2, hexc('#26262c')); cv.r(hx - 4, hy - 12, 9, 7, hexc('#30303a')); cv.r(hx - 4, hy - 7, 9, 1, hexc('#c33'))
    if has('mustache') and not back: cv.r(hx - 3, hy + 4, 7, 1, hexc('#d6d6de')); cv.r(hx - 4, hy + 5, 2, 1, hexc('#d6d6de')); cv.r(hx + 3, hy + 5, 2, 1, hexc('#d6d6de'))
    if has('beard') and not back: cv.r(hx - 4, hy + 4, 9, 3, hexc('#b8b8b8')); cv.r(hx - 2, hy + 7, 5, 1, hexc('#b8b8b8'))
    if has('cap'):
        cc = top; cv.e(hx, hy - 3, 6.4, 3.8, cc); cv.r(hx - 6, hy - 1, 13, 1, shade(cc, .75))
        if not back: cv.r(hx - (6 if not side else (6 if fl < 0 else 0)), hy, 6 if side else 13, 1, shade(cc, .7))
    if has('strawhat'): cv.e(hx, hy - 4, 9.5, 2.2, hexc('#e8c870')); cv.e(hx, hy - 6, 5.5, 3.2, hexc('#f2d98a')); cv.r(hx - 5, hy - 5, 11, 1, hexc('#b03a3a'))
    if has('visor'): cv.r(hx - 6, hy - 4, 13, 2, hexc('#e0564a')); cv.r(hx - 8 + (0 if not side else (0 if fl < 0 else 4)), hy - 2, 7, 1, hexc('#e0564a'))
    if has('shades') and not back: fx = hx + (fl * 1.5 if side else 0); cv.r(int(fx) - 4, hy + 1, 9, 2, hexc('#101018')); cv.p(int(fx) - 3, hy + 1, hexc('#6ab0ff'))
    if has('helm'):
        cv.e(hx, hy - 1, 6.8, 6.4, hexc('#8a90a8'), lambda x, y: hexc('#aab0c8') if (x < hx - 1 and y < hy - 3) else hexc('#8a90a8'))
        if not back: cv.r(hx - 5, hy, 11, 2, hexc('#101018'))
        cv.r(hx - 1, hy - 10, 2, 5, hexc('#cc3333')); cv.r(hx - 3, hy + 3, 7, 3, hexc('#ece8d4'))
    return cv.im

def npc_sheet(id_, d):
    sp = NPC[id_]; base = d if d != 'right' else 'left'
    im = npc_idle(sp, base)
    if d == 'right': im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = outline(im)  # 24 x 32
    return walk_sheet(im, d)

# ---------------------------------------------------------------- NPC portraits (painted-ink look, 101x105)
def portrait(id_, emo):
    sp = NPC[id_]; K = 4; Wd, Ht = 101 * K, 105 * K
    bg = hexc(sp['bg']); im = Image.new('RGB', (Wd, Ht), bg[:3]); d = ImageDraw.Draw(im, 'RGBA')
    ink = (36, 26, 32); skin = hexc(sp['skin'])[:3]; sk2 = shade(hexc(sp['skin']), .86)[:3]; hair = hexc(sp['hair'])[:3]; top = hexc(sp['top'])[:3]; A = sp['acc']; has = A.__contains__
    cx, cy = Wd // 2, int(Ht * .56); lw = 6
    skull = has('skull'); cloak = has('cloak')
    if skull: skin = (236, 232, 212); sk2 = (206, 202, 182)
    # shoulders
    d.ellipse((cx - 170, cy + 150, cx + 170, cy + 420), fill=top if not cloak else (74, 80, 104), outline=ink, width=lw)
    d.rectangle((cx - 28, cy + 110, cx + 28, cy + 180), fill=sk2, outline=ink, width=lw)   # neck
    if has('apron'): d.rectangle((cx - 80, cy + 170, cx + 80, Ht + 40), fill=(244, 240, 232), outline=ink, width=lw)
    if has('bowtie'): d.polygon([(cx, cy + 170), (cx - 40, cy + 150), (cx - 40, cy + 190)], fill=(208, 32, 48), outline=ink); d.polygon([(cx, cy + 170), (cx + 40, cy + 150), (cx + 40, cy + 190)], fill=(208, 32, 48), outline=ink)
    # hair back
    st = sp['style']
    if st == 'long': d.ellipse((cx - 150, cy - 130, cx + 150, cy + 190), fill=hair, outline=ink, width=lw)
    # ears
    if not cloak: d.ellipse((cx - 138, cy - 5, cx - 98, cy + 55), fill=skin, outline=ink, width=lw); d.ellipse((cx + 98, cy - 5, cx + 138, cy + 55), fill=skin, outline=ink, width=lw)
    # head
    if cloak:
        d.ellipse((cx - 150, cy - 140, cx + 150, cy + 130), fill=(74, 80, 104), outline=ink, width=lw); d.ellipse((cx - 100, cy - 70, cx + 100, cy + 115), fill=(10, 8, 16))
    else:
        d.ellipse((cx - 122, cy - 118, cx + 122, cy + 128), fill=skin, outline=ink, width=lw)
        d.chord((cx - 122, cy - 118, cx + 122, cy + 128), 30, 150, fill=sk2)  # jaw shade
        d.ellipse((cx - 122, cy - 118, cx + 122, cy + 128), outline=ink, width=lw)
    # hair front
    if not cloak and not skull:
        if st in ('spiky', 'messy', 'slick', 'bun', 'long'):
            d.pieslice((cx - 130, cy - 135, cx + 130, cy + 70), 180, 360, fill=hair, outline=ink, width=lw)
            if st == 'spiky':
                for i in range(6): x0 = cx - 120 + i * 48; d.polygon([(x0, cy - 85), (x0 + 24, cy - 175 - (i % 2) * 22), (x0 + 48, cy - 85)], fill=hair, outline=ink)
            if st == 'messy':
                for i in range(5): x0 = cx - 110 + i * 46; d.polygon([(x0, cy - 80), (x0 + 30, cy - 160 - (i % 3) * 18), (x0 + 60, cy - 80)], fill=hair, outline=ink)
            if st == 'bun': d.ellipse((cx - 50, cy - 195, cx + 50, cy - 105), fill=hair, outline=ink, width=lw)
            if st == 'slick': d.arc((cx - 120, cy - 135, cx + 20, cy - 10), 190, 300, fill=tuple(min(255, v + 50) for v in hair), width=10)
            d.polygon([(cx - 122, cy - 20), (cx - 90, cy - 20), (cx - 122, cy + 70)], fill=hair)
            d.polygon([(cx + 122, cy - 20), (cx + 90, cy - 20), (cx + 122, cy + 70)], fill=hair)
        if st == 'bald': d.arc((cx - 100, cy - 100, cx + 100, cy + 20), 200, 340, fill=(255, 255, 255, 90), width=8)
    # face parts
    ey = cy + 20; ex = 56
    def eye(side, kind):
        x = cx + side * ex
        if skull: d.ellipse((x - 26, ey - 26, x + 26, ey + 30), fill=(20, 20, 20)); return
        if cloak: d.ellipse((x - 22, ey - 12, x + 22, ey + 18), fill=(120, 255, 255)); return
        if kind in ('happy', 'blush'):
            d.arc((x - 28, ey - 8, x + 28, ey + 40), 200, 340, fill=ink, width=12)
        elif kind == 'shock':
            d.ellipse((x - 30, ey - 36, x + 30, ey + 38), fill=(255, 255, 255), outline=ink, width=lw); d.ellipse((x - 8, ey - 10, x + 8, ey + 12), fill=ink)
        elif kind == 'dark':
            d.ellipse((x - 26, ey - 26, x + 26, ey + 30), fill=(255, 255, 255)); d.ellipse((x - 5, ey - 5, x + 5, ey + 5), fill=ink)
        else:
            hh = 20 if kind == 'angry' else 28
            d.ellipse((x - 16, ey - hh, x + 16, ey + hh), fill=ink); d.ellipse((x - 9 - side * 2, ey - hh + 8, x + 1 - side * 2, ey - hh + 20), fill=(255, 255, 255))
    for s_ in (-1, 1): eye(s_, emo)
    # brows
    by = ey - 62; bc = ink if st != 'bald' else (150, 150, 158)
    if not cloak and not skull and not has('shades'):
        for s_ in (-1, 1):
            x = cx + s_ * ex
            if emo == 'angry': d.line((x + s_ * 34, by + 20 - 34, x - s_ * 34, by + 20), fill=bc, width=14)
            elif emo in ('sad', 'worried'): d.line((x - s_ * 34, by - 14, x + s_ * 34, by + 20), fill=bc, width=12)
            elif emo == 'shock': d.line((x - 30, by - 28, x + 30, by - 28), fill=bc, width=10)
            else: d.line((x - 30, by, x + 30, by - (6 if emo == 'happy' else 0)), fill=bc, width=10)
    if has('shades'):
        for s_ in (-1, 1): x = cx + s_ * ex; d.rounded_rectangle((x - 46, ey - 28, x + 46, ey + 30), 10, fill=(16, 16, 24), outline=ink, width=lw); d.line((x - 36, ey - 14, x - 14, ey - 14), fill=(110, 170, 255), width=8)
        d.line((cx - 12, ey - 6, cx + 12, ey - 6), fill=(16, 16, 24), width=12)
    if emo in ('blush', 'happy'): 
        for s_ in (-1, 1): d.ellipse((cx + s_ * 88 - 34, ey + 40, cx + s_ * 88 + 34, ey + 76), fill=(255, 140, 150, 130 if emo == 'blush' else 80))
    if emo == 'sad': d.ellipse((cx - ex - 8, ey + 40, cx - ex + 6, ey + 70), fill=(150, 210, 255)); 
    # nose + mouth
    d.line((cx - 4, ey + 40, cx + 6, ey + 52), fill=(150, 90, 80), width=7)
    my = ey + 82
    if skull: d.rectangle((cx - 60, my - 14, cx + 60, my + 24), fill=(244, 240, 224), outline=ink, width=6); [d.line((cx - 60 + i * 24, my - 14, cx - 60 + i * 24, my + 24), fill=ink, width=5) for i in range(6)]
    elif not cloak:
        if emo == 'happy': d.chord((cx - 52, my - 36, cx + 52, my + 40), 0, 180, fill=(110, 30, 40), outline=ink, width=7)
        elif emo == 'sad': d.arc((cx - 40, my, cx + 40, my + 60), 200, 340, fill=ink, width=9)
        elif emo == 'angry': d.rectangle((cx - 44, my - 6, cx + 44, my + 30), fill=(110, 30, 40), outline=ink, width=7); d.line((cx - 44, my + 12, cx + 44, my + 12), fill=(255, 255, 255), width=5)
        elif emo == 'shock': d.ellipse((cx - 22, my - 10, cx + 22, my + 46), fill=(110, 30, 40), outline=ink, width=7)
        elif emo == 'worried': d.line([(cx - 40, my + 14), (cx - 20, my + 2), (cx, my + 16), (cx + 20, my + 2), (cx + 40, my + 14)], fill=ink, width=8)
        elif emo == 'blush': d.arc((cx - 34, my - 14, cx + 34, my + 24), 20, 160, fill=ink, width=8)
        else: d.line((cx - 30, my + 8, cx + 30, my + 8), fill=ink, width=8)
    # mustache / beard
    if has('mustache') and not skull: d.polygon([(cx, my - 46), (cx - 84, my - 56), (cx - 66, my - 22), (cx, my - 30), (cx + 66, my - 22), (cx + 84, my - 56)], fill=(214, 214, 222), outline=ink)
    if has('beard'): d.pieslice((cx - 110, my - 60, cx + 110, my + 150), 0, 180, fill=(184, 184, 184), outline=ink, width=lw)
    # hats / gear
    if has('tophat'): d.rectangle((cx - 100, cy - 140, cx + 100, cy - 118), fill=(38, 38, 44), outline=ink, width=lw); d.rectangle((cx - 74, cy - 235, cx + 74, cy - 130), fill=(48, 48, 58), outline=ink, width=lw); d.rectangle((cx - 74, cy - 165, cx + 74, cy - 140), fill=(200, 50, 50))
    if has('cap'): d.pieslice((cx - 125, cy - 150, cx + 125, cy + 40), 180, 360, fill=top, outline=ink, width=lw); d.rectangle((cx - 140, cy - 24, cx + 40, cy - 6), fill=tuple(int(v * .75) for v in top), outline=ink, width=5)
    if has('strawhat'): d.ellipse((cx - 190, cy - 140, cx + 190, cy - 60), fill=(232, 200, 112), outline=ink, width=lw); d.pieslice((cx - 105, cy - 215, cx + 105, cy - 80), 180, 360, fill=(242, 217, 138), outline=ink, width=lw); d.rectangle((cx - 100, cy - 118, cx + 100, cy - 98), fill=(176, 58, 58))
    if has('visor'): d.pieslice((cx - 125, cy - 130, cx + 125, cy + 50), 180, 360, fill=(224, 86, 74), outline=ink, width=lw); d.ellipse((cx - 150, cy - 50, cx + 100, cy - 10), fill=(224, 86, 74), outline=ink, width=lw)
    if has('helm'): d.pieslice((cx - 135, cy - 150, cx + 135, cy + 90), 180, 360, fill=(138, 144, 168), outline=ink, width=lw); d.rectangle((cx - 135, cy - 46, cx + 135, cy - 6), fill=(16, 16, 24), outline=ink, width=lw); d.rectangle((cx - 12, cy - 215, cx + 12, cy - 140), fill=(204, 51, 51), outline=ink, width=5)
    if has('dress') and False: pass
    im = im.crop((cx - 175, cy - 212, cx + 175, cy - 212 + 364)).resize((101, 105), Image.LANCZOS)
    a = np.array(im).astype(np.float32); rs = np.random.RandomState(hash(id_) % 9999 + len(emo)); a += rs.normal(0, 4.5, a.shape[:2])[:, :, None]   # paper grain
    if emo == 'dark': a *= .55
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

if __name__ == '__main__':
    os.makedirs(SPR, exist_ok=True); os.makedirs(POR, exist_ok=True)
    for hero in ('caroline', 'hitori', 'steven', 'uku'):
        for d in DIRS:
            idle = clean_hero(hero, d); walk_sheet(idle, d).save(os.path.join(SPR, f'{hero}_{d}.png'))
    for id_ in NPC:
        for d in DIRS: npc_sheet(id_, d).save(os.path.join(SPR, f'npc_{id_}_{d}.png'))
        for emo in ('neutral', 'happy', 'sad', 'angry', 'shock', 'worried', 'blush', 'dark'): portrait(id_, emo).save(os.path.join(POR, f'npc_{id_}_{emo}.png'))
    print('done',SPR)
