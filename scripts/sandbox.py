#!/usr/bin/env python3
"""Repository convenience entry for the packaged, canonical offline runner."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[1] / '.agents/skills/cloudflare-cost-safety/scripts/sandbox.py'), run_name='__main__')
