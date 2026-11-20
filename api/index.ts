import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';

function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  }
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL || '');
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_BUCKET = (process.env.SUPABASE_STORAGE_BUCKET || 'horlogerie-zeina').trim();
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

// Preserve pre-parsed JSON body if serverless runtime already drained request stream
app.use((req, _res, next) => {
  if (
    req.readableEnded &&
    req.headers['content-type']?.includes('application/json') &&
    (req as any).body !== undefined
  ) {
    (req as any)._body = true;
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const ALLOWED_IMAGE_MIMES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Format non autorisé. Utilisez uniquement JPG, PNG ou WebP.'));
    }
  },
});

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

function cleanStr(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 && /^[+\d\s().-]{8,25}$/.test(phone);
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatProductRow(row: any) {
  if (!row) return null;
  let specs: any = {};
  let images: string[] = [];

  if (typeof row.specs_json === 'string') {
    try {
      specs = JSON.parse(row.specs_json || '{}');
    } catch {
      specs = {};
    }
  } else if (row.specs_json && typeof row.specs_json === 'object') {
    specs = row.specs_json;
  }

  if (typeof row.images_json === 'string') {
    try {
      images = JSON.parse(row.images_json || '[]');
    } catch {
      images = [];
    }
  } else if (Array.isArray(row.images_json)) {
    images = row.images_json;
  }

  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    category_name: row.category_name || row.categories?.name || '',
    category_slug: row.category_slug || row.categories?.slug || '',
    name: row.name,
    slug: row.slug,
    reference: row.reference || '',
    description: row.description || '',
    specs,
    price: Number(row.price),
    promo_price:
      row.promo_price !== null && row.promo_price !== undefined ? Number(row.promo_price) : null,
    stock_qty: Number(row.stock_qty),
    is_active: Boolean(row.is_active),
    is_bestseller: Boolean(row.is_bestseller),
    is_new: Boolean(row.is_new),
    images,
    primary_image: row.primary_image || images[0] || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatOrderRow(o: any, items: any[]) {
  return {
    ...o,
    id: Number(o.id),
    customer_id: o.customer_id !== null && o.customer_id !== undefined ? Number(o.customer_id) : null,
    delivery_fee: Number(o.delivery_fee || 0),
    total_amount: Number(o.total_amount || 0),
    items: (items || []).map((it) => ({
      ...it,
      id: Number(it.id),
      order_id: Number(it.order_id),
      product_id: it.product_id !== null && it.product_id !== undefined ? Number(it.product_id) : null,
      unit_price: Number(it.unit_price),
      quantity: Number(it.quantity),
      subtotal: Number(it.subtotal),
    })),
  };
}

function toLocalYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeDaySlotsFromData(
  dateStr: string,
  schedulesByDay: Map<number, any>,
  blockedForDate: any[],
  bookedTimesForDate: Set<string>
) {
  const parsed = new Date(`${dateStr}T12:00:00Z`);
  const dayOfWeek = parsed.getUTCDay();
  const sched = schedulesByDay.get(dayOfWeek);

  if (!sched || !sched.is_working_day) {
    return { isWorkingDay: false, isBlockedDay: false, slots: [] as string[] };
  }

  const allDayBlock = blockedForDate.some((b) => !b.start_time || b.start_time === '');
  if (allDayBlock) {
    return { isWorkingDay: true, isBlockedDay: true, slots: [] as string[] };
  }

  const [startH, startM] = String(sched.start_time || '09:00').split(':').map(Number);
  const [endH, endM] = String(sched.end_time || '18:00').split(':').map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  const step = Number(sched.slot_duration_min) || 60;

  const blockedTimes = new Set(
    blockedForDate.filter((b) => b.start_time).map((b) => b.start_time)
  );

  const slots: string[] = [];
  for (let mins = startTotal; mins + step <= endTotal; mins += step) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 13) continue;
    const slotStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!blockedTimes.has(slotStr) && !bookedTimesForDate.has(slotStr)) {
      slots.push(slotStr);
    }
  }

  return { isWorkingDay: true, isBlockedDay: false, slots };
}

let seeded = false;
let bucketEnsured = false;

async function ensureBucket(sb: SupabaseClient) {
  if (bucketEnsured) return;
  const { data: existing } = await sb.storage.getBucket(SUPABASE_BUCKET);
  if (!existing) {
    await sb.storage.createBucket(SUPABASE_BUCKET, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  }
  bucketEnsured = true;
}

async function ensureSeeded(sb: SupabaseClient) {
  if (seeded) return;
  const { count: adminCount, error: adminErr } = await sb
    .from('admins')
    .select('id', { count: 'exact', head: true });
  if (adminErr) {
    throw new Error('Tables Supabase introuvables. Exécutez supabase/schema.sql dans Supabase.');
  }
  if ((adminCount || 0) === 0) {
    const hash = bcrypt.hashSync('Kanalou2026!', 10);
    await sb.from('admins').insert({
      username: 'admin',
      password_hash: hash,
      full_name: 'Maître Horloger — Direction',
      role: 'superadmin',
    });
  }

  const { count: schedCount } = await sb
    .from('availability_slots')
    .select('id', { count: 'exact', head: true })
    .eq('slot_type', 'schedule');
  if ((schedCount || 0) === 0) {
    const rows = [
      {
        slot_type: 'schedule',
        day_of_week: 0,
        start_time: '09:00',
        end_time: '13:00',
        slot_duration_min: 60,
        is_working_day: false,
        is_blocked: false,
        reason: '',
      },
    ];
    for (let day = 1; day <= 6; day++) {
      rows.push({
        slot_type: 'schedule',
        day_of_week: day,
        start_time: '09:00',
        end_time: day === 6 ? '16:00' : '18:00',
        slot_duration_min: 60,
        is_working_day: true,
        is_blocked: false,
        reason: '',
      });
    }
    await sb.from('availability_slots').insert(rows);
  }
  seeded = true;
}

function requireSupabase(res: Response): SupabaseClient | null {
  if (!supabase) {
    res.status(503).json({
      error:
        'Configuration Supabase manquante sur Vercel : ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans les variables d’environnement.',
    });
    return null;
  }
  return supabase;
}

interface AuthenticatedRequest extends Request {
  admin?: { id: number; username: string; full_name: string; role: string };
  authToken?: string;
}

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const sb = requireSupabase(res);
    if (!sb) return;
    await ensureSeeded(sb);

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }

    const { data } = await sb
      .from('admin_sessions')
      .select('token, expires_at, admins!inner(id, username, full_name, role)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!data || !data.admins) {
      res.status(401).json({ error: 'Session expirée ou invalide.' });
      return;
    }

    const adm: any = Array.isArray(data.admins) ? data.admins[0] : data.admins;
    req.admin = {
      id: Number(adm.id),
      username: adm.username,
      full_name: adm.full_name,
      role: adm.role,
    };
    req.authToken = data.token;
    next();
  } catch (err) {
    next(err);
  }
}

async function getSettingsObj(sb: SupabaseClient): Promise<Record<string, string>> {
  await ensureSeeded(sb);
  const { data, error } = await sb.from('business_settings').select('key, value');
  if (error) throw new Error(error.message);
  return Object.fromEntries((data || []).map((r: any) => [r.key, r.value]));
}

async function getDayAvail(sb: SupabaseClient, dateStr: string) {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr < todayStr) {
    return { isWorkingDay: false, isBlockedDay: false, slots: [] as string[], past: true };
  }
  await ensureSeeded(sb);
  const [{ data: slotRows }, { data: bookedRows }] = await Promise.all([
    sb.from('availability_slots').select('*'),
    sb
      .from('appointments')
      .select('appointment_time')
      .eq('appointment_date', dateStr)
      .neq('status', 'annule'),
  ]);

  const schedulesByDay = new Map<number, any>();
  const blockedForDate: any[] = [];
  for (const r of slotRows || []) {
    if (r.slot_type === 'schedule' && r.day_of_week !== null) {
      schedulesByDay.set(Number(r.day_of_week), r);
    } else if (r.slot_type === 'blocked' && r.specific_date === dateStr) {
      blockedForDate.push(r);
    }
  }
  const bookedSet = new Set((bookedRows || []).map((r: any) => r.appointment_time));
  const info = computeDaySlotsFromData(dateStr, schedulesByDay, blockedForDate, bookedSet);
  let slots = info.slots;
  if (dateStr === todayStr) {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    slots = slots.filter((slot) => {
      const [h, m] = slot.split(':').map(Number);
      return h * 60 + m > nowMins + 30;
    });
  }
  return {
    isWorkingDay: info.isWorkingDay,
    isBlockedDay: info.isBlockedDay,
    slots,
    past: false,
  };
}

// ==================== ROUTES ====================

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, supabaseConfigured: isSupabaseConfigured });
});

app.get(
  '/api/settings',
  asyncHandler(async (_req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    res.json(await getSettingsObj(sb));
  })
);

app.get(
  '/api/categories',
  asyncHandler(async (_req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    await ensureSeeded(sb);
    const { data, error } = await sb
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    res.json(data || []);
  })
);

app.get(
  '/api/products',
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    await ensureSeeded(sb);

    const { category, search, inStock, minPrice, maxPrice, bestseller, isNew, sort } = req.query;
    const { data, error } = await sb
      .from('products')
      .select('*, categories!inner(name, slug)')
      .eq('is_active', true);
    if (error) throw new Error(error.message);

    let list = (data || []).map(formatProductRow).filter(Boolean) as any[];
    if (category && category !== 'all') list = list.filter((p) => p.category_slug === String(category));
    if (search && String(search).trim() !== '') {
      const q = String(search).trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q)
      );
    }
    if (inStock === 'true') list = list.filter((p) => p.stock_qty > 0);
    if (minPrice !== undefined && minPrice !== '') {
      const min = Number(minPrice);
      if (!Number.isNaN(min)) list = list.filter((p) => (p.promo_price ?? p.price) >= min);
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const max = Number(maxPrice);
      if (!Number.isNaN(max)) list = list.filter((p) => (p.promo_price ?? p.price) <= max);
    }
    if (bestseller === 'true') list = list.filter((p) => p.is_bestseller);
    if (isNew === 'true') list = list.filter((p) => p.is_new);

    switch (sort) {
      case 'price_asc':
        list.sort((a, b) => (a.promo_price ?? a.price) - (b.promo_price ?? b.price));
        break;
      case 'price_desc':
        list.sort((a, b) => (b.promo_price ?? b.price) - (a.promo_price ?? a.price));
        break;
      case 'newest':
        list.sort((a, b) => Number(b.is_new) - Number(a.is_new) || b.id - a.id);
        break;
      default:
        list.sort((a, b) => Number(b.is_bestseller) - Number(a.is_bestseller) || b.id - a.id);
    }
    res.json(list);
  })
);

app.get(
  '/api/products/:slug',
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    await ensureSeeded(sb);

    const { data: row } = await sb
      .from('products')
      .select('*, categories!inner(name, slug)')
      .eq('slug', String(req.params.slug || ''))
      .eq('is_active', true)
      .maybeSingle();

    if (!row) {
      res.status(404).json({ error: 'Produit introuvable.' });
      return;
    }

    const { data: simRows } = await sb
      .from('products')
      .select('*, categories!inner(name, slug)')
      .eq('is_active', true)
      .eq('category_id', row.category_id)
      .neq('id', row.id)
      .order('is_bestseller', { ascending: false })
      .order('id', { ascending: false })
      .limit(3);

    res.json({
      product: formatProductRow(row),
      similar: (simRows || []).map(formatProductRow),
    });
  })
);

app.post(
  '/api/orders',
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    await ensureSeeded(sb);

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

    const settings = await getSettingsObj(sb);
    const baseDeliveryFee = Number(settings.delivery_fee || 8);
    const freeThreshold = Number(settings.free_delivery_threshold || 500);

    const { data: prodRows, error: prodErr } = await sb
      .from('products')
      .select('*')
      .in('id', parsedItems.map((i) => i.product_id))
      .eq('is_active', true);
    if (prodErr) throw new Error(prodErr.message);

    const prodMap = new Map<number, any>((prodRows || []).map((p: any) => [Number(p.id), p]));
    let subtotal = 0;
    const prepared: Array<{
      product_id: number;
      product_name: string;
      product_reference: string;
      unit_price: number;
      quantity: number;
      subtotal: number;
      prev_stock: number;
    }> = [];

    for (const item of parsedItems) {
      const prod = prodMap.get(item.product_id);
      if (!prod) {
        res.status(400).json({ error: "Le produit sélectionné n'est plus disponible." });
        return;
      }
      if (Number(prod.stock_qty) < item.quantity) {
        res.status(400).json({
          error: `Stock insuffisant pour "${prod.name}" (disponible : ${prod.stock_qty}).`,
        });
        return;
      }
      const unitPrice =
        prod.promo_price !== null && prod.promo_price !== undefined
          ? Number(prod.promo_price)
          : Number(prod.price);
      const lineSubtotal = unitPrice * item.quantity;
      subtotal += lineSubtotal;
      prepared.push({
        product_id: Number(prod.id),
        product_name: prod.name,
        product_reference: prod.reference || '',
        unit_price: unitPrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        prev_stock: Number(prod.stock_qty),
      });
    }

    const decremented: Array<{ product_id: number; quantity: number }> = [];
    try {
      for (const pi of prepared) {
        const { data: upd, error: updErr } = await sb
          .from('products')
          .update({ stock_qty: pi.prev_stock - pi.quantity, updated_at: new Date().toISOString() })
          .eq('id', pi.product_id)
          .gte('stock_qty', pi.quantity)
          .select('id');
        if (updErr || !upd || upd.length === 0) {
          throw new Error(`Stock insuffisant pour "${pi.product_name}".`);
        }
        decremented.push({ product_id: pi.product_id, quantity: pi.quantity });
      }

      const deliveryFee = subtotal >= freeThreshold ? 0 : baseDeliveryFee;
      const totalAmount = subtotal + deliveryFee;

      const { data: existingCust } = await sb
        .from('customers')
        .select('id, email')
        .eq('phone', customer_phone)
        .maybeSingle();

      let customerId: number;
      if (existingCust) {
        customerId = Number(existingCust.id);
        await sb
          .from('customers')
          .update({
            full_name: customer_name,
            email: customer_email || existingCust.email || '',
            address,
            city,
            region,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId);
      } else {
        const { data: newCust, error: custErr } = await sb
          .from('customers')
          .insert({
            full_name: customer_name,
            phone: customer_phone,
            email: customer_email || '',
            address,
            city,
            region,
          })
          .select('id')
          .single();
        if (custErr) throw new Error(custErr.message);
        customerId = Number(newCust.id);
      }

      const year = new Date().getFullYear();
      const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
      const { count: ordersCount } = await sb.from('orders').select('id', { count: 'exact', head: true });
      const orderNumber = `MK-${year}-${String((ordersCount || 0) + 1).padStart(4, '0')}-${randomPart}`;

      const { data: createdOrder, error: orderErr } = await sb
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId,
          customer_name,
          customer_phone,
          customer_email: customer_email || '',
          address,
          city,
          region,
          notes: notes || '',
          payment_method: 'Paiement à la livraison',
          status: 'en_attente',
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
        })
        .select()
        .single();
      if (orderErr) throw new Error(orderErr.message);

      const { data: createdItems, error: itemsErr } = await sb
        .from('order_items')
        .insert(
          prepared.map((pi) => ({
            order_id: createdOrder.id,
            product_id: pi.product_id,
            product_name: pi.product_name,
            product_reference: pi.product_reference,
            unit_price: pi.unit_price,
            quantity: pi.quantity,
            subtotal: pi.subtotal,
          }))
        )
        .select();
      if (itemsErr) throw new Error(itemsErr.message);

      res.status(201).json(formatOrderRow(createdOrder, createdItems || []));
    } catch (err: any) {
      for (const d of decremented) {
        const { data: p } = await sb.from('products').select('stock_qty').eq('id', d.product_id).maybeSingle();
        if (p) {
          await sb
            .from('products')
            .update({ stock_qty: Number(p.stock_qty) + d.quantity })
            .eq('id', d.product_id);
        }
      }
      res.status(400).json({ error: err.message || 'Erreur lors de la création de la commande.' });
    }
  })
);

app.get(
  '/api/appointments/availability',
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const dateStr = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json({ error: 'Format de date invalide (YYYY-MM-DD).' });
      return;
    }
    res.json(await getDayAvail(sb, dateStr));
  })
);

app.get(
  '/api/appointments/month-availability',
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const monthStr = String(req.query.month || '');
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      res.status(400).json({ error: 'Format de mois invalide (YYYY-MM).' });
      return;
    }

    await ensureSeeded(sb);
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStart = `${monthStr}-01`;
    const monthEnd = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    const [{ data: slotRows }, { data: bookedRows }] = await Promise.all([
      sb.from('availability_slots').select('*'),
      sb
        .from('appointments')
        .select('appointment_date, appointment_time')
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd)
        .neq('status', 'annule'),
    ]);

    const schedulesByDay = new Map<number, any>();
    const blockedByDate = new Map<string, any[]>();
    for (const r of slotRows || []) {
      if (r.slot_type === 'schedule' && r.day_of_week !== null) {
        schedulesByDay.set(Number(r.day_of_week), r);
      } else if (r.slot_type === 'blocked' && r.specific_date) {
        if (!blockedByDate.has(r.specific_date)) blockedByDate.set(r.specific_date, []);
        blockedByDate.get(r.specific_date)!.push(r);
      }
    }

    const bookedByDate = new Map<string, Set<string>>();
    for (const b of bookedRows || []) {
      if (!bookedByDate.has(b.appointment_date)) bookedByDate.set(b.appointment_date, new Set());
      bookedByDate.get(b.appointment_date)!.add(b.appointment_time);
    }

    const result: Record<
      string,
      { availableCount: number; isWorkingDay: boolean; isBlockedDay: boolean; isPast: boolean }
    > = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      if (dateStr < todayStr) {
        result[dateStr] = { availableCount: 0, isWorkingDay: false, isBlockedDay: false, isPast: true };
        continue;
      }
      const info = computeDaySlotsFromData(
        dateStr,
        schedulesByDay,
        blockedByDate.get(dateStr) || [],
        bookedByDate.get(dateStr) || new Set()
      );
      result[dateStr] = {
        availableCount: info.slots.length,
        isWorkingDay: info.isWorkingDay,
        isBlockedDay: info.isBlockedDay,
        isPast: false,
      };
    }

    res.json(result);
  })
);

app.post(
  '/api/appointments',
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    await ensureSeeded(sb);

    const body = req.body || {};
    const customer_name = cleanStr(body.customer_name, 120);
    const customer_phone = cleanStr(body.customer_phone, 30);
    const watch_type = cleanStr(body.watch_type, 60);
    const problem_description = cleanStr(body.problem_description, 600);
    const appointment_date = cleanStr(body.appointment_date, 10);
    const appointment_time = cleanStr(body.appointment_time, 5);

    if (!customer_name || !customer_phone || !watch_type || !appointment_date || !appointment_time) {
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

    const avail = await getDayAvail(sb, appointment_date);
    if (!avail.slots.includes(appointment_time)) {
      res.status(409).json({
        error: "Ce créneau horaire vient d'être réservé. Veuillez choisir un autre horaire.",
      });
      return;
    }

    const { data: existingCust } = await sb
      .from('customers')
      .select('id')
      .eq('phone', customer_phone)
      .maybeSingle();

    let customerId: number;
    if (existingCust) {
      customerId = Number(existingCust.id);
    } else {
      const { data: newCust, error: custErr } = await sb
        .from('customers')
        .insert({ full_name: customer_name, phone: customer_phone })
        .select('id')
        .single();
      if (custErr) throw new Error(custErr.message);
      customerId = Number(newCust.id);
    }

    const refCode = `RDV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { data, error } = await sb
      .from('appointments')
      .insert({
        reference_code: refCode,
        customer_id: customerId,
        customer_name,
        customer_phone,
        watch_type,
        problem_description,
        appointment_date,
        appointment_time,
        status: 'en_attente',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || String(error.message).toLowerCase().includes('unique')) {
        res.status(409).json({
          error: "Ce créneau horaire vient d'être réservé. Veuillez choisir un autre horaire.",
        });
        return;
      }
      throw new Error(error.message);
    }
    res.status(201).json(data);
  })
);

// ==================== ADMIN AUTH ====================

app.post(
  '/api/admin/login',
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    await ensureSeeded(sb);

    const { username, password } = req.body || {};
    const cleanUser = cleanStr(username, 60);
    const cleanPass = typeof password === 'string' ? password : '';
    if (!cleanUser || !cleanPass) {
      res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
      return;
    }

    const { data: admin } = await sb.from('admins').select('*').eq('username', cleanUser).maybeSingle();
    if (!admin || !bcrypt.compareSync(cleanPass, admin.password_hash)) {
      res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
      return;
    }

    await sb.from('admin_sessions').delete().lte('expires_at', new Date().toISOString());

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await sb.from('admin_sessions').insert({
      token,
      admin_id: admin.id,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    res.json({
      token,
      admin: {
        id: Number(admin.id),
        username: admin.username,
        full_name: admin.full_name,
        role: admin.role,
      },
    });
  })
);

app.post(
  '/api/admin/logout',
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    if (req.authToken) {
      await sb.from('admin_sessions').delete().eq('token', req.authToken);
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
    const sb = requireSupabase(res);
    if (!sb) return;

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

    const { data: admin } = await sb.from('admins').select('*').eq('id', req.admin!.id).maybeSingle();
    if (!admin || !bcrypt.compareSync(current_password, admin.password_hash)) {
      res.status(401).json({ error: 'Le mot de passe actuel est incorrect.' });
      return;
    }

    const nextHash = bcrypt.hashSync(new_password, 12);
    await sb.from('admins').update({ password_hash: nextHash }).eq('id', admin.id);
    await sb.from('admin_sessions').delete().eq('admin_id', admin.id).neq('token', req.authToken || '');
    res.json({ ok: true });
  })
);

// ==================== ADMIN PROTECTED ROUTES ====================

app.post(
  '/api/admin/upload',
  requireAdmin,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier reçu.' });
      return;
    }

    await ensureBucket(sb);
    const ext = ALLOWED_IMAGE_MIMES[req.file.mimetype] || '.jpg';
    const rawBase = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const safeName =
      rawBase
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 32) || 'image';
    const storagePath = `uploads/${safeName}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;

    const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
      cacheControl: '31536000',
    });
    if (error) throw new Error(`Erreur Supabase Storage : ${error.message}`);

    const { data } = sb.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
    res.json({ url: data.publicUrl });
  })
);

app.get(
  '/api/admin/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;

    const rawPeriod = String(req.query.period || 'month');
    const period: 'today' | 'week' | 'month' =
      rawPeriod === 'today' || rawPeriod === 'week' ? rawPeriod : 'month';

    const [{ data: allOrders }, { count: availableProducts }, { count: totalCustomers }, { data: allAppts }] =
      await Promise.all([
        sb.from('orders').select('total_amount, status, created_at'),
        sb.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).gt('stock_qty', 0),
        sb.from('customers').select('id', { count: 'exact', head: true }),
        sb.from('appointments').select('status'),
      ]);

    const ordersList = allOrders || [];
    const now = new Date();
    const todayYMD = toLocalYMD(now);
    const currentYM = todayYMD.slice(0, 7);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    const weekStartYMD = toLocalYMD(weekAgo);

    let totalRevenue = 0;
    let todayRevenue = 0;
    let todayOrders = 0;
    let weekRevenue = 0;
    let weekOrders = 0;
    let monthRevenue = 0;
    let monthOrders = 0;
    let pendingOrders = 0;

    const byDay = new Map<string, { revenue: number; orders: number }>();
    const byHour = new Map<string, { revenue: number; orders: number }>();

    for (const o of ordersList) {
      if (o.status === 'en_attente') pendingOrders += 1;
      if (o.status === 'annulee') continue;

      const amt = Number(o.total_amount || 0);
      const dt = new Date(o.created_at);
      const ymd = toLocalYMD(dt);
      const ym = ymd.slice(0, 7);
      const hr = String(dt.getHours()).padStart(2, '0');

      totalRevenue += amt;
      if (ymd === todayYMD) {
        todayRevenue += amt;
        todayOrders += 1;
        const hCur = byHour.get(hr) || { revenue: 0, orders: 0 };
        hCur.revenue += amt;
        hCur.orders += 1;
        byHour.set(hr, hCur);
      }
      if (ymd >= weekStartYMD) {
        weekRevenue += amt;
        weekOrders += 1;
      }
      if (ym === currentYM) {
        monthRevenue += amt;
        monthOrders += 1;
      }

      const dCur = byDay.get(ymd) || { revenue: 0, orders: 0 };
      dCur.revenue += amt;
      dCur.orders += 1;
      byDay.set(ymd, dCur);
    }

    const chartData: Array<{ date: string; label: string; revenue: number; orders: number }> = [];
    if (period === 'today') {
      for (let h = 8; h <= 22; h += 2) {
        const h1 = String(h).padStart(2, '0');
        const h2 = String(h + 1).padStart(2, '0');
        chartData.push({
          date: `${h1}:00`,
          label: `${h1}h`,
          revenue: (byHour.get(h1)?.revenue || 0) + (byHour.get(h2)?.revenue || 0),
          orders: (byHour.get(h1)?.orders || 0) + (byHour.get(h2)?.orders || 0),
        });
      }
    } else {
      const daysCount = period === 'week' ? 7 : 30;
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = toLocalYMD(d);
        chartData.push({
          date: dateKey,
          label: `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`,
          revenue: byDay.get(dateKey)?.revenue || 0,
          orders: byDay.get(dateKey)?.orders || 0,
        });
      }
    }

    const apptsList = allAppts || [];
    res.json({
      period,
      total_revenue: totalRevenue,
      today_revenue: todayRevenue,
      week_revenue: weekRevenue,
      month_revenue: monthRevenue,
      period_revenue: period === 'today' ? todayRevenue : period === 'week' ? weekRevenue : monthRevenue,
      period_orders: period === 'today' ? todayOrders : period === 'week' ? weekOrders : monthOrders,
      total_orders: ordersList.length,
      pending_orders: pendingOrders,
      available_products: availableProducts || 0,
      total_customers: totalCustomers || 0,
      total_appointments: apptsList.length,
      pending_appointments: apptsList.filter((a: any) => a.status === 'en_attente').length,
      chart_data: chartData,
    });
  })
);

app.get(
  '/api/admin/products',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const { data, error } = await sb
      .from('products')
      .select('*, categories!inner(name, slug)')
      .order('id', { ascending: false });
    if (error) throw new Error(error.message);
    res.json((data || []).map(formatProductRow));
  })
);

app.post(
  '/api/admin/products',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const body = req.body || {};
    if (!body.name?.trim() || !body.category_id || body.price === undefined || Number(body.price) < 0) {
      res.status(400).json({ error: 'Nom, catégorie et prix valide requis.' });
      return;
    }

    let baseSlug = slugify(body.name.trim()) || `montre-${Date.now()}`;
    const { data: existing } = await sb.from('products').select('id').eq('slug', baseSlug).maybeSingle();
    if (existing) baseSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    const imageList = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
    const mainImg = body.primary_image || imageList[0] || '';
    const promoVal =
      body.promo_price !== null && body.promo_price !== '' && body.promo_price !== undefined
        ? Number(body.promo_price)
        : null;

    const { data, error } = await sb
      .from('products')
      .insert({
        category_id: Number(body.category_id),
        name: body.name.trim(),
        slug: baseSlug,
        reference: String(body.reference || '').trim(),
        description: String(body.description || '').trim(),
        specs_json: body.specs || {},
        price: Number(body.price),
        promo_price: promoVal,
        stock_qty: Math.max(0, Math.floor(Number(body.stock_qty || 0))),
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
        is_bestseller: Boolean(body.is_bestseller),
        is_new: body.is_new !== undefined ? Boolean(body.is_new) : true,
        images_json: imageList,
        primary_image: mainImg,
      })
      .select('*, categories!inner(name, slug)')
      .single();
    if (error) throw new Error(error.message);
    res.status(201).json(formatProductRow(data));
  })
);

app.put(
  '/api/admin/products/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Identifiant produit invalide.' });
      return;
    }

    const { data: existing } = await sb.from('products').select('*').eq('id', id).maybeSingle();
    if (!existing) {
      res.status(404).json({ error: 'Produit introuvable.' });
      return;
    }

    const payload = req.body || {};
    const imageList = Array.isArray(payload.images)
      ? payload.images.filter(Boolean)
      : existing.images_json || [];
    const mainImg =
      payload.primary_image !== undefined
        ? payload.primary_image
        : existing.primary_image || imageList[0] || '';
    const promoVal =
      payload.promo_price === undefined
        ? existing.promo_price
        : payload.promo_price === null || payload.promo_price === ''
        ? null
        : Number(payload.promo_price);

    const { data: updated, error } = await sb
      .from('products')
      .update({
        category_id: payload.category_id !== undefined ? Number(payload.category_id) : existing.category_id,
        name: payload.name !== undefined ? String(payload.name).trim() : existing.name,
        reference: payload.reference !== undefined ? String(payload.reference).trim() : existing.reference,
        description: payload.description !== undefined ? String(payload.description).trim() : existing.description,
        specs_json: payload.specs !== undefined ? payload.specs : existing.specs_json,
        price: payload.price !== undefined ? Number(payload.price) : existing.price,
        promo_price: promoVal,
        stock_qty:
          payload.stock_qty !== undefined
            ? Math.max(0, Math.floor(Number(payload.stock_qty)))
            : existing.stock_qty,
        is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : existing.is_active,
        is_bestseller: payload.is_bestseller !== undefined ? Boolean(payload.is_bestseller) : existing.is_bestseller,
        is_new: payload.is_new !== undefined ? Boolean(payload.is_new) : existing.is_new,
        images_json: imageList,
        primary_image: mainImg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, categories!inner(name, slug)')
      .single();
    if (error) throw new Error(error.message);
    res.json(formatProductRow(updated));
  })
);

app.delete(
  '/api/admin/products/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Identifiant produit invalide.' });
      return;
    }
    const { data, error } = await sb.from('products').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      res.status(404).json({ error: 'Produit introuvable.' });
      return;
    }
    res.json({ ok: true });
  })
);

app.post(
  '/api/admin/categories',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const { name, description = '' } = req.body || {};
    if (!name?.trim()) {
      res.status(400).json({ error: 'Nom de catégorie requis.' });
      return;
    }
    const slug = slugify(String(name).trim());
    const { data: existing } = await sb.from('categories').select('id').eq('slug', slug).maybeSingle();
    if (existing) {
      res.status(400).json({ error: 'Cette catégorie existe déjà.' });
      return;
    }
    const { data: maxRow } = await sb
      .from('categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await sb
      .from('categories')
      .insert({
        name: String(name).trim(),
        slug,
        description: String(description || '').trim(),
        sort_order: (maxRow?.sort_order || 0) + 1,
      })
      .select()
      .single();
    if (error) {
      res.status(400).json({ error: 'Cette catégorie existe déjà.' });
      return;
    }
    res.status(201).json(data);
  })
);

app.get(
  '/api/admin/orders',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const { status, search } = req.query;
    let query = sb.from('orders').select('*').order('id', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', String(status));
    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);

    let list = orders || [];
    if (search && String(search).trim() !== '') {
      const q = String(search).trim().toLowerCase();
      list = list.filter(
        (o: any) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_phone.toLowerCase().includes(q)
      );
    }
    if (list.length === 0) {
      res.json([]);
      return;
    }

    const { data: allItems } = await sb.from('order_items').select('*').in('order_id', list.map((o: any) => o.id));
    const itemsByOrder = new Map<number, any[]>();
    for (const it of allItems || []) {
      const oid = Number(it.order_id);
      if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
      itemsByOrder.get(oid)!.push(it);
    }
    res.json(list.map((o: any) => formatOrderRow(o, itemsByOrder.get(Number(o.id)) || [])));
  })
);

app.patch(
  '/api/admin/orders/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const allowed = ['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: 'Statut invalide.' });
      return;
    }

    const { data: existing } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
    if (!existing) {
      res.status(404).json({ error: 'Commande introuvable.' });
      return;
    }

    const { data: items } = await sb.from('order_items').select('*').eq('order_id', id);
    if (existing.status !== 'annulee' && status === 'annulee') {
      for (const item of items || []) {
        if (item.product_id) {
          const { data: p } = await sb.from('products').select('stock_qty').eq('id', item.product_id).maybeSingle();
          if (p) {
            await sb.from('products').update({ stock_qty: Number(p.stock_qty) + Number(item.quantity) }).eq('id', item.product_id);
          }
        }
      }
    }
    if (existing.status === 'annulee' && status !== 'annulee') {
      for (const item of items || []) {
        if (item.product_id) {
          const { data: p } = await sb.from('products').select('stock_qty').eq('id', item.product_id).maybeSingle();
          if (p) {
            await sb.from('products').update({ stock_qty: Math.max(0, Number(p.stock_qty) - Number(item.quantity)) }).eq('id', item.product_id);
          }
        }
      }
    }

    const { data: updated, error } = await sb
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.json(formatOrderRow(updated, items || []));
  })
);

app.get(
  '/api/admin/appointments',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const { date, status } = req.query;
    let query = sb
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });
    if (date) query = query.eq('appointment_date', String(date));
    if (status && status !== 'all') query = query.eq('status', String(status));
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data || []);
  })
);

app.post(
  '/api/admin/appointments',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
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

    const { data: conflict } = await sb
      .from('appointments')
      .select('id')
      .eq('appointment_date', String(appointment_date))
      .eq('appointment_time', String(appointment_time))
      .neq('status', 'annule')
      .maybeSingle();
    if (conflict) {
      res.status(409).json({ error: 'Ce créneau est déjà occupé par un autre rendez-vous.' });
      return;
    }

    const { data: existingCust } = await sb
      .from('customers')
      .select('id')
      .eq('phone', String(customer_phone).trim())
      .maybeSingle();

    let customerId: number;
    if (existingCust) {
      customerId = Number(existingCust.id);
    } else {
      const { data: newCust, error: custErr } = await sb
        .from('customers')
        .insert({ full_name: String(customer_name).trim(), phone: String(customer_phone).trim() })
        .select('id')
        .single();
      if (custErr) throw new Error(custErr.message);
      customerId = Number(newCust.id);
    }

    const refCode = `RDV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { data, error } = await sb
      .from('appointments')
      .insert({
        reference_code: refCode,
        customer_id: customerId,
        customer_name: String(customer_name).trim(),
        customer_phone: String(customer_phone).trim(),
        watch_type: String(watch_type).trim(),
        problem_description: String(problem_description).trim(),
        appointment_date: String(appointment_date),
        appointment_time: String(appointment_time),
        status: String(status),
        admin_notes: String(admin_notes).trim(),
      })
      .select()
      .single();
    if (error) {
      res.status(409).json({ error: 'Ce créneau est déjà occupé par un autre rendez-vous.' });
      return;
    }
    res.status(201).json(data);
  })
);

app.patch(
  '/api/admin/appointments/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const id = Number(req.params.id);
    const { data: existing } = await sb.from('appointments').select('*').eq('id', id).maybeSingle();
    if (!existing) {
      res.status(404).json({ error: 'Rendez-vous introuvable.' });
      return;
    }

    const payload = req.body || {};
    const nextDate = payload.appointment_date ?? existing.appointment_date;
    const nextTime = payload.appointment_time ?? existing.appointment_time;
    const nextStatus = payload.status ?? existing.status;

    if (nextStatus !== 'annule' && (nextDate !== existing.appointment_date || nextTime !== existing.appointment_time)) {
      const { data: conflict } = await sb
        .from('appointments')
        .select('id')
        .eq('appointment_date', nextDate)
        .eq('appointment_time', nextTime)
        .neq('status', 'annule')
        .neq('id', id)
        .maybeSingle();
      if (conflict) {
        res.status(409).json({ error: 'Ce créneau est déjà réservé par un autre rendez-vous.' });
        return;
      }
    }

    const { data, error } = await sb
      .from('appointments')
      .update({
        appointment_date: nextDate,
        appointment_time: nextTime,
        status: nextStatus,
        admin_notes: payload.admin_notes ?? existing.admin_notes,
        watch_type: payload.watch_type ?? existing.watch_type,
        problem_description: payload.problem_description ?? existing.problem_description,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Ce créneau est déjà réservé par un autre rendez-vous.' });
        return;
      }
      throw new Error(error.message);
    }
    res.json(data);
  })
);

app.get(
  '/api/admin/availability',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const [{ data: schedules }, { data: blocked }] = await Promise.all([
      sb.from('availability_slots').select('*').eq('slot_type', 'schedule').order('day_of_week', { ascending: true }),
      sb
        .from('availability_slots')
        .select('*')
        .eq('slot_type', 'blocked')
        .order('specific_date', { ascending: true })
        .order('start_time', { ascending: true }),
    ]);

    res.json({
      schedules: (schedules || []).map((r: any) => ({ ...r, is_working_day: Boolean(r.is_working_day) })),
      blocked: blocked || [],
    });
  })
);

app.put(
  '/api/admin/availability/schedule',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const { schedules } = req.body || {};
    if (!Array.isArray(schedules)) {
      res.status(400).json({ error: 'Données de planning invalides.' });
      return;
    }
    for (const s of schedules) {
      await sb
        .from('availability_slots')
        .update({
          start_time: s.start_time || '09:00',
          end_time: s.end_time || '18:00',
          slot_duration_min: Number(s.slot_duration_min) || 60,
          is_working_day: Boolean(s.is_working_day),
        })
        .eq('slot_type', 'schedule')
        .eq('day_of_week', Number(s.day_of_week));
    }
    res.json({ ok: true });
  })
);

app.post(
  '/api/admin/availability/block',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const { specific_date, start_time = null, reason = 'Indisponible' } = req.body || {};
    if (!specific_date) {
      res.status(400).json({ error: 'Date requise.' });
      return;
    }
    const { data, error } = await sb
      .from('availability_slots')
      .insert({
        slot_type: 'blocked',
        specific_date: String(specific_date),
        start_time: start_time ? String(start_time) : null,
        is_blocked: true,
        reason: String(reason).trim(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  })
);

app.delete(
  '/api/admin/availability/block/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    await sb.from('availability_slots').delete().eq('id', Number(req.params.id)).eq('slot_type', 'blocked');
    res.json({ ok: true });
  })
);

app.put(
  '/api/admin/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sb = requireSupabase(res);
    if (!sb) return;
    const rawUpdates = req.body || {};
    const rows: Array<{ key: string; value: string; updated_at: string }> = [];
    for (const [k, v] of Object.entries(rawUpdates)) {
      if (ALLOWED_SETTING_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number')) {
        rows.push({ key: k, value: String(v).slice(0, 2000), updated_at: new Date().toISOString() });
      }
    }
    if (rows.length > 0) {
      const { error } = await sb.from('business_settings').upsert(rows, { onConflict: 'key' });
      if (error) throw new Error(error.message);
    }
    res.json(await getSettingsObj(sb));
  })
);

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint API introuvable.' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: 'Fichier trop volumineux (max 4 Mo) ou invalide.' });
    return;
  }
  if (err?.message && typeof err.message === 'string' && err.message.includes('Format non autorisé')) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: err?.message || 'Une erreur serveur est survenue.' });
});

export default function handler(req: Request, res: Response): Promise<void> {
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const apiPath = urlObj.searchParams.get('__api_path');
  if (apiPath !== null) {
    urlObj.searchParams.delete('__api_path');
    const qs = urlObj.searchParams.toString();
    req.url = `/api/${apiPath}${qs ? `?${qs}` : ''}`;
  }

  return new Promise<void>((resolve) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    app(req, res);
  });
}
