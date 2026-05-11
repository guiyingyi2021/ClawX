"""
Dclaw Logo 重建 + 多平台图标生成
根据上传的 logo（蓝色圆形，双环+中心图案）重建并生成所有格式
"""
from PIL import Image, ImageDraw
import os, math

OUTPUT_DIR = r"c:\Users\40832\WorkBuddy\20260429101446\dclaw-brand\icons"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

BLUE = (52, 101, 179, 255)   # 品牌蓝色
WHITE = (255, 255, 255, 255)
cx, cy = SIZE // 2, SIZE // 2

# 外圆（蓝色填充）
r_outer = 500
draw.ellipse([cx-r_outer, cy-r_outer, cx+r_outer, cy+r_outer], fill=BLUE)

# 白色环（外环内侧白圈）
r_white1_outer = 500
r_white1_inner = 450
draw.ellipse([cx-r_white1_outer, cy-r_white1_outer, cx+r_white1_outer, cy+r_white1_outer], fill=BLUE)
draw.ellipse([cx-r_white1_outer, cy-r_white1_outer, cx+r_white1_outer, cy+r_white1_outer], outline=WHITE, width=45)

# 内蓝色圆
r_inner_blue = 420
draw.ellipse([cx-r_inner_blue, cy-r_inner_blue, cx+r_inner_blue, cy+r_inner_blue], fill=BLUE)

# 白色内环
draw.ellipse([cx-r_inner_blue, cy-r_inner_blue, cx+r_inner_blue, cy+r_inner_blue], outline=WHITE, width=20)

# 中心白色图案（3个竖向弧形类似"JJS"形态）
# 用白色矩形+圆角模拟3条竖线+底部弧形连接
w = 280  # 图案总宽
h = 260  # 图案总高
bx, by = cx - w//2, cy - h//2 - 20

bar_w = 62
gap = 18
bar_h = 200
arc_r = 50

# 3 根白色竖条（带圆角）
for i in range(3):
    x0 = bx + i * (bar_w + gap)
    y0 = by
    x1 = x0 + bar_w
    y1 = y0 + bar_h
    draw.rounded_rectangle([x0, y0, x1, y1], radius=arc_r//2, fill=WHITE)

# 底部白色横向连接弧（半圆托底）
arc_x0 = bx - 10
arc_y0 = by + bar_h - arc_r
arc_x1 = bx + w + 10
arc_y1 = by + bar_h + arc_r + 60
draw.ellipse([arc_x0, arc_y0, arc_x1, arc_y1], fill=WHITE)

# 遮掉弧形上半部分，只留下半月
cover_y = by + bar_h + 20
draw.rectangle([arc_x0 - 20, arc_y0, arc_x1 + 20, cover_y], fill=BLUE)

# 重绘竖条底部（确保在弧形上方）
for i in range(3):
    x0 = bx + i * (bar_w + gap)
    y0 = by + bar_h - 30
    x1 = x0 + bar_w
    y1 = by + bar_h
    draw.rectangle([x0, y0, x1, y1], fill=WHITE)

# ---- 输出各格式 ----
# 1. 1024 PNG
icon_1024 = img.resize((1024, 1024), Image.LANCZOS)
icon_1024.save(os.path.join(OUTPUT_DIR, "icon.png"))

# 2. Linux 系列
for s in [16, 32, 48, 64, 128, 256, 512]:
    img.resize((s, s), Image.LANCZOS).save(os.path.join(OUTPUT_DIR, f"{s}x{s}.png"))

# 3. Windows ICO
ico_imgs = [img.resize((s, s), Image.LANCZOS).convert("RGBA") for s in [16, 32, 48, 64, 128, 256]]
ico_imgs[0].save(
    os.path.join(OUTPUT_DIR, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in [16, 32, 48, 64, 128, 256]],
    append_images=ico_imgs[1:]
)

# 4. UI logo 系列
for fname, s in [("logo-64.png",64),("logo-128.png",128),("logo-256.png",256),("logo-512.png",512)]:
    img.resize((s, s), Image.LANCZOS).save(os.path.join(OUTPUT_DIR, fname))

print("OK: 所有图标已生成:")
for f in sorted(os.listdir(OUTPUT_DIR)):
    kb = os.path.getsize(os.path.join(OUTPUT_DIR, f)) / 1024
    print(f"   {f:28s}  {kb:6.1f} KB")
print("\n路径:", OUTPUT_DIR)
