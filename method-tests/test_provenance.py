import hashlib
from pathlib import Path
import tempfile
import unittest
from methods.provenance import settings_hash, require_same_settings, file_manifest


class ProvenanceTests(unittest.TestCase):
    def test_settings_order_and_resume_guard(self):
        settings = {'seed': 7, 'terrain': True}
        saved = settings_hash(settings)
        self.assertEqual(saved, settings_hash({'terrain': True, 'seed': 7}))
        self.assertEqual(saved, require_same_settings(saved, settings))
        with self.assertRaises(ValueError):
            require_same_settings(saved, {**settings, 'seed': 8})
        with self.assertRaises(ValueError):
            settings_hash({'bad': float('nan')})

    def test_manifest_hash_and_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root/'source.txt').write_bytes(b'synthetic')
            record = file_manifest(root, ['source.txt'])[0]
            self.assertEqual(record['sha256'], hashlib.sha256(b'synthetic').hexdigest())
            for paths in [['../outside'], ['/absolute'], ['source.txt', 'source.txt'], ['.'], ['a//b']]:
                with self.assertRaises(ValueError):
                    file_manifest(root, paths)
            (root/'link').symlink_to('source.txt')
            with self.assertRaises(ValueError):
                file_manifest(root, ['link'])
            (root/'folder').symlink_to(root, target_is_directory=True)
            with self.assertRaises(ValueError):
                file_manifest(root, ['folder/source.txt'])


if __name__ == '__main__':
    unittest.main()
