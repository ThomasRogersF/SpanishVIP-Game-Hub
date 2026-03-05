# 🇪🇸 SpanishVIP Interactive Game Hub

A Kahoot-style interactive learning platform built for SpanishVIP corporate Spanish training classes. 7 fully playable games, real-time multiplayer via Firebase, hosted on Vercel.

## 🎮 Games Included
| Game | Type | Description |
|------|------|-------------|
| 🎯 Multiple Choice | Knowledge | 4 options, speed + accuracy scoring |
| ✅ True or False | Knowledge | Rapid-fire, streak multipliers |
| ☁️ Word Cloud | Open-ended | Free-form answers visualized |
| 🧩 Puzzle Sequencing | Ordering | Drag and drop to arrange |
| ⌨️ Type Answer | Recall | Type the exact answer |
| 📊 Opinion Poll | Engagement | Live results with charts |
| 🤖 Robot Run | Narrative | Escape the robot escape game |

## 🚀 Quick Start (Demo Mode — no Firebase needed)
```
npm install
npm run dev
# Visit http://localhost:5173
# Click any "Play Demo" button to play instantly
```

## 🔥 Live Multiplayer Setup
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database + Realtime Database
3. Register a Web App and copy the config
4. `cp .env.example .env`
5. Fill in your Firebase values in `.env`
6. `npm run dev`

## 🌐 Deploy to Vercel
1. Push this repo to GitHub
2. Go to https://vercel.com → Import Project
3. Select your GitHub repo
4. Add all `VITE_FIREBASE_*` variables in Vercel → Settings → Environment Variables
5. Click Deploy
6. Every future git push auto-deploys

## 👩‍🏫 How to Run a Live Class Game
**Teacher:**
1. Go to `/teacher`
2. Select a game type
3. Click "Generate PIN" — share the 6-digit PIN with students
4. Click "Start Game"

**Students:**
1. Go to `/join` (or the Vercel URL)
2. Enter the PIN + a nickname
3. Play!

**Demo (no students needed):**
- Go to `/` → click any "Play Demo →" button

## 🛠 Tech Stack
- React 18 + Vite
- Tailwind CSS
- Firebase (Firestore + Realtime Database)
- Framer Motion (animations)
- Recharts (charts)
- @dnd-kit (drag and drop)
- react-wordcloud (word cloud)
- Vercel (hosting)

## 📁 Project Structure
```
src/
├── components/
│   ├── games/          ← 7 game components
│   └── shared/         ← Leaderboard, Timer, PinEntry, GameWrapper
├── pages/              ← Hub, TeacherDashboard, StudentJoin, GameResults
├── firebase/           ← config, sessions, leaderboard, healthCheck
├── hooks/              ← useTimer, useLeaderboard, useSession
└── utils/              ← generatePin, scoreCalculator, stringMatcher
```

## 📝 License
Built for internal use by SpanishVIP.
