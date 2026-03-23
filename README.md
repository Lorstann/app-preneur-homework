# File Converter Hub (Next.js + Three.js, Vercel-ready)

File Converter Hub is a full-stack conversion platform with a modern 3D UI.
The app now uses Next.js frontend + Next.js API routes for conversion logic, so it can be deployed directly on Vercel.

## Features

- 3D animated landing interface using Three.js
- Image conversion:
  - JPG to PNG
  - PNG to JPG
  - WEBP to PNG
  - WEBP to JPG
- Text to PDF (`.txt` to `.pdf`)
- CSV to JSON (`.csv` to `.json`)
- JSON to CSV (`.json` to `.csv`)
- Download converted file immediately after conversion

## Technologies Used

- Frontend: Next.js, React, Three.js
- Backend: Next.js API Routes (Node runtime)
- Conversion libraries:
  - sharp (image conversion)
  - pdf-lib (TXT to PDF)
  - csv-parse + csv-stringify

## Project Structure

```text
FileConverterHub/
├── frontend-next/
│   ├── app/
│   │   ├── api/
│   │   │   └── convert/
│   │   │       └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── ThreeBackground.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
└── README.md
```

## Installation

1. Open terminal in `FileConverterHub/frontend-next`.
2. Install dependencies:

```bash
npm install
```

## Run Locally

Single terminal is enough:
```bash
npm run dev
```

App runs at `http://127.0.0.1:3000`.

## Deploy on Vercel

1. Push the repository to GitHub.
2. In Vercel, click **New Project** and import this repository.
3. Set project root directory to:
   - `FileConverterHub/frontend-next`
4. Build settings (usually auto-detected):
   - Build Command: `npm run build`
   - Output: `.next`
5. Deploy.

No external backend is required for production because conversion runs inside Next.js API routes.

## Supported Conversion Types

- `jpg_to_png`
- `png_to_jpg`
- `webp_to_png`
- `webp_to_jpg`
- `txt_to_pdf`
- `csv_to_json`
- `json_to_csv`

## Validation and Error Handling

- missing uploaded file
- missing conversion selection
- mismatch between selected conversion and uploaded extension
- invalid/corrupted image file
- empty TXT, CSV, or JSON file
- unsupported JSON structure for CSV conversion (must be array of objects)

## Limitations

- No user authentication
- No database
- No cloud storage
- JSON to CSV is intended for flat object arrays
- Output files are stored in local `outputs/` until manually cleaned

## Future Improvements

- auto-delete old output files
- flatten nested JSON for richer CSV export
- drag-and-drop upload area in the Next.js UI
- conversion history panel
- progress indicator for larger files

## Presentation-Friendly Logic

### Problem

Users frequently need quick one-time file conversion without downloading desktop tools.

### Solution

A web app with an appealing 3D interface and a simple built-in conversion API.

### Target Users

- students
- office users
- small business users

### Value Proposition

Visually impressive and practical converter that is simple enough for local demos and academic presentations.
