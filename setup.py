# setup.py shim for setuptools compatibility
import os
from pathlib import Path
from setuptools import setup

data_files = []
labext_dir = Path("jupyterlab_bopp/labextension")
if labext_dir.exists():
    for root, _, files in os.walk(labext_dir):
        if not files:
            continue
        rel_path = Path(root).relative_to(labext_dir)
        target_dir = Path("share/jupyter/labextensions/jupyterlab-bopp") / rel_path
        data_files.append((str(target_dir), [os.path.join(root, f) for f in files]))

if __name__ == "__main__":
    setup(data_files=data_files)
