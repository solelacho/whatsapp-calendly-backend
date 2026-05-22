// server.js — Backend proxy para Calendly + WhatsApp × Calendly App
// Deploy en Railway, Render, o Fly.io (gratis)

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { GoogleGenerativeAI } from "@google/generative-ai";


const app = express();

// ── Variables de entorno (configurar en el panel del hosting) ──
const CALENDLY_TOKEN = process.env.CALENDLY_TOKEN;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; // ej: "https://tuapp.vercel.app"
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const PORT = process.env.PORT || 3000;

// ── Middlewares ──
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// ── Helper: llamar a Calendly ──
async function calendlyFetch(path) {
  const res = await fetch(`https://api.calendly.com${path}`, {
    headers: {
      Authorization: `Bearer ${CALENDLY_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendly ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Rutas ──

// GET /api/me — Info del usuario
app.get("/api/me", async (req, res) => {
  try {
    const data = await calendlyFetch("/users/me");
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/event-types — Tipos de evento del usuario
app.get("/api/event-types", async (req, res) => {
  try {
    const me = await calendlyFetch("/users/me");
    const userUri = me.resource.uri;
    const data = await calendlyFetch(`/event_types?user=${encodeURIComponent(userUri)}&count=20`);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/events — Eventos agendados (±30 días)
app.get("/api/events", async (req, res) => {
  try {
    const me = await calendlyFetch("/users/me");
    const userUri = me.resource.uri;
    const now = new Date();
    const past = new Date(now); past.setDate(past.getDate() - 30);
    const future = new Date(now); future.setDate(future.getDate() + 30);
    const data = await calendlyFetch(
      `/scheduled_events?user=${encodeURIComponent(userUri)}&count=50` +
      `&min_start_time=${past.toISOString()}&max_start_time=${future.toISOString()}` +
      `&sort=start_time:asc`
    );
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/availability?event_type_uuid=xxx&start=...&end=... — Disponibilidad
app.get("/api/availability", async (req, res) => {
  try {
    const { event_type_uuid, start, end } = req.query;
    if (!event_type_uuid || !start || !end) {
      return res.status(400).json({ error: "Faltan parámetros: event_type_uuid, start, end" });
    }
    const data = await calendlyFetch(
      `/event_type_available_times?event_type=${encodeURIComponent(event_type_uuid)}` +
      `&start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`
    );
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get("/", (req, res) => res.json({ status: "ok", service: "WhatsApp × Calendly Backend" }));

const VERIFY_TOKEN = "sole1230";

// Verificación de webhook (Meta WhatsApp)
app.get("/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado ✅");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook/whatsapp", (req, res) => {
 // console.log(req.body)
  console.log(JSON.stringify(req.body, null, 2))
  res.sendStatus(200)
})

app.post("/test-post", (req, res) => {
  console.log("🔥 TEST POST RECIBIDO");
  console.log(JSON.stringify(req.body, null, 2));

  res.json({
    ok: true,
    received: req.body
  });
});

app.get("/test-ai", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.0-pro",
    });

    const result = await model.generateContent(
      "Decí hola como un asistente espiritual amable"
    );

    const response = await result.response;
    const text = response.text();

    res.json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server corriendo en puerto ${PORT}`));
