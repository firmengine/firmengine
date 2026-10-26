"""Minimal read-only HWP5 paragraph extraction for inspecting the retained blank forms."""
from pathlib import Path
import struct
import zlib
import re

def paragraphs(path):
    blob = Path(path).read_bytes()
    size = 1 << struct.unpack_from('<H', blob, 30)[0]
    mini_size = 1 << struct.unpack_from('<H', blob, 32)[0]
    def sector(n): return blob[(n+1)*size:(n+2)*size]
    difat = [n for n in struct.unpack_from('<109I',blob,76) if n < 0xfffffffa]
    fat = []
    for n in difat: fat.extend(struct.unpack('<'+'I'*(size//4),sector(n)))
    def chain(start, table):
        seen = set()
        while start < 0xfffffffa and start not in seen:
            seen.add(start)
            yield start
            start = table[start]
    def normal(start): return b''.join(sector(n) for n in chain(start,fat))
    directory = normal(struct.unpack_from('<I',blob,48)[0])
    entries = []
    for offset in range(0,len(directory),128):
        chunk=directory[offset:offset+128]
        length=struct.unpack_from('<H',chunk,64)[0]
        if not length: continue
        entries.append((chunk[:length-2].decode('utf-16le'),chunk[66],struct.unpack_from('<I',chunk,116)[0],struct.unpack_from('<Q',chunk,120)[0]))
    root=next(x for x in entries if x[1]==5)
    ministream=normal(root[2])[:root[3]]
    mini_raw=normal(struct.unpack_from('<I',blob,60)[0])
    minifat=struct.unpack('<'+'I'*(len(mini_raw)//4),mini_raw)
    def read(entry):
        _,_,start,length=entry
        if length>=4096: return normal(start)[:length]
        return b''.join(ministream[n*mini_size:(n+1)*mini_size] for n in chain(start,minifat))[:length]
    header=read(next(x for x in entries if x[0]=='FileHeader'))
    compressed=bool(struct.unpack_from('<I',header,36)[0]&1)
    for entry in entries:
        if not re.fullmatch(r'Section\d+',entry[0]): continue
        data=read(entry)
        if compressed: data=zlib.decompress(data,-15)
        offset=0
        while offset+4<=len(data):
            head=struct.unpack_from('<I',data,offset)[0]; offset+=4
            tag=head&0x3ff; length=head>>20
            if length==0xfff:
                length=struct.unpack_from('<I',data,offset)[0]; offset+=4
            chunk=data[offset:offset+length]; offset+=length
            if tag==67:
                text=chunk.decode('utf-16le',errors='replace')
                text=re.sub(r'[\x00-\x1f]',' ',text).strip()
                if text: yield text

if __name__=='__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    root=Path(__file__).resolve().parent
    for path in sorted((root/'originals').glob('*.hwp')):
        content='\n'.join(paragraphs(path))
        (root/'originals'/f'{path.stem}.txt').write_text(content,encoding='utf-8')
        print(path.stem,content[:10000],sep='\n')
