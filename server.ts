import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Mock Data & State ---
  let athletes = [
    {
      id: '1',
      name: 'MARCUS R.',
      role: 'ELITE MEMBER',
      hr: 164,
      reps: 142,
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop',
      progress: 0,
      hasWatch: true
    },
    {
      id: '2',
      name: 'SARAH V.',
      role: 'PRO MEMBER',
      hr: 158,
      reps: 138,
      image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000&auto=format&fit=crop',
      progress: 0,
      hasWatch: true
    },
    {
      id: '3',
      name: 'LUCAS V.',
      role: 'ELITE MEMBER',
      hr: 152,
      reps: 120,
      image: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=1000&auto=format&fit=crop',
      progress: 0,
      hasWatch: false
    },
    {
      id: '4',
      name: 'JULIA M.',
      role: 'PRO MEMBER',
      hr: 145,
      reps: 110,
      image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop',
      progress: 0,
      hasWatch: true
    }
  ];

  let isWodActive = false;
  let wodStartTime = null;

  // --- API Routes ---
  
  // Get all athletes
  app.get("/api/athletes", (req, res) => {
    // Simulate real-time HR changes if WOD is active
    if (isWodActive) {
      athletes = athletes.map(a => ({
        ...a,
        hr: a.hasWatch ? (140 + Math.floor(Math.random() * 50)) : 0,
        progress: Math.min(100, a.progress + Math.random() * 0.5)
      }));
    }
    res.json(athletes);
  });

  // Start/Stop WOD
  app.post("/api/wod/toggle", (req, res) => {
    isWodActive = !isWodActive;
    if (isWodActive) {
      wodStartTime = new Date();
      // Reset progress
      athletes = athletes.map(a => ({ ...a, progress: 0 }));
    } else {
      wodStartTime = null;
    }
    res.json({ isWodActive, wodStartTime });
  });

  // Update specific athlete HR (Simulating Watch Webhook)
  app.post("/api/telemetry/hr", (req, res) => {
    const { athleteId, hr } = req.body;
    const index = athletes.findIndex(a => a.id === athleteId);
    if (index !== -1) {
      athletes[index].hr = hr;
      athletes[index].hasWatch = true;
      res.json({ success: true, athlete: athletes[index] });
    } else {
      res.status(404).json({ error: "Athlete not found" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
