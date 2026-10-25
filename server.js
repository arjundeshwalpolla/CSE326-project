const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
// Change these before using the project outside a classroom demo.
const ADMIN_ID = process.env.ADMIN_ID || "campusadmin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "FitAdmin@2026";
const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_DIR = __dirname;

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ bookings: [], equipment: [] }, null, 2));
}
const sessions = new Map();

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { bookings: [], equipment: [] }; }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}
function sessionFor(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)campusfit_session=([a-f0-9]+)/);
  return match ? sessions.get(match[1]) : null;
}
function adminOnly(req, res) {
  const session = sessionFor(req);
  if (!session || session.role !== "admin") {
    send(res, 401, { error: "Admin login required." });
    return false;
  }
  return true;
}
function serveStatic(req, res, pathname) {
  const route = pathname === "/" ? "/index.html" : pathname;
  const full = path.resolve(PUBLIC_DIR, "." + route);
  if (!full.startsWith(path.resolve(PUBLIC_DIR) + path.sep)) {
    return send(res, 403, { error: "Forbidden" });
  }
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const ext = path.extname(full);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
    send(res, 200, data.toString("utf8"), types[ext] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;

  try {
    if (req.method === "POST" && route === "/api/admin/login") {
      const body = await readBody(req);
      if (body.id !== ADMIN_ID || body.password !== ADMIN_PASSWORD) {
        return send(res, 401, { error: "Incorrect admin ID or password." });
      }
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { role: "admin", created: Date.now() });
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `campusfit_session=${token}; HttpOnly; SameSite=Strict; Path=/`,
        "Cache-Control": "no-store"
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (req.method === "POST" && route === "/api/admin/logout") {
      const cookie = req.headers.cookie || "";
      const match = cookie.match(/(?:^|;\s*)campusfit_session=([a-f0-9]+)/);
      if (match) sessions.delete(match[1]);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": "campusfit_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        "Cache-Control": "no-store"
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (req.method === "GET" && route === "/api/admin/me") {
      return send(res, 200, { isAdmin: !!(sessionFor(req) && sessionFor(req).role === "admin") });
    }

    if (req.method === "GET" && route === "/api/bookings") {
      const data = readData();
      // Students can see only the public facility/slot availability, not other students' details.
      const publicSlots = data.bookings.map(b => ({ facility: b.facility, date: b.date, slot: b.slot }));
      return send(res, 200, { bookings: publicSlots });
    }

    if (req.method === "POST" && route === "/api/bookings") {
      const body = await readBody(req);
      const name = String(body.name || "").trim().slice(0, 100);
      const roll = String(body.roll || "").trim().slice(0, 50);
      const facility = String(body.facility || "").trim().slice(0, 80);
      const date = String(body.date || "").trim();
      const slot = String(body.slot || "").trim().slice(0, 60);
      const allowedFacilities = ["Cardio Gym", "Weight Training", "Badminton Court", "Table Tennis Room", "Basketball Court"];
      const allowedSlots = [
        "6:00 AM - 6:45 AM", "6:45 AM - 7:30 AM", "7:30 AM - 8:15 AM",
        "8:15 AM - 9:00 AM", "4:00 PM - 4:45 PM", "4:45 PM - 5:30 PM",
        "5:30 PM - 6:15 PM", "6:15 PM - 7:00 PM", "7:15 PM - 8:00 PM"
      ];
      if (!name || !roll || !allowedFacilities.includes(facility) || !date || !allowedSlots.includes(slot)) {
        return send(res, 400, { error: "Please complete all booking fields correctly." });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < new Date().toLocaleDateString("en-CA")) {
        // Also validate date shape; browser date minimum provides the normal UX.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: "Invalid date." });
      }
      const data = readData();
      const capacity = facility.includes("Badminton") ? 4 :
        facility.includes("Table Tennis") ? 6 :
        facility.includes("Gym") ? 12 : 10;
      const used = data.bookings.filter(b => b.facility === facility && b.date === date && b.slot === slot).length;
      if (used >= capacity) return send(res, 409, { error: "This time slot is full. Please select another." });
      if (data.bookings.some(b => b.roll.toLowerCase() === roll.toLowerCase() && b.date === date && b.slot === slot)) {
        return send(res, 409, { error: "This roll number already has a booking for that date and slot." });
      }
      const booking = {
        id: "CF-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
        name, roll, facility, date, slot,
        createdAt: new Date().toISOString()
      };
      data.bookings.push(booking);
      writeData(data);
      return send(res, 201, { ok: true, booking });
    }

    if (req.method === "GET" && route === "/api/admin/bookings") {
      if (!adminOnly(req, res)) return;
      const data = readData();
      return send(res, 200, { bookings: data.bookings });
    }

    if (req.method === "DELETE" && route.startsWith("/api/admin/bookings/")) {
      if (!adminOnly(req, res)) return;
      const id = decodeURIComponent(route.split("/").pop());
      const data = readData();
      const before = data.bookings.length;
      data.bookings = data.bookings.filter(b => b.id !== id);
      writeData(data);
      return send(res, before === data.bookings.length ? 404 : 200, { ok: before !== data.bookings.length });
    }

    if (req.method === "GET" && route === "/api/admin/equipment") {
      if (!adminOnly(req, res)) return;
      return send(res, 200, { equipment: readData().equipment });
    }

    if (req.method === "POST" && route === "/api/equipment") {
      const body = await readBody(req);
      const roll = String(body.roll || "").trim().slice(0, 50);
      const item = String(body.item || "").trim().slice(0, 80);
      const due = String(body.due || "").trim();
      if (!roll || !["Badminton Racket", "Basketball", "Table Tennis Bat"].includes(item) || !due || !Number.isFinite(Date.parse(due))) {
        return send(res, 400, { error: "Please provide valid equipment details." });
      }
      const data = readData();
      const record = { id: "EQ-" + crypto.randomBytes(3).toString("hex").toUpperCase(), roll, item, due, returned: false, createdAt: new Date().toISOString() };
      data.equipment.push(record);
      writeData(data);
      return send(res, 201, { ok: true, record });
    }

    if (req.method === "POST" && route.startsWith("/api/admin/equipment/") && route.endsWith("/return")) {
      if (!adminOnly(req, res)) return;
      const id = decodeURIComponent(route.split("/")[4]);
      const data = readData();
      const record = data.equipment.find(e => e.id === id);
      if (!record) return send(res, 404, { error: "Equipment record not found." });
      record.returned = true;
      record.returnedAt = new Date().toISOString();
      writeData(data);
      return send(res, 200, { ok: true });
    }

    return serveStatic(req, res, route);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "Server error. Please try again." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CampusFit running at http://localhost:${PORT}`);
  console.log(`Admin ID: ${ADMIN_ID}`);
  console.log("Set ADMIN_ID and ADMIN_PASSWORD environment variables to change credentials.");
});
