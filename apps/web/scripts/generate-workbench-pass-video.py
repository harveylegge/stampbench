"""Generate the original folded-paper loop used behind the homepage Workbench pass.

The asset is procedural: no third-party images or footage are used. Install the
versions pinned in requirements-workbench-pass.txt and pass the path to an
FFmpeg 6.x binary as the first argument. The script writes web-ready MP4/WebM
loops and a static poster into public/media.

Example:
    python -m pip install -r scripts/requirements-workbench-pass.txt
    python scripts/generate-workbench-pass-video.py /path/to/ffmpeg
"""

from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


FPS = 24
FRAMES = 180
# 2160px square gives the model more than 2× pixel density at its largest
# on-page size, keeping curves and colour transitions crisp on Retina displays.
SIZE = 2160
SUPERSAMPLE = 1.0
RENDER_SIZE = int(SIZE * SUPERSAMPLE)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "media"
OUTPUT.mkdir(parents=True, exist_ok=True)


def rotation_matrix(rx: float, ry: float, rz: float) -> np.ndarray:
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    mx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    my = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    mz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return mz @ my @ mx


def orange_surface(brightness: float, groove: float, facing: float) -> tuple[int, int, int]:
    dark = np.array([116.0, 37.0, 24.0])
    middle = np.array([224.0, 78.0, 37.0])
    light = np.array([255.0, 183.0, 103.0])
    amount = max(0.0, min(1.0, brightness))
    if amount < 0.58:
        colour = dark + (middle - dark) * (amount / 0.58)
    else:
        colour = middle + (light - middle) * ((amount - 0.58) / 0.42)
    colour *= 0.83 + groove * 0.17
    colour += max(0.0, facing) ** 8 * np.array([34.0, 24.0, 18.0])
    return tuple(np.clip(colour, 0, 255).astype(np.uint8))


def draw_frame(frame_index: int) -> Image.Image:
    phase = 2 * math.pi * frame_index / FRAMES
    size = RENDER_SIZE
    cream = np.array([241.0, 234.0, 216.0])

    yy, xx = np.mgrid[0:size, 0:size]
    cx, cy = size * 0.51, size * 0.50
    dx = (xx - cx) / (size * 0.50)
    dy = (yy - cy) / (size * 0.50)
    glow = np.exp(-((dx / 0.78) ** 2 + (dy / 0.68) ** 2) * 2.25)[..., None]
    warm = np.array([246.0, 126.0, 61.0])
    background = cream + (warm - cream) * glow * 0.16
    image = Image.fromarray(np.clip(background, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    # A soft shadow makes the object sit inside the cream field without creating
    # a visible video rectangle.
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse(
        (size * 0.19, size * 0.63, size * 0.83, size * 0.84),
        fill=(101, 45, 25, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.055))
    image = Image.alpha_composite(image, shadow)

    u_count, v_count = 240, 96
    u = np.linspace(0, 2 * math.pi, u_count, endpoint=False)
    v = np.linspace(0, 2 * math.pi, v_count, endpoint=False)
    uu, vv = np.meshgrid(u, v, indexing="ij")

    # The shape is a slowly turning, deformed torus. Its folds reference curled
    # paper rather than the amorphous purple sculpture used by the inspiration.
    major = 1.12 + 0.13 * np.sin(3 * uu + phase) + 0.055 * np.sin(7 * uu - phase * 1.7)
    minor = 0.41 + 0.05 * np.sin(2 * uu - phase * 1.25)
    twist = vv + 0.62 * np.sin(3 * uu + phase * 0.8)

    x = (major + minor * np.cos(twist)) * np.cos(uu)
    y = (major + minor * np.cos(twist)) * np.sin(uu)
    z = minor * np.sin(twist)
    z += 0.14 * np.sin(4 * uu - phase * 1.35) * np.cos(vv)
    y *= 0.91

    points = np.stack([x, y, z], axis=-1)
    rotation = rotation_matrix(
        0.84 + 0.10 * math.sin(phase),
        -0.36 + phase * 0.16,
        -0.20 + 0.07 * math.cos(phase),
    )
    points = points @ rotation.T

    scale = size * 0.235
    projected = np.empty(points.shape[:-1] + (2,), dtype=np.float64)
    perspective = 1.0 / (1.0 + (points[..., 2] + 1.8) * 0.065)
    projected[..., 0] = cx + points[..., 0] * scale * perspective
    projected[..., 1] = cy + points[..., 1] * scale * perspective

    quads: list[tuple[float, list[tuple[float, float]], tuple[int, int, int]]] = []
    light = np.array([-0.34, -0.55, 0.76])
    light /= np.linalg.norm(light)

    for i in range(u_count):
        ni = (i + 1) % u_count
        for j in range(v_count):
            nj = (j + 1) % v_count
            p00, p10 = points[i, j], points[ni, j]
            p01, p11 = points[i, nj], points[ni, nj]
            normal = np.cross(p10 - p00, p01 - p00)
            length = np.linalg.norm(normal)
            if length == 0:
                continue
            normal /= length
            if normal[2] < 0:
                normal = -normal
            lambert = max(0.0, float(np.dot(normal, light)))
            facing = max(0.0, float(normal[2]))
            broad_groove = 0.5 + 0.5 * math.sin(v[j] * 5.0 + u[i] * 1.4 + phase * 1.4)
            fine_groove = 0.5 + 0.5 * math.sin(v[j] * 11.0 - u[i] * 2.1 - phase * 1.8)
            groove = max(0.0, min(1.0, broad_groove * 0.78 + fine_groove * 0.22))
            brightness = 0.20 + lambert * 0.61 + facing * 0.15
            brightness -= (1.0 - groove) * 0.13
            colour = orange_surface(brightness, groove, facing)
            coords = [
                tuple(projected[i, j]),
                tuple(projected[ni, j]),
                tuple(projected[ni, nj]),
                tuple(projected[i, nj]),
            ]
            depth = float((p00[2] + p10[2] + p01[2] + p11[2]) / 4)
            quads.append((depth, coords, colour))

    surface = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(surface)
    for _, coords, colour in sorted(quads, key=lambda item: item[0]):
        draw.polygon(coords, fill=colour + (255,))

    # A tiny sub-pixel soften joins the denser mesh without erasing its folded
    # paper ridges. At 2160px this is still sharper than the old 720px source.
    surface = surface.filter(ImageFilter.GaussianBlur(size * 0.00055))

    # Fine warm highlights move across the folds and stop the form feeling flat.
    sheen = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sheen_draw = ImageDraw.Draw(sheen)
    sheen_x = size * (0.43 + 0.06 * math.sin(phase))
    sheen_draw.ellipse(
        (sheen_x - size * 0.25, size * 0.20, sheen_x + size * 0.20, size * 0.73),
        fill=(255, 220, 173, 42),
    )
    sheen = sheen.filter(ImageFilter.GaussianBlur(size * 0.075))
    surface = Image.alpha_composite(surface, sheen)
    image = Image.alpha_composite(image, surface)

    if frame_index == 45:
        image.convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(
            OUTPUT / "workbench-pass-poster.webp", "WEBP", quality=94, method=6
        )
    return image.convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def encode(ffmpeg: str) -> None:
    mp4 = OUTPUT / "workbench-pass.mp4"
    webm = OUTPUT / "workbench-pass.webm"
    mobile_mp4 = OUTPUT / "workbench-pass-mobile.mp4"
    mobile_webm = OUTPUT / "workbench-pass-mobile.webm"
    process = subprocess.Popen(
        [
            ffmpeg,
            "-y",
            "-f",
            "rawvideo",
            "-vcodec",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{SIZE}x{SIZE}",
            "-r",
            str(FPS),
            "-i",
            "-",
            "-an",
            "-map",
            "0:v",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(mp4),
            "-map",
            "0:v",
            "-c:v",
            "libvpx-vp9",
            "-crf",
            "29",
            "-b:v",
            "0",
            "-pix_fmt",
            "yuv420p",
            "-row-mt",
            "1",
            "-deadline",
            "good",
            "-cpu-used",
            "3",
            str(webm),
        ],
        stdin=subprocess.PIPE,
    )
    assert process.stdin is not None
    for frame in range(FRAMES):
        process.stdin.write(draw_frame(frame).tobytes())
        if frame % 30 == 0:
            print(f"render: {frame}/{FRAMES}", flush=True)
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed while writing the Workbench pass video")

    # Keep the 2160px master for high-density desktop displays, then derive a
    # lighter 1440px source for phones so the hero stays crisp without making
    # small screens decode the full desktop loop.
    mobile_commands = (
        [
            ffmpeg, "-y", "-i", str(mp4), "-an", "-vf", "scale=1440:1440:flags=lanczos",
            "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(mobile_mp4),
        ],
        [
            ffmpeg, "-y", "-i", str(mp4), "-an", "-vf", "scale=1440:1440:flags=lanczos",
            "-c:v", "libvpx-vp9", "-crf", "31", "-b:v", "0", "-pix_fmt", "yuv420p",
            "-row-mt", "1", "-deadline", "good", "-cpu-used", "3", str(mobile_webm),
        ],
    )
    for command in mobile_commands:
        subprocess.run(command, check=True)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Pass the path to an ffmpeg executable")
    ffmpeg = sys.argv[1]
    encode(ffmpeg)


if __name__ == "__main__":
    main()
