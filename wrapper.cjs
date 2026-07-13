const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

process.on('uncaughtException', (err) => {
  console.error('[Server Uncaught Exception]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server Unhandled Rejection]', reason);
});

const isSea = !process.argv[0].toLowerCase().endsWith('node.exe') && !process.argv[0].toLowerCase().endsWith('node');
const args = process.argv.slice(isSea ? 1 : 2).filter(arg => {
  const lower = arg.toLowerCase();
  return !lower.endsWith('node.exe') && !lower.endsWith('node') && !lower.endsWith('start-app.js') && !lower.endsWith('start-app.exe') && !lower.endsWith('start-app-exe');
});

const playWithVlc = args.includes('--vlc');
const backendOnly = args.includes('--backend-only');
const frontendOnly = args.includes('--frontend-only');
const trayMode = args.includes('--tray');
const filePath = args.find(arg => arg !== '--vlc' && !arg.startsWith('--'));
const resolvedFilePath = filePath ? path.resolve(filePath) : null;

// VLC fallback handler
if (playWithVlc && resolvedFilePath) {
  const vlcPaths = [
    'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
    'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
    'vlc'
  ];
  let selectedPath = 'vlc';
  for (const p of vlcPaths) {
    if (p === 'vlc' || fs.existsSync(p)) {
      selectedPath = p;
      if (p !== 'vlc') break;
    }
  }
  console.log(`[VLC] Launching VLC to play: ${resolvedFilePath}`);
  const child = spawn(selectedPath, [resolvedFilePath], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  process.exit(0);
}

const execDir = path.dirname(process.execPath);
let appDir = __dirname;
if (!fs.existsSync(path.join(appDir, 'dist'))) {
  appDir = execDir;
}
if (!fs.existsSync(path.join(appDir, 'dist'))) {
  appDir = process.cwd();
}
const dataDir = path.join(appDir, '.valor_data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = path.join(dataDir, 'valor.db');
const db = new DatabaseSync(dbPath);

// Create SQLite tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    userId TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT,
    password TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
  );
`);

// Try to alter profiles table if columns are missing (migrations)
try { db.exec(`ALTER TABLE profiles ADD COLUMN username TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE profiles ADD COLUMN password TEXT;`); } catch(e){}

// Populate accounts table from existing profiles for backward compatibility
try {
  const existingProfilesWithPasswords = db.prepare('SELECT username, password FROM profiles WHERE username IS NOT NULL AND password IS NOT NULL').all();
  const insertAccount = db.prepare('INSERT OR IGNORE INTO accounts (username, password) VALUES (?, ?)');
  for (const p of existingProfilesWithPasswords) {
    insertAccount.run(p.username, p.password);
  }
} catch (e) {
  console.warn('Failed to migrate existing profiles to accounts table:', e.message);
}

// Migration to remove UNIQUE constraint from username
try {
  db.exec(`DROP INDEX IF EXISTS idx_profiles_username;`);
  const indexList = db.prepare("PRAGMA index_list('profiles')").all();
  const hasUniqueIndex = indexList.some(idx => idx.unique === 1 && idx.name.includes('username'));
  
  if (hasUniqueIndex) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS profiles_temp (
        userId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT,
        password TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      );
    `);
    db.exec(`INSERT OR REPLACE INTO profiles_temp SELECT userId, name, username, password, createdAt FROM profiles;`);
    db.exec(`DROP TABLE profiles;`);
    db.exec(`ALTER TABLE profiles_temp RENAME TO profiles;`);
    console.log('[SQLite Migration] Successfully removed UNIQUE constraint from profiles.username');
  }
} catch (e) {
  console.log('[SQLite Migration] Note: profiles table already migrated or no UNIQUE index found:', e.message);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    userId TEXT PRIMARY KEY,
    settingsJson TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    userId TEXT NOT NULL,
    videoId TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    type TEXT,
    fileName TEXT,
    duration REAL,
    currentTime REAL,
    lastPlayedDate TEXT,
    totalTimeWatched REAL,
    rating INTEGER,
    timeToFinish REAL,
    sessions TEXT,
    localFilePath TEXT,
    playedDates TEXT,
    format TEXT,
    streams TEXT,
    audioTracks TEXT,
    subtitleTracks TEXT,
    PRIMARY KEY (userId, videoId)
  );
`);

// Try to alter history table for missing columns (migrations)
try { db.exec(`ALTER TABLE history ADD COLUMN url TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE history ADD COLUMN type TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE history ADD COLUMN fileName TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE history ADD COLUMN format TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE history ADD COLUMN streams TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE history ADD COLUMN audioTracks TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE history ADD COLUMN subtitleTracks TEXT;`); } catch(e){}

db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    userId TEXT NOT NULL,
    videoId TEXT NOT NULL,
    id TEXT NOT NULL,
    time REAL NOT NULL,
    endTime REAL,
    label TEXT NOT NULL,
    isIntro INTEGER DEFAULT 0,
    isOutro INTEGER DEFAULT 0,
    skipEnabled INTEGER DEFAULT 0,
    PRIMARY KEY (userId, videoId, id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS login_attempts (
    username TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 0,
    lockedUntil TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS blocked_ips (
    ip TEXT PRIMARY KEY,
    blockedUntil TEXT
  );
`);

// Setup logging redirection to app.log
const logFilePath = path.join(dataDir, 'app.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  logStream.write(`[${new Date().toISOString()}] [INFO] ${msg}\n`);
  originalLog(...args);
};

console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  logStream.write(`[${new Date().toISOString()}] [ERROR] ${msg}\n`);
  originalError(...args);
};

const PORT_SERVICE = 50000;
const PORT_BACKEND = 50001;

const getJsonBody = (req) => new Promise((resolve) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try { resolve(JSON.parse(body)); }
    catch { resolve({}); }
  });
});

let distDir = path.join(appDir, 'dist');

console.log(`[Server] Serving static files from: ${distDir}`);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.vtt': 'text/vtt',
  '.srt': 'text/plain'
};

let lastHeartbeat = Date.now();
let hasReceivedFirstHeartbeat = false;
let activeConnections = 0;
let pendingPlayFile = null;

// 1. Backend API Server (Port 50001)
const backendServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT_BACKEND}`);
  const pathname = parsedUrl.pathname;

  // Global IP block check middleware
  const ip = req.socket.remoteAddress || req.headers['x-forwarded-for'] || '';
  try {
    const checkIp = db.prepare('SELECT blockedUntil FROM blocked_ips WHERE ip = ?').get(ip);
    if (checkIp && checkIp.blockedUntil && new Date(checkIp.blockedUntil) > new Date()) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'IP blocked', blockedUntil: checkIp.blockedUntil }));
      return;
    }
  } catch (e) {
    console.error('[IP check error]', e.message);
  }

  // Heartbeat check
  if (pathname === '/api/heartbeat') {
    lastHeartbeat = Date.now();
    hasReceivedFirstHeartbeat = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    
    const responseData = { status: 'ok' };
    if (pendingPlayFile) {
      responseData.playFile = pendingPlayFile;
      pendingPlayFile = null;
    }
    
    res.end(JSON.stringify(responseData));
    return;
  }

  // Play command forward receiver
  if (pathname === '/api/play') {
    const file = parsedUrl.searchParams.get('file');
    
    // Check if there is an active tab (heartbeat received within last 6 seconds)
    const hasActiveTab = hasReceivedFirstHeartbeat && (Date.now() - lastHeartbeat < 6000);
    
    if (hasActiveTab && file) {
      console.log(`[Server] Active tab detected. Queueing file for playback: ${file}`);
      pendingPlayFile = file;
    } else {
      const openUrl = file 
        ? `http://127.0.0.1:${PORT_SERVICE}/?file=${encodeURIComponent(file)}`
        : `http://127.0.0.1:${PORT_SERVICE}/`;
        
      console.log(`[Server] No active tab. Opening browser: ${openUrl}`);
      if (process.platform === 'win32') {
        spawn('cmd', ['/c', 'start', '', openUrl], { detached: true }).unref();
      } else if (process.platform === 'darwin') {
        spawn('open', [openUrl], { detached: true }).unref();
      } else {
        spawn('xdg-open', [openUrl], { detached: true }).unref();
      }
    }
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, tabReused: hasActiveTab }));
    return;
  }

  // Browser remote logging API
  if (pathname === '/api/log') {
    getJsonBody(req).then(data => {
      const type = data.type || 'INFO';
      const msg = data.message || '';
      console.log(`[Browser ${type}] ${msg}`);
      res.statusCode = 200;
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // Profiles List API (Returns userId, name, username, createdAt - password omitted!)
  if (pathname === '/api/profiles' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    try {
      const query = db.prepare("SELECT userId, name, username, (password IS NOT NULL AND password != '') AS hasPassword, createdAt FROM profiles");
      const rows = query.all();
      res.end(JSON.stringify(rows));
    } catch (e) {
      console.error('[SQLite profiles GET error]', e.message);
      res.end(JSON.stringify([]));
    }
    return;
  }

  // Create Profile / Signup API
  if (pathname === '/api/profiles' && req.method === 'POST') {
    getJsonBody(req).then(data => {
      const name = data.name || 'Unnamed Profile';
      const username = data.username;
      const password = data.password;
      const userId = data.userId || `u_${Math.random().toString(36).substring(2, 11)}`;
      
      if (username) {
        try {
          const existing = db.prepare('SELECT userId FROM profiles WHERE username = ?').get(username);
          if (existing) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Username already taken' }));
            return;
          }
        } catch (e) {}
      }

      try {
        const insert = db.prepare('INSERT OR REPLACE INTO profiles (userId, name, username, password) VALUES (?, ?, ?, ?)');
        insert.run(userId, name, username || null, password || null);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, userId, name }));
      } catch (e) {
        console.error('[SQLite profiles POST error]', e.message);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Delete Profile API
  if (pathname === '/api/profile/delete' && req.method === 'POST') {
    getJsonBody(req).then(data => {
      const { userId } = data;
      if (!userId || userId === 'local') {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid userId' }));
        return;
      }
      try {
        db.prepare('DELETE FROM profiles WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM settings WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM history WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM bookmarks WHERE userId = ?').run(userId);
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('[SQLite profile delete error]', e.message);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Profile Login API (mismatch lockout checks)
  if (pathname === '/api/profile/login' && req.method === 'POST') {
    getJsonBody(req).then(data => {
      const { userId, username, password } = data;
      
      let profile;
      let account;
      try {
        if (userId) {
          profile = db.prepare('SELECT * FROM profiles WHERE userId = ?').get(userId);
          if (!profile) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Profile not found' }));
            return;
          }
          if (profile.password && profile.password !== password) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Incorrect profile password' }));
            return;
          }
        } else if (username) {
          account = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);
          if (!account) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Account not found' }));
            return;
          }
          if (account.password !== password) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Incorrect username or password' }));
            return;
          }
          profile = db.prepare('SELECT * FROM profiles WHERE username = ? ORDER BY createdAt ASC').get(username);
          if (!profile) {
            const fallbackId = `u_${Math.random().toString(36).substring(2, 11)}`;
            db.prepare('INSERT INTO profiles (userId, name, username, password) VALUES (?, ?, ?, null)')
              .run(fallbackId, username, username);
            profile = { userId: fallbackId, name: username };
          }
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Database error' }));
        return;
      }

      const activeUsername = username || profile.username || profile.name;

      // Account lock check
      try {
        const checkLock = db.prepare('SELECT lockedUntil FROM login_attempts WHERE username = ?').get(activeUsername);
        if (checkLock && checkLock.lockedUntil && new Date(checkLock.lockedUntil) > new Date()) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Account locked', lockedUntil: checkLock.lockedUntil }));
          return;
        }
      } catch (e) {}

      // Validate password success (already checked above)
      if (true) {
        // Success! Reset attempts
        try {
          db.prepare('INSERT OR REPLACE INTO login_attempts (username, attempts, lockedUntil) VALUES (?, 0, NULL)').run(activeUsername);
        } catch(e) {}
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, userId: profile.userId, name: profile.name }));
      } else {
        // Failure! Increment attempts
        let attempts = 1;
        try {
          const row = db.prepare('SELECT attempts FROM login_attempts WHERE username = ?').get(activeUsername);
          if (row) {
            attempts = (row.attempts || 0) + 1;
          }
          
          if (attempts >= 5) {
            const lockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
            const blockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day
            
            db.prepare('INSERT OR REPLACE INTO login_attempts (username, attempts, lockedUntil) VALUES (?, ?, ?)')
              .run(activeUsername, attempts, lockedUntil);
            db.prepare('INSERT OR REPLACE INTO blocked_ips (ip, blockedUntil) VALUES (?, ?)')
              .run(ip, blockedUntil);

            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              error: 'Account locked for 1 hour. IP blocked for 1 day.', 
              lockedUntil, 
              blockedUntil 
            }));
          } else {
            db.prepare('INSERT OR REPLACE INTO login_attempts (username, attempts, lockedUntil) VALUES (?, ?, NULL)')
              .run(activeUsername, attempts);
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Incorrect password', attempts }));
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Database update error' }));
        }
      }
    });
    return;
  }

  // Get Profile Data API (Combined Settings & History)
  // GraphQL API
  if (pathname === '/api/graphql' && req.method === 'POST') {
    getJsonBody(req).then(body => {
      const query = body.query || '';
      const variables = body.variables || {};
      
      // GetProfiles query
      if (query.includes('profiles') || query.includes('GetProfiles')) {
        try {
          const usernameVal = variables.username;
          let rows;
          if (usernameVal) {
            rows = db.prepare("SELECT userId, name, username, (password IS NOT NULL AND password != '') AS hasPassword, createdAt FROM profiles WHERE username = ?").all(usernameVal);
          } else {
            rows = db.prepare("SELECT userId, name, username, (password IS NOT NULL AND password != '') AS hasPassword, createdAt FROM profiles").all();
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: { profiles: rows } }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ errors: [{ message: e.message }] }));
        }
        return;
      }
      
      // GetProfileData query
      if (query.includes('profile') || query.includes('GetProfileData')) {
        let userId = variables.userId;
        if (!userId) {
          const match = query.match(/profile\s*\(\s*userId\s*:\s*"([^"]+)"\)/);
          if (match) userId = match[1];
        }
        
        if (!userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ errors: [{ message: 'Missing userId variable or argument' }] }));
          return;
        }
        
        try {
          // Fetch settings
          const settingsQuery = db.prepare('SELECT settingsJson FROM settings WHERE userId = ?');
          const settingsRow = settingsQuery.get(userId);
          const settings = settingsRow ? JSON.parse(settingsRow.settingsJson) : {};

          // Fetch history
          const historyQuery = db.prepare('SELECT * FROM history WHERE userId = ?');
          const historyRows = historyQuery.all(userId);

          // Fetch bookmarks
          const bookmarksQuery = db.prepare('SELECT * FROM bookmarks WHERE userId = ?');
          const bookmarksRows = bookmarksQuery.all(userId);

          // Combine history and bookmarks
          const videos = historyRows.map(row => {
            const videoBookmarks = bookmarksRows
              .filter(bm => bm.videoId === row.videoId)
              .map(bm => ({
                id: bm.id,
                time: bm.time,
                endTime: bm.endTime !== null ? bm.endTime : undefined,
                label: bm.label,
                isIntro: bm.isIntro === 1,
                isOutro: bm.isOutro === 1,
                skipEnabled: bm.skipEnabled === 1
              }));
            
            return {
              id: row.videoId,
              title: row.title,
              url: row.url || '',
              type: row.type || 'local',
              fileName: row.fileName || '',
              duration: row.duration,
              currentTime: row.currentTime,
              lastPlayedDate: row.lastPlayedDate,
              totalTimeWatched: row.totalTimeWatched,
              rating: row.rating,
              timeToFinish: row.timeToFinish,
              sessions: row.sessions ? JSON.parse(row.sessions) : [],
              localFilePath: row.localFilePath,
              playedDates: row.playedDates ? JSON.parse(row.playedDates) : [],
              format: row.format || null,
              streams: row.streams ? JSON.parse(row.streams) : [],
              audioTracks: row.audioTracks ? JSON.parse(row.audioTracks) : [],
              subtitleTracks: row.subtitleTracks ? JSON.parse(row.subtitleTracks) : [],
              bookmarks: videoBookmarks
            };
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: { profile: { settings, history: videos } } }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ errors: [{ message: e.message }] }));
        }
        return;
      }
      
      // SaveSettings mutation
      if (query.includes('SaveSettings') || query.includes('saveSettings')) {
        const userId = variables.userId;
        const settingsData = variables.settings;
        if (userId && userId !== 'local' && !userId.startsWith('local_')) {
          try {
            const insert = db.prepare('INSERT OR REPLACE INTO settings (userId, settingsJson) VALUES (?, ?)');
            insert.run(userId, JSON.stringify(settingsData));
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ data: { saveSettings: { success: true } } }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ errors: [{ message: e.message }] }));
          }
        } else {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: { saveSettings: { success: true } } }));
        }
        return;
      }
      
      // SaveHistory mutation
      if (query.includes('SaveHistory') || query.includes('saveHistory')) {
        const userId = variables.userId;
        const historyData = variables.history;
        if (userId && userId !== 'local' && !userId.startsWith('local_')) {
          try {
            // Delete existing history & bookmarks first to match full sync behavior
            const deleteHistory = db.prepare('DELETE FROM history WHERE userId = ?');
            deleteHistory.run(userId);
            const deleteBookmarks = db.prepare('DELETE FROM bookmarks WHERE userId = ?');
            deleteBookmarks.run(userId);

            const insertHistory = db.prepare(`
              INSERT OR REPLACE INTO history 
              (userId, videoId, title, url, type, fileName, duration, currentTime, lastPlayedDate, totalTimeWatched, rating, timeToFinish, sessions, localFilePath, playedDates, format, streams, audioTracks, subtitleTracks)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const insertBookmark = db.prepare(`
              INSERT OR REPLACE INTO bookmarks
              (userId, videoId, id, time, endTime, label, isIntro, isOutro, skipEnabled)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            if (Array.isArray(historyData)) {
              for (const video of historyData) {
                insertHistory.run(
                  userId,
                  video.id,
                  video.title || 'Untitled Video',
                  video.url || '',
                  video.type || 'local',
                  video.fileName || '',
                  video.duration || null,
                  video.currentTime || null,
                  video.lastPlayedDate || null,
                  video.totalTimeWatched || null,
                  video.rating || null,
                  video.timeToFinish || null,
                  video.sessions ? JSON.stringify(video.sessions) : null,
                  video.localFilePath || null,
                  video.playedDates ? JSON.stringify(video.playedDates) : null,
                  video.format || null,
                  video.streams ? JSON.stringify(video.streams) : null,
                  video.audioTracks ? JSON.stringify(video.audioTracks) : null,
                  video.subtitleTracks ? JSON.stringify(video.subtitleTracks) : null
                );

                if (video.bookmarks && Array.isArray(video.bookmarks)) {
                  for (const bm of video.bookmarks) {
                    insertBookmark.run(
                      userId,
                      video.id,
                      bm.id,
                      bm.time,
                      bm.endTime !== undefined ? bm.endTime : null,
                      bm.label || '',
                      bm.isIntro ? 1 : 0,
                      bm.isOutro ? 1 : 0,
                      bm.skipEnabled ? 1 : 0
                    );
                  }
                }
              }
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ data: { saveHistory: { success: true } } }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ errors: [{ message: e.message }] }));
          }
        } else {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data: { saveHistory: { success: true } } }));
        }
        return;
      }
      
      // Unknown query
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ errors: [{ message: 'Unsupported GraphQL operation' }] }));
    });
    return;
  }

  if (pathname === '/api/profile/data' && req.method === 'GET') {
    const userId = parsedUrl.searchParams.get('userId');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    if (!userId) {
      res.end(JSON.stringify({ error: 'Missing userId' }));
      return;
    }

    try {
      // Fetch settings
      const settingsQuery = db.prepare('SELECT settingsJson FROM settings WHERE userId = ?');
      const settingsRow = settingsQuery.get(userId);
      const settings = settingsRow ? JSON.parse(settingsRow.settingsJson) : {};

      // Fetch history
      const historyQuery = db.prepare('SELECT * FROM history WHERE userId = ?');
      const historyRows = historyQuery.all(userId);

      // Fetch bookmarks
      const bookmarksQuery = db.prepare('SELECT * FROM bookmarks WHERE userId = ?');
      const bookmarksRows = bookmarksQuery.all(userId);

      // Combine history and bookmarks
      const videos = historyRows.map(row => {
        const videoBookmarks = bookmarksRows
          .filter(bm => bm.videoId === row.videoId)
          .map(bm => ({
            id: bm.id,
            time: bm.time,
            endTime: bm.endTime !== null ? bm.endTime : undefined,
            label: bm.label,
            isIntro: bm.isIntro === 1,
            isOutro: bm.isOutro === 1,
            skipEnabled: bm.skipEnabled === 1
          }));
        
        return {
          id: row.videoId,
          title: row.title,
          url: row.url || '',
          type: row.type || 'local',
          fileName: row.fileName || '',
          duration: row.duration,
          currentTime: row.currentTime,
          lastPlayedDate: row.lastPlayedDate,
          totalTimeWatched: row.totalTimeWatched,
          rating: row.rating,
          timeToFinish: row.timeToFinish,
          sessions: row.sessions ? JSON.parse(row.sessions) : [],
          localFilePath: row.localFilePath,
          playedDates: row.playedDates ? JSON.parse(row.playedDates) : [],
          format: row.format || null,
          streams: row.streams ? JSON.parse(row.streams) : [],
          audioTracks: row.audioTracks ? JSON.parse(row.audioTracks) : [],
          subtitleTracks: row.subtitleTracks ? JSON.parse(row.subtitleTracks) : [],
          bookmarks: videoBookmarks
        };
      });

      res.end(JSON.stringify({ settings, history: videos }));
    } catch (e) {
      console.error('[SQLite profile data GET error]', e.message);
      res.end(JSON.stringify({ settings: {}, history: [] }));
    }
    return;
  }

  // Migrate Local Profile to Server SQLite
  if (pathname === '/api/profile/migrate' && req.method === 'POST') {
    getJsonBody(req).then(data => {
      const name = data.name || 'Migrated Profile';
      const username = data.username;
      const password = data.password;
      const userId = `u_${Math.random().toString(36).substring(2, 11)}`;
      
      let settings = data.settings || {};
      let historyList = data.history || [];

      // Check username uniqueness if registering a new account
      if (username && data.isSignUp) {
        try {
          const existing = db.prepare('SELECT username FROM accounts WHERE username = ?').get(username);
          if (existing) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Username already taken' }));
            return;
          }
        } catch (e) {}
      }

      // Auto-migrate server's local legacy settings & history files if empty
      const legacySettingsFile = path.join(dataDir, 'settings.json');
      if (fs.existsSync(legacySettingsFile)) {
        try {
          const fileSettings = JSON.parse(fs.readFileSync(legacySettingsFile, 'utf8'));
          settings = { ...fileSettings, ...settings };
        } catch (e) {
          console.warn('Failed to migrate legacy settings file on disk:', e.message);
        }
      }
      
      const legacyHistoryFile = path.join(dataDir, 'history.json');
      if (fs.existsSync(legacyHistoryFile) && historyList.length === 0) {
        try {
          const fileHistory = JSON.parse(fs.readFileSync(legacyHistoryFile, 'utf8'));
          if (Array.isArray(fileHistory)) {
            historyList = fileHistory;
          }
        } catch (e) {
          console.warn('Failed to migrate legacy history file on disk:', e.message);
        }
      }

      try {
        if (username) {
          const existingAccount = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username);
          if (data.isSignUp) {
            if (existingAccount) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Username already taken' }));
              return;
            }
            db.prepare('INSERT INTO accounts (username, password) VALUES (?, ?)').run(username, password);
            db.prepare('INSERT INTO profiles (userId, name, username, password) VALUES (?, ?, ?, null)')
              .run(userId, name, username);
          } else if (data.isLoginAndSync) {
            if (!existingAccount) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Account not found' }));
              return;
            }
            if (existingAccount.password !== password) {
              res.statusCode = 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Incorrect account password' }));
              return;
            }
            db.prepare('INSERT INTO profiles (userId, name, username, password) VALUES (?, ?, ?, null)')
              .run(userId, name, username);
          } else if (data.isLoggedIn) {
            if (!existingAccount) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Account not found' }));
              return;
            }
            db.prepare('INSERT INTO profiles (userId, name, username, password) VALUES (?, ?, ?, ?)')
              .run(userId, name, username, password || null);
          } else {
            if (!existingAccount) {
              db.prepare('INSERT INTO accounts (username, password) VALUES (?, ?)').run(username, password || '');
            }
            db.prepare('INSERT INTO profiles (userId, name, username, password) VALUES (?, ?, ?, ?)')
              .run(userId, name, username, password || null);
          }
        } else {
          db.prepare('INSERT INTO profiles (userId, name, username, password) VALUES (?, ?, null, null)')
            .run(userId, name);
        }

        // Save settings
        const insertSettings = db.prepare('INSERT OR REPLACE INTO settings (userId, settingsJson) VALUES (?, ?)');
        insertSettings.run(userId, JSON.stringify(settings));

        // Save history & bookmarks
        const insertHistory = db.prepare(`
          INSERT OR REPLACE INTO history 
          (userId, videoId, title, url, type, fileName, duration, currentTime, lastPlayedDate, totalTimeWatched, rating, timeToFinish, sessions, localFilePath, playedDates, format, streams, audioTracks, subtitleTracks)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertBookmark = db.prepare(`
          INSERT OR REPLACE INTO bookmarks
          (userId, videoId, id, time, endTime, label, isIntro, isOutro, skipEnabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const video of historyList) {
          insertHistory.run(
            userId,
            video.id,
            video.title || 'Untitled Video',
            video.url || '',
            video.type || 'local',
            video.fileName || '',
            video.duration || null,
            video.currentTime || null,
            video.lastPlayedDate || null,
            video.totalTimeWatched || null,
            video.rating || null,
            video.timeToFinish || null,
            video.sessions ? JSON.stringify(video.sessions) : null,
            video.localFilePath || null,
            video.playedDates ? JSON.stringify(video.playedDates) : null,
            video.format || null,
            video.streams ? JSON.stringify(video.streams) : null,
            video.audioTracks ? JSON.stringify(video.audioTracks) : null,
            video.subtitleTracks ? JSON.stringify(video.subtitleTracks) : null
          );

          if (video.bookmarks && Array.isArray(video.bookmarks)) {
            for (const bm of video.bookmarks) {
              insertBookmark.run(
                userId,
                video.id,
                bm.id,
                bm.time,
                bm.endTime !== undefined ? bm.endTime : null,
                bm.label || '',
                bm.isIntro ? 1 : 0,
                bm.isOutro ? 1 : 0,
                bm.skipEnabled ? 1 : 0
              );
            }
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, userId, name }));
      } catch (e) {
        console.error('[SQLite migrate POST error]', e.message);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Trakt Token Exchange API (to bypass CORS)
  if (pathname === '/api/trakt/exchange' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    getJsonBody(req).then(data => {
      const code = data.code;
      if (!code) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing code parameter' }));
        return;
      }

      const redirectUri = data.redirect_uri || 'http://localhost:50000';
      const bodyData = JSON.stringify({
        code: code,
        client_id: 'f2926f0d87d3e789c50a3c276ab6002f5027dec31089fe75792c2836165c7289',
        client_secret: '2863090375d796f593e2f9ec37d61d44fa971c5bb11fdf0614d816d0e48c0c6d',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      const https = require('https');
      const traktReq = https.request({
        hostname: 'api.trakt.tv',
        port: 443,
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyData),
          'User-Agent': 'Valor/1.0.0',
          'trakt-api-key': 'f2926f0d87d3e789c50a3c276ab6002f5027dec31089fe75792c2836165c7289',
          'trakt-api-version': '2'
        }
      }, (traktRes) => {
        let responseString = '';
        traktRes.on('data', (chunk) => {
          responseString += chunk;
        });
        traktRes.on('end', () => {
          res.statusCode = traktRes.statusCode;
          res.end(responseString);
        });
      });

      traktReq.on('error', (err) => {
        console.error('[Trakt Exchange Error]', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      });

      traktReq.write(bodyData);
      traktReq.end();
    }).catch(err => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // Settings API
  if (pathname === '/api/settings') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const userId = parsedUrl.searchParams.get('userId');
    
    if (req.method === 'POST') {
      getJsonBody(req).then(data => {
        if (userId && userId !== 'local') {
          try {
            const insert = db.prepare('INSERT OR REPLACE INTO settings (userId, settingsJson) VALUES (?, ?)');
            insert.run(userId, JSON.stringify(data));

            // Cache/store the active user ID and username in the global settings.json file
            const settingsFile = path.join(dataDir, 'settings.json');
            let globalSettings = {};
            if (fs.existsSync(settingsFile)) {
              try { globalSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch {}
            }
            let activeUsername = '';
            try {
              const uRow = db.prepare('SELECT username FROM profiles WHERE userId = ?').get(userId);
              if (uRow) activeUsername = uRow.username || '';
            } catch {}
            
            globalSettings = {
              ...globalSettings,
              activeUserId: userId,
              activeUsername: activeUsername,
              storageMode: 'file'
            };
            fs.writeFileSync(settingsFile, JSON.stringify(globalSettings, null, 2));
          } catch (e) {
            console.error('[SQLite settings POST error]', e.message);
          }
        } else {
          const settingsFile = path.join(dataDir, 'settings.json');
          let globalSettings = data;
          if (data && data.userId === 'local') {
            globalSettings.activeUserId = 'local';
            globalSettings.activeUsername = '';
          }
          fs.writeFileSync(settingsFile, JSON.stringify(globalSettings, null, 2));
        }
        res.end(JSON.stringify({ success: true }));
      });
    } else {
      if (userId && userId !== 'local') {
        try {
          const query = db.prepare('SELECT settingsJson FROM settings WHERE userId = ?');
          const row = query.get(userId);
          res.end(row ? row.settingsJson : JSON.stringify({}));
        } catch (e) {
          console.error('[SQLite settings GET error]', e.message);
          res.end(JSON.stringify({}));
        }
      } else {
        const settingsFile = path.join(dataDir, 'settings.json');
        if (fs.existsSync(settingsFile)) {
          res.end(fs.readFileSync(settingsFile));
        } else {
          res.end(JSON.stringify({}));
        }
      }
    }
    return;
  }

  // History API
  if (pathname === '/api/history') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const userId = parsedUrl.searchParams.get('userId');

    if (req.method === 'POST') {
      getJsonBody(req).then(data => {
        if (userId && userId !== 'local') {
          try {
            // Delete existing history & bookmarks for this user first to match full sync behavior
            const deleteHistory = db.prepare('DELETE FROM history WHERE userId = ?');
            deleteHistory.run(userId);
            const deleteBookmarks = db.prepare('DELETE FROM bookmarks WHERE userId = ?');
            deleteBookmarks.run(userId);

            const insertHistory = db.prepare(`
              INSERT OR REPLACE INTO history 
              (userId, videoId, title, url, type, fileName, duration, currentTime, lastPlayedDate, totalTimeWatched, rating, timeToFinish, sessions, localFilePath, playedDates, format, streams, audioTracks, subtitleTracks)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const insertBookmark = db.prepare(`
              INSERT OR REPLACE INTO bookmarks
              (userId, videoId, id, time, endTime, label, isIntro, isOutro, skipEnabled)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            if (Array.isArray(data)) {
              const deleteVideoBookmarks = db.prepare('DELETE FROM bookmarks WHERE userId = ? AND videoId = ?');
              for (const video of data) {
                deleteVideoBookmarks.run(userId, video.id);
                insertHistory.run(
                  userId,
                  video.id,
                  video.title || 'Untitled Video',
                  video.url || '',
                  video.type || 'local',
                  video.fileName || '',
                  video.duration || null,
                  video.currentTime || null,
                  video.lastPlayedDate || null,
                  video.totalTimeWatched || null,
                  video.rating || null,
                  video.timeToFinish || null,
                  video.sessions ? JSON.stringify(video.sessions) : null,
                  video.localFilePath || null,
                  video.playedDates ? JSON.stringify(video.playedDates) : null,
                  video.format || null,
                  video.streams ? JSON.stringify(video.streams) : null,
                  video.audioTracks ? JSON.stringify(video.audioTracks) : null,
                  video.subtitleTracks ? JSON.stringify(video.subtitleTracks) : null
                );

                if (video.bookmarks && Array.isArray(video.bookmarks)) {
                  for (const bm of video.bookmarks) {
                    insertBookmark.run(
                      userId,
                      video.id,
                      bm.id,
                      bm.time,
                      bm.endTime !== undefined ? bm.endTime : null,
                      bm.label || '',
                      bm.isIntro ? 1 : 0,
                      bm.isOutro ? 1 : 0,
                      bm.skipEnabled ? 1 : 0
                    );
                  }
                }
              }
            }
          } catch (e) {
            console.error('[SQLite history POST error]', e.message);
          }
        } else {
          const historyFile = path.join(dataDir, 'history.json');
          fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
        }
        res.end(JSON.stringify({ success: true }));
      });
    } else {
      if (userId && userId !== 'local') {
        try {
          const historyQuery = db.prepare('SELECT * FROM history WHERE userId = ?');
          const historyRows = historyQuery.all(userId);

          const bookmarksQuery = db.prepare('SELECT * FROM bookmarks WHERE userId = ?');
          const bookmarksRows = bookmarksQuery.all(userId);

          const videos = historyRows.map(row => {
            const videoBookmarks = bookmarksRows
              .filter(bm => bm.videoId === row.videoId)
              .map(bm => ({
                id: bm.id,
                time: bm.time,
                endTime: bm.endTime !== null ? bm.endTime : undefined,
                label: bm.label,
                isIntro: bm.isIntro === 1,
                isOutro: bm.isOutro === 1,
                skipEnabled: bm.skipEnabled === 1
              }));

            return {
              id: row.videoId,
              title: row.title,
              url: row.url || '',
              type: row.type || 'local',
              fileName: row.fileName || '',
              duration: row.duration,
              currentTime: row.currentTime,
              lastPlayedDate: row.lastPlayedDate,
              totalTimeWatched: row.totalTimeWatched,
              rating: row.rating,
              timeToFinish: row.timeToFinish,
              sessions: row.sessions ? JSON.parse(row.sessions) : [],
              localFilePath: row.localFilePath,
              playedDates: row.playedDates ? JSON.parse(row.playedDates) : [],
              format: row.format || null,
              streams: row.streams ? JSON.parse(row.streams) : [],
              audioTracks: row.audioTracks ? JSON.parse(row.audioTracks) : [],
              subtitleTracks: row.subtitleTracks ? JSON.parse(row.subtitleTracks) : [],
              bookmarks: videoBookmarks
            };
          });
          res.end(JSON.stringify(videos));
        } catch (e) {
          console.error('[SQLite history GET error]', e.message);
          res.end(JSON.stringify([]));
        }
      } else {
        const historyFile = path.join(dataDir, 'history.json');
        if (fs.existsSync(historyFile)) {
          res.end(fs.readFileSync(historyFile));
        } else {
          res.end(JSON.stringify([]));
        }
      }
    }
    return;
  }

  // Video streaming endpoint with range request support
  if (pathname === '/local-video-stream') {
    const videoPath = parsedUrl.searchParams.get('path');
    if (!videoPath || !fs.existsSync(videoPath)) {
      res.statusCode = 404;
      res.end('File not found');
      return;
    }

    let connectionTracked = false;
    let fileStream = null;

    const trackStart = () => {
      if (!connectionTracked) {
        activeConnections++;
        connectionTracked = true;
        console.log(`[Server] Active video stream connection started. Total active: ${activeConnections}`);
      }
    };
    const trackEnd = () => {
      if (connectionTracked) {
        activeConnections = Math.max(0, activeConnections - 1);
        connectionTracked = false;
        console.log(`[Server] Active video stream connection ended. Total active: ${activeConnections}`);
      }
    };

    const cleanUp = () => {
      trackEnd();
      if (fileStream) {
        fileStream.destroy();
        fileStream = null;
      }
    };

    req.on('close', cleanUp);
    res.on('close', cleanUp);
    res.on('finish', cleanUp);
    req.on('error', (err) => {
      console.error('[Server Request Error]', err.message);
    });

    trackStart();

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');

    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Length': fileSize });
      res.end();
      return;
    }

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      fileStream = fs.createReadStream(videoPath, { start, end });
      fileStream.on('error', (err) => {
        console.error('[Server Stream Error]', err.message);
      });
      res.on('error', (err) => {
        console.error('[Server Response Error]', err.message);
      });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize,
      };
      res.writeHead(206, head);
      fileStream.pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': fileSize });
      fileStream = fs.createReadStream(videoPath);
      fileStream.on('error', (err) => {
        console.error('[Server Stream Error]', err.message);
      });
      res.on('error', (err) => {
        console.error('[Server Response Error]', err.message);
      });
      fileStream.pipe(res);
    }
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
});

// 2. Service Static Server (Port 50000)
const serviceServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT_SERVICE}`);
  let pathname = parsedUrl.pathname;

  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(distDir, safePath);

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (e) {
    filePath = path.join(distDir, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('File not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.end(data);
  });
});

// Auto-shutdown if no active tabs (1-minute grace period under all conditions)
const startShutdownChecker = () => {
  if (trayMode) {
    console.log('[Server] Running in tray mode. Auto-shutdown checker disabled.');
    return;
  }
  setInterval(() => {
    if (activeConnections > 0) {
      lastHeartbeat = Date.now();
    }
    const limit = 60000; // 1 minute
    if (Date.now() - lastHeartbeat > limit) {
      console.log('[Server] No active tabs detected. Shutting down...');
      try { serviceServer.close(); } catch (e) {}
      backendServer.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 1000);
    }
  }, 2000);
};

const attemptListen = () => {
  const startBackend = () => {
    backendServer.listen({ port: PORT_BACKEND, host: '127.0.0.1' }, () => {
      console.log(`[Server] Valor backend server is running on http://127.0.0.1:${PORT_BACKEND}`);
      
      if (!backendOnly) {
        // Write active port to active_port.txt
        try {
          const activePortFile = path.join(dataDir, 'active_port.txt');
          fs.writeFileSync(activePortFile, String(PORT_SERVICE));
        } catch (e) {
          console.error('[Server] Failed to write active_port.txt:', e);
        }

        const openUrl = resolvedFilePath 
          ? `http://127.0.0.1:${PORT_SERVICE}/?file=${encodeURIComponent(resolvedFilePath)}`
          : `http://127.0.0.1:${PORT_SERVICE}/`;
          
        console.log(`[Server] Opening browser: ${openUrl}`);
        
        if (process.platform === 'win32') {
          spawn('cmd', ['/c', 'start', '', openUrl], { detached: true }).unref();
        } else if (process.platform === 'darwin') {
          spawn('open', [openUrl], { detached: true }).unref();
        } else {
          spawn('xdg-open', [openUrl], { detached: true }).unref();
        }
      }

      startShutdownChecker();
    });
  };

  if (!backendOnly) {
    serviceServer.listen({ port: PORT_SERVICE, host: '127.0.0.1' }, () => {
      console.log(`[Server] Valor service server is running on http://127.0.0.1:${PORT_SERVICE}`);
      if (!frontendOnly) {
        startBackend();
      }
    });
  } else if (!frontendOnly) {
    startBackend();
  }
};

serviceServer.on('error', (err) => {
  console.error('[Server Fatal Service Error]', err);
  process.exit(1);
});

backendServer.on('error', (err) => {
  console.error('[Server Fatal Backend Error]', err);
  process.exit(1);
});

// Startup check: reuse existing running server if present
let checkingExisting = false;
const activePortFile = path.join(dataDir, 'active_port.txt');
if (fs.existsSync(activePortFile)) {
  try {
    const savedPort = parseInt(fs.readFileSync(activePortFile, 'utf8').trim(), 10);
    if (savedPort && !isNaN(savedPort)) {
      checkingExisting = true;
      console.log(`[Server] Checking for running backend instance on port ${PORT_BACKEND}...`);
      
      const options = {
        host: '127.0.0.1',
        port: PORT_BACKEND,
        path: '/api/heartbeat',
        method: 'POST',
        timeout: 1000
      };
      
      const clientReq = http.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log(`[Server] Found running instance on port ${PORT_BACKEND}. Forwarding play command...`);
          const playPath = resolvedFilePath 
            ? `/api/play?file=${encodeURIComponent(resolvedFilePath)}`
            : '/api/play';
            
          const playReq = http.request({
            host: '127.0.0.1',
            port: PORT_BACKEND,
            path: playPath,
            method: 'GET',
            timeout: 1000
          }, () => {
            console.log('[Server] Command successfully forwarded. Exiting.');
            process.exit(0);
          });
          playReq.on('error', () => {
            process.exit(0);
          });
          playReq.end();
        } else {
          attemptListen();
        }
      });
      
      clientReq.on('error', () => {
        attemptListen();
      });
      clientReq.on('timeout', () => {
        clientReq.destroy();
        attemptListen();
      });
      clientReq.end();
    }
  } catch (e) {
    console.error('[Server] Port check error:', e.message);
    attemptListen();
  }
} else {
  attemptListen();
}
