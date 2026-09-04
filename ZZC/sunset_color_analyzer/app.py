from __future__ import annotations

import colorsys
import io
import json
from pathlib import Path

import numpy as np
import streamlit as st
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / "public" / "photos" / "gallery-03.jpg"

st.set_page_config(page_title="晚霞颜色分析器", page_icon="◐", layout="wide")


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#" + "".join(f"{channel:02X}" for channel in rgb)


def color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return float(np.linalg.norm(np.array(a, dtype=float) - np.array(b, dtype=float)))


def extract_palette(image: Image.Image, count: int = 6) -> list[tuple[int, int, int]]:
    working = image.convert("RGB")
    working.thumbnail((320, 320))
    quantized = working.quantize(colors=18, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()
    ranked = sorted(quantized.getcolors() or [], reverse=True)
    selected: list[tuple[int, int, int]] = []
    for _, index in ranked:
        rgb = tuple(palette[index * 3 : index * 3 + 3])
        if all(color_distance(rgb, previous) > 30 for previous in selected):
            selected.append(rgb)
        if len(selected) == count:
            break
    while len(selected) < count:
        selected.append(selected[-1] if selected else (120, 120, 120))
    return selected


def analyze(image: Image.Image) -> dict[str, float]:
    sample = image.convert("RGB")
    sample.thumbnail((420, 420))
    hsv = np.asarray(sample.convert("HSV"), dtype=np.float32)
    hue = hsv[..., 0] * 360 / 255
    saturation = hsv[..., 1] / 255
    value = hsv[..., 2] / 255
    warm = (((hue <= 72) | (hue >= 330)) & (saturation >= 0.18)).mean()
    return {
        "warmth": float(warm * 100),
        "brightness": float(value.mean() * 100),
        "saturation": float(saturation.mean() * 100),
        "contrast": float(value.std() * 100),
    }


def poetic_name(rgb: tuple[int, int, int]) -> str:
    h, s, v = colorsys.rgb_to_hsv(*(channel / 255 for channel in rgb))
    degree = h * 360
    if v < 0.24:
        return "暮夜墨"
    if s < 0.16 and v > 0.82:
        return "云隙白"
    if s < 0.2:
        return "远山灰"
    if degree < 18 or degree >= 345:
        return "霞绯"
    if degree < 43:
        return "落日橙"
    if degree < 72:
        return "余晖金"
    if degree < 165:
        return "薄暮青"
    if degree < 215:
        return "天际蓝"
    if degree < 270:
        return "深空蓝"
    if degree < 320:
        return "暮紫"
    return "晚樱粉"


def scene_summary(metrics: dict[str, float]) -> tuple[str, str]:
    warmth = metrics["warmth"]
    brightness = metrics["brightness"]
    saturation = metrics["saturation"]
    if warmth > 58:
        title = "燃烧的金色时刻"
    elif warmth > 34:
        title = "冷暖交汇的黄昏"
    else:
        title = "蓝调时刻的余光"
    if brightness < 38:
        light = "低照度让色彩更集中，暗部具有明显的夜幕倾向。"
    elif brightness > 68:
        light = "整体通透明亮，云层保留了柔和的空气感。"
    else:
        light = "明暗分布平衡，天空层次能够自然展开。"
    color = "色彩浓度鲜明。" if saturation > 48 else "色彩克制柔和。"
    return title, f"{light}{color}"


def palette_card(palette: list[tuple[int, int, int]], title: str) -> bytes:
    width, height = 1440, 900
    canvas = Image.new("RGB", (width, height), (14, 17, 16))
    draw = ImageDraw.Draw(canvas)
    try:
        font_large = ImageFont.truetype("arial.ttf", 54)
        font_small = ImageFont.truetype("arial.ttf", 25)
    except OSError:
        font_large = font_small = ImageFont.load_default()
    draw.text((80, 72), title, fill=(238, 243, 240), font=font_large)
    block_width = (width - 160) // len(palette)
    for index, rgb in enumerate(palette):
        x0 = 80 + index * block_width
        x1 = 80 + (index + 1) * block_width
        draw.rounded_rectangle((x0, 220, x1 - 12, 690), radius=20, fill=rgb)
        draw.text((x0, 730), rgb_to_hex(rgb), fill=(205, 214, 209), font=font_small)
    draw.text((80, 826), "SUNSET COLOR STUDY", fill=(108, 130, 117), font=font_small)
    output = io.BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue()


st.markdown(
    """
    <style>
    :root{--ink:#eef3ef;--muted:#9aa8a0;--line:rgba(220,235,225,.14);--accent:#8bc3a0}
    .stApp{background:radial-gradient(80% 55% at 86% -10%,#284a37 0%,transparent 65%),linear-gradient(180deg,#101512,#080b09 72%);color:var(--ink)}
    [data-testid="stHeader"]{background:transparent}
    [data-testid="stMainBlockContainer"]{max-width:1280px;padding-top:3.2rem;padding-bottom:5rem}
    h1{font-size:clamp(3.4rem,7vw,7rem)!important;line-height:.9!important;letter-spacing:-.065em!important;font-weight:520!important;max-width:900px}
    .eyebrow{font:12px ui-monospace,monospace;letter-spacing:.2em;color:var(--accent);margin-bottom:1.5rem}
    .intro{max-width:640px;color:var(--muted);font-size:1.05rem;line-height:1.8;margin:1.4rem 0 2.5rem}
    .glass{border:1px solid var(--line);background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 25px 75px rgba(0,0,0,.24);border-radius:24px;padding:22px}
    .palette{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:8px 0 26px}
    .swatch{min-height:170px;border-radius:16px;padding:14px;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
    .swatch b,.swatch span{mix-blend-mode:difference;color:white}.swatch b{font-size:13px}.swatch span{font:10px ui-monospace,monospace;opacity:.78}
    .metric{border-top:1px solid var(--line);padding-top:15px}.metric strong{font-size:2rem;font-weight:450}.metric span{display:block;color:var(--muted);font-size:.78rem;margin-top:4px}
    .gradient-preview{height:180px;border-radius:20px;border:1px solid rgba(255,255,255,.13);margin:10px 0 18px}
    .scene-title{font-size:1.65rem;font-weight:520;margin:10px 0 7px}.scene-copy{color:var(--muted);line-height:1.75}
    [data-testid="stFileUploader"]{border:1px dashed rgba(139,195,160,.35);border-radius:18px;padding:8px;background:rgba(255,255,255,.025)}
    .stDownloadButton button{width:100%;border-radius:999px;border:1px solid rgba(139,195,160,.35);background:rgba(139,195,160,.1);color:#eaf3ed}
    @media(max-width:760px){.palette{grid-template-columns:repeat(3,1fr)}.swatch{min-height:130px}}
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown('<div class="eyebrow">LIGHT / COLOR / MEMORY</div>', unsafe_allow_html=True)
st.title("晚霞颜色分析器")
st.markdown('<div class="intro">把一张天空拆解成可以保存、复用和继续创作的颜色语言。上传照片，观察它的温度、明度与色彩节奏。</div>', unsafe_allow_html=True)

uploaded = st.file_uploader("上传晚霞照片", type=["jpg", "jpeg", "png", "webp"], label_visibility="collapsed")
if uploaded:
    image = Image.open(uploaded)
    source_name = uploaded.name
else:
    image = Image.open(SAMPLE)
    source_name = "画廊示例 · gallery-03.jpg"

palette = extract_palette(image)
metrics = analyze(image)
title, description = scene_summary(metrics)
hexes = [rgb_to_hex(color) for color in palette]
gradient = f"linear-gradient(112deg, {', '.join(hexes)})"

left, right = st.columns([1.18, 0.82], gap="large")
with left:
    st.markdown('<div class="glass">', unsafe_allow_html=True)
    st.image(image, caption=source_name, width="stretch")
    st.markdown('</div>', unsafe_allow_html=True)

with right:
    st.markdown('<div class="glass">', unsafe_allow_html=True)
    st.markdown(f'<div class="scene-title">{title}</div><div class="scene-copy">{description}</div>', unsafe_allow_html=True)
    metric_cols = st.columns(4)
    metric_data = [
        ("暖色", metrics["warmth"]),
        ("明度", metrics["brightness"]),
        ("饱和", metrics["saturation"]),
        ("对比", metrics["contrast"]),
    ]
    for column, (label, value) in zip(metric_cols, metric_data):
        column.markdown(f'<div class="metric"><strong>{value:.0f}</strong><span>{label} / 100</span></div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

st.markdown("### 提取色谱")
swatches = "".join(
    f'<div class="swatch" style="background:{hex_code}"><b>{poetic_name(rgb)}</b><span>{hex_code}</span></div>'
    for rgb, hex_code in zip(palette, hexes)
)
st.markdown(f'<div class="palette">{swatches}</div>', unsafe_allow_html=True)

gradient_col, export_col = st.columns([1.35, 0.65], gap="large")
with gradient_col:
    st.markdown("### 天空渐变")
    st.markdown(f'<div class="gradient-preview" style="background:{gradient}"></div>', unsafe_allow_html=True)
    st.code(f"background: {gradient};", language="css")

with export_col:
    st.markdown("### 保存分析")
    payload = {
        "source": source_name,
        "scene": title,
        "palette": [{"name": poetic_name(rgb), "hex": rgb_to_hex(rgb), "rgb": rgb} for rgb in palette],
        "metrics": {key: round(value, 1) for key, value in metrics.items()},
        "css_gradient": gradient,
    }
    st.download_button("下载色卡 PNG", palette_card(palette, title), "sunset-palette.png", "image/png")
    st.download_button("下载分析 JSON", json.dumps(payload, ensure_ascii=False, indent=2), "sunset-analysis.json", "application/json")

st.caption("所有分析均在本地完成，上传图片不会发送到第三方服务。")
