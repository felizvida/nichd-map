import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zlib

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
            def chunk(kind, data):
                body = kind + data
                return len(data).to_bytes(4, 'big') + body + zlib.crc32(body).to_bytes(4, 'big')
            banner = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', bytes(13)) + chunk(b'IDAT', b'synthetic-test-only') + chunk(b'IEND', b'')
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
            (root/'assets'/'banner.png').write_bytes(banner[:-12]+chunk(b'IDAT', b'changed')+banner[-12:])
            git('add', 'assets/banner.png'); self.assertNotEqual(check(), 0)
            (root/'assets'/'banner.png').write_bytes(banner); git('add', 'assets/banner.png')
            (root/'README.md').unlink(); (root/'README.md').symlink_to('PUBLIC_FILES.json')
            git('add', 'README.md'); self.assertNotEqual(check(), 0)

    def test_pinned_sample_data_and_metadata_free_png(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            def git(*args):
                subprocess.run(['git', *args], cwd=root, check=True, capture_output=True)
            def check():
                return subprocess.run([sys.executable, '-B', str(CHECK), '--staged'],
                                      cwd=root, capture_output=True).returncode
            def chunk(kind, data):
                body = kind + data
                return len(data).to_bytes(4, 'big') + body + zlib.crc32(body).to_bytes(4, 'big')
            png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', bytes(13)) + chunk(b'IDAT', b'x') + chunk(b'IEND', b''))
            data = json.dumps({'type': 'FeatureCollection', 'features': []}).encode()
            git('init', '-b', 'main')
            (root/'sample').mkdir(); (root/'tutorial').mkdir()
            (root/'sample'/'features.geojson').write_bytes(data)
            (root/'tutorial'/'preview.png').write_bytes(png)
            def write_config(data_sha, png_sha, licence='ODbL-1.0'):
                config = {'files': ['PUBLIC_FILES.json', 'sample/features.geojson', 'tutorial/preview.png'],
                          'binary_sha256': {'tutorial/preview.png': png_sha},
                          'data_files': {'sample/features.geojson': {'sha256': data_sha, 'license': licence, 'source': 'synthetic'}}}
                (root/'PUBLIC_FILES.json').write_text(json.dumps(config))
                git('add', '.')
            sha = lambda b: hashlib.sha256(b).hexdigest()
            write_config(sha(data), sha(png)); self.assertEqual(check(), 0)
            write_config(sha(data), sha(png), licence=''); self.assertNotEqual(check(), 0)
            write_config(sha(data + b' '), sha(png)); self.assertNotEqual(check(), 0)
            tagged = png[:-12] + chunk(b'tEXt', b'Author\x00someone') + png[-12:]
            (root/'tutorial'/'preview.png').write_bytes(tagged)
            write_config(sha(data), sha(tagged)); self.assertNotEqual(check(), 0)
            (root/'tutorial'/'preview.png').write_bytes(png)
            # an institutional URL in data must be rejected; assembled from fragments so this source file itself passes
            leak = ('{"url": "https://' + 'www.' + 'nih' + '.gov/x"}').encode()
            (root/'sample'/'features.geojson').write_bytes(leak)
            write_config(sha(leak), sha(png)); self.assertNotEqual(check(), 0)


if __name__ == '__main__':
    unittest.main()
