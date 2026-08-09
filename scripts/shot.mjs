import { chromium } from 'playwright-core'
const url = process.argv[2] || 'http://localhost:3001/'
const out = process.argv[3] || 'shot.png'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await page.screenshot({ path: out })
await browser.close()
console.log('saved', out)
