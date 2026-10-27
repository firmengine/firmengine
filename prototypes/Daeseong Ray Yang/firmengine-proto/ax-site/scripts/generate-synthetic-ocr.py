#!/usr/bin/env python3
"""Seeded Korean OCR generalization corpus generator.

Request PDFs and gold metadata are written to separate private directories. Never
point a live model request at the gold directory. Public repository contains only
this generator, its schema documentation, and the scorer/driver.
"""
import argparse, calendar, hashlib, json, random
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageEnhance, ImageFilter
import io

DEFAULT_ROOT = Path('/tmp/firmengine-synthetic-ocr-private')
FAMILIES = ('payroll','debt_balance','insurance','transactions')
VARIANTS = ('clean','layout','degraded')
INSTITUTIONS = ('한빛가상급여센터','푸른가상채권관리','다온가상보험연구소','모아가상거래은행','누리가상정산원','새봄가상금융지원','이음가상보험센터','바다가상채무관리')

def won(rng, low=150_000, high=8_000_000, step=1000):
    return rng.randrange(low//step, high//step)*step

def base_case(rng, family, case_index):
    inst=rng.choice(INSTITUTIONS)
    rid=f'SYN-{rng.randrange(10**8,10**9)}-{case_index:02d}'
    day=f'2025-{rng.randrange(1,13):02d}-{rng.randrange(1,28):02d}'
    if family=='payroll':
        gross=won(rng,2_400_000,6_200_000); tax=won(rng,90_000,600_000,1000); other=won(rng,50_000,420_000,1000); net=gross-tax-other
        end=calendar.monthrange(int(day[:4]),int(day[5:7]))[1]
        period=f'{day[:7]}-01 ~ {day[:7]}-{end:02d}'
        fields={'gross_pay':f'{gross:,}','deductions':f'{tax+other:,}','net_pay':f'{net:,}','period':period}
        rows=[('총급여',fields['gross_pay']),('공제합계',fields['deductions']),('실수령액',fields['net_pay']),('명시 급여기간',fields['period'])]
    elif family=='debt_balance':
        principal=won(rng,3_000_000,42_000_000); interest=won(rng,30_000,1_800_000,1000); fields={'principal':f'{principal:,}','interest':f'{interest:,}','as_of_date':day}
        rows=[('잔여 원금',fields['principal']),('미납 이자',fields['interest']),('잔액 기준일',fields['as_of_date'])]
    elif family=='insurance':
        refund=won(rng,250_000,12_000_000); premium=won(rng,35_000,240_000,1000); coverage=won(rng,10_000_000,150_000_000,10000)
        fields={'surrender_value':f'{refund:,}','premium':f'{premium:,}','coverage_amount':f'{coverage:,}'}
        rows=[('해약환급금',fields['surrender_value']),('월 보험료',fields['premium']),('주계약 보장액',fields['coverage_amount'])]
    else:
        amount=won(rng,12_000,550_000,1000); date=day; other=won(rng,18_000,360_000,1000); sub=amount*2+other
        fields={'repeat_date':date}
        rows=[('정상 승인 거래',f'{date} 09:14 승인 {amount:,}'),('정상 승인 거래',f'{date} 13:42 승인 {amount:,}'),('정상 승인 거래',f'{date} 18:07 승인 {other:,}'),('당일 승인 소계',f'{sub:,}')]
    return {'family':family,'case_id':f'{family}-{case_index:02d}-{rid}','seed':None,'institution':inst,'record_id':rid,'fields':fields,'rows':rows}

def draw_page(path, item, variant, font_path):
    w,h=A4
    if 'NotoKR' not in pdfmetrics.getRegisteredFontNames(): pdfmetrics.registerFont(TTFont('NotoKR',str(font_path)))
    f='NotoKR'
    buf=io.BytesIO(); c=canvas.Canvas(buf,pagesize=A4)
    c.setTitle('합성 테스트 문서 - 실제기관 및 실제인명 없음')
    c.setFillColor(colors.HexColor('#e9f0f4')); c.rect(0,h-92,w,92,fill=1,stroke=0)
    c.setFillColor(colors.HexColor('#123247')); c.setFont(f,18); c.drawString(42,h-54,'합성 테스트 문서')
    c.setFont(f,9); c.drawString(42,h-75,'실제기관·실제인명 없음 | OCR 평가용 임의 생성 자료')
    title={'payroll':'급여명세서','debt_balance':'채무잔액증명서','insurance':'보험 해약환급금 안내','transactions':'거래내역서'}[item['family']]
    c.setFillColor(colors.HexColor('#183f56')); c.setFont(f,15); c.drawString(42,h-132,title)
    c.setFillColor(colors.black); c.setFont(f,10); c.drawString(42,h-160,'발급기관: '+item['institution']); c.drawString(42,h-178,'기록번호: '+item['record_id'])
    if item['family']=='transactions': c.drawString(42,h-196,'조회기간: '+item['fields']['repeat_date']+' ~ '+item['fields']['repeat_date'])
    top=h-224
    for idx,(label,value) in enumerate(item['rows']):
        y=top-idx*58
        if variant=='layout':
            # Alternate two-column card placement to test layout generalization.
            x=42+(idx%2)*260; y=top-(idx//2)*90
            c.setFillColor(colors.HexColor('#f1f5f6')); c.roundRect(x,y-52,238,68,5,fill=1,stroke=0)
            c.setFillColor(colors.HexColor('#34596a')); c.setFont(f,9); c.drawString(x+12,y-8,label)
            c.setFillColor(colors.black); c.setFont(f,12); c.drawString(x+12,y-34,value)
        else:
            c.setStrokeColor(colors.HexColor('#d5e0e4')); c.line(42,y-32,w-42,y-32)
            c.setFillColor(colors.HexColor('#34596a')); c.setFont(f,10); c.drawString(48,y,label)
            c.setFillColor(colors.black); c.setFont(f,12); c.drawRightString(w-52,y,value)
    c.setFillColor(colors.HexColor('#617782')); c.setFont(f,8); c.drawString(42,54,'합성 자료입니다. 금액·날짜·기록번호는 재현 가능한 난수로 생성되었습니다.')
    c.showPage(); c.save()
    raw=buf.getvalue()
    if variant=='degraded':
        from pypdf import PdfReader, PdfWriter
        # Render and downsample moderately, retaining human-readable text.
        import fitz
        doc=fitz.open(stream=raw,filetype='pdf'); pix=doc[0].get_pixmap(matrix=fitz.Matrix(1.2,1.2),alpha=False)
        im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples).filter(ImageFilter.GaussianBlur(.12))
        im.thumbnail((900,1273),Image.Resampling.LANCZOS); out=io.BytesIO(); im.save(out,format='JPEG',quality=76)
        c2=canvas.Canvas(str(path),pagesize=A4); c2.drawImage(ImageReader(io.BytesIO(out.getvalue())),0,0,width=w,height=h); c2.showPage(); c2.save()
    else: Path(path).write_bytes(raw)

def main():
    p=argparse.ArgumentParser(); p.add_argument('--seed',type=int,default=20261027); p.add_argument('--out-root',type=Path,default=DEFAULT_ROOT); p.add_argument('--font',type=Path,default=Path('/usr/share/fonts/truetype/nanum/NanumGothic.ttf'),help='Installable Korean TTF font; embed in every PDF for portable rendering.'); args=p.parse_args()
    if not args.font.is_file(): raise SystemExit('Korean font file is required; pass --font /path/to/NotoSansCJKkr-Regular.otf')
    req=args.out_root/'request-only'; gold=args.out_root/'gold'; req.mkdir(parents=True,exist_ok=True); gold.mkdir(parents=True,exist_ok=True)
    # These two directories are generator-owned outputs. Remove only its file
    # types so a prior seed cannot silently inflate the corpus or denominator.
    for stale in req.glob('*.pdf'): stale.unlink()
    for stale in gold.glob('*.json'): stale.unlink()
    rng=random.Random(args.seed); pages=[]
    for i,fam in enumerate(FAMILIES,1):
        item=base_case(rng,fam,i); item['seed']=args.seed
        for variant in VARIANTS:
            name=f"{item['case_id']}--{variant}.pdf"; draw_page(req/name,item,variant,args.font)
            pages.append({'case_id':item['case_id'],'family':fam,'variant':variant,'path':name,'sha256':hashlib.sha256((req/name).read_bytes()).hexdigest(),'is_independent_case':variant=='clean','seed':args.seed})
        # Gold has field labels/expected values and per-layout normalized source boxes.
        # It never enters request-only. Boxes enclose the row containing each value.
        def box(row,variant):
            w,h=A4; y=h-224-(row//2*90 if variant=='layout' else row*58)
            x=42+(row%2)*260 if variant=='layout' else 42
            right=x+238 if variant=='layout' else w-42
            return [round((x+6)/w,4),round(1-(y+16)/h,4),round((right-6)/w,4),round(1-(y-18)/h,4)]
        expected=[]
        row_for={key:n for n,key in enumerate(item['fields'])}
        for key,value in item['fields'].items():
            row=row_for[key]
            expected.append({'field':key,'expected':value,'source_bbox':box(row,'clean'),'source_bbox_by_variant':{v:box(row,v) for v in VARIANTS}, 'row_critical':True,'row_index':row})
        if fam=='transactions':
            repeated=item['rows'][0][1].split()[-1]
            expected += [{'field':'repeated_transaction_row','expected':repeated,'source_bbox':box(0,'clean'),'source_bbox_by_variant':{v:box(0,v) for v in VARIANTS},'row_critical':True,'row_index':0}, {'field':'repeated_transaction_row','expected':repeated,'source_bbox':box(1,'clean'),'source_bbox_by_variant':{v:box(1,v) for v in VARIANTS},'row_critical':True,'row_index':1}, {'field':'transaction_row','expected':item['rows'][2][1].split()[-1],'source_bbox':box(2,'clean'),'source_bbox_by_variant':{v:box(2,v) for v in VARIANTS},'row_critical':True,'row_index':2}, {'field':'subtotal','expected':item['rows'][3][1],'source_bbox':box(3,'clean'),'source_bbox_by_variant':{v:box(3,v) for v in VARIANTS},'row_critical':True,'row_index':3}]
        (gold/f"{item['case_id']}.json").write_text(json.dumps({'case_id':item['case_id'],'family':fam,'seed':args.seed,'institution':item['institution'],'record_id':item['record_id'],'fields':expected},ensure_ascii=False,indent=2),encoding='utf-8')
    (gold/'manifest.json').write_text(json.dumps({'seed':args.seed,'independent_cases':len(FAMILIES),'pages':pages,'variants_per_case':list(VARIANTS)},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'seed':args.seed,'independent_cases':len(FAMILIES),'pages':len(pages),'request_dir':str(req),'gold_dir':str(gold)},ensure_ascii=False))
if __name__=='__main__': main()
