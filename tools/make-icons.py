#!/usr/bin/env python3
"""Redraw src/logo.svg as the PNG icons that build.py embeds as fallbacks.

    pip install pillow
    python tools/make-icons.py

Browsers that take SVG favicons use src/logo.svg directly (build.py inlines it). This script only exists
for the ones that do not - older browsers and the iOS home screen - and it only needs running when the
logo changes. It redraws the shapes from logo.svg by hand rather than rasterising the file, so it needs
nothing but Pillow; if you edit the SVG's geometry, mirror the change in the constants below.

    src/icon-64.png    tab icon, transparent outside the coin
    src/icon-180.png   apple-touch-icon, on a solid tile because iOS turns transparency black
"""
import math
import os

from PIL import Image, ImageDraw

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src')

RIM, FACE, WHITE = (229, 139, 0), (255, 170, 0), (255, 255, 255)
RING = (239, 151, 0)          # #E58B00 at 60% over #FFAA00, which is how the SVG's inner rim reads

# the euro sign, in the SVG's 64 x 64 units: one cubic Bezier arch, two round-capped bars
ARCH = [((42, 21), (38, 17), (28, 17), (24, 23)),
        ((24, 23), (20.5, 28.2), (20.5, 35.8), (24, 41)),
        ((24, 41), (28, 47), (38, 47), (42, 43))]
BARS = [((17, 28), (34, 28)), ((17, 36), (32, 36))]


def bezier(p0, p1, p2, p3, steps=240):
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        yield (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
               u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])


def line(a, b, steps=120):
    for i in range(steps + 1):
        t = i / steps
        yield (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def coin(size, supersample=8):
    """The coin as a size x size RGBA image, transparent outside the rim."""
    n = size * supersample
    k = n / 64.0
    img = Image.new('RGBA', (n, n), RIM + (0,))      # transparent, but the rim colour, so no halo when scaled down
    d = ImageDraw.Draw(img)

    def disc(r, fill):
        d.ellipse([(32 - r) * k, (32 - r) * k, (32 + r) * k, (32 + r) * k], fill=fill + (255,))

    disc(30, RIM)
    disc(26, FACE)
    disc(23, RING)        # the 2-unit inner rim: a ring from r=21 to r=23
    disc(21, FACE)

    mask = Image.new('L', (n, n), 0)
    m = ImageDraw.Draw(mask)

    def stroke(points, width):
        r = width / 2.0 * k
        for x, y in points:
            m.ellipse([x * k - r, y * k - r, x * k + r, y * k + r], fill=255)

    for seg in ARCH:
        stroke(bezier(*seg), 5)
    for a, b in BARS:
        stroke(line(a, b), 4.5)
    img.paste(WHITE + (255,), mask=mask)
    return img.resize((size, size), Image.LANCZOS)


def tile(size, background=(255, 246, 229), fill=0.84):
    """The coin centred on a solid square, for the home-screen icon."""
    out = Image.new('RGBA', (size, size), background + (255,))
    c = coin(round(size * fill))
    off = (size - c.width) // 2
    out.alpha_composite(c, (off, off))
    return out.convert('RGB')


if __name__ == '__main__':
    coin(64).save(os.path.join(SRC, 'icon-64.png'), optimize=True)
    tile(180).save(os.path.join(SRC, 'icon-180.png'), optimize=True)
    for name in ('icon-64.png', 'icon-180.png'):
        print(name, os.path.getsize(os.path.join(SRC, name)), 'bytes')
