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
        existing = Image.open(root / path).convert(image.mode)
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

# Prepared tvOS catalog; no tvOS app target exists yet.
import json
from PIL import ImageOps
landscape = Image.open(root / 'assets/tvos-icon.png').convert('RGB')
catalog = root / 'tvos/Assets.xcassets'
brand = catalog / 'Brand Assets.brandassets'
info = {'author': 'xcode', 'version': 1}

def contents(path, data):
    text = json.dumps(data, indent=2) + '\n'
    if check:
        assert (path / 'Contents.json').read_text() == text, str(path)
    else:
        path.mkdir(parents=True, exist_ok=True)
        (path / 'Contents.json').write_text(text)

contents(catalog, {'info': info})
contents(brand, {'assets': [
    {'idiom': 'tv', 'size': '400x240', 'filename': 'App Icon.imagestack', 'role': 'primary-app-icon'},
    {'idiom': 'tv', 'size': '1280x768', 'filename': 'App Icon Large.imagestack', 'role': 'primary-app-icon'},
    {'idiom': 'tv', 'size': '1920x720', 'filename': 'Top Shelf.imageset', 'role': 'top-shelf-image'},
    {'idiom': 'tv', 'size': '2320x720', 'filename': 'Top Shelf Wide.imageset', 'role': 'top-shelf-image-wide'}
], 'info': info})
for name, sizes in [('App Icon', [(400, 240), (800, 480)]), ('App Icon Large', [(1280, 768)])]:
    stack = brand / (name + '.imagestack')
    contents(stack, {'layers': [{'filename': 'Foreground.imagestacklayer'}, {'filename': 'Artwork.imagestacklayer'}], 'info': info})
    foreground = stack / 'Foreground.imagestacklayer'
    contents(foreground, {'info': info})
    fg_folder = foreground / 'Content.imageset'
    contents(fg_folder, {'images': [{'idiom': 'tv', 'filename': f'empty-{i}x.png', 'scale': f'{i}x'} for i in range(1, len(sizes) + 1)], 'info': info})
    for i, size in enumerate(sizes, 1):
        emit_png(Image.new('RGBA', size, (0, 0, 0, 0)), str((fg_folder / f'empty-{i}x.png').relative_to(root)))
    layer = stack / 'Artwork.imagestacklayer'
    contents(layer, {'info': info})
    folder = layer / 'Content.imageset'
    images = []
    for index, size in enumerate(sizes, 1):
        images.append({'idiom': 'tv', 'filename': f'icon-{index}x.png', 'scale': f'{index}x'})
    contents(folder, {'images': images, 'info': info})
    for index, size in enumerate(sizes, 1):
        emit_png(ImageOps.fit(landscape, size, method=Image.Resampling.LANCZOS), str((folder / f'icon-{index}x.png').relative_to(root)))
for name, width in [('Top Shelf', 1920), ('Top Shelf Wide', 2320)]:
    folder = brand / (name + '.imageset')
    contents(folder, {'images': [{'idiom': 'tv', 'filename': f'shelf-{scale}x.png', 'scale': f'{scale}x'} for scale in (1, 2)], 'info': info})
    for scale in (1, 2):
        size = (width * scale, 720 * scale)
        image = Image.new('RGB', size, landscape.getpixel((0, 0)))
        artwork = ImageOps.contain(landscape, size, method=Image.Resampling.LANCZOS)
        image.paste(artwork, ((size[0] - artwork.width) // 2, (size[1] - artwork.height) // 2))
        emit_png(image, str((folder / f'shelf-{scale}x.png').relative_to(root)))
print('Prepared tvOS icon and top-shelf catalog')
