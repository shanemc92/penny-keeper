#!/usr/bin/env python3
"""Check text/background colour pairs from src/style.css meet WCAG AA (4.5:1 for text, 3:1 for large text and icons).

    python tests/contrast.py

Reads the :root (light) and [data-theme="dark"] custom properties and tests the pairs the stylesheet actually
uses. Exits 1 if any pair falls short, so CI can catch a colour change that makes something unreadable.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = open(os.path.join(ROOT, 'src', 'style.css'), encoding='utf-8').read()


def block(selector):
    m = re.search(re.escape(selector) + r'\s*\{(.*?)\n\}', CSS, re.S)
    assert m, 'no block for ' + selector
    return dict(re.findall(r'--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})', m.group(1)))


def lum(hexv):
    r, g, b = [int(hexv[i:i+2], 16) / 255 for i in (1, 3, 5)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# (foreground, background, minimum ratio, what it is)
PAIRS = [
    ('text', 'bg', 4.5, 'body text'),
    ('text', 'surface', 4.5, 'text on a card'),
    ('muted', 'surface', 4.5, 'secondary text on a card'),
    ('muted', 'bg', 4.5, 'secondary text on the page'),
    ('muted', 'surface2', 4.5, 'secondary text on a tinted panel'),
    ('accent', 'surface', 4.5, 'links and active menu text'),
    ('accent', 'accent-soft', 4.5, 'active menu item, pills'),
    ('on-accent', 'accent', 4.5, 'primary button, selected chip, step numbers'),
    ('on-good', 'good', 4.5, 'completed step badge'),
    ('good', 'surface', 4.5, 'positive figures'),
    ('good', 'good-soft', 4.5, 'good pill / callout'),
    ('warn', 'warn-soft', 4.5, 'warning pill / callout'),
    ('bad', 'surface', 4.5, 'negative figures'),
    ('bad', 'bad-soft', 4.5, 'error pill / callout'),
    ('info', 'info-soft', 4.5, 'info callout'),
    ('text', 'need-soft', 4.5, 'text in an amber "fill this in" box'),
]


def main():
    light = block(':root')
    dark = dict(light)
    dark.update(block(':root[data-theme="dark"]') if ':root[data-theme="dark"]' in CSS else block('[data-theme="dark"]'))
    failures = 0
    for name, theme in (('light', light), ('dark', dark)):
        for fg, bg, need, what in PAIRS:
            if fg not in theme or bg not in theme:
                print('skip  %-5s %s on %s (not defined)' % (name, fg, bg))
                continue
            r = ratio(theme[fg], theme[bg])
            ok = r >= need
            failures += 0 if ok else 1
            print('%s %-5s %-9s on %-11s %5.2f:1 (need %.1f)  %s' % ('ok  ' if ok else 'FAIL', name, fg, bg, r, need, what))
    print('\n%d pair(s) below the minimum' % failures if failures else '\nall pairs meet the minimum')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
