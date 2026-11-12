import unittest
import numpy as np
from methods.raster import (alignment, translate, composite_landscape,
                            fit_overlap_gain, feather_blend, frame_metrics)


class RasterTests(unittest.TestCase):
    def test_known_shift_and_flat_or_ambiguous_rejection(self):
        rng = np.random.default_rng(42)
        ref = rng.normal(size=(40, 48))
        mask = np.zeros(ref.shape, bool)
        mask[8:-8, 8:-8] = True
        result = alignment(ref, translate(ref, 2, -3), mask)
        self.assertTrue(result['accepted'])
        self.assertEqual(result['shift'], [-2, 3])
        self.assertFalse(alignment(np.ones_like(ref), ref, mask)['accepted'])
        stripes = np.tile(np.arange(48) % 2, (40, 1))
        self.assertFalse(alignment(stripes, stripes, mask)['accepted'])

    def test_translation_exposes_zero_instead_of_wrapping(self):
        a = np.ones((5, 6, 4), np.uint8)*255
        b = translate(a, -1, 2)
        self.assertFalse(b[-1].any())
        self.assertFalse(b[:, :2].any())
        self.assertFalse(translate(a, 9, 0).any())

    def test_semantic_composite_keeps_buildings_and_alpha(self):
        a = np.full((4, 5, 3), 25, np.uint8)
        b = np.full_like(a, 180)
        mask = np.zeros((4, 5), bool); mask[1:3, 1:4] = True
        alpha = np.arange(20, dtype=np.uint8).reshape(4, 5)*10
        out = composite_landscape(a, b, mask, alpha)
        np.testing.assert_array_equal(out[..., 3], alpha)
        np.testing.assert_array_equal(out[mask, :3], b[mask])
        np.testing.assert_array_equal(out[~mask, :3], a[~mask])

    def test_overlap_gain_is_bounded_and_black_stays_finite(self):
        a = np.ones((4, 4, 3))*100
        b = a.copy(); b[..., 0] = 80; b[..., 2] = 0
        gains = fit_overlap_gain(a, b, np.ones((4, 4), bool))
        np.testing.assert_allclose(gains, [1.12, 1, 1])

    def test_transparent_rgb_cannot_pollute_feathered_colour(self):
        a = np.full((3, 4, 4), [255, 0, 0, 255], np.uint8)
        b = np.full_like(a, [0, 0, 255, 0])
        out = feather_blend([a, b], [np.ones((3, 4)), np.ones((3, 4))])
        np.testing.assert_array_equal(out, a)
        self.assertFalse(feather_blend([a], [np.zeros((3, 4))]).any())

    def test_coverage_and_context_metrics_expose_changes(self):
        expected = np.ones((2, 2), np.uint8)
        actual = expected.copy(); actual[0, 0] = 0
        before = np.zeros((2, 2, 3), np.uint8)
        after = np.full_like(before, 51)
        result = frame_metrics(expected, actual, before, after, expected)
        self.assertEqual(result['coverage'], .75)
        self.assertAlmostEqual(result['ctx_diff'], .2)


if __name__ == '__main__':
    unittest.main()
