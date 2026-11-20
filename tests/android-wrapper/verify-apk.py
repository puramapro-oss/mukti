import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile


apk = Path(sys.argv[1])
package = 'dev.purama.mukti'
origin = 'https://mukti.purama.dev'
analyzer = Path(os.environ['ANDROID_HOME']) / 'cmdline-tools/latest/bin/apkanalyzer'
manifest = ET.fromstring(subprocess.check_output([analyzer, 'manifest', 'print', apk]))
name = '{http://schemas.android.com/apk/res/android}name'
assert manifest.get('package') == package
activities = {n.get(name) for n in manifest.findall('application/activity')}
receivers = {n.get(name) for n in manifest.findall('application/receiver')}
assert package + '.MainActivity' in activities or '.MainActivity' in activities
assert package + '.widgets.AffirmationWidgetProvider' in receivers

with zipfile.ZipFile(apk) as contents:
    assert contents.testzip() is None
    config = json.loads(contents.read('assets/capacitor.config.json'))
    assert (config['appId'], config['appName'], config['server']['url']) == (package, 'MUKTI', origin)
    assert config['server']['cleartext'] is False and config['android']['allowMixedContent'] is False
    plugins = {entry['pkg'] for entry in json.loads(contents.read('assets/capacitor.plugins.json'))}
    packages = json.loads(Path('package.json').read_text())['dependencies']
    expected = {p for p in packages if p.startswith('@capacitor/')} - {
        '@capacitor/core', '@capacitor/cli', '@capacitor/ios', '@capacitor/android',
    }
    assert plugins == expected, (plugins, expected)
    for resource in ('manifest.json', 'icon.svg', 'favicon.svg'):
        assert contents.read('assets/public/' + resource) == (Path('public') / resource).read_bytes(), resource
    assert any(path.endswith('.dex') for path in contents.namelist())

print(f'{apk.name}: {package}, {origin}, {len(plugins)} plugins, APK SHA-256 {hashlib.sha256(apk.read_bytes()).hexdigest()}')
