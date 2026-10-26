"""Optional local UI verification against a running server; synthetic data only."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',default='http://127.0.0.1:8091')
    args=parser.parse_args()
    from playwright.sync_api import sync_playwright
    screenshots=Path(__file__).resolve().parents[1]/'docs'/'screenshots'
    screenshots.mkdir(parents=True,exist_ok=True)
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(args.url,wait_until='networkidle')
        page.locator('[data-action="demo"]').first.click()
        page.locator('[data-action="generate"]').first.wait_for(timeout=30000)
        page.screenshot(path=str(screenshots/'overview.png'),full_page=True)
        page.locator('[data-action="generate"]').first.click()
        page.locator('[data-action="preview-artifact"]').first.wait_for(timeout=30000)
        page.screenshot(path=str(screenshots/'generated-documents.png'),full_page=True)
        page.locator('[data-action="preview-artifact"]').first.click()
        page.locator('#review-form').wait_for()
        page.locator('#review-form input[name="reviewer"]').fill('합성 UI 검수자')
        page.locator('#review-form input[type="checkbox"]').check()
        page.locator('#review-form button[type="submit"]').click()
        page.wait_for_timeout(800)
        if page.locator('#modal').evaluate('(el)=>el.open'):
            page.locator('[data-action="close-modal"]').first.click()
        for view in ('documents','facts','calculations','requirements','strategy','history','knowledge','promptbook','runtime'):
            page.locator(f'.nav-item[data-view="{view}"]').first.click()
            page.wait_for_timeout(300)
            if page.locator('main .loading-state').count():
                page.locator('main .loading-state').wait_for(state='hidden',timeout=15000)
        page.set_viewport_size({'width':390,'height':844})
        page.locator('[data-action="toggle-menu"]').click()
        page.locator('.nav-item[data-view="overview"]').first.click()
        page.wait_for_timeout(300)
        overflow=page.evaluate('document.documentElement.scrollWidth>window.innerWidth')
        page.screenshot(path=str(screenshots/'mobile.png'),full_page=True)
        browser.close()
    print(json.dumps({'page_errors':errors,'mobile_horizontal_overflow':overflow,'screenshots':str(screenshots)},ensure_ascii=True,indent=2))
    if errors or overflow:
        return 1
    return 0


if __name__=='__main__':
    raise SystemExit(main())
