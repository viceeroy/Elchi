import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Define Data interfaces
interface Post {
  id: string;
  type: "traveler" | "request";
  from_city: string;
  to_city: string;
  date: string; // YYYY-MM-DD
  weight: string;
  price: string | null;
  note: string | null;
  contact: string;
  created_at: string;
  expires_at: string; // date + 1 day
}

interface Report {
  id: string;
  post_id: string;
  created_at: string;
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

// Ensure DB directory and file exist with initial mock data if empty
function initializeDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const farFuture = new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0]; // for long-lasting sample posts

    const initialPosts: Post[] = [
      {
        id: "mock-traveler-1",
        type: "traveler",
        from_city: "Seoul",
        to_city: "Tashkent",
        date: farFuture,
        weight: "8 kg",
        price: "Negotiable / Kelishiladi",
        note: "Oziq-ovqat va dori-darmon olaman. Suyuqliklar qabul qilinmaydi.",
        contact: "@sherzod_korea",
        created_at: new Date().toISOString(),
        expires_at: farFuture
      },
      {
        id: "mock-request-1",
        type: "request",
        from_city: "Tashkent",
        to_city: "Seoul",
        date: farFuture,
        weight: "1.5 kg",
        price: "15,000 KRW",
        note: "Hujjatlar va kitoblar bor. Tezkor yetkazib berish kerak.",
        contact: "+998901234567",
        created_at: new Date().toISOString(),
        expires_at: farFuture
      }
    ];

    const initialData = {
      posts: initialPosts,
      reports: [] as Report[]
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

// Database helper functions
function readDB(): { posts: Post[]; reports: Report[] } {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database, resetting...", err);
    return { posts: [], reports: [] };
  }
}

function writeDB(data: { posts: Post[]; reports: Report[] }) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database", err);
  }
}

// In-memory rate limiting store (IP -> timestamp of last insert)
const rateLimits = new Map<string, number>();
const RATE_LIMIT_COOLDOWN = 1 * 60 * 1000; // 1 minute cooldown per IP to prevent spamming

async function startServer() {
  initializeDatabase();
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. API: Get active posts (expires_at >= today) sorted newest first
  app.get("/api/posts", (req, res) => {
    try {
      const db = readDB();
      const todayStr = new Date().toISOString().split("T")[0];
      
      // Filter active posts
      const activePosts = db.posts.filter(p => p.expires_at >= todayStr);
      
      // Sort newest first
      activePosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      res.json(activePosts);
    } catch (error) {
      res.status(500).json({ error: "Xatolik yuz berdi" });
    }
  });

  // 2. API: Add a new post
  app.post("/api/posts", (req, res) => {
    try {
      const {
        type,
        from_city,
        to_city,
        date,
        weight,
        price,
        note,
        contact,
        honeypot // Spam protection
      } = req.body;

      // Spam Protection: Honeypot check
      if (honeypot && honeypot.trim() !== "") {
        console.warn("Spam detected: Honeypot filled by bot.");
        return res.status(400).json({ error: "Spam aniqlandi" });
      }

      // Spam Protection: Rate limiting by IP
      const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      if (rateLimits.has(ip)) {
        const lastPostTime = rateLimits.get(ip) || 0;
        if (now - lastPostTime < RATE_LIMIT_COOLDOWN) {
          const waitSecs = Math.ceil((RATE_LIMIT_COOLDOWN - (now - lastPostTime)) / 1000);
          return res.status(429).json({ 
            error: `Iltimos kutib turing. Siz juda ko'p e'lon beryapsiz. Yana ${waitSecs} soniyadan keyin qayta urining.` 
          });
        }
      }

      // Server-side validation
      if (!type || !from_city || !to_city || !date || !weight || !contact) {
        return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmagan" });
      }

      if (type !== "traveler" && type !== "request") {
        return res.status(400).json({ error: "E'lon turi noto'g'ri" });
      }

      // Parse date and calculate expires_at (date + 1 day)
      const inputDate = new Date(date);
      if (isNaN(inputDate.getTime())) {
        return res.status(400).json({ error: "Sana formati noto'g'ri" });
      }

      const expiresDate = new Date(inputDate.getTime() + 86400000);
      const expires_at = expiresDate.toISOString().split("T")[0];

      const db = readDB();
      const newPost: Post = {
        id: "post-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now(),
        type,
        from_city,
        to_city,
        date,
        weight,
        price: price ? price.trim() : null,
        note: note ? note.trim() : null,
        contact,
        created_at: new Date().toISOString(),
        expires_at
      };

      db.posts.push(newPost);
      writeDB(db);

      // Record rate limit for this IP
      rateLimits.set(ip, now);

      res.status(201).json(newPost);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Tizimda xatolik yuz berdi" });
    }
  });

  // 3. API: Report a post (abusive or spam)
  app.post("/api/reports", (req, res) => {
    try {
      const { post_id } = req.body;
      if (!post_id) {
        return res.status(400).json({ error: "post_id majburiy" });
      }

      const db = readDB();
      
      // Verify post exists
      const postExists = db.posts.some(p => p.id === post_id);
      if (!postExists) {
        return res.status(404).json({ error: "E'lon topilmadi" });
      }

      const newReport: Report = {
        id: "report-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now(),
        post_id,
        created_at: new Date().toISOString()
      };

      db.reports.push(newReport);
      writeDB(db);

      res.status(201).json({ success: true, message: "E'lon muvaffaqiyatli shikoyat qilindi" });
    } catch (error) {
      console.error("Error creating report:", error);
      res.status(500).json({ error: "Tizimda xatolik yuz berdi" });
    }
  });

  // Serve static files / Vite middleware
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
