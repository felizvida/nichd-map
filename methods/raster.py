"""Generic raster guards. Arrays are caller-supplied, never fetched."""
import numpy as np


def translate(image, dy, dx):
    """Integer translation with zero fill; never wrap pixels across a frame."""
    if not isinstance(dy, int) or not isinstance(dx, int):
        raise TypeError("integer shift required")
    out = np.zeros_like(image)
    h, w = image.shape[:2]
    if abs(dy) >= h or abs(dx) >= w:
        return out
    sy, sx = max(0, -dy), max(0, -dx)
    ty, tx = max(0, dy), max(0, dx)
    hh, ww = h - abs(dy), w - abs(dx)
    out[ty:ty+hh, tx:tx+ww] = image[sy:sy+hh, sx:sx+ww]
    return out


def alignment(reference, candidate, mask, max_shift=6, min_pixels=32,
              min_score=.8, min_margin=.02):
    """Search masked Pearson correlation; ambiguous or flat matches fail closed.

    Returned (dy, dx) translates candidate into reference. A proposed shift is
    diagnostic only when accepted is false; do not repair a rejected frame.
    """
    ref, img = np.asarray(reference, float), np.asarray(candidate, float)
    mask = np.asarray(mask, bool)
    if ref.ndim != 2 or ref.shape != img.shape or mask.shape != ref.shape:
        raise ValueError("matching grayscale arrays and mask required")
    if not isinstance(max_shift, int) or max_shift < 0 or min_pixels < 2:
        raise ValueError("invalid search limits")
    if not np.isfinite(ref).all() or not np.isfinite(img).all():
        raise ValueError("non-finite pixels")
    scores = []
    for dy in range(-max_shift, max_shift+1):
        for dx in range(-max_shift, max_shift+1):
            valid = mask & translate(np.ones_like(mask), dy, dx)
            if valid.sum() < min_pixels:
                continue
            a, b = ref[valid], translate(img, dy, dx)[valid]
            a, b = a-a.mean(), b-b.mean()
            denom = np.linalg.norm(a)*np.linalg.norm(b)
            if denom > 1e-12:
                scores.append((float(a@b/denom), dy, dx))
    scores.sort(reverse=True)
    if not scores:
        return {"accepted": False, "shift": [0, 0], "reason": "insufficient texture"}
    score, dy, dx = scores[0]
    margin = score-scores[1][0] if len(scores)>1 else float("inf")
    accepted = score >= min_score and margin >= min_margin
    return {"accepted": bool(accepted), "shift": [dy, dx], "score": score,
            "margin": margin, "reason": "pass" if accepted else "weak or ambiguous match"}


def composite_landscape(landscape, buildings, building_mask, alpha):
    """Select RGB by semantic mask, then restore exact export alpha."""
    a, b = np.asarray(landscape), np.asarray(buildings)
    mask, alpha = np.asarray(building_mask, bool), np.asarray(alpha)
    if a.dtype != np.uint8 or b.dtype != np.uint8 or alpha.dtype != np.uint8:
        raise ValueError("uint8 images and alpha required")
    if a.shape != b.shape or a.ndim != 3 or a.shape[2] != 3 or mask.shape != a.shape[:2] or alpha.shape != mask.shape:
        raise ValueError("incompatible image shapes")
    return np.dstack((np.where(mask[..., None], b, a), alpha))


def fit_overlap_gain(reference, candidate, mask, limit=.12):
    """Per-channel least squares with a hard correction bound."""
    a, b = np.asarray(reference, float), np.asarray(candidate, float)
    mask = np.asarray(mask, bool)
    if a.shape != b.shape or a.ndim != 3 or a.shape[2] != 3 or mask.shape != a.shape[:2] or not mask.any() or not 0 <= limit < 1:
        raise ValueError("nonempty matching RGB overlap required")
    if not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError("non-finite pixels")
    a, b = a[mask], b[mask]
    denom = (b*b).sum(axis=0)
    gain = np.divide((a*b).sum(axis=0), denom, out=np.ones(3), where=denom>1e-12)
    return np.clip(gain, 1-limit, 1+limit)


def feather_blend(images, weights):
    """Blend same-sized RGBA arrays with premultiplied alpha and edge weights.

    Alpha is the maximum input alpha wherever a nonzero effective weight exists.
    Place tiles on a common canvas before calling this reference helper.
    """
    if len(images) == 0 or len(images) != len(weights):
        raise ValueError("images and weights required")
    stack = np.asarray(images)
    w = np.asarray(weights, float)
    if stack.dtype != np.uint8 or stack.ndim != 4 or stack.shape[3] != 4 or w.shape != stack.shape[:3] or not np.isfinite(w).all() or (w<0).any():
        raise ValueError("matching uint8 RGBA images and nonnegative weights required")
    effective = w*stack[..., 3]/255
    denominator = effective.sum(axis=0)
    numerator = (stack[..., :3]*effective[..., None]).sum(axis=0)
    rgb = np.divide(numerator, denominator[..., None], out=np.zeros_like(numerator), where=denominator[..., None]>0)
    alpha = np.where(denominator>0, np.where(w>0, stack[..., 3], 0).max(axis=0), 0)
    return np.dstack((np.rint(rgb).clip(0,255).astype(np.uint8), alpha.astype(np.uint8)))


def frame_metrics(expected_alpha, actual_alpha, context_before, context_after, context_mask):
    """Coverage fraction and masked RGB MAE / 255; no universal pass threshold."""
    expected, actual = np.asarray(expected_alpha)>0, np.asarray(actual_alpha)>0
    a, b = np.asarray(context_before, float), np.asarray(context_after, float)
    mask = np.asarray(context_mask, bool)
    if expected.shape != actual.shape or a.shape != b.shape or a.shape != expected.shape+(3,) or mask.shape != expected.shape:
        raise ValueError("incompatible metric shapes")
    if not expected.any() or not mask.any() or not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError("nonempty finite metric inputs required")
    return {"coverage": float((expected & actual).sum()/expected.sum()),
            "ctx_diff": float(np.abs(a[mask]-b[mask]).mean()/255)}
