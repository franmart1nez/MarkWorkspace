"""Run in Designer's Python console or Tools > Scripting > Run Script.

Inspect packages already open in Designer; never opens, changes or saves them.
"""
import json
from pathlib import Path
import sd

def audit(output=None):
    app = sd.getContext().getSDApplication()
    packages = []
    for package in app.getPackageMgr().getUserPackages():
        resources = []
        for resource in package.getChildrenResources(True):
            record = {'identifier': resource.getIdentifier(),
                      'class': resource.getClassName()}
            if hasattr(resource, 'getNodes'):
                record['node_count'] = len(resource.getNodes())
            resources.append(record)
        packages.append({'path': package.getFilePath(), 'resources': resources})
    result = {'application': 'Adobe Substance 3D Designer', 'packages': packages,
              'source_modified': False}
    if output:
        target = Path(output)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
    return result

if __name__ == '__main__':
    audit('D:/AI/MarkWorkspace/.mrmak/total-insanitation/designer-live-audit.json')
