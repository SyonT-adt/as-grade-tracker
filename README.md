# AS Grade Tracker

A personal AS Level grade accumulator. Choose five or six subjects, enter personal-assessment and terminal exam marks, and see the weighted result and current grade.

## Grade calculation

- Each personal-assessment test percentage is marks achieved divided by total possible marks.
- The personal-assessment score is the average of four tests.
- Overall percentage = personal assessment × 40% + terminal exam × 60%.
- The supplied A and E minimums define evenly spaced A–E grade bands; marks below E are ungraded (U).

Subject thresholds can be edited. The starting values come from the supplied template and may not match every exam board, paper, or exam session.

## Data and privacy

Marks stay in local storage in the current browser. They do not sync between devices. Use the JSON backup and restore controls to move or protect your data. The app does not upload marks to this repository or to a server.

## Run locally

Requires Node.js 20.19 or newer.

~~~sh
pnpm install
pnpm dev

# or with npm
npm install
npm run dev
~~~

## Build for a hosted subpath

For GitHub Pages, set VITE_BASE_PATH to /as-grade-tracker/ when building. Use / for hosting at a domain root.
