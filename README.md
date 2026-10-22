# LifeLine — Time & Memory Archive
> *"Your Life. Your Memories. Your Story."*

A calm, personal digital memory archive and chronological life timeline. LifeLine enables individuals to capture, organize, and celebrate their life stories from earliest memories to the present through photographs, milestones, and personal reflections.

![LifeLine Logo](assets/logo.jpg)

---

## 1. Architecture Overview

```
lifeline/
├── index.html               # Semantic HTML5 layout with SPA view routing, modals & global footer
├── css/
│   └── styles.css           # Refined design system (navy/charcoal, electric blue, accessible UI)
├── js/
│   ├── supabaseClient.js    # Supabase client instantiation, dynamic config, and demo fallback
│   ├── auth.js              # User authentication (signUp, signIn, signOut, session guard)
│   ├── memories.js          # CRUD, multi-photo storage, favorites, milestones & export
│   ├── timeline.js          # Chronological grouping, card rendering, Photo-Grid, year scrubber
│   ├── imageUtils.js        # Multi-photo canvas compression, validation & WebP/JPEG conversion
│   └── main.js              # SPA router, search suggestions, photo carousel & reminders wiring
├── assets/
│   └── logo.jpg             # High-resolution brand emblem
├── .env.example             # Supabase credential template
└── README.md                # Project documentation, schema migration & test checklist
```

---

## 2. UI/UX Improvements & Redesign Highlights

| Area | Prior Implementation | New Redesigned Experience |
| :--- | :--- | :--- |
| **Theme & Color** | Dark theme only | **Light Theme by default** (clean canvas `#f8fafc`, crisp slate typography, restrained oceanic blue & gold accents) with instant Dark Theme switcher |
| **Navigation & Header** | Basic top bar | Global responsive header with search suggestions, reminder controls, view tabs, and mobile drawer |
| **Views & Formats** | Single timeline list | Multi-view experience: **Timeline**, **Photo Gallery Grid**, **Milestone Explorer**, **Favorites**, **Data Export**, and **About** |
| **Media Handling** | Single photo upload | **Multi-photo memories**: drag-and-drop multiple files, client-side thumbnail chips with compression savings, and detail carousel |
| **Milestone Distinction** | Generic category badge | Golden milestone ribbon, custom timeline nodes, and dedicated Milestone Explorer |
| **Retrospectives** | None | **On This Day** automatic detection for memories that happened on today's date in past years |
| **Data Ownership** | Basic cloud save | Full JSON metadata export and downloadable Markdown Life-Story chronicle |
| **Reminders** | None | Genuine user-configurable memory reminders (milestone anniversaries, weekly prompts) |
| **Accessibility** | Default browser states | Reduced-motion query support, high-contrast text, clear focus rings (`:focus-visible`), keyboard shortcuts |

---

## 3. End-to-End Features Implemented

### Core Workflows
- [x] **Chronological Life Timeline**: Grouped by year with year marker anchors, count badges, and timeline nodes.
- [x] **Sticky Year Scrubber**: Vertical navigation rail on desktop / horizontal on mobile with milestone indicators and active scroll-spy.
- [x] **Multi-Photo Upload**: Select or drop multiple images at once. Client-side canvas compression reduces payloads by ~70–85% to WebP/JPEG before uploading.
- [x] **Photo Carousel Lightbox**: In the Memory Detail view, cycle through multiple photographs with previous/next controls, dot indicators, and keyboard arrows (`←` / `→`).
- [x] **Photo Gallery Grid View**: Browse memories purely visually with consistent aspect ratios and hover detail cards.
- [x] **Milestone Explorer**: Dedicated chronological filter for pivotal achievements.
- [x] **Favorites System**: Instant one-click favorite toggling on memory cards and detail modal.
- [x] **Search with Live Suggestions**: Navbar search queries titles, descriptions, locations, and `#tags` in real time with quick-jump suggestions.
- [x] **On This Day Banner**: Automatically highlights memorable moments from previous years on today's calendar date.
- [x] **Data Export Center**: One-click download of all memory metadata in JSON format or as a structured Markdown life-story document.
- [x] **Genuine Reminders**: Configurable reminder settings stored securely.
- [x] **Demo Mode & Live Mode Separation**: Realistic sample data is clearly labeled in Demo Mode. Users can clear demo records with one click to start fresh.

---

## 4. Database Schema & Security Configuration

LifeLine uses Supabase PostgreSQL with **Row Level Security (RLS)** ensuring users only access their own private records.

Run this SQL migration in the **Supabase SQL Editor**:

```sql
-- 1. Create memories table
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  category TEXT DEFAULT 'Personal',
  location TEXT,
  importance INT DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  is_milestone BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  privacy TEXT DEFAULT 'private',
  media_url TEXT,
  media_path TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_date ON public.memories (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_memories_category ON public.memories (user_id, category);
CREATE INDEX IF NOT EXISTS idx_memories_milestones ON public.memories (user_id, is_milestone);
CREATE INDEX IF NOT EXISTS idx_memories_favorites ON public.memories (user_id, is_favorite);

-- 3. Row Level Security (RLS)
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memories"
  ON public.memories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Cloud Storage Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('lifeline-media', 'lifeline-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload their own memory media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lifeline-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view their own memory media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lifeline-media' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## 5. Local Setup & Execution

### Environment Variables
Copy `.env.example` to `.env` (or configure directly in the in-app Settings dialog):

```ini
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-key-here
SUPABASE_STORAGE_BUCKET=lifeline-media
```

### Running Locally

```bash
# Option A: Python HTTP server
python -m http.server 8080

# Option B: Node static server
npx serve .
```

Open `http://localhost:8080` in your web browser.

---

## 6. Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `/` | Focus global search input |
| `N` | Open "Capture New Memory" dialog |
| `Esc` | Close any open modal, drawer, or photo lightbox |
| `←` / `→` | Navigate previous / next photos in carousel |

---

## 7. Verification & Test Checklist

- [x] **Navigation**: Timeline, All Memories (Grid), Milestones, Favorites, Data & Export, and About views switch seamlessly.
- [x] **Multi-photo Upload**: Adding multiple images shows compression savings badges and individual remove buttons.
- [x] **Photo Carousel**: Memories with multiple images display a carousel in Detail view with prev/next buttons and thumbnail dots.
- [x] **Category Filters**: Clicking category pills filters the feed in real time.
- [x] **Favorites & Milestones**: Toggling favorite or milestone updates the card and reflects in dedicated views.
- [x] **Search**: Typing into global search displays live dropdown suggestions and filters the timeline.
- [x] **Data Export**: Successfully generates and downloads JSON backup and Markdown Life-Story chronicle.
- [x] **On This Day**: Correctly filters memories occurring on the current month and day from previous years.
- [x] **No Dead Links**: All header and footer links trigger genuine views, modals, or actions.
- [x] **Code Quality**: Verified with `node --check` across all modules with 0 syntax errors.
