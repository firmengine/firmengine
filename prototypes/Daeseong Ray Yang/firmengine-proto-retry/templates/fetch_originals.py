"""Fetch public blank court forms, never case material. Run explicitly to refresh."""
from pathlib import Path
import hashlib
import json
from urllib.parse import urlencode
import httpx

ROOT = Path(__file__).resolve().parent
FORMS = [
    ("D5100", "개인회생절차 개시신청서(2021.4.20.시행)(D5100).hwp", "1671090749768_165229.hwp", 139),
    ("D5101", "재산목록(D5101).hwp", "1671089070565_162430.hwp", 84),
    ("D5103", "수입 및 지출에 관한 목록(D5103).hwp", "1671173271613_154751.hwp", 85),
    ("D5105", "진술서(D5105).hwp", "1671174188494_160308.hwp", 86),
    ("D5106", "개인회생채권자목록(D5106).hwp", "1671173144868_154544.hwp", 142),
    ("D5110", "변제계획안(가용소득만으로 변제하는 경우)(D5110).hwp", "1671173705925_155505.hwp", 94),
]

def main():
    records = []
    (ROOT / "originals").mkdir(exist_ok=True)
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        for code, name, remote, seq in FORMS:
            url = "https://file.scourt.go.kr/AttachDownload?" + urlencode({"downFile":name,"file":remote,"path":"004","seqnum":seq})
            response = client.get(url)
            response.raise_for_status()
            if not response.content.startswith(bytes.fromhex("d0cf11e0a1b11ae1")):
                raise ValueError(f"{code}: expected HWP compound file")
            target = ROOT / "originals" / f"{code}.hwp"
            target.write_bytes(response.content)
            records.append({"id":code,"name":name,"url":url,"path":f"originals/{code}.hwp","sha256":hashlib.sha256(response.content).hexdigest(),"retrieved_date":"2026-10-26","status":"public_blank_source_not_expert_mapping_approval"})
            print(code, len(response.content), "bytes")
    (ROOT / "originals.json").write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")

if __name__ == "__main__":
    main()
