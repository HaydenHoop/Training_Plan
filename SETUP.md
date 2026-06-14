# XC Training Analyzer — Setup

## First-time setup

```bash
# 1. Delete any leftover node_modules (may be corrupted from sandbox)
rm -rf node_modules

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Start local dev server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |

## Uploading a training plan

The app accepts `.csv` files in this format:

```
date,workoutType,plannedMileage,plannedPace,notes
2026-06-16,Easy Run,6,7:45,Aerobic base
2026-06-17,Tempo,8,6:30,Threshold work
2026-06-18,Rest,0,,Recovery
```

You can also use the Manual Entry tab to type a week directly into the app.

## Data

All training data is stored in your browser's **localStorage** — nothing is sent to a server. To back up your data, use your browser's dev tools or the export feature (coming soon).
