#!/usr/bin/env python3
"""Check tracked files for private case artifacts, without printing their contents."""
import hashlib
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FINGERPRINTS={
 "1dfd979da22e0b7222eec78973c993ae0e1220748fd558ac2e236350c9d92aae",
 "b11d31ffe75a07f42179715f42944391be96e42818e0cc925da484151c907409",
}
TOKEN=re.compile(rb"(?i)(?<![a-z0-9])[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![a-z0-9])|(?<![a-z0-9])[a-f0-9]{64}(?![a-z0-9])")
PRIVATE_NAMES={"sample_manifest.json","submission_target_manifest.json","submission_rubric.json","report.json","submission_report.json","REPORT.md","SUBMISSION_REPORT.md","SAMPLE_REPORT.md"}
failures=[];scanned=0
for folder in [ROOT,ROOT.parent/"firmengine-proto-retry"]:
 if not folder.exists():continue
 paths=subprocess.check_output(["git","ls-files","-z","--","."],cwd=folder).decode().split("\0")
 for name in filter(None,paths):
  path=folder/name
  if not path.is_file():continue
  scanned+=1
  if name.startswith("evaluation/") and (path.name in PRIVATE_NAMES or name.startswith("evaluation/runs/")):
   failures.append(str(path.relative_to(ROOT.parent)));continue
  if any(hashlib.sha256(token.lower()).hexdigest() in FINGERPRINTS for token in TOKEN.findall(path.read_bytes())):
   failures.append(str(path.relative_to(ROOT.parent)))
print(f"Scanned {scanned} tracked files; private case artifact findings: {len(failures)}")
for name in failures:print(name)
raise SystemExit(bool(failures))
