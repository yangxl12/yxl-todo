"""从原始 logo 图中抠出火焰图案，输出透明背景的 brand-mark.png。

用法: python scripts/make-brand-mark.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "shiyan-logo_assets" / "7aeecb0e-logo.png"
OUT = ROOT / "src" / "assets" / "brand-mark.png"

# 输出高度（CSS 里按 2x~4x 屏显示，留足余量）
OUT_HEIGHT = 240
# 与背景色的距离低于该值视作纯背景；边缘按距离线性还原 alpha
BG_TOLERANCE = 14.0


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    px = img.load()

    # 取四角平均作为背景色
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(round(sum(c[i] for c in corners) / len(corners)) for i in range(3))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    min_x, min_y, max_x, max_y = w, h, -1, -1

    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # 到背景色的最大通道差，比欧氏距离更抗渐变
            dist = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            if dist <= BG_TOLERANCE:
                continue
            alpha = min(1.0, dist / 160.0)
            if alpha < 0.02:
                continue
            # 反解混色：去掉背景污染，边缘不再有米色描边
            fr = (r - (1 - alpha) * bg[0]) / alpha
            fg = (g - (1 - alpha) * bg[1]) / alpha
            fb = (b - (1 - alpha) * bg[2]) / alpha
            op[x, y] = (
                max(0, min(255, round(fr))),
                max(0, min(255, round(fg))),
                max(0, min(255, round(fb))),
                round(alpha * 255),
            )
            min_x, min_y = min(min_x, x), min(min_y, y)
            max_x, max_y = max(max_x, x), max(max_y, y)

    if max_x < 0:
        raise SystemExit("没有找到图案像素")

    pad = 2
    box = (max(0, min_x - pad), max(0, min_y - pad), min(w, max_x + 1 + pad), min(h, max_y + 1 + pad))
    out = out.crop(box)

    ratio = OUT_HEIGHT / out.height
    out = out.resize((max(1, round(out.width * ratio)), OUT_HEIGHT), Image.LANCZOS)
    out.save(OUT, optimize=True)

    print(f"背景色 {bg}  裁切 {box}  输出 {OUT.relative_to(ROOT)} {out.size}")


if __name__ == "__main__":
    main()
