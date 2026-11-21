import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as store from './server/store';

export const app = express();
const PORT = 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers (preserve iframe embedding compatibility for AI Studio preview)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

// Block direct HTTP access to server code, database files, supabase schema, env, config, and source maps
app.use((req, res, next) => {
  let decodedPath = req.path;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    res.status(400).end();
    return;
  }
  const lower = decodedPath.toLowerCase();

  const blockedExactOrPrefix = [
    '/server.ts',
    '/server/',
    '/data/',
    '/supabase',
    '/supabase/',
    '/.env',
    '/package.json',
    '/package-lock.json',
    '/tsconfig.json',
    '/vite.config.ts',
    '/metadata.json',
    '/vercel.json',
    '/api/index.ts',
    '/.git',
    '/.aistudio',
  ];

  const isBlockedPrefix = blockedExactOrPrefix.some(
    (p) => lower === p || lower.startsWith(p)
  );
  const isBlockedExt =
    lower.endsWith('.db') ||
    lower.endsWith('.db-wal') ||
    lower.endsWith('.db-shm') ||
    lower.endsWith('.sqlite') ||
    lower.endsWith('.sql') ||
    lower.endsWith('.map');

  const isProdSourceLeak =
    process.env.NODE_ENV === 'production' &&
    (lower.startsWith('/node_modules/') ||
      (lower.startsWith('/src/') && !lower.startsWith('/src/assets/')));

  if (isBlockedPrefix || isBlockedExt || isProdSourceLeak) {
    res.status(404).json({ error: 'Ressource introuvable.' });
    return;
  }

  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Wrap async Express 4 routes so rejected promises pass cleanly to global error handler
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Simple sliding-window in-memory rate limiter
function createRateLimiter(maxHits: number, windowMs: number, message: string) {
  const buckets = new Map<string, number[]>();
  const timer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of buckets.entries()) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) buckets.delete(key);
      else buckets.set(key, fresh);
    }
  }, Math.min(windowMs, 5 * 60 * 1000));
  timer.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (buckets.get(ip) || []).filter((t) => t > cutoff);
    if (hits.length >= maxHits) {
      res.status(429).json({ error: message });
      return;
    }
    hits.push(now);
    buckets.set(ip, hits);
    next();
  };
}

// Track failed admin login attempts per IP (lock after 6 failures for 15 minutes)
const failedLogins = new Map<string, { count: number; resetAt: number }>();
function checkLoginLock(ip: string): boolean {
  const entry = failedLogins.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedLogins.delete(ip);
    return false;
  }
  return entry.count >= 6;
}
function recordFailedLogin(ip: string) {
  const now = Date.now();
  const entry = failedLogins.get(ip);
  if (!entry || now > entry.resetAt) {
    failedLogins.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}
function clearFailedLogin(ip: string) {
  failedLogins.delete(ip);
}

const publicWriteLimiter = createRateLimiter(
  20,
  10 * 60 * 1000,
  'Trop de requêtes effectuées. Veuillez patienter quelques minutes.'
);

function cleanStr(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^[+\d\s().-]{8,25}$/.test(phone);
}

const ALLOWED_WATCH_TYPES = new Set([
  'Montre classique',
  'Montre automatique',
  'Montre connectée',
  'Autre',
]);

const ALLOWED_SETTING_KEYS = new Set([
  'brand_name',
  'logo_url',
  'hero_image',
  'hero_slogan',
  'hero_subtitle',
  'repair_title',
  'repair_description',
  'repair_banner_image',
  'about_title',
  'about_text',
  'phone',
  'email',
  'address',
  'google_maps_url',
  'instagram_url',
  'facebook_url',
  'whatsapp_number',
  'currency',
  'delivery_fee',
  'free_delivery_threshold',
]);

// Local uploads directory served only as fallback when Supabase is not configured
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!store.isSupabaseConfigured && !process.env.VERCEL) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      next();
    },
    express.static(UPLOADS_DIR)
  );
}

// Also serve src/assets/images statically in case Vite middleware doesn't catch something
app.use(
  '/src/assets/images',
  express.static(path.resolve(process.cwd(), 'src/assets/images'), { maxAge: '7d' })
);

const ALLOWED_IMAGE_MIMES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Memory storage so uploaded images go straight to Supabase Storage without local disk bloat
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Format non autorisé. Utilisez uniquement JPG, PNG ou WebP.'));
    }
  },
});

interface AuthenticatedRequest extends Request {
  admin?: { id: number; username: string; full_name: string; role: string };
  authToken?: string;
}

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }

    const session = await store.getAdminSession(token);
    if (!session) {
      res.status(401).json({ error: 'Session expirée ou invalide.' });
      return;
    }

    req.admin = session.admin;
    req.authToken = session.token;
    next();
  } catch (err) {
    next(err);
  }
}

// ==================== PUBLIC ROUTES ====================

const PUBLIC_CATALOG_CACHE = 'public, max-age=30, s-maxage=120, stale-while-revalidate=300';

app.get(
  '/api/settings',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', PUBLIC_CATALOG_CACHE);
    res.json(await store.getSettings());
  })
);

app.get(
  '/api/categories',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', PUBLIC_CATALOG_CACHE);
    res.json(await store.getCategories());
  })
);

app.get(
  '/api/products',
  asyncHandler(async (req, res) => {
    const { category, search, inStock, minPrice, maxPrice, bestseller, isNew, sort } = req.query;

    const products = await store.getPublicProducts({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      inStock: inStock === 'true',
      minPrice: minPrice !== undefined && minPrice !== '' ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : undefined,
      bestseller: bestseller === 'true',
      isNew: isNew === 'true',
      sort: sort ? String(sort) : undefined,
    });

    res.setHeader('Cache-Control', PUBLIC_CATALOG_CACHE);
    res.json(products);
  })
);

app.get(
  '/api/products/:slug',
  asyncHandler(async (req, res) => {
    const data = await store.getPublicProductBySlug(String(req.params.slug || ''));
    if (!data) {
      res.status(404).json({ error: 'Produit introuvable.' });
      return;
    }
    res.setHeader('Cache-Control', PUBLIC_CATALOG_CACHE);
    res.json(data);
  })
);

app.post(
  '/api/orders',
  publicWriteLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const customer_name = cleanStr(body.customer_name, 120);
    const customer_phone = cleanStr(body.customer_phone, 30);
    const customer_email = cleanStr(body.customer_email, 120);
    const address = cleanStr(body.address, 250);
    const city = cleanStr(body.city, 80);
    const region = cleanStr(body.region, 80);
    const notes = cleanStr(body.notes, 500);
    const items = body.items;

    if (!customer_name || !customer_phone || !address || !city || !region) {
      res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires de livraison.' });
      return;
    }

    if (!isValidPhone(customer_phone)) {
      res.status(400).json({ error: 'Veuillez saisir un numéro de téléphone valide.' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
      res.status(400).json({ error: 'Votre panier est invalide ou vide.' });
      return;
    }

    const parsedItems: Array<{ product_id: number; quantity: number }> = [];
    for (const item of items) {
      const productId = Number(item?.product_id);
      const qty = Math.floor(Number(item?.quantity));
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        res.status(400).json({ error: 'Quantité ou article invalide.' });
        return;
      }
      parsedItems.push({ product_id: productId, quantity: qty });
    }

    try {
      const result = await store.createOrder({
        customer_name,
        customer_phone,
        customer_email,
        address,
        city,
        region,
        notes,
        items: parsedItems,
      });
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Erreur lors de la création de la commande.' });
    }
  })
);

app.get(
  '/api/appointments/availability',
  asyncHandler(async (req, res) => {
    const dateStr = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ error: 'Format de date invalide (YYYY-MM-DD).' });
      return;
    }
    res.json(await store.getDayAvailability(dateStr));
  })
);

app.get(
  '/api/appointments/month-availability',
  asyncHandler(async (req, res) => {
    const monthStr = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      res.status(400).json({ error: 'Format de mois invalide (YYYY-MM).' });
      return;
    }
    res.json(await store.getMonthAvailability(monthStr));
  })
);

app.post(
  '/api/appointments',
  publicWriteLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const customer_name = cleanStr(body.customer_name, 120);
    const customer_phone = cleanStr(body.customer_phone, 30);
    const watch_type = cleanStr(body.watch_type, 60);
    const problem_description = cleanStr(body.problem_description, 600);
    const appointment_date = cleanStr(body.appointment_date, 10);
    const appointment_time = cleanStr(body.appointment_time, 5);

    if (
      !customer_name ||
      !customer_phone ||
      !watch_type ||
      !appointment_date ||
      !appointment_time
    ) {
      res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires du rendez-vous.' });
      return;
    }

    if (!isValidPhone(customer_phone)) {
      res.status(400).json({ error: 'Veuillez saisir un numéro de téléphone valide.' });
      return;
    }

    if (!ALLOWED_WATCH_TYPES.has(watch_type)) {
      res.status(400).json({ error: 'Type de montre invalide.' });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) || !/^\d{2}:\d{2}$/.test(appointment_time)) {
      res.status(400).json({ error: 'Format de date ou horaire invalide.' });
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (appointment_date < todayStr) {
      res.status(400).json({ error: 'Impossible de réserver une date passée.' });
      return;
    }

    try {
      const appointment = await store.createPublicAppointment({
        customer_name,
        customer_phone,
        watch_type,
        problem_description,
        appointment_date,
        appointment_time,
      });
      res.status(201).json(appointment);
    } catch (err: any) {
      if (err.message === 'SLOT_TAKEN' || String(err.message).includes('UNIQUE constraint')) {
        res.status(409).json({
          error: "Ce créneau horaire vient d'être réservé. Veuillez choisir un autre horaire.",
        });
        return;
      }
      res.status(400).json({ error: err.message || 'Erreur lors de la réservation.' });
    }
  })
);

// ==================== ADMIN AUTH ====================

app.post(
  '/api/admin/login',
  asyncHandler(async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (checkLoginLock(ip)) {
      res.status(429).json({
        error: 'Trop de tentatives échouées. Veuillez réessayer dans 15 minutes.',
      });
      return;
    }

    const { username, password } = req.body || {};
    const cleanUser = cleanStr(username, 60);
    const cleanPass = typeof password === 'string' ? password : '';

    if (!cleanUser || !cleanPass) {
      res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
      return;
    }

    const loginResult = await store.loginAdmin(cleanUser, cleanPass);
    if (!loginResult) {
      recordFailedLogin(ip);
      res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
      return;
    }

    clearFailedLogin(ip);
    res.json(loginResult);
  })
);

app.post(
  '/api/admin/logout',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (req.authToken) {
      await store.logoutAdmin(req.authToken);
    }
    res.json({ ok: true });
  })
);

app.get('/api/admin/me', requireAdmin, (req: AuthenticatedRequest, res) => {
  res.json({ admin: req.admin });
});

app.post(
  '/api/admin/change-password',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string') {
      res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
      return;
    }
    if (new_password.length < 8 || new_password.length > 128) {
      res.status(400).json({
        error: 'Le nouveau mot de passe doit contenir entre 8 et 128 caractères.',
      });
      return;
    }

    const outcome = await store.changeAdminPassword(
      req.admin!.id,
      req.authToken || '',
      current_password,
      new_password
    );
    if (outcome === 'bad_password') {
      res.status(401).json({ error: 'Le mot de passe actuel est incorrect.' });
      return;
    }

    res.json({ ok: true });
  })
);

// ==================== ADMIN PROTECTED ROUTES ====================

app.post(
  '/api/admin/upload',
  requireAdmin,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier reçu.' });
      return;
    }
    const url = await store.uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    res.json({ url });
  })
);

app.get(
  '/api/admin/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawPeriod = String(req.query.period || 'month');
    const period: 'today' | 'week' | 'month' =
      rawPeriod === 'today' || rawPeriod === 'week' ? rawPeriod : 'month';
    res.json(await store.getAdminStats(period));
  })
);

// Admin Products CRUD
app.get(
  '/api/admin/products',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await store.getAdminProducts());
  })
);

app.post(
  '/api/admin/products',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    if (!body.name?.trim() || !body.category_id || body.price === undefined || Number(body.price) < 0) {
      res.status(400).json({ error: 'Nom, catégorie et prix valide requis.' });
      return;
    }
    const created = await store.createProduct(body);
    res.status(201).json(created);
  })
);

app.put(
  '/api/admin/products/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Identifiant produit invalide.' });
      return;
    }
    const updated = await store.updateProduct(id, req.body || {});
    if (!updated) {
      res.status(404).json({ error: 'Produit introuvable.' });
      return;
    }
    res.json(updated);
  })
);

app.delete(
  '/api/admin/products/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Identifiant produit invalide.' });
      return;
    }
    const deleted = await store.deleteProduct(id);
    if (!deleted) {
      res.status(404).json({ error: 'Produit introuvable.' });
      return;
    }
    res.json({ ok: true });
  })
);

// Admin Categories
app.post(
  '/api/admin/categories',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, description = '' } = req.body || {};
    if (!name?.trim()) {
      res.status(400).json({ error: 'Nom de catégorie requis.' });
      return;
    }
    try {
      const created = await store.createCategory(String(name), String(description || ''));
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Cette catégorie existe déjà.' });
    }
  })
);

// Admin Orders
app.get(
  '/api/admin/orders',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const orders = await store.getAdminOrders({
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json(orders);
  })
);

app.patch(
  '/api/admin/orders/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const allowed = ['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: 'Statut invalide.' });
      return;
    }
    const updatedOrder = await store.updateOrderStatus(id, status);
    if (!updatedOrder) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }
    res.json(updatedOrder);
  })
);

app.post(
  '/api/admin/orders/bulk-delete',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawIds = req.body?.ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 200) {
      res.status(400).json({ error: 'Veuillez sélectionner au moins une commande valide.' });
      return;
    }
    const deletedCount = await store.deleteAdminOrders(rawIds);
    res.json({ ok: true, deletedCount });
  })
);

app.delete(
  '/api/admin/orders/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Identifiant commande invalide.' });
      return;
    }
    const deletedCount = await store.deleteAdminOrders([id]);
    if (deletedCount === 0) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }
    res.json({ ok: true, deletedCount });
  })
);

// Admin Appointments & Availability
app.get(
  '/api/admin/appointments',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { date, status } = req.query;
    const rows = await store.getAdminAppointments({
      date: date ? String(date) : undefined,
      status: status ? String(status) : undefined,
    });
    res.json(rows);
  })
);

app.post(
  '/api/admin/appointments',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const {
      customer_name,
      customer_phone,
      watch_type = 'Montre classique',
      problem_description = '',
      appointment_date,
      appointment_time,
      status = 'confirme',
      admin_notes = '',
    } = req.body || {};

    if (!customer_name?.trim() || !customer_phone?.trim() || !appointment_date || !appointment_time) {
      res.status(400).json({ error: 'Champs obligatoires manquants.' });
      return;
    }

    try {
      const created = await store.createAdminAppointment({
        customer_name: String(customer_name).trim(),
        customer_phone: String(customer_phone).trim(),
        watch_type: String(watch_type).trim(),
        problem_description: String(problem_description).trim(),
        appointment_date: String(appointment_date),
        appointment_time: String(appointment_time),
        status: String(status),
        admin_notes: String(admin_notes).trim(),
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(409).json({ error: err.message });
    }
  })
);

app.patch(
  '/api/admin/appointments/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await store.updateAdminAppointment(id, req.body || {});
    if (result.notFound) {
      res.status(404).json({ error: 'Rendez-vous introuvable.' });
      return;
    }
    if (result.conflict) {
      res.status(409).json({ error: 'Ce créneau est déjà réservé par un autre rendez-vous.' });
      return;
    }
    res.json(result.appointment);
  })
);

app.get(
  '/api/admin/availability',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await store.getAdminAvailability());
  })
);

app.put(
  '/api/admin/availability/schedule',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { schedules } = req.body || {};
    if (!Array.isArray(schedules)) {
      res.status(400).json({ error: 'Données de planning invalides.' });
      return;
    }
    await store.updateAvailabilitySchedule(schedules);
    res.json({ ok: true });
  })
);

app.post(
  '/api/admin/availability/block',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { specific_date, start_time = null, reason = 'Indisponible' } = req.body || {};
    if (!specific_date) {
      res.status(400).json({ error: 'Date requise.' });
      return;
    }
    const created = await store.blockAvailabilitySlot({
      specific_date: String(specific_date),
      start_time: start_time ? String(start_time) : null,
      reason: String(reason).trim(),
    });
    res.status(201).json(created);
  })
);

app.delete(
  '/api/admin/availability/block/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await store.unblockAvailabilitySlot(Number(req.params.id));
    res.json({ ok: true });
  })
);

// Admin Settings
app.put(
  '/api/admin/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawUpdates = req.body || {};
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawUpdates)) {
      if (ALLOWED_SETTING_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number')) {
        sanitized[k] = String(v).slice(0, 2000);
      }
    }
    res.json(await store.updateSettings(sanitized));
  })
);

// Unknown API endpoints return JSON 404 rather than SPA index.html
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint API introuvable.' });
});

let initPromise: Promise<void> | null = null;
export async function ensureAppReady() {
  if (!initPromise) {
    initPromise = store.initStore();
  }
  await initPromise;
}

// ==================== VITE / STATIC SERVING ====================

async function startServer() {
  await ensureAppReady();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Serve SPA entry HTML for client routes (/admin, /boutique, etc.) before vite.middlewares
    // so Vite's internal 404 handler cannot reject requests with non-standard Accept headers.
    app.get('*', async (req, res, next) => {
      const p = req.path;
      if (
        p.startsWith('/api/') ||
        p.startsWith('/src/') ||
        p.startsWith('/node_modules/') ||
        p.startsWith('/@') ||
        p.startsWith('/uploads/') ||
        path.extname(p)
      ) {
        next();
        return;
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        dotfiles: 'ignore',
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Global error handler — never expose internal stack traces or database errors
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: 'Fichier trop volumineux (max 8 Mo) ou invalide.' });
      return;
    }
    if (err?.message && typeof err.message === 'string' && err.message.includes('Format non autorisé')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Une erreur serveur est survenue.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Horlogerie Zeina server running on http://0.0.0.0:${PORT} (${
        store.isSupabaseConfigured ? 'Supabase PostgreSQL & Storage' : 'SQLite local fallback'
      })`
    );
  });
}

// On Vercel, error middleware must also be attached cleanly for serverless API invocations
if (process.env.VERCEL) {
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: 'Fichier trop volumineux (max 8 Mo) ou invalide.' });
      return;
    }
    if (err?.message && typeof err.message === 'string' && err.message.includes('Format non autorisé')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Une erreur serveur est survenue.' });
  });
} else {
  startServer();
}
