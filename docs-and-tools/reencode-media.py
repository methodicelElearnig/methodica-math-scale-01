#!/usr/bin/env python3
"""Re-encode the unit's raster images, keeping every file's REAL type (PNG stays PNG, JPEG stays
JPEG — unit-owner constraint 2026-11-03), downsized to 2 x the box each one is drawn in, and
written under a NEW name (`<stem>-opt.<ext>`) with every reference rewritten — the unit is
deployed and images are fetched without ?v=, so a same-name file would be served stale from
caches (guide ADDING-REPORTING-AND-RESUME.md §15.2 rule 6).

Never shipped (docs-and-tools/ is outside the package allowlist). Run from the unit root:

    python -I docs-and-tools/reencode-media.py --dry-run [--only NAME ...]
    python -I docs-and-tools/reencode-media.py --apply   [--only NAME ...]
    python -I docs-and-tools/reencode-media.py --videos --dry-run | --apply     (clips, `_video` boxes)

Ported 2026-11-10 from methodica-math-percent-06/docs-and-tools/reencode-media.py (itself from
methodica-ar-science-mass-liquid-02, 2026-10-22). This unit: images live in <part>/assets/images; the
references are every part's *.html, script.js and styles.css. SKIP keeps the two base avatars
(Character1.png / Character2.png) under their names: the parts build them at runtime as char + '.png'
and Character2.png (92 KB) is under MIN_BYTES - renaming one family only would break the other. The
pose files are built at runtime too (part 01 / 05 preloadImages, 05 s43): those suffixes carry '-opt'
by hand, and _test/verify-report.js PRELOAD_VARIANTS checks that every built name exists.

Rules:
  * only files >= MIN_BYTES; SVG never touched
  * target size = 2 x the largest box in docs-and-tools/media-display-boxes.json (cover rule: the
    larger of the two ratios), never upscaled; a shrink below 10 % is skipped
  * PNG: LANCZOS resize -> libimagequant 256-colour palette (dithered, alpha kept, quality floor 70 —
    an image that cannot reach it stays 24-bit, the banding guard) -> oxipng -o4 --strip safe
  * JPEG: LANCZOS resize -> Pillow quality 82, progressive, optimize, EXIF dropped
  * the real format decides the pipeline and the new extension: four files here carry a wrong
    extension (PNG content named .jpeg/.jpg); they come out as `-opt.png`
  * an output larger than its input is discarded: the input keeps its name, row says "kept (no gain)"
  * --apply: writes the new file, rewrites every reference (index.html, js/*.js, css/*.css,
    unit-css/*.css, root *.html) and deletes the original; rows -> docs-and-tools/reencode-rows.md
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

from PIL import Image, ImageOps
import imagequant

ROOT = Path(__file__).resolve().parent.parent
BOXES = json.loads((ROOT / 'docs-and-tools' / 'media-display-boxes.json').read_text('utf-8'))
ROWS_OUT = ROOT / 'docs-and-tools' / 'reencode-rows.md'

PNG_MIN_Q, PNG_MAX_Q, JPG_Q = 70, 95, 82
MIN_SHRINK = 0.90          # scale >= this: no resample
MIN_BYTES = 100 * 1024     # smaller files are not worth a rename
SKIP = {'Character1.png', 'Character2.png',   # built at runtime as char + '.png' (see the header)
        'ChatGPT Image Jul 27, 2026, 11_36_45 AM.png', 'Tel Aviv Map - Copy.jpg'}   # referenced nowhere, never shipped
IMG_EXT = {'.png', '.jpg', '.jpeg'}
EXT_FOR = {'PNG': '.png', 'JPEG': '.jpg'}


def asset_files():
    dirs = sorted(ROOT.glob('*-0[1-9]/assets/images'))
    out = []
    for d in dirs:
        if d.is_dir():
            out += sorted(x for x in d.iterdir() if x.is_file() and x.suffix.lower() in IMG_EXT)
    return out


def ref_files():
    return sorted(ROOT.glob('*-0[1-9]/*.html')) + sorted(ROOT.glob('*-0[1-9]/script.js')) + \
           sorted(ROOT.glob('*-0[1-9]/styles.css')) + sorted(ROOT.glob('*.html'))


def target_scale(name, nat_w, nat_h):
    boxes = BOXES.get(name)
    if not boxes:
        return 1.0, None
    s = max(max(bw / nat_w, bh / nat_h) for bw, bh in boxes)   # cover: the larger ratio
    biggest = max(boxes, key=lambda b: b[0] * b[1])
    return min(1.0, 2.0 * s), biggest


def rel(p):
    return p.relative_to(ROOT).as_posix()


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f'{cmd[0]} failed: {r.stderr[-800:]}')
    return r.stdout


def rewrite_refs(old_name, new_name):
    pat = re.compile(r'(?<=[/"\'(])' + re.escape(old_name) + r'(?=["\'?)])')
    touched = []
    for f in ref_files():
        s = f.read_text('utf-8')
        n, cnt = pat.subn(new_name, s)
        if cnt:
            f.write_text(n, 'utf-8', newline='')
            touched.append(f'{rel(f)}:{cnt}')
    return touched


def probe(f):
    j = json.loads(run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', str(f)]))
    v = next(x for x in j['streams'] if x['codec_type'] == 'video')
    return int(v['width']), int(v['height']), int(j['format'].get('bit_rate', 0))


def even(n): return int(n) - (int(n) % 2)


def videos(apply, only):
    """Clips: 2 x the drawn box (even), libx264 high / slow / crf 23 / maxrate 500k, no audio, faststart."""
    rows, saved, total_before = [], 0, 0
    table = BOXES.get('_video', {})
    for f in sorted(ROOT.glob('*-0[1-9]/assets/video*/*.mp4')):
        if (only and f.name not in only) or f.stem.endswith('-opt'): continue
        before = f.stat().st_size; total_before += before
        w, h, br = probe(f)
        boxes = table.get(f.name)
        s = min(1.0, 2.0 * max(max(bw / w, bh / h) for bw, bh in boxes)) if boxes else 1.0
        tw, th = (even(w * s), even(h * s)) if s < MIN_SHRINK else (w, h)
        new_name = f.stem + '-opt.mp4'; tmpdir = Path(tempfile.mkdtemp()); out = tmpdir / new_name
        vf = ['-vf', f'scale={tw}:{th}:flags=lanczos'] if (tw, th) != (w, h) else []
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(f), '-an', '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '23',
             '-maxrate', '500k', '-bufsize', '1000k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'] + vf + [str(out)])
        after = out.stat().st_size; w2, h2, br2 = probe(out)
        if after >= before:
            verdict, after_eff, final = 'kept (no gain)', before, f.name
        else:
            verdict, after_eff, final = 'written', after, new_name
            if apply:
                shutil.copyfile(out, f.with_name(new_name)); touched = rewrite_refs(f.name, new_name); f.unlink()
                verdict += ' -> refs: ' + (', '.join(touched) or 'NONE (orphan?)')
        shutil.rmtree(tmpdir, ignore_errors=True); saved += before - after_eff
        bx = f'{boxes[0][0]}x{boxes[0][1]}' if boxes else 'none'
        rows.append(f'| video | `{rel(f)}` | `{final}` | {before:,} | {after_eff:,} | {w}x{h} {br // 1000} kb/s | {w2}x{h2} {br2 // 1000} kb/s | {bx} | libx264 high slow crf 23 maxrate 500k -an faststart{" scale " + str(tw) + "x" + str(th) if vf else ""} | {verdict} |')
        print(f'{rel(f):60} {before:>10,} -> {after_eff:>9,}  {w}x{h}->{w2}x{h2} {br // 1000}->{br2 // 1000} kb/s  {verdict}')
    hdr = '| op | file | new name | bytes before | bytes after | before | after | box | parameters | verdict |\n|---|---|---|---|---|---|---|---|---|---|\n'
    (ROOT / 'docs-and-tools' / 'reencode-rows-video.md').write_text(hdr + '\n'.join(rows) + '\n', 'utf-8')
    print(f'\n{len(rows)} clips, {total_before:,} -> {total_before - saved:,} bytes ({saved:,} saved){" (dry run)" if not apply else ""}')


def main(apply, only):
    rows, saved, total_before = [], 0, 0
    for f in asset_files():
        if (only and f.name not in only) or f.name in SKIP:
            continue
        before = f.stat().st_size
        if before < MIN_BYTES or f.stem.endswith('-opt'):   # already done (re-runs are safe)
            continue
        total_before += before
        im = Image.open(f); im.load()
        fmt = im.format
        if fmt not in EXT_FOR:
            print(f'{rel(f):70} skipped: format {fmt}')
            continue
        nat = im.size
        scale, box = target_scale(f.name, *nat)
        ops, params = [], []
        tmpdir = Path(tempfile.mkdtemp())
        new_name = f.stem + '-opt' + EXT_FOR[fmt]
        out = tmpdir / new_name
        work = im
        if scale < MIN_SHRINK:
            new = (max(1, round(nat[0] * scale)), max(1, round(nat[1] * scale)))
            work = ImageOps.exif_transpose(im).resize(new, Image.LANCZOS)
            ops.append('resize'); params.append(f'LANCZOS {nat[0]}x{nat[1]} -> {new[0]}x{new[1]} (2 x box {box[0]}x{box[1]})')
        else:
            new = nat
        if fmt == 'PNG':
            rgba = work.convert('RGBA')
            try:
                q = imagequant.quantize_pil_image(rgba, dithering_level=1.0, max_colors=256, min_quality=PNG_MIN_Q, max_quality=PNG_MAX_Q)
                q.save(out, 'PNG', optimize=True)
                ops.append('quantize'); params.append(f'libimagequant 256 colours, dither 1.0, quality {PNG_MIN_Q}-{PNG_MAX_Q}')
            except RuntimeError:
                (rgba if im.mode in ('RGBA', 'LA', 'P') else work.convert('RGB')).save(out, 'PNG', optimize=True)
                params.append(f'palette refused below quality {PNG_MIN_Q}: kept 24-bit')
            run(['oxipng', '-o', '4', '--strip', 'safe', '-q', str(out)])
            params.append('oxipng -o4 --strip safe')
        else:
            work.convert('RGB').save(out, 'JPEG', quality=JPG_Q, optimize=True, progressive=True)
            ops.append('reencode'); params.append(f'Pillow JPEG q{JPG_Q} progressive optimize, EXIF dropped')
        if f.suffix.lower() != EXT_FOR[fmt]:
            params.append(f'real format {fmt}, extension corrected')
        after = out.stat().st_size
        op = '+'.join(ops) if ops else 'reencode'
        if after >= before:
            verdict, after_eff, final = 'kept (no gain)', before, f.name
        else:
            verdict, after_eff, final = 'written', after, new_name
            if apply:
                shutil.copyfile(out, f.with_name(new_name))
                touched = rewrite_refs(f.name, new_name)
                f.unlink()
                verdict += ' -> refs: ' + (', '.join(touched) or 'NONE (orphan?)')
        shutil.rmtree(tmpdir, ignore_errors=True)
        saved += before - after_eff
        boxtxt = f'{box[0]}x{box[1]}' if box else 'none: native kept'
        rows.append(f'| {op} | `{rel(f)}` | `{final}` | {before:,} | {after_eff:,} | {nat[0]}x{nat[1]} | {new[0]}x{new[1]} | {boxtxt} | {"; ".join(params)} | {verdict} |')
        print(f'{rel(f):70} {before:>10,} -> {after_eff:>10,}  {nat[0]}x{nat[1]}->{new[0]}x{new[1]:<5} {op:16} {verdict}')
    hdr = '| op | file | new name | bytes before | bytes after | px before | px after | box | parameters | verdict |\n|---|---|---|---|---|---|---|---|---|---|\n'
    ROWS_OUT.write_text(hdr + '\n'.join(rows) + '\n', 'utf-8')
    print(f'\n{len(rows)} files, {total_before:,} -> {total_before - saved:,} bytes ({saved:,} saved)'
          f'{" (dry run — nothing written)" if not apply else ""}; rows -> {rel(ROWS_OUT)}')


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--apply' not in args and '--dry-run' not in args:
        sys.exit(__doc__)
    only = set(args[args.index('--only') + 1:]) if '--only' in args else set()
    only -= {'--apply', '--dry-run', '--videos'}
    (videos if '--videos' in args else main)('--apply' in args, only)
