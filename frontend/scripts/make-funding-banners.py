"""One-off art for the featured-event banner. Desktop 1600x320, mobile 1080x640."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / 'public' / 'images' / 'events'
INK = (23, 23, 23)
CREAM = (245, 242, 235)
ORANGE = (255, 107, 44)
SOFT = (255, 150, 112)
PALE = (255, 208, 184)


def font(name, size):
    return ImageFont.truetype(rf'C:\Windows\Fonts\{name}', size)


def gradient(size):
    image = Image.new('RGB', size, CREAM)
    draw = ImageDraw.Draw(image)
    width, height = size
    for x in range(width):
        t = x / (width - 1)
        color = tuple(int(CREAM[i] + (ORANGE[i] - CREAM[i]) * (t ** 1.6)) for i in range(3))
        draw.line([(x, 0), (x, height)], fill=color)
    return image


def bar(image, box, parts):
    x0, y0, x1, y1 = box
    height = y1 - y0
    layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(box, radius=height // 2, fill=(255, 255, 255, 255))
    width = x1 - x0
    cursor = x0
    for share, color in parts:
        end = cursor + int(width * share)
        draw.rectangle([cursor, y0, end, y1], fill=color + (255,))
        cursor = end
    mask = Image.new('L', image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=height // 2, fill=255)
    image.paste(layer, mask=mask)


def desktop():
    image = gradient((1600, 320))
    draw = ImageDraw.Draw(image)
    draw.text((72, 48), 'CROWDFUNDED INVESTIGATIONS', font=font('segoeuib.ttf', 54), fill=INK)
    draw.text((72, 122), 'Investigaciones de financiamiento colectivo', font=font('segoeui.ttf', 28), fill=INK)
    draw.text((72, 188), 'Pledge Bitcoin Cash with your wallet', font=font('segoeui.ttf', 30), fill=INK)
    bar(image, (72, 250, 760, 286), [(0.34, ORANGE), (0.18, SOFT), (0.12, PALE)])
    image.save(OUT / 'crowdfunded-investigations-desktop.jpg', quality=82, optimize=True)


def mobile():
    image = gradient((1080, 640))
    draw = ImageDraw.Draw(image)
    draw.text((64, 150), 'CROWDFUNDED', font=font('segoeuib.ttf', 72), fill=INK)
    draw.text((64, 230), 'INVESTIGATIONS', font=font('segoeuib.ttf', 72), fill=INK)
    draw.text((64, 330), 'Investigaciones de', font=font('segoeui.ttf', 36), fill=INK)
    draw.text((64, 376), 'financiamiento colectivo', font=font('segoeui.ttf', 36), fill=INK)
    draw.text((64, 450), 'Pledge Bitcoin Cash with your wallet', font=font('segoeui.ttf', 32), fill=INK)
    bar(image, (64, 520, 760, 568), [(0.34, ORANGE), (0.18, SOFT), (0.12, PALE)])
    image.save(OUT / 'crowdfunded-investigations-mobile.jpg', quality=82, optimize=True)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    desktop()
    mobile()
    for name in ('crowdfunded-investigations-desktop.jpg', 'crowdfunded-investigations-mobile.jpg'):
        path = OUT / name
        print(name, path.stat().st_size)
