"""
Direct execution entry point for `python -m jupyterlab_bopp <file.bopp>`
"""

import sys
from .cli import main

if __name__ == "__main__":
    sys.exit(main())
