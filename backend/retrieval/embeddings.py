"""
SatQueryAI - Embedding Generation Module
Generates normalized visual & spectral feature embeddings for satellite image patches.
Enables fast vector search across BigEarthNet references.
"""

import math
from typing import List, Any, Dict

def compute_visual_embedding(img: Any, dim: int = 64) -> List[float]:
    """
    Computes a deterministic 64-dimensional visual embedding from an image:
    - 4x4 spatial grid color moments (R, G, B mean): 4x4x3 = 48 dims
    - Global edge & directional gradient proxies: 8 dims
    - Spectral ratio proxies (ExG, NDWI, NDBI proxies): 8 dims
    Total: 64 dimensions, L2-normalized.
    """
    if img is None:
        return [0.0] * dim

    try:
        resized = img.resize((64, 64))
        w, h = resized.size
        grid_w, grid_h = w // 4, h // 4
        features = []

        # 1. 4x4 spatial grid color means
        for row in range(4):
            for col in range(4):
                box = (col * grid_w, row * grid_h, (col + 1) * grid_w, (row + 1) * grid_h)
                cell = resized.crop(box)
                cell_px = list(cell.getdata())
                c_len = max(1, len(cell_px))
                r_m = sum(p[0] for p in cell_px) / (c_len * 255.0)
                g_m = sum(p[1] for p in cell_px) / (c_len * 255.0)
                b_m = sum(p[2] for p in cell_px) / (c_len * 255.0)
                features.extend([r_m, g_m, b_m])

        # 2. Global edge & gradient characteristics
        all_px = list(resized.getdata())
        diff_h = 0.0
        diff_v = 0.0
        for y in range(h - 1):
            for x in range(w - 1):
                p0 = all_px[y * w + x]
                p_right = all_px[y * w + x + 1]
                p_down = all_px[(y + 1) * w + x]
                diff_h += abs(p0[0] - p_right[0]) + abs(p0[1] - p_right[1]) + abs(p0[2] - p_right[2])
                diff_v += abs(p0[0] - p_down[0]) + abs(p0[1] - p_down[1]) + abs(p0[2] - p_down[2])

        total_pts = (w - 1) * (h - 1)
        mean_dh = (diff_h / (total_pts * 3 * 255.0)) if total_pts > 0 else 0.0
        mean_dv = (diff_v / (total_pts * 3 * 255.0)) if total_pts > 0 else 0.0

        features.extend([
            mean_dh,
            mean_dv,
            min(1.0, mean_dh * 2.0),
            min(1.0, mean_dv * 2.0),
            min(1.0, (mean_dh + mean_dv)),
            abs(mean_dh - mean_dv),
            mean_dh * mean_dv,
            math.sqrt(mean_dh**2 + mean_dv**2 + 1e-6)
        ])

        # 3. Spectral index proxies
        r_tot = sum(p[0] for p in all_px) / (len(all_px) * 255.0)
        g_tot = sum(p[1] for p in all_px) / (len(all_px) * 255.0)
        b_tot = sum(p[2] for p in all_px) / (len(all_px) * 255.0)

        r = max(r_tot, 1e-4)
        g = max(g_tot, 1e-4)
        b = max(b_tot, 1e-4)

        exg = (2 * g - r - b)
        ndwi = (g - r) / (g + r + 1e-5)
        ndbi = (r - g) / (r + g + 1e-5)
        bi = math.sqrt((r**2 + g**2) / 2.0)
        max_c = max(r, g, b)
        min_c = min(r, g, b)
        sat = (max_c - min_c) / (max_c + 1e-5)

        features.extend([
            exg,
            ndwi,
            ndbi,
            bi,
            sat,
            r / (g + 1e-4),
            g / (b + 1e-4),
            b / (r + 1e-4),
        ])

        # Pad or truncate to exact dim
        if len(features) < dim:
            features.extend([0.0] * (dim - len(features)))
        else:
            features = features[:dim]

        norm = math.sqrt(sum(x * x for x in features))
        if norm > 1e-6:
            return [x / norm for x in features]
        return features

    except Exception:
        return [0.0] * dim

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculates cosine similarity between two normalized vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    return max(0.0, min(1.0, dot))
