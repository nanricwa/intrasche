import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';

const db = new Database('scheduling.db');

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    host_id TEXT NOT NULL,
    host_name TEXT NOT NULL,
    slots TEXT NOT NULL, -- JSON array of strings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    name TEXT NOT NULL,
    availabilities TEXT NOT NULL, -- JSON object { slot: "yes" | "maybe" | "no" }
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/events', (req, res) => {
    const { id, title, description, host_id, host_name, slots } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO events (id, title, description, host_id, host_name, slots) VALUES (?, ?, ?, ?, ?, ?)');
      stmt.run(id, title, description, host_id, host_name, JSON.stringify(slots));
      res.json({ success: true, id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  app.get('/api/events/:id', (req, res) => {
    try {
      const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as any;
      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      const responses = db.prepare('SELECT * FROM responses WHERE event_id = ?').all(req.params.id) as any[];
      
      res.json({
        ...event,
        slots: JSON.parse(event.slots),
        responses: responses.map(r => ({
          ...r,
          availabilities: JSON.parse(r.availabilities)
        }))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.get('/api/events', (req, res) => {
    const hostId = req.query.host_id as string;
    if (!hostId) return res.status(400).json({ error: 'host_id is required' });
    try {
      const events = db.prepare('SELECT * FROM events WHERE host_id = ? ORDER BY created_at DESC').all(hostId) as any[];
      const result = events.map(event => {
        const responseCount = (db.prepare('SELECT COUNT(*) as count FROM responses WHERE event_id = ?').get(event.id) as any).count;
        return { ...event, slots: JSON.parse(event.slots), response_count: responseCount };
      });
      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  app.post('/api/events/:id/responses', (req, res) => {
    const { id, name, availabilities, comment } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO responses (id, event_id, name, availabilities, comment) VALUES (?, ?, ?, ?, ?)');
      stmt.run(id, req.params.id, name, JSON.stringify(availabilities), comment || '');
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to submit response' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
