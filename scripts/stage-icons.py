"""Generate release icons from assets/app-icon.png. Requires Pillow 11.3.0."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = Image.open(root / 'assets/app-icon.png').convert('RGB')
if source.width != source.height:
    raise ValueError('The master icon must be square')

def png(path, size):
    source.resize((size, size), Image.Resampling.LANCZOS).save(root / path, optimize=True)

for size in (16, 32, 192, 512):
    png(f'public/icon-{size}.png', size)
png('public/apple-touch-icon.png', 180)
png('ios/ExerciseStudio/Assets.xcassets/AppIcon.appiconset/icon.png', 1024)
# Separate maskable asset keeps the artwork within Android's central safe zone.
maskable = Image.new('RGB', (512, 512), source.getpixel((0, 0)))
maskable.paste(source.resize((360, 360), Image.Resampling.LANCZOS), (76, 76))
maskable.save(root / 'public/icon-maskable-512.png', optimize=True)
source.save(root / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('Generated browser, PWA, Apple touch and iOS icons from assets/app-icon.png')
