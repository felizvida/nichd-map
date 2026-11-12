import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

CHECK = Path(__file__).resolve().parents[1]/'publication'/'check.py'


class PublicationTests(unittest.TestCase):
    def test_exact_index_rejects_unlisted_data_links_and_changed_banner(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            def git(*args):
                subprocess.run(['git', *args], cwd=root, check=True,
                               capture_output=True)
            def check():
                return subprocess.run([sys.executable, '-B', str(CHECK), '--staged'],
                                      cwd=root, capture_output=True).returncode
            git('init', '-b', 'main')
            (root/'assets').mkdir()
            banner = b'\x89PNG\r\n\x1a\nsynthetic-test-only'
            (root/'assets'/'banner.png').write_bytes(banner)
            config = {'files': ['README.md', 'PUBLIC_FILES.json', 'assets/banner.png'],
                      'banner_sha256': hashlib.sha256(banner).hexdigest()}
            (root/'PUBLIC_FILES.json').write_text(json.dumps(config))
            (root/'README.md').write_text('Synthetic example')
            git('add', '.')
            self.assertEqual(check(), 0)
            (root/'data').mkdir(); (root/'data'/'sample.csv').write_text('invented')
            git('add', 'data'); self.assertNotEqual(check(), 0)
            git('rm', '--cached', 'data/sample.csv')
            (root/'assets'/'banner.png').write_bytes(banner+b'changed')
            git('add', 'assets/banner.png'); self.assertNotEqual(check(), 0)
            (root/'assets'/'banner.png').write_bytes(banner); git('add', 'assets/banner.png')
            (root/'README.md').unlink(); (root/'README.md').symlink_to('PUBLIC_FILES.json')
            git('add', 'README.md'); self.assertNotEqual(check(), 0)


if __name__ == '__main__':
    unittest.main()
