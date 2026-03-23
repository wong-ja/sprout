# 🌱 Sprout - Job & Application Tracker

A private, local-first job tracking board. No account required. Your data never leaves your device. Built for everyone - any role, any field, any stage of your journey.

---

## Features

- **Kanban board** with drag-and-drop (keyboard accessible)
- **Table view** - sortable spreadsheet of all jobs
- **Stats dashboard** - pipeline funnel, industry breakdown, timeline, interview stages
- **AI autofill** - paste a job URL and Gemini extracts the details automatically
- **Interview sub-stages** - Phone Screen, Technical, Panel, Final Round, etc.
- **Application requirements** - multiselect chips (Resume, Portfolio, References, etc.)
- **Custom columns** - add, rename, reorder your own pipeline stages
- **Color palette presets** + light/dark mode
- **Export/import JSON** - full data backup and restore, no account needed
- **localStorage persistence** - auto-saves in browser
- Job tracker for **any industry and role** (not just tech)

---

## Technologies

- HTML
- CSS
- JavaScript
- React 19
- Vite 8
- @dnd-kit/core 6
- localStorage + JSON export
- Vercel
- Gemini LLM - (optional) AI autofill feature

---

## Installation & Usage

```bash
# clone repository
git clone https://github.com/wong-ja/sprout.git
```

- **Node.js** 20.19+ or 22.12+
- **npm** 9+

```bash
# install dependencies
npm install

# start dev server
npm run dev
```

Opens at: `http://localhost:3000`

---

## AI Autofill Setup (optional)

The autofill feature calls the Gemini API. To enable it:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an `.env` file in the project root with your API key:

```
VITE_GEMINI_API_KEY=your_key
```

---

## Data & Privacy

- All job data is stored in your browser's `localStorage`
- Nothing is sent to any server (except the Gemini API call for autofill, if enabled)
- Export a backup anytime via **Settings → Export backup**
- Import a backup via **Settings → Import backup** or the **Import** button in the header
- Clearing browser data will erase your jobs - always keep a backup if needed

---

## Project Structure (core)

```
sprout/
├── package.json
├── vite.config.js
├── vercel.json
├── .env
├── index.html
└── src/
    ├── main.jsx 
    ├── App.jsx 
    ├── theme.css 
    ├── store.js            # localStorage, export/import, defaults
    └── components/
        ├── Board.jsx       # Kanban board (dnd-kit)
        ├── Table.jsx       # Table view
        ├── JobModal.jsx    # Add/Edit/View job
        ├── Stats.jsx       # Stats/Viz Dashboard
        ├── FilterBar.jsx   # Board/Table/Stats - filter, sort, group by
        └── Settings.jsx    # options, palettes, themes, columns, etc.
```
