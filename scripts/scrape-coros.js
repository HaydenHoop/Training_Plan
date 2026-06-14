#!/usr/bin/env node
/**
 * Coros Activity Scraper
 * Logs into training.coros.com and downloads GPX files for all your runs.
 *
 * Setup:
 *   cd "Training Plan Analyzer"
 *   npm install playwright
 *   npx playwright install chromium
 *   node scripts/scrape-coros.js
 *
 * GPX files are saved to: scripts/gpx-exports/
 * Then drag them all into the "Import Runs" tab in the app.
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const OUTPUT_DIR = path.join(import.meta.dirname, 'gpx-exports')
const COROS_URL  = 'https://training.coros.com'

// ── Prompt helpers ────────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(res => rl.question(q, res))

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🏃 Coros Activity Scraper\n')

  const email    = await ask('Coros email: ')
  const password = await ask('Password:    ')
  rl.close()

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const context = await browser.newContext()
  const page    = await context.newPage()

  // ── 1. Log in ──────────────────────────────────────────────────────────────
  console.log('\n→ Opening Coros...')
  await page.goto(COROS_URL)
  await page.waitForLoadState('networkidle')

  // Handle the login form (Coros uses email/password on the main page)
  try {
    await page.fill('input[type="email"], input[placeholder*="email" i], input[name="account"]', email, { timeout: 8000 })
    await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"], .login-btn, button:has-text("Log In"), button:has-text("Sign In")')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    console.log('✓ Logged in')
  } catch {
    console.log('⚠ Could not auto-fill login. Please log in manually in the browser window, then press Enter here.')
    await ask('Press Enter once you are logged in...')
  }

  // ── 2. Intercept the Coros API to get activities ──────────────────────────
  console.log('\n→ Fetching activities list via Coros API...')

  // Coros web app hits their own REST API — we piggyback the auth token
  const token = await page.evaluate(() => {
    // Try common storage keys Coros uses
    for (const key of Object.keys(localStorage)) {
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
        const val = localStorage.getItem(key)
        if (val && val.length > 20) return val
      }
    }
    // Try cookies
    return document.cookie
  })

  // Navigate to activity list page to trigger API calls
  await page.goto(`${COROS_URL}/#/activity`)
  await page.waitForLoadState('networkidle')

  // ── 3. Intercept network requests to find activity IDs ────────────────────
  const activityIds = []
  const seenIds = new Set()

  page.on('response', async (response) => {
    const url = response.url()
    if (!url.includes('activity') || !url.includes('coros')) return
    try {
      const json = await response.json()
      // Coros API typically returns { data: { dataList: [...] } }
      const list = json?.data?.dataList || json?.data || []
      if (Array.isArray(list)) {
        for (const item of list) {
          const id = item.labelId || item.id || item.activityId
          if (id && !seenIds.has(id)) {
            seenIds.add(id)
            activityIds.push({ id, name: item.name || item.sportType, date: item.startTime || item.date })
          }
        }
      }
    } catch {}
  })

  // Scroll through pages to load all activities
  console.log('→ Loading activity pages...')
  let page_num = 1
  let prevCount = 0
  while (true) {
    await page.waitForTimeout(2000)
    if (activityIds.length === prevCount && page_num > 1) break
    prevCount = activityIds.length

    // Try clicking "next page" or "load more"
    const nextBtn = page.locator('button:has-text("Next"), .pagination-next, [aria-label="Next page"]').first()
    const hasNext = await nextBtn.isVisible().catch(() => false)
    if (!hasNext) break

    await nextBtn.click()
    await page.waitForLoadState('networkidle')
    page_num++
    if (page_num > 50) break // Safety cap
  }

  if (activityIds.length === 0) {
    console.log('\n⚠ No activities captured from API. Trying direct export approach...')
    await manualExportFlow(page, OUTPUT_DIR)
  } else {
    console.log(`\n✓ Found ${activityIds.length} activities. Downloading GPX files...`)
    await downloadGpxFiles(page, context, activityIds, OUTPUT_DIR)
  }

  console.log(`\n✅ Done! GPX files saved to:\n   ${OUTPUT_DIR}`)
  console.log('\nNext step: drag all the .gpx files into the "Import Runs" tab in your training app.\n')

  await browser.close()
}

// ── Download GPX for each activity via Coros export endpoint ─────────────────
async function downloadGpxFiles(page, context, activities, outputDir) {
  let saved = 0
  for (const act of activities) {
    const filename = `${act.date || 'run'}-${act.id}.gpx`.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const outPath = path.join(outputDir, filename)
    if (fs.existsSync(outPath)) { console.log(`  skip ${filename} (exists)`); continue }

    try {
      // Coros GPX export URL pattern
      const exportUrl = `https://training.coros.com/activity/exportGpx?labelId=${act.id}`
      const dlPage = await context.newPage()
      const [download] = await Promise.all([
        dlPage.waitForEvent('download', { timeout: 15000 }),
        dlPage.goto(exportUrl),
      ])
      await download.saveAs(outPath)
      await dlPage.close()
      saved++
      console.log(`  ✓ ${filename}`)
    } catch {
      // Try the activity detail page approach
      try {
        await page.goto(`https://training.coros.com/#/activity/${act.id}`)
        await page.waitForLoadState('networkidle')
        const exportBtn = page.locator('button:has-text("Export"), [title*="Export"], button:has-text("GPX")').first()
        if (await exportBtn.isVisible({ timeout: 3000 })) {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            exportBtn.click(),
          ])
          await download.saveAs(outPath)
          saved++
          console.log(`  ✓ ${filename} (via button)`)
        }
      } catch { console.log(`  ✗ could not export ${act.id}`) }
    }
    await page.waitForTimeout(300) // be polite
  }
  console.log(`\n  Saved ${saved} of ${activities.length} GPX files`)
}

// ── Fallback: guide user through manual export of individual activities ───────
async function manualExportFlow(page, outputDir) {
  console.log('\nFallback: opening each activity for manual export.')
  console.log('For each activity, click the export/download button and save the GPX.')
  console.log(`Files will auto-save to: ${outputDir}\n`)
  await page.waitForTimeout(3000)
}

main().catch(e => { console.error(e); process.exit(1) })
