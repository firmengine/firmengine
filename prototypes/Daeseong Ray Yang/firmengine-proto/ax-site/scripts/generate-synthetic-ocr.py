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
DEFAULT_V2_ROOT = Path('/tmp/firmengine-synthetic-ocr-v2-private')
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
    if item.get('version')=='v2':
        # Verify that the exact text drawing used for every rendering contains
        # the schema-declared source unit for each money row.
        import fitz
        drawn=' '.join(fitz.open(stream=raw,filetype='pdf')[0].get_text().split())
        for label,value in item['rows']:
            if item.get('expected_unit') and item.get('money_row',{}).get(label):
                if f'{value}' not in drawn or not value.endswith(item['expected_unit']):
                    raise ValueError(f'PDF drawing does not visibly bind expected unit to row {label!r}')
            elif item.get('variant')=='missing_unit' and item.get('money_row',{}).get(label):
                if value.endswith(('원','KRW','₩')):
                    raise ValueError(f'missing_unit variant unexpectedly contains a unit in row {label!r}')
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
    p=argparse.ArgumentParser(); p.add_argument('--version',choices=('v1','v2'),default='v2'); p.add_argument('--seed',type=int); p.add_argument('--out-root',type=Path); p.add_argument('--include-missing-unit',action='store_true',help='Add an explicitly unitless safety variant, scored separately from positive accuracy.'); p.add_argument('--font',type=Path,default=Path('/usr/share/fonts/truetype/nanum/NanumGothic.ttf'),help='Installable Korean TTF font; embed in every PDF for portable rendering.'); args=p.parse_args()
    seed=args.seed if args.seed is not None else (20261028 if args.version=='v2' else 20261027)
    out_root=args.out_root or (DEFAULT_V2_ROOT if args.version=='v2' else DEFAULT_ROOT)
    if not args.font.is_file(): raise SystemExit('Korean font file is required; pass --font /path/to/NotoSansCJKkr-Regular.otf')
    req=out_root/'request-only'; gold=out_root/'gold'; req.mkdir(parents=True,exist_ok=True); gold.mkdir(parents=True,exist_ok=True)
    # Existing sources and gold may already bind a completed or running trial.
    # A new corpus needs a new directory; never rewrite a prior trial in place.
    if any(req.iterdir()) or any(gold.iterdir()):
        raise SystemExit('Output request-only/gold directories must be empty. Choose a new --out-root to preserve prior source hashes and evaluations.')
    rng=random.Random(seed); pages=[]; variants=list(VARIANTS)+(['missing_unit'] if args.version=='v2' and args.include_missing_unit else [])
    for i,fam in enumerate(FAMILIES,1):
        item=base_case(rng,fam,i); item['seed']=seed; item['version']=args.version
        item['field_units']={key:('원' if key in {'gross_pay','deductions','net_pay','principal','interest','surrender_value','premium','coverage_amount'} else None) for key in item['fields']}
        if fam=='transactions':
            item['field_units'].update({'repeated_transaction_row':'원','transaction_row':'원','subtotal':'원'})
        money_row_indexes={'payroll':{0,1,2},'debt_balance':{0,1},'insurance':{0,1,2},'transactions':{0,1,2,3}}[fam]
        for variant in variants:
            variant_item={**item,'rows':list(item['rows']),'variant':variant,'expected_unit':'원' if args.version=='v2' and variant!='missing_unit' else None}
            variant_item['money_row']={label:True for row_index,(label,_) in enumerate(item['rows']) if row_index in money_row_indexes}
            if args.version=='v2' and variant!='missing_unit':
                for row_index,(label,value) in enumerate(variant_item['rows']):
                    if row_index not in money_row_indexes: continue
                    if fam=='transactions' and row_index<3:
                        import re
                        value=re.sub(r'([0-9][0-9,]*)(?=\s*$)',r'\1원',value)
                    else: value=f'{value}원'
                    variant_item['rows'][row_index]=(label,value)
            name=f"{item['case_id']}--{variant}.pdf"; draw_page(req/name,variant_item,variant,args.font)
            pages.append({'case_id':item['case_id'],'family':fam,'variant':variant,'path':name,'sha256':hashlib.sha256((req/name).read_bytes()).hexdigest(),'is_independent_case':variant=='clean','seed':seed,'expected_money_unit':'원' if args.version=='v2' and variant!='missing_unit' else None,'safety_variant':variant=='missing_unit'})
        # Gold has field labels/expected values and per-layout normalized source boxes.
        # It never enters request-only. Boxes enclose the row containing each value.
        def box(row,variant):
            w,h=A4; y=h-224-(row//2*90 if variant=='layout' else row*58)
            x=42+(row%2)*260 if variant=='layout' else 42
            right=x+238 if variant=='layout' else w-42
            return [round((x+6)/w,4),round(1-(y+16)/h,4),round((right-6)/w,4),round(1-(y-18)/h,4)]
        expected=[]
        row_for={key:n for n,key in enumerate(item['fields'])}
        def unit_meta(key):
            if args.version!='v2': return {}
            return {'expected_unit':item['field_units'].get(key),'expected_unit_by_variant':{v:(item['field_units'].get(key) if v!='missing_unit' else None) for v in variants},'safety_unitless':args.include_missing_unit}
        for key,value in item['fields'].items():
            row=row_for[key]
            entry={'field':key,'expected':value,'source_bbox':box(row,'clean'),'source_bbox_by_variant':{v:box(row,v) for v in variants}, 'row_critical':True,'row_index':row}
            entry.update(unit_meta(key))
            expected.append(entry)
        if fam=='transactions':
            repeated=item['rows'][0][1].split()[-1]
            for field,value,row_index in [('repeated_transaction_row',repeated,0),('repeated_transaction_row',repeated,1),('transaction_row',item['rows'][2][1].split()[-1],2),('subtotal',item['rows'][3][1],3)]:
                entry={'field':field,'expected':value.removesuffix('원'),'source_bbox':box(row_index,'clean'),'source_bbox_by_variant':{v:box(row_index,v) for v in variants},'row_critical':True,'row_index':row_index}
                entry.update(unit_meta(field)); expected.append(entry)
        gold_case={'case_id':item['case_id'],'family':fam,'seed':seed,'institution':item['institution'],'record_id':item['record_id'],'fields':expected}
        if args.version=='v2': gold_case.update({'version':'v2','currency_unit_source':'generation_schema'})
        (gold/f"{item['case_id']}.json").write_text(json.dumps(gold_case,ensure_ascii=False,indent=2),encoding='utf-8')
    manifest={'seed':seed,'independent_cases':len(FAMILIES),'pages':pages,'variants_per_case':variants}
    if args.version=='v2': manifest.update({'version':'v2','positive_variants':list(VARIANTS),'safety_variants':['missing_unit'] if 'missing_unit' in variants else [],'money_unit_source':'generation_schema'})
    (gold/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'version':args.version,'seed':seed,'independent_cases':len(FAMILIES),'pages':len(pages),'request_dir':str(req),'gold_dir':str(gold)},ensure_ascii=False))
if __name__=='__main__': main()
