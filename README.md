# Ask-a-Podcast UI

The Next.js frontend for Ask-a-Podcast. Handles subscribing to feeds, asking questions, and playing cited audio at the exact timestamp a citation refers to.

**Live:** [ask-a-podcast-ui.vercel.app](https://ask-a-podcast-ui.vercel.app)

Backend repo: [ask-a-podcast](https://github.com/Abhinav-Anthati/ask-a-podcast)

## What it does

- A single question box, with a dropdown to scope search to one subscribed podcast or all of them.
- Answers stream in token by token, NDJSON parsed client-side as it arrives, not waiting for the full response.
- Citations render as clickable cards. Clicking one seeks an in-page audio player to that exact second in the actual episode, loading the file if it's a different episode than what's currently playing.
- A subscriptions panel to add, view, and remove podcasts, with live progress while a new one syncs.

## Stack

Next.js (App Router), TypeScript, Tailwind. No component library, everything here is plain HTML elements and Tailwind classes.

## Running it locally

```bash
npm install
npm run dev
```

Runs on `http://localhost:3000`. Expects the backend at `http://localhost:8000` by default (see `API_BASE` in `app/page.tsx`), overridable via the `NEXT_PUBLIC_API_BASE` environment variable, which is how the deployed version points at the production backend instead.

## Notes on the implementation

The whole app is one component, `app/page.tsx`, heavily commented inline rather than split into many small files, since it's small enough that one file stays readable and the comments explain the reasoning behind each piece (controlled inputs, the NDJSON stream parser, why the audio element stays permanently mounted, why `useState` updates in `handleAsk` use the updater-function form) directly where it's relevant.

Two things worth knowing if you're extending this:

**The audio player is always rendered, its visibility just toggles.** It has to stay mounted the whole time, or the `ref` pointing at it would go stale every time it's conditionally added or removed from the page.

**Errors are split by section, not shared globally.** Asking a question and managing subscriptions each have their own error state, so a failure in one doesn't show a confusing, unrelated error message next to the other.