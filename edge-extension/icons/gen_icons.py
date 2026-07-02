#!/usr/bin/env python3
"""生成书籍工具扩展程序图标 PNG 文件"""
import struct, zlib, math

def create_png(width, height, pixels_rgba):
    """纯 Python 生成 PNG（无第三方依赖）"""
    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            r, g, b, a = pixels_rgba[y * width + x]
            raw += bytes([r, g, b])

    idat_data = zlib.compress(raw, 9)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', idat_data)
    png += chunk(b'IEND', b'')
    return png

def draw_icon(size):
    """绘制书籍图标"""
    px = [(0, 0, 0, 0)] * (size * size)

    def set_pixel(x, y, r, g, b, a=255):
        if 0 <= x < size and 0 <= y < size:
            px[y * size + x] = (r, g, b, a)

    def fill_rect(x1, y1, x2, y2, r, g, b, a=255):
        for yy in range(y1, y2 + 1):
            for xx in range(x1, x2 + 1):
                set_pixel(xx, yy, r, g, b, a)

    def draw_rounded_rect(x1, y1, x2, y2, radius, r, g, b, a=255):
        for yy in range(y1, y2 + 1):
            for xx in range(x1, x2 + 1):
                # 检查四角圆角
                in_corner = False
                if xx < x1 + radius and yy < y1 + radius:
                    dist = math.sqrt((xx - (x1 + radius))**2 + (yy - (y1 + radius))**2)
                    in_corner = dist > radius
                elif xx > x2 - radius and yy < y1 + radius:
                    dist = math.sqrt((xx - (x2 - radius))**2 + (yy - (y1 + radius))**2)
                    in_corner = dist > radius
                elif xx < x1 + radius and yy > y2 - radius:
                    dist = math.sqrt((xx - (x1 + radius))**2 + (yy - (y2 - radius))**2)
                    in_corner = dist > radius
                elif xx > x2 - radius and yy > y2 - radius:
                    dist = math.sqrt((xx - (x2 - radius))**2 + (yy - (y2 - radius))**2)
                    in_corner = dist > radius
                if not in_corner:
                    set_pixel(xx, yy, r, g, b, a)

    s = size
    # 背景：深蓝色圆角矩形
    r_bg = max(2, s // 8)
    draw_rounded_rect(0, 0, s-1, s-1, r_bg, 30, 30, 70)

    # 书本主体（象牙白色书页）
    m = max(1, s // 10)
    bx1 = m + max(1, s // 8)
    bx2 = s - m - 1
    by1 = m + max(1, s // 10)
    by2 = s - m - 1
    fill_rect(bx1, by1, bx2, by2, 245, 240, 220)

    # 书脊（左侧深色）
    spine_w = max(1, s // 8)
    fill_rect(bx1 - spine_w, by1, bx1 - 1, by2, 137, 180, 250)

    # 文字线条（模拟文字）
    if s >= 16:
        line_color = (150, 140, 120)
        lm = max(1, s // 6)
        lx1 = bx1 + lm
        lx2 = bx2 - lm // 2
        num_lines = max(2, s // 10)
        gap = (by2 - by1 - lm * 2) // (num_lines + 1)
        for i in range(1, num_lines + 1):
            ly = by1 + lm + i * gap
            # 最后一行稍短
            line_end = lx2 if i < num_lines else lx1 + (lx2 - lx1) * 2 // 3
            fill_rect(lx1, ly, line_end, ly + max(1, s // 32), *line_color)

    return px, size, size


sizes = [16, 32, 48, 128]
output_dir = r"C:\Users\sjk304\Desktop\book-edit\edge-extension\icons"

for sz in sizes:
    pixels, w, h = draw_icon(sz)
    png_data = create_png(w, h, pixels)
    path = f"{output_dir}\\icon{sz}.png"
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f"Generated: {path} ({sz}x{sz})")

print("All icons generated.")
