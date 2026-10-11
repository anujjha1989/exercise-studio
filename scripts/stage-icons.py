"""Generate release icons from assets/app-icon.png. Requires Pillow 11.3.0."""
from pathlib import Path
from PIL import Image
import sys

check = "--check" in sys.argv

root = Path(__file__).resolve().parent.parent
source = Image.open(root / 'assets/app-icon.png').convert('RGB')
if source.width != source.height:
    raise ValueError('The master icon must be square')

def emit_png(image, path):
    if check:
        existing = Image.open(root / path).convert('RGB')
        assert existing.size == image.size and existing.tobytes() == image.tobytes(), path
    else:
        image.save(root / path, optimize=True)

def png(path, size):
    emit_png(source.resize((size, size), Image.Resampling.LANCZOS), path)

for size in (16, 32, 192, 512):
    png(f'public/icon-{size}.png', size)
png('public/apple-touch-icon.png', 180)
png('ios/ExerciseStudio/Assets.xcassets/AppIcon.appiconset/icon.png', 1024)
# Separate maskable asset keeps the artwork within Android's central safe zone.
maskable = Image.new('RGB', (512, 512), source.getpixel((0, 0)))
maskable.paste(source.resize((360, 360), Image.Resampling.LANCZOS), (76, 76))
emit_png(maskable, 'public/icon-maskable-512.png')
if check:
    ico = Image.open(root / 'public/favicon.ico')
    assert ico.ico.sizes() == {(16, 16), (32, 32), (48, 48)}
    for size in ico.ico.sizes():
        expected = source.copy()
        expected.thumbnail(size, Image.Resampling.LANCZOS, reducing_gap=None)
        assert ico.ico.getimage(size).convert('RGB').tobytes() == expected.tobytes(), 'favicon.ico'
else:
    source.save(root / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('Generated browser, PWA, Apple touch and iOS icons from assets/app-icon.png')
