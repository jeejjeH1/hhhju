"""Builds cut-outs from the source art in assets/img -> assets/cut."""
import numpy as np
from PIL import Image, ImageFilter
import os
os.makedirs('assets/cut', exist_ok=True)

# fomies logo keyed off the navy background of the intake art
im = Image.open('assets/img/intake.jpg').convert('RGB').crop((480, 20, 1530, 400))
a = np.asarray(im).astype(float)
lum = a.mean(axis=2)
alpha = np.clip((lum - 95) / 60, 0, 1)
ys, xs = np.where(alpha > 0.5)
y0, y1, x0, x1 = ys.min() - 6, ys.max() + 6, xs.min() - 6, xs.max() + 6
rgba = np.dstack([a, alpha * 255])[y0:y1, x0:x1]
# un-premultiply the navy fringe toward white-ish
rgba[..., :3] = np.clip((rgba[..., :3] - np.array([30, 44, 58]) * (1 - alpha[y0:y1, x0:x1, None])) / np.maximum(alpha[y0:y1, x0:x1, None], .05), 0, 255)
Image.fromarray(rgba.astype(np.uint8), 'RGBA').save('assets/cut/logo.png')
print('logo', rgba.shape)

def crop(src, box, name):
    Image.open('assets/img/' + src).convert('RGB').crop(box).save('assets/cut/' + name, quality=95)

crop('banner.jpg', (228, 52, 400, 228), 'card_yellow.jpg')
crop('banner.jpg', (1240, 62, 1392, 212), 'card_peach.jpg')
crop('banner.jpg', (1010, 255, 1300, 474), 'card_blue.jpg')
crop('ghost.jpg', (12, 272, 186, 470), 'card_witch.jpg')
crop('envelope.jpg', (288, 474, 530, 716), 'card_cowboy.jpg')
crop('envelope.jpg', (205, 140, 1730, 945), 'envelope_crop.jpg')
crop('ghost.jpg', (0, 236, 1080, 844), 'ghost_wide.jpg')
crop('pickle.jpg', (0, 438, 2000, 1563), 'pickle_wide.jpg')
