"""Read sculpture PSD passes without editing the originals; preserve 16-bit depth."""

import argparse
from array import array
import json
from pathlib import Path
import struct
import sys

from PIL import Image, UnidentifiedImageError


def psd_header(path):
    path = Path(path)
    with path.open("rb") as source:
        header = source.read(26)
        if len(header) != 26:
            raise ValueError("Truncated PSD header.")
        signature, version, reserved, channels, height, width, depth, mode = struct.unpack(
            ">4sH6sHIIHH", header
        )
        if signature != b"8BPS" or version != 1 or reserved != bytes(6):
            raise ValueError("Expected a standard version-1 PSD.")
        lengths = []
        for _ in range(3):
            raw_length = source.read(4)
            if len(raw_length) != 4:
                raise ValueError("Truncated PSD section.")
            length = struct.unpack(">I", raw_length)[0]
            lengths.append(length)
            source.seek(length, 1)
        compression_bytes = source.read(2)
        if len(compression_bytes) != 2:
            raise ValueError("Missing PSD image data.")
        compression = struct.unpack(">H", compression_bytes)[0]
        offset = source.tell()
    if min(width, height, channels) <= 0:
        raise ValueError("Invalid PSD dimensions or channel count.")
    if compression == 0 and path.stat().st_size - offset != channels * height * width * depth // 8:
        raise ValueError("Raw PSD payload size does not match its header.")
    return {
        "width": width, "height": height, "depth": depth, "channels": channels,
        "colorMode": mode, "compression": compression,
        "layerSectionBytes": lengths[2], "imageDataOffset": offset,
    }


def load_image(path):
    path = Path(path)
    try:
        image = Image.open(path)
        try:
            image.load()
        except Exception:
            image.close()
            raise
        return image
    except UnidentifiedImageError:
        if path.suffix.lower() != ".psd":
            raise
        info = psd_header(path)
        if not (
            info["depth"] == 16 and info["channels"] == 1
            and info["colorMode"] == 1 and info["compression"] == 0
            and info["layerSectionBytes"] == 0
        ):
            raise ValueError("Unsupported PSD for the 16-bit grayscale fallback.") from None
        with path.open("rb") as source:
            source.seek(info["imageDataOffset"])
            pixels = array("H")
            pixels.frombytes(source.read())
        # PSD stores 16-bit channel samples in big-endian order.
        if sys.byteorder == "little":
            pixels.byteswap()
        return Image.frombytes("I;16", (info["width"], info["height"]), pixels.tobytes())


def export_preview(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if source == output or output.suffix.lower() != ".png":
        raise ValueError("Write a separate PNG preview; never replace the source PSD.")
    if output.exists():
        raise FileExistsError("Preview already exists; choose a new version.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with load_image(source) as image:
        options = {"icc_profile": image.info["icc_profile"]} if image.info.get("icc_profile") else {}
        image.save(output, **options)
        with Image.open(output) as reopened:
            reopened.load()
            if image.size != reopened.size or image.tobytes() != reopened.convert(image.mode).tobytes():
                raise ValueError("PNG round-trip changed the decoded source pixels.")
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    result = export_preview(args.source, args.output)
    print(json.dumps({"preview": str(result), "sourceUnchanged": True}))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from None
