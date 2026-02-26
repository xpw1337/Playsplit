# 🎶 Playsplit

**Split a YouTube playlist into multiple playlists using AI.** Give it one playlist and a set of categories (or let Gemini suggest them), and Playsplit fetches all tracks, classifies each with [Google Gemini](https://ai.google.dev/), then creates new private playlists in your YouTube account and fills them.

---

## Features

- **One playlist → many playlists** — Split by mood, genre, energy, or any labels you choose
- **AI-powered classification** — [Gemini](https://ai.google.dev/) assigns each video to a single category from titles and descriptions
- **Your categories or Gemini’s** — Enter comma-separated categories, or leave blank and approve/retry suggested ones
- **Handles large playlists** — Paginates through the source playlist and batches classification calls
- **Resilient to flakiness** — Retries when adding videos fails with “operation aborted” or timeouts
- **Private by default** — New playlists are created as private

---

## Prerequisites

- **Node.js** 18+ (20.19+ or 22.12+ recommended for Vite)
- **Google Cloud project** with:
  - [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) enabled
  - An **API key** (for reading playlist items)
  - An **OAuth 2.0 client** (for creating playlists and adding videos under your account)
- **Gemini API key** — [Get one here](https://aistudio.google.com/apikey)

---

## Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/xpw1337/Playsplit.git
   cd Playsplit
   npm install
   ```

2. **YouTube Data API**
   - In [Google Cloud Console](https://console.cloud.google.com/), enable **YouTube Data API v3** for your project.
   - Create an **API key** (Credentials → Create credentials → API key).
   - Create **OAuth 2.0** credentials (Desktop or Web). Use the OAuth playground or your app to sign in and get a temporary **Access Token** (you’ll paste it into Playsplit).

3. **Gemini**
   - Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) and paste it into the app.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open the URL Vite prints (e.g. `http://localhost:5173`).

---

## Usage

1. **Credentials** — Enter your YouTube API key, Gemini API key, and a current YouTube OAuth Access Token.
2. **Source playlist** — Paste the playlist URL or ID (e.g. `https://www.youtube.com/playlist?list=PLxxxx` or `PLxxxx`).
3. **Categories** — Either:
   - Type comma-separated categories (e.g. `Chill, Workout, Focus`), or  
   - Leave blank to get Gemini-suggested categories, then **Approve & Continue** or **Reject & Retry**.
4. **Split Playlist** — The app fetches all items, classifies them in batches, creates one new private playlist per category, and adds videos (with delays and retries to reduce rate limits and aborts).

New playlists appear in your YouTube account as **“Split: &lt;Category&gt;”**.

---

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start dev server (Vite)    |
| `npm run build`| TypeScript + Vite build   |
| `npm run preview` | Serve production build |

---

## Tech stack

- **TypeScript** + **Vite**
- **YouTube Data API v3** — `playlistItems.list`, `playlists.insert`, `playlistItems.insert`
- **Google Gemini** — [Vercel AI SDK](https://sdk.vercel.ai/) + `@ai-sdk/google` + **Zod** for structured category output

---

## License

ISC
