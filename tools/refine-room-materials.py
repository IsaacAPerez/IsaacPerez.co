#!/usr/bin/env python3
"""Rebuild selected room material maps without touching geometry or photos.

The 70-inch desk and dark plank floor already have approved dimensions and UVs.
This focused pass replaces their embedded 512-pixel PNG tiles with richer,
deterministic wood grain and slightly more legible 256-pixel fabric tiles.
All other binary buffer views are copied byte-for-byte.

Usage: python3 tools/refine-room-materials.py --input room/room-cat-furniture.glb \
           --output /tmp/room-refined.glb
The operation is idempotent; it can also write to a temporary path before an
atomic replacement of the public GLB. Requires the local NumPy installation.
"""

import argparse
import copy
import hashlib
import json
import math
import pathlib
import struct
import zlib

import numpy as np


N = 512
# The values are mean sRGB bytes measured from the approved material revision.
# They retain the reference-matched dark walnut/neutral desktop palette.
FLOOR = {
    13: ("isaac-walnut-04", (90, 77, 66)),
    18: ("isaac-walnut-01", (84, 72, 60)),
    19: ("isaac-walnut-06", (93, 81, 69)),
    20: ("isaac-walnut-00", (82, 70, 58)),
    21: ("isaac-walnut-05", (92, 79, 68)),
    22: ("isaac-walnut-02", (86, 74, 62)),
    23: ("isaac-walnut-07", (95, 83, 71)),
    24: ("isaac-walnut-03", (88, 76, 64)),
}
EXPECTED = {
    0: "isaac-room-oak-normal",
    1: "isaac-room-desktop-honey-oak-basecolor",
    2: "isaac-room-oak-orm",
    12: "isaac-room-floor-normal",
    14: "isaac-room-floor-orm",
    16: "isaac-room-bedding-olive-cotton-basecolor",
    29: "isaac-room-chair-soft-silver-mesh-basecolor",
    32: "isaac-room-blanket-warm-dove-grey-basecolor",
    **{index: name for index, (name, _) in FLOOR.items()},
}


def png_rgb(pixels):
    """Encode RGB8 PNG with no source-image metadata or color-profile chunk."""
    pixels = np.ascontiguousarray(np.clip(np.rint(pixels), 0, 255).astype(np.uint8))
    height, width, channels = pixels.shape
    assert width == height and width in (256, 512) and channels == 3

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    scanlines = b"".join(b"\0" + row.tobytes() for row in pixels)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(scanlines, 9))
            + chunk(b"IEND", b""))


def cloud(seed, n=N):
    """Seamless low-frequency variation with no image input or external asset."""
    rng = np.random.default_rng(seed)
    x = np.arange(n, dtype=np.float32)[None, :] / n
    y = np.arange(n, dtype=np.float32)[:, None] / n
    out = np.zeros((n, n), dtype=np.float32)
    for scale, weight in ((1, 1.0), (2, .55), (4, .27), (8, .12)):
        for _ in range(3):
            a = int(rng.integers(1, scale + 2))
            b = int(rng.integers(1, scale + 2))
            out += weight * np.sin(math.tau * (a * x + b * y) + rng.uniform(0, math.tau))
    return out / max(float(np.std(out)), 1e-6)


def grain(seed, knot=False):
    """Longitudinal growth rings, occasional shallow knots and wood pores."""
    rng = np.random.default_rng(seed)
    x = np.arange(N, dtype=np.float32)[None, :] / N
    y = np.arange(N, dtype=np.float32)[:, None] / N
    warp = (.010 * np.sin(math.tau * y + rng.uniform(0, math.tau))
            + .004 * np.sin(2 * math.tau * y + rng.uniform(0, math.tau)))
    xx = x + warp
    knot_core = np.zeros((N, N), dtype=np.float32)
    if knot:
        # Periodic distance avoids a visible edge at either end of a UV tile.
        cx, cy = float(rng.uniform(.29, .71)), float(rng.uniform(.3, .7))
        dx = np.mod(x - cx + .5, 1.0) - .5
        dy = np.mod(y - cy + .5, 1.0) - .5
        ellipse = (dx / .115) ** 2 + (dy / .17) ** 2
        xx += .023 * np.sign(dx) * np.exp(-ellipse * .7)
        knot_core = np.exp(-((dx / .035) ** 2 + (dy / .083) ** 2) * 1.8)
    # Both cross-grain perturbations are periodic in x and y. With world-box
    # UVs the tile repeats on each board; a non-integer ring harmonic would
    # produce a visible line across the repeat boundary.
    phase = math.tau * 17 * xx + 1.2 * np.sin(math.tau * y + .5 * np.sin(math.tau * x))
    broad = np.sin(phase) * .65 + np.sin(2 * phase + .6) * .23
    fine = np.sin(math.tau * 91 * xx + .9 * np.sin(3 * math.tau * y)) * .21
    # Elongated pores, with physical length along each wood plank.
    pores = rng.normal(size=(N, N)).astype(np.float32)
    pores = sum(np.roll(pores, shift, axis=0) for shift in range(-5, 6)) / 11
    pores /= max(float(np.std(pores)), 1e-6)
    return broad + fine, pores, knot_core


def wood_maps(seed, mean, *, desktop=False, knot=False):
    growth, pores, knot_core = grain(seed, knot)
    low = cloud(seed + 12000)
    # sRGB contrast is stronger than the revision-16 tiles, without changing
    # their mean color or turning the room's dark walnut orange.
    pattern = 11.5 * growth + 3.0 * low + 2.0 * pores - 14 * knot_core
    if desktop:
        pattern *= .82
    pattern -= float(np.mean(pattern))
    base = np.array(mean, dtype=np.float32)[None, None, :]
    color = base + pattern[:, :, None] * np.array((1.0, .94, .85))[None, None, :]
    # Small warm and cool variation follows the grain instead of adding flat
    # random noise to every pixel.
    color += low[:, :, None] * np.array((.4, 0, -.45))[None, None, :]
    # Height is in metres; derivative scale matches the authored .32 x 1.80 m
    # floor tile and .34 x 1.78 m desk tile.
    tile_width, tile_length = (.34, 1.78) if desktop else (.32, 1.80)
    height = (.00012 if desktop else .00018) * (growth * .48 + pores * .035)
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * N / (2 * tile_width)
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * N / (2 * tile_length)
    n = np.stack((-dx, -dy, np.ones_like(dx)), axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    normal = (n * .5 + .5) * 255
    rough = np.clip((.49 if desktop else .54) + growth * .025 + low * .011, .35, .7)
    orm = np.stack((np.full_like(rough, 255), rough * 255, np.zeros_like(rough)), axis=-1)
    return png_rgb(color), png_rgb(normal), png_rgb(orm)


def fabric_color(seed, mean, kind):
    """Photo-family textile color only; authored normal/roughness stay intact."""
    n = 256
    rng = np.random.default_rng(seed)
    x = np.arange(n, dtype=np.float32)[None, :] / n
    y = np.arange(n, dtype=np.float32)[:, None] / n
    low = cloud(seed + 18000, n)
    if kind == "chair":
        # Tight light mesh with small dark openings, not a broad checkerboard.
        # Shift openings away from the tile border so their dark centres do
        # not fall on only one side of the repeating seam at 256px.
        holes = (np.maximum(0, np.cos(math.tau * 48 * x + math.pi)) ** 8
                 * np.maximum(0, np.cos(math.tau * 48 * y + math.pi)) ** 8)
        variation = -15 * (holes - float(np.mean(holes))) + 2.4 * low
    elif kind == "cotton":
        warp = np.cos(math.tau * 64 * x)
        weft = np.cos(math.tau * 64 * y)
        variation = 3.8 * (warp + weft) + 2.3 * low
    else:
        # The pale throw is plush and irregular rather than a checked weave.
        pile = rng.normal(size=(n, n)).astype(np.float32)
        pile = (pile + np.roll(pile, 1, axis=0) + np.roll(pile, 2, axis=0)) / 3
        pile /= max(float(np.std(pile)), 1e-6)
        variation = 3.1 * pile + 3.4 * low
    variation -= float(np.mean(variation))
    rgb = np.array(mean, dtype=np.float32)[None, None, :] + variation[:, :, None]
    return png_rgb(rgb)


def parse_glb(data):
    if len(data) < 28 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise ValueError("Input must be a GLB version 2 file")
    if struct.unpack_from("<I", data, 8)[0] != len(data):
        raise ValueError("GLB length does not match file size")
    length, kind = struct.unpack_from("<I4s", data, 12)
    if kind != b"JSON":
        raise ValueError("Missing JSON chunk")
    scene = json.loads(data[20:20 + length])
    start = 20 + length
    length, kind = struct.unpack_from("<I4s", data, start)
    if kind != b"BIN\0":
        raise ValueError("Missing BIN chunk")
    return scene, data[start + 8:start + 8 + length]


def repack(scene, binary, replacements):
    original = copy.deepcopy(scene)
    view_to_image = {image["bufferView"]: index for index, image in enumerate(scene["images"])}
    target_views = {scene["images"][index]["bufferView"] for index in replacements}
    accessor_views = {accessor.get("bufferView") for accessor in scene["accessors"]}
    assert not target_views & accessor_views, "Target image buffer view is shared by geometry"
    views = scene["bufferViews"]
    order = sorted(range(len(views)), key=lambda index: views[index].get("byteOffset", 0))
    rebuilt = bytearray()
    last_end = 0
    for index in order:
        view = views[index]
        offset, size = view.get("byteOffset", 0), view["byteLength"]
        assert offset >= last_end and offset + size <= len(binary), "Overlapping/out-of-range buffer views"
        last_end = offset + size
        rebuilt.extend(b"\0" * ((-len(rebuilt)) % 4))
        view["byteOffset"] = len(rebuilt)
        image_index = view_to_image.get(index)
        payload = replacements[image_index] if image_index in replacements else binary[offset:offset + size]
        view["byteLength"] = len(payload)
        rebuilt.extend(payload)
        if image_index not in replacements:
            assert hashlib.sha256(payload).digest() == hashlib.sha256(binary[offset:offset + size]).digest()
    rebuilt.extend(b"\0" * ((-len(rebuilt)) % 4))
    scene["buffers"][0]["byteLength"] = len(rebuilt)
    expected = copy.deepcopy(original)
    expected["bufferViews"] = scene["bufferViews"]
    expected["buffers"] = scene["buffers"]
    assert scene == expected, "Unexpected JSON mutation"
    encoded = json.dumps(scene, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    data = (b"glTF" + struct.pack("<II", 2, 12 + 8 + len(encoded) + 8 + len(rebuilt))
            + struct.pack("<I4s", len(encoded), b"JSON") + encoded
            + struct.pack("<I4s", len(rebuilt), b"BIN\0") + rebuilt)
    after, after_binary = parse_glb(data)
    for index in range(len(views)):
        before_view = original["bufferViews"][index]
        after_view = after["bufferViews"][index]
        before_bytes = binary[before_view.get("byteOffset", 0):before_view.get("byteOffset", 0) + before_view["byteLength"]]
        after_bytes = after_binary[after_view["byteOffset"]:after_view["byteOffset"] + after_view["byteLength"]]
        if index in target_views:
            assert after_bytes == replacements[view_to_image[index]]
        else:
            assert before_bytes == after_bytes, f"Non-target buffer view {index} changed"
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Output must differ from input; inspect before replacing the runtime asset")
    before = args.input.read_bytes()
    scene, binary = parse_glb(before)
    for index, name in EXPECTED.items():
        image = scene["images"][index]
        assert image["name"] == name and image["mimeType"] == "image/png", f"Unexpected image {index}"
    replacements = {}
    for index, (_, mean) in FLOOR.items():
        color, normal, orm = wood_maps(6174 + index, mean, knot=index in (19, 21, 23))
        replacements[index] = color
        if index == 13:
            replacements[12], replacements[14] = normal, orm
    replacements[1], replacements[0], replacements[2] = wood_maps(6188, (184, 151, 108), desktop=True, knot=True)
    replacements[16] = fabric_color(6116, (108, 125, 106), "cotton")
    replacements[29] = fabric_color(6129, (189, 194, 189), "chair")
    replacements[32] = fabric_color(6132, (181, 181, 175), "throw")
    result = repack(scene, binary, replacements)
    args.output.write_bytes(result)
    print(json.dumps({
        "input_sha256": hashlib.sha256(before).hexdigest(),
        "output_sha256": hashlib.sha256(result).hexdigest(),
        "input_bytes": len(before), "output_bytes": len(result),
        "replaced_images": len(replacements),
        "untouched_buffer_views": len(scene["bufferViews"]) - len(replacements),
        "geometry_and_node_json_unchanged": True,
    }, indent=2))


if __name__ == "__main__":
    main()
