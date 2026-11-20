import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
type DbModule = typeof import('./db');
let sqlitePromise: Promise<DbModule> | null = null;
async function getSqlite(): Promise<DbModule> {
  if (!sqlitePromise) {
    sqlitePromise = import('./db');
  }
  return sqlitePromise;
}

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

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!isSupabaseConfigured && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function slugify(text: string): string {
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

  const catName = row.category_name || row.categories?.name || '';
  const catSlug = row.category_slug || row.categories?.slug || '';

  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    category_name: catName,
    category_slug: catSlug,
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

// ==================== SUPABASE INITIALIZATION & SEEDING ====================

let supabaseSeeded = false;
let supabaseInitPromise: Promise<void> | null = null;
let bucketEnsured = false;

async function ensureSupabaseBucket() {
  if (!supabase || bucketEnsured) return;
  const { data: existing } = await supabase.storage.getBucket(SUPABASE_BUCKET);
  if (!existing) {
    const { error } = await supabase.storage.createBucket(SUPABASE_BUCKET, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (error && !String(error.message).toLowerCase().includes('already exists')) {
      console.warn('Supabase bucket creation warning:', error.message);
      return;
    }
  }
  bucketEnsured = true;
}

async function uploadLocalAssetToSupabase(localWebPath: string): Promise<string> {
  if (!supabase) return localWebPath;
  try {
    await ensureSupabaseBucket();
    const cleanRel = localWebPath.replace(/^\/+/, '');
    const absPath = path.resolve(process.cwd(), cleanRel);
    if (!fs.existsSync(absPath)) return localWebPath;

    const filename = path.basename(absPath);
    const storagePath = `seed/${filename}`;
    const buffer = fs.readFileSync(absPath);

    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) {
      return localWebPath;
    }
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl || localWebPath;
  } catch {
    return localWebPath;
  }
}

async function ensureSupabaseSeeded() {
  if (!supabase || supabaseSeeded) return;
  if (supabaseInitPromise) {
    await supabaseInitPromise;
    return;
  }

  supabaseInitPromise = (async () => {
    try {
      await ensureSupabaseBucket();

      // Verify schema exists
      const { count: adminCount, error: adminErr } = await supabase
        .from('admins')
        .select('id', { count: 'exact', head: true });

      if (adminErr) {
        console.warn(
          'Supabase schema non détecté. Exécutez supabase/schema.sql dans votre SQL Editor Supabase :',
          adminErr.message
        );
        return;
      }

      if ((adminCount || 0) === 0) {
        const hash = bcrypt.hashSync('Kanalou2026!', 10);
        await supabase.from('admins').insert({
          username: 'admin',
          password_hash: hash,
          full_name: 'Maître Horloger — Direction',
          role: 'superadmin',
        });
      }

      const { count: catCount } = await supabase
        .from('categories')
        .select('id', { count: 'exact', head: true });

      if ((catCount || 0) === 0) {
        await supabase.from('categories').insert([
          {
            name: 'Montres Hommes',
            slug: 'hommes',
            description: 'Chronographes mécaniques, calibres automatiques et garde-temps de caractère.',
            sort_order: 1,
          },
          {
            name: 'Montres Femmes',
            slug: 'femmes',
            description: 'Pièces raffinées en or champagne, cadrans nacrés et mailles milanaises.',
            sort_order: 2,
          },
          {
            name: 'Bracelets & Accessoires',
            slug: 'accessoires',
            description: 'Bracelets en cuir italien cousu main, boucles déployantes et outils horlogers.',
            sort_order: 3,
          },
        ]);
      }

      const { count: prodCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      const heroImgLocal = '/src/assets/images/hero_luxury_watch_1795182946775.jpg';
      const menChronoLocal = '/src/assets/images/watch_men_chronograph_1795182913892.jpg';
      const menSteelLocal = '/src/assets/images/watch_men_steel_1795182913137.jpg';
      const womenGoldLocal = '/src/assets/images/watch_women_gold_1795182912356.jpg';
      const accStrapsLocal = '/src/assets/images/watch_accessories_straps_1795182913032.jpg';
      const atelierLocal = '/src/assets/images/atelier_watchmaker_repair_1795182913427.jpg';

      let heroImg = heroImgLocal;
      let atelierImg = atelierLocal;

      if ((prodCount || 0) === 0) {
        const [uHero, uMenChrono, uMenSteel, uWomenGold, uAccStraps, uAtelier] = await Promise.all([
          uploadLocalAssetToSupabase(heroImgLocal),
          uploadLocalAssetToSupabase(menChronoLocal),
          uploadLocalAssetToSupabase(menSteelLocal),
          uploadLocalAssetToSupabase(womenGoldLocal),
          uploadLocalAssetToSupabase(accStrapsLocal),
          uploadLocalAssetToSupabase(atelierLocal),
        ]);
        heroImg = uHero;
        atelierImg = uAtelier;

        const { data: cats } = await supabase.from('categories').select('id, slug');
        const catMap = Object.fromEntries((cats || []).map((c: any) => [c.slug, c.id]));

        if (catMap['hommes'] && catMap['femmes'] && catMap['accessoires']) {
          await supabase.from('products').insert([
            {
              category_id: catMap['hommes'],
              name: 'Chronographe Zeina Obsidienne',
              slug: 'chronographe-zeina-obsidienne',
              reference: 'MK-CHR-01',
              description:
                'Boîtier en acier brossé PVD obsidienne rehaussé d’une lunette cannelée en or champagne. Mouvement chronographe automatique de haute précision avec réserve de marche de 48 heures et verre saphir antireflet.',
              specs_json: {
                movement: 'Automatique Calibre MK-7750',
                case_material: 'Acier 316L PVD Obsidienne & Or Champagne',
                diameter: '41 mm',
                water_resistance: '100 m (10 ATM)',
                strap: 'Acier brossé intégral',
                warranty: '2 ans Atelier Horlogerie Zeina',
              },
              price: 1890,
              promo_price: 1650,
              stock_qty: 7,
              is_active: true,
              is_bestseller: true,
              is_new: true,
              images_json: [uHero, uMenChrono],
              primary_image: uHero,
            },
            {
              category_id: catMap['hommes'],
              name: 'Chronographe Héritage Or & Alligator',
              slug: 'chronographe-heritage-or-alligator',
              reference: 'MK-HER-02',
              description:
                'Un grand classique horloger associant un boîtier poli doré champagne à un cadran anthracite soleillé et trois compteurs harmonieusement équilibrés. Monté sur un bracelet en cuir noir grain alligator.',
              specs_json: {
                movement: 'Automatique Suisse 28 800 A/h',
                case_material: 'Acier inoxydable plaqué Or Champagne 18k',
                diameter: '40 mm',
                water_resistance: '50 m (5 ATM)',
                strap: 'Cuir noir surpiqué main',
                warranty: '2 ans Atelier Horlogerie Zeina',
              },
              price: 1540,
              promo_price: null,
              stock_qty: 5,
              is_active: true,
              is_bestseller: true,
              is_new: false,
              images_json: [uMenChrono, uHero],
              primary_image: uMenChrono,
            },
            {
              category_id: catMap['hommes'],
              name: 'Zaghouan Acier Calibre 01',
              slug: 'zaghouan-acier-calibre-01',
              reference: 'MK-ZAG-03',
              description:
                'Dessinée pour le quotidien exigeant, la Zaghouan Calibre 01 allie sobriété architecturale, index bâtons dorés luminescents et bracelet en acier brossé à maillons pleins avec boucle déployante.',
              specs_json: {
                movement: 'Automatique 3 aiguilles + date',
                case_material: 'Acier chirurgical 316L brossé satin',
                diameter: '39 mm',
                water_resistance: '100 m (10 ATM)',
                strap: 'Acier brossé massif',
                warranty: '2 ans Atelier Horlogerie Zeina',
              },
              price: 1180,
              promo_price: 980,
              stock_qty: 11,
              is_active: true,
              is_bestseller: false,
              is_new: true,
              images_json: [uMenSteel, uMenChrono],
              primary_image: uMenSteel,
            },
            {
              category_id: catMap['femmes'],
              name: 'Aurore Nacre Champagne',
              slug: 'aurore-nacre-champagne',
              reference: 'MK-AUR-04',
              description:
                'D’une finesse remarquable (6,4 mm d’épaisseur), le modèle Aurore marie la luminosité naturelle de la nacre véritable à la souplesse d’un bracelet en maille milanaise tissée or champagne.',
              specs_json: {
                movement: 'Quartz Suisse Haute Précision',
                case_material: 'Acier doré champagne poli miroir',
                diameter: '34 mm',
                water_resistance: '30 m (3 ATM)',
                strap: 'Maille milanaise ajustable',
                warranty: '2 ans Atelier Horlogerie Zeina',
              },
              price: 790,
              promo_price: 690,
              stock_qty: 9,
              is_active: true,
              is_bestseller: true,
              is_new: true,
              images_json: [uWomenGold],
              primary_image: uWomenGold,
            },
            {
              category_id: catMap['femmes'],
              name: 'Solstice Maille Dorée 32mm',
              slug: 'solstice-maille-doree-32',
              reference: 'MK-SOL-05',
              description:
                'Épure absolue au poignet féminin. Cadran nacre ivoire sans chiffres, aiguilles dauphines facettées et verre saphir inrayable pour accompagner chaque instant avec discrétion.',
              specs_json: {
                movement: 'Mouvement Suisse Ronda',
                case_material: 'Acier inoxydable PVD Or Champagne',
                diameter: '32 mm',
                water_resistance: '50 m (5 ATM)',
                strap: 'Maille milanaise fine 14 mm',
                warranty: '2 ans Atelier Horlogerie Zeina',
              },
              price: 720,
              promo_price: null,
              stock_qty: 6,
              is_active: true,
              is_bestseller: false,
              is_new: true,
              images_json: [uWomenGold],
              primary_image: uWomenGold,
            },
            {
              category_id: catMap['accessoires'],
              name: 'Duo Bracelets Cuir Italien & Outil',
              slug: 'duo-bracelets-cuir-italien-outil',
              reference: 'MK-ACC-06',
              description:
                'Ensemble complet comprenant deux bracelets en cuir pleine fleur italien (Cognac patiné et Noir grainé) équipés de pompes rapides et d’un outil chasse-pompe en laiton massif.',
              specs_json: {
                movement: 'Compatible entrecornes 20 mm',
                case_material: 'Boucles ardillon acier doré champagne',
                diameter: 'Largeur 20 mm / 18 mm',
                water_resistance: 'Cuir traité hydrofuge',
                strap: 'Cuir pleine fleur tannage végétal',
                warranty: '1 an Atelier Horlogerie Zeina',
              },
              price: 260,
              promo_price: 215,
              stock_qty: 18,
              is_active: true,
              is_bestseller: true,
              is_new: true,
              images_json: [uAccStraps],
              primary_image: uAccStraps,
            },
            {
              category_id: catMap['accessoires'],
              name: 'Rouleau de Voyage Horloger Suédine',
              slug: 'rouleau-voyage-horloger-suedine',
              reference: 'MK-ACC-07',
              description:
                'Étui de transport artisanal pour 3 montres, confectionné en suédine chocolat doublée de velours beige protecteur avec boutons-pression dorés et coussins amovibles.',
              specs_json: {
                movement: 'Capacité 3 garde-temps',
                case_material: 'Suédine & cuir grainé',
                diameter: '22 × 10 × 9 cm',
                water_resistance: 'Doublure anti-rayures',
                strap: 'Sangles de maintien cuir',
                warranty: '1 an Atelier Horlogerie Zeina',
              },
              price: 340,
              promo_price: null,
              stock_qty: 12,
              is_active: true,
              is_bestseller: false,
              is_new: false,
              images_json: [uAccStraps],
              primary_image: uAccStraps,
            },
          ]);
        }
      }

      const { count: settingsCount } = await supabase
        .from('business_settings')
        .select('key', { count: 'exact', head: true });

      if ((settingsCount || 0) === 0) {
        if (heroImg === heroImgLocal) heroImg = await uploadLocalAssetToSupabase(heroImgLocal);
        if (atelierImg === atelierLocal) atelierImg = await uploadLocalAssetToSupabase(atelierLocal);

        const defaults: Record<string, string> = {
          brand_name: 'Horlogerie Zeina',
          logo_url: '',
          hero_slogan: 'Pas besoin de courir après le temps… laissez-nous nous en occuper',
          hero_subtitle:
            'Garde-temps de caractère pour hommes et femmes, bracelets sur mesure et atelier de haute réparation horlogère au cœur de Zaghouan.',
          hero_image: heroImg,
          repair_banner_image: atelierImg,
          repair_title: 'Votre montre mérite une seconde vie',
          repair_description:
            'Révision complète de mouvements automatiques et mécaniques, remplacement de pile et test d’étanchéité, polissage artisanal et restauration de pièces de famille.',
          about_title: 'L’Exigence Horlogère à Zaghouan',
          about_text:
            'Horlogerie Zeina incarne la rencontre entre la tradition horlogère de précision et le service de proximité. Chaque montre proposée dans notre boutique est contrôlée sur banc chronométrique avant sa remise, et notre atelier accueille vos pièces les plus précieuses pour leur redonner leur éclat originel.',
          phone: '+216 56 375 456',
          email: 'contact@horlogeriezeina.tn',
          address: 'C44R+GXM, Rue Kanalou, Zaghouan, Tunisie',
          google_maps_url:
            'https://www.google.com/maps/search/?api=1&query=C44R%2BGXM,+Rue+Kanalou,+Zaghouan,+Tunisie',
          instagram_url: 'https://www.instagram.com/horlogerie_zeina/',
          facebook_url: 'https://www.facebook.com/p/Zeina-61556602533155/',
          whatsapp_number: '+216 56 375 456',
          currency: 'TND',
          delivery_fee: '8',
          free_delivery_threshold: '500',
        };

        await supabase
          .from('business_settings')
          .upsert(
            Object.entries(defaults).map(([key, value]) => ({ key, value })),
            { onConflict: 'key', ignoreDuplicates: true }
          );
      }

      const { count: schedCount } = await supabase
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
        await supabase.from('availability_slots').insert(rows);
      }

      supabaseSeeded = true;
      console.log('Supabase connecté et initialisé pour Horlogerie Zeina.');
    } catch (err: any) {
      console.error('Erreur initialisation Supabase:', err?.message || err);
    } finally {
      supabaseInitPromise = null;
    }
  })();

  await supabaseInitPromise;
}

export async function initStore() {
  if (supabase) {
    await ensureSupabaseSeeded();
  } else {
    const { initDatabase } = await getSqlite();
    initDatabase();
  }
}

// ==================== STORAGE UPLOAD ====================

export async function uploadImage(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const ext = MIME_TO_EXT[mimeType] || '.jpg';
  const rawBase = path.basename(originalName, path.extname(originalName));
  const safeName =
    rawBase
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32) || 'image';
  const filename = `${safeName}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`;

  if (supabase) {
    await ensureSupabaseBucket();
    const storagePath = `uploads/${filename}`;
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
      cacheControl: '31536000',
    });
    if (error) {
      throw new Error(`Erreur Supabase Storage : ${error.message}`);
    }
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  // Fallback local disk (only when Supabase is not configured)
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

// ==================== SETTINGS & CATEGORIES ====================

export async function getSettings(): Promise<Record<string, string>> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data, error } = await supabase.from('business_settings').select('key, value');
    if (error) throw new Error(error.message);
    return Object.fromEntries((data || []).map((r: any) => [r.key, r.value]));
  }
  const { getSettingsObject } = await getSqlite();
  return getSettingsObject();
}

export async function updateSettings(updates: Record<string, string>): Promise<Record<string, string>> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      const { error } = await supabase
        .from('business_settings')
        .upsert(rows, { onConflict: 'key' });
      if (error) throw new Error(error.message);
    }
    return getSettings();
  }

  const { db, getSettingsObject } = await getSqlite();
  const upsert = db.prepare(
    `INSERT INTO BusinessSettings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  );
  db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      upsert.run(k, v);
    }
  })();
  return getSettingsObject();
}

export async function getCategories(): Promise<any[]> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }
  const { db } = await getSqlite();
  return db.prepare('SELECT * FROM Categories ORDER BY sort_order ASC, id ASC').all();
}

export async function createCategory(name: string, description = ''): Promise<any> {
  const slug = slugify(name.trim());
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) throw new Error('Cette catégorie existe déjà.');

    const { data: maxRow } = await supabase
      .from('categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order || 0) + 1;

    const { data, error } = await supabase
      .from('categories')
      .insert({ name: name.trim(), slug, description: description.trim(), sort_order: nextOrder })
      .select()
      .single();
    if (error) throw new Error('Cette catégorie existe déjà.');
    return data;
  }

  const { db } = await getSqlite();
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM Categories').get() as { m: number }
  ).m;
  const info = db
    .prepare('INSERT INTO Categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)')
    .run(name.trim(), slug, description.trim(), maxOrder + 1);
  return db.prepare('SELECT * FROM Categories WHERE id = ?').get(info.lastInsertRowid);
}

// ==================== PRODUCTS ====================

export async function getPublicProducts(filters: {
  category?: string;
  search?: string;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  bestseller?: boolean;
  isNew?: boolean;
  sort?: string;
}): Promise<any[]> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data, error } = await supabase
      .from('products')
      .select('*, categories!inner(name, slug)')
      .eq('is_active', true);

    if (error) throw new Error(error.message);
    let list = (data || []).map(formatProductRow).filter(Boolean) as any[];

    if (filters.category && filters.category !== 'all') {
      list = list.filter((p) => p.category_slug === filters.category);
    }
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q)
      );
    }
    if (filters.inStock) {
      list = list.filter((p) => p.stock_qty > 0);
    }
    if (filters.minPrice !== undefined && !Number.isNaN(filters.minPrice)) {
      list = list.filter((p) => (p.promo_price ?? p.price) >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined && !Number.isNaN(filters.maxPrice)) {
      list = list.filter((p) => (p.promo_price ?? p.price) <= filters.maxPrice!);
    }
    if (filters.bestseller) {
      list = list.filter((p) => p.is_bestseller);
    }
    if (filters.isNew) {
      list = list.filter((p) => p.is_new);
    }

    switch (filters.sort) {
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

    return list;
  }

  const { db } = await getSqlite();
  let sql = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM Products p
    JOIN Categories c ON c.id = p.category_id
    WHERE p.is_active = 1
  `;
  const params: any[] = [];
  if (filters.category && filters.category !== 'all') {
    sql += ' AND c.slug = ?';
    params.push(filters.category);
  }
  if (filters.search && filters.search.trim() !== '') {
    const q = `%${filters.search.trim()}%`;
    sql += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.reference LIKE ?)';
    params.push(q, q, q);
  }
  if (filters.inStock) {
    sql += ' AND p.stock_qty > 0';
  }
  if (filters.minPrice !== undefined && !Number.isNaN(filters.minPrice)) {
    sql += ' AND COALESCE(p.promo_price, p.price) >= ?';
    params.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined && !Number.isNaN(filters.maxPrice)) {
    sql += ' AND COALESCE(p.promo_price, p.price) <= ?';
    params.push(filters.maxPrice);
  }
  if (filters.bestseller) {
    sql += ' AND p.is_bestseller = 1';
  }
  if (filters.isNew) {
    sql += ' AND p.is_new = 1';
  }

  switch (filters.sort) {
    case 'price_asc':
      sql += ' ORDER BY COALESCE(p.promo_price, p.price) ASC';
      break;
    case 'price_desc':
      sql += ' ORDER BY COALESCE(p.promo_price, p.price) DESC';
      break;
    case 'newest':
      sql += ' ORDER BY p.is_new DESC, p.id DESC';
      break;
    default:
      sql += ' ORDER BY p.is_bestseller DESC, p.id DESC';
  }

  return db.prepare(sql).all(...params).map(formatProductRow);
}

export async function getPublicProductBySlug(
  slug: string
): Promise<{ product: any; similar: any[] } | null> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: row } = await supabase
      .from('products')
      .select('*, categories!inner(name, slug)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (!row) return null;

    const { data: simRows } = await supabase
      .from('products')
      .select('*, categories!inner(name, slug)')
      .eq('is_active', true)
      .eq('category_id', row.category_id)
      .neq('id', row.id)
      .order('is_bestseller', { ascending: false })
      .order('id', { ascending: false })
      .limit(3);

    return {
      product: formatProductRow(row),
      similar: (simRows || []).map(formatProductRow),
    };
  }

  const { db } = await getSqlite();
  const row = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM Products p
       JOIN Categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.is_active = 1`
    )
    .get(slug) as any;

  if (!row) return null;

  const similarRows = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM Products p
       JOIN Categories c ON c.id = p.category_id
       WHERE p.is_active = 1 AND p.id != ? AND p.category_id = ?
       ORDER BY p.is_bestseller DESC, p.id DESC
       LIMIT 3`
    )
    .all(row.id, row.category_id);

  return {
    product: formatProductRow(row),
    similar: similarRows.map(formatProductRow),
  };
}

export async function getAdminProducts(): Promise<any[]> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data, error } = await supabase
      .from('products')
      .select('*, categories!inner(name, slug)')
      .order('id', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(formatProductRow);
  }

  const { db } = await getSqlite();
  return db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM Products p
       JOIN Categories c ON c.id = p.category_id
       ORDER BY p.id DESC`
    )
    .all()
    .map(formatProductRow);
}

export async function createProduct(payload: any): Promise<any> {
  const {
    category_id,
    name,
    reference = '',
    description = '',
    specs = {},
    price,
    promo_price = null,
    stock_qty = 0,
    is_active = true,
    is_bestseller = false,
    is_new = true,
    images = [],
    primary_image = '',
  } = payload;

  let baseSlug = slugify(name.trim()) || `montre-${Date.now()}`;
  const imageList = Array.isArray(images) ? images.filter(Boolean) : [];
  const mainImg = primary_image || imageList[0] || '';
  const promoVal =
    promo_price !== null && promo_price !== '' && promo_price !== undefined
      ? Number(promo_price)
      : null;

  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('slug', baseSlug)
      .maybeSingle();
    if (existing) {
      baseSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        category_id: Number(category_id),
        name: name.trim(),
        slug: baseSlug,
        reference: String(reference).trim(),
        description: String(description).trim(),
        specs_json: specs || {},
        price: Number(price),
        promo_price: promoVal,
        stock_qty: Math.max(0, Math.floor(Number(stock_qty))),
        is_active: Boolean(is_active),
        is_bestseller: Boolean(is_bestseller),
        is_new: Boolean(is_new),
        images_json: imageList,
        primary_image: mainImg,
      })
      .select('*, categories!inner(name, slug)')
      .single();

    if (error) throw new Error(error.message);
    return formatProductRow(data);
  }

  const { db } = await getSqlite();
  const existing = db.prepare('SELECT id FROM Products WHERE slug = ?').get(baseSlug);
  if (existing) {
    baseSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
  }

  const info = db
    .prepare(
      `INSERT INTO Products (
        category_id, name, slug, reference, description, specs_json,
        price, promo_price, stock_qty, is_active, is_bestseller, is_new,
        images_json, primary_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(category_id),
      name.trim(),
      baseSlug,
      String(reference).trim(),
      String(description).trim(),
      JSON.stringify(specs || {}),
      Number(price),
      promoVal,
      Math.max(0, Math.floor(Number(stock_qty))),
      is_active ? 1 : 0,
      is_bestseller ? 1 : 0,
      is_new ? 1 : 0,
      JSON.stringify(imageList),
      mainImg
    );

  const created = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM Products p JOIN Categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(info.lastInsertRowid);
  return formatProductRow(created);
}

export async function updateProduct(id: number, payload: any): Promise<any | null> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: existing } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return null;

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

    const { data: updated, error } = await supabase
      .from('products')
      .update({
        category_id:
          payload.category_id !== undefined ? Number(payload.category_id) : existing.category_id,
        name: payload.name !== undefined ? String(payload.name).trim() : existing.name,
        reference:
          payload.reference !== undefined ? String(payload.reference).trim() : existing.reference,
        description:
          payload.description !== undefined
            ? String(payload.description).trim()
            : existing.description,
        specs_json: payload.specs !== undefined ? payload.specs : existing.specs_json,
        price: payload.price !== undefined ? Number(payload.price) : existing.price,
        promo_price: promoVal,
        stock_qty:
          payload.stock_qty !== undefined
            ? Math.max(0, Math.floor(Number(payload.stock_qty)))
            : existing.stock_qty,
        is_active:
          payload.is_active !== undefined ? Boolean(payload.is_active) : existing.is_active,
        is_bestseller:
          payload.is_bestseller !== undefined
            ? Boolean(payload.is_bestseller)
            : existing.is_bestseller,
        is_new: payload.is_new !== undefined ? Boolean(payload.is_new) : existing.is_new,
        images_json: imageList,
        primary_image: mainImg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, categories!inner(name, slug)')
      .single();

    if (error) throw new Error(error.message);
    return formatProductRow(updated);
  }

  const { db } = await getSqlite();
  const existing = db.prepare('SELECT * FROM Products WHERE id = ?').get(id) as any;
  if (!existing) return null;

  const {
    category_id = existing.category_id,
    name = existing.name,
    reference = existing.reference,
    description = existing.description,
    specs,
    price = existing.price,
    promo_price,
    stock_qty = existing.stock_qty,
    is_active = Boolean(existing.is_active),
    is_bestseller = Boolean(existing.is_bestseller),
    is_new = Boolean(existing.is_new),
    images,
    primary_image,
  } = payload;

  const imageList = Array.isArray(images)
    ? images.filter(Boolean)
    : JSON.parse(existing.images_json || '[]');
  const mainImg =
    primary_image !== undefined ? primary_image : existing.primary_image || imageList[0] || '';
  const promoVal =
    promo_price === undefined
      ? existing.promo_price
      : promo_price === null || promo_price === ''
      ? null
      : Number(promo_price);

  db.prepare(
    `UPDATE Products SET
      category_id = ?, name = ?, reference = ?, description = ?, specs_json = ?,
      price = ?, promo_price = ?, stock_qty = ?, is_active = ?, is_bestseller = ?, is_new = ?,
      images_json = ?, primary_image = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    Number(category_id),
    String(name).trim(),
    String(reference).trim(),
    String(description).trim(),
    specs !== undefined ? JSON.stringify(specs) : existing.specs_json,
    Number(price),
    promoVal,
    Math.max(0, Math.floor(Number(stock_qty))),
    is_active ? 1 : 0,
    is_bestseller ? 1 : 0,
    is_new ? 1 : 0,
    JSON.stringify(imageList),
    mainImg,
    id
  );

  const updated = db
    .prepare(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM Products p JOIN Categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id);
  return formatProductRow(updated);
}

export async function deleteProduct(id: number): Promise<boolean> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    return (data || []).length > 0;
  }
  const { db } = await getSqlite();
  const resDel = db.prepare('DELETE FROM Products WHERE id = ?').run(id);
  return resDel.changes > 0;
}

// ==================== ORDERS ====================

export async function createOrder(payload: {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address: string;
  city: string;
  region: string;
  notes: string;
  items: Array<{ product_id: number; quantity: number }>;
}): Promise<any> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const settings = await getSettings();
    const baseDeliveryFee = Number(settings.delivery_fee || 8);
    const freeThreshold = Number(settings.free_delivery_threshold || 500);

    const productIds = payload.items.map((it) => it.product_id);
    const { data: prodRows, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true);
    if (prodErr) throw new Error(prodErr.message);

    const prodMap = new Map<number, any>((prodRows || []).map((p: any) => [Number(p.id), p]));

    let subtotal = 0;
    const preparedItems: Array<{
      product_id: number;
      product_name: string;
      product_reference: string;
      unit_price: number;
      quantity: number;
      subtotal: number;
      prev_stock: number;
    }> = [];

    for (const item of payload.items) {
      const prod = prodMap.get(item.product_id);
      if (!prod) {
        throw new Error(`Le produit sélectionné n'est plus disponible.`);
      }
      if (Number(prod.stock_qty) < item.quantity) {
        throw new Error(
          `Stock insuffisant pour "${prod.name}" (disponible : ${prod.stock_qty}).`
        );
      }
      const unitPrice =
        prod.promo_price !== null && prod.promo_price !== undefined
          ? Number(prod.promo_price)
          : Number(prod.price);
      const lineSubtotal = unitPrice * item.quantity;
      subtotal += lineSubtotal;
      preparedItems.push({
        product_id: Number(prod.id),
        product_name: prod.name,
        product_reference: prod.reference || '',
        unit_price: unitPrice,
        quantity: item.quantity,
        subtotal: lineSubtotal,
        prev_stock: Number(prod.stock_qty),
      });
    }

    // Deduct stocks with optimistic guard and rollback on failure
    const decremented: Array<{ product_id: number; quantity: number }> = [];
    try {
      for (const pi of preparedItems) {
        const { data: upd, error: updErr } = await supabase
          .from('products')
          .update({
            stock_qty: pi.prev_stock - pi.quantity,
            updated_at: new Date().toISOString(),
          })
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

      // Upsert customer
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id, email')
        .eq('phone', payload.customer_phone)
        .maybeSingle();

      let customerId: number;
      if (existingCust) {
        customerId = Number(existingCust.id);
        await supabase
          .from('customers')
          .update({
            full_name: payload.customer_name,
            email: payload.customer_email || existingCust.email || '',
            address: payload.address,
            city: payload.city,
            region: payload.region,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId);
      } else {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            full_name: payload.customer_name,
            phone: payload.customer_phone,
            email: payload.customer_email || '',
            address: payload.address,
            city: payload.city,
            region: payload.region,
          })
          .select('id')
          .single();
        if (custErr) throw new Error(custErr.message);
        customerId = Number(newCust.id);
      }

      const year = new Date().getFullYear();
      const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true });
      const orderNumber = `MK-${year}-${String((ordersCount || 0) + 1).padStart(4, '0')}-${randomPart}`;

      const { data: createdOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: customerId,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
          customer_email: payload.customer_email || '',
          address: payload.address,
          city: payload.city,
          region: payload.region,
          notes: payload.notes || '',
          payment_method: 'Paiement à la livraison',
          status: 'en_attente',
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (orderErr) throw new Error(orderErr.message);

      const { data: createdItems, error: itemsErr } = await supabase
        .from('order_items')
        .insert(
          preparedItems.map((pi) => ({
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
      return formatOrderRow(createdOrder, createdItems || []);
    } catch (err) {
      // Restore stock for any already-decremented items
      for (const d of decremented) {
        const { data: p } = await supabase
          .from('products')
          .select('stock_qty')
          .eq('id', d.product_id)
          .maybeSingle();
        if (p) {
          await supabase
            .from('products')
            .update({ stock_qty: Number(p.stock_qty) + d.quantity })
            .eq('id', d.product_id);
        }
      }
      throw err;
    }
  }

  const { db, getSettingsObject } = await getSqlite();
  return db.transaction(() => {
    const settings = getSettingsObject();
    const baseDeliveryFee = Number(settings.delivery_fee || 8);
    const freeThreshold = Number(settings.free_delivery_threshold || 500);

    let subtotal = 0;
    const preparedItems: Array<{
      product_id: number;
      product_name: string;
      product_reference: string;
      unit_price: number;
      quantity: number;
      line_subtotal: number;
    }> = [];

    for (const item of payload.items) {
      const prod = db
        .prepare('SELECT * FROM Products WHERE id = ? AND is_active = 1')
        .get(item.product_id) as any;

      if (!prod) {
        throw new Error(`Le produit sélectionné n'est plus disponible.`);
      }
      if (prod.stock_qty < item.quantity) {
        throw new Error(
          `Stock insuffisant pour "${prod.name}" (disponible : ${prod.stock_qty}).`
        );
      }

      const unitPrice =
        prod.promo_price !== null && prod.promo_price !== undefined
          ? Number(prod.promo_price)
          : Number(prod.price);
      const lineSubtotal = unitPrice * item.quantity;
      subtotal += lineSubtotal;

      preparedItems.push({
        product_id: prod.id,
        product_name: prod.name,
        product_reference: prod.reference || '',
        unit_price: unitPrice,
        quantity: item.quantity,
        line_subtotal: lineSubtotal,
      });

      db.prepare(
        "UPDATE Products SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ?"
      ).run(item.quantity, prod.id);
    }

    const deliveryFee = subtotal >= freeThreshold ? 0 : baseDeliveryFee;
    const totalAmount = subtotal + deliveryFee;

    const existingCustomer = db
      .prepare('SELECT id FROM Customers WHERE phone = ?')
      .get(payload.customer_phone) as { id: number } | undefined;

    let customerId: number;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      db.prepare(
        `UPDATE Customers
         SET full_name = ?, email = COALESCE(NULLIF(?, ''), email),
             address = ?, city = ?, region = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        payload.customer_name,
        payload.customer_email,
        payload.address,
        payload.city,
        payload.region,
        customerId
      );
    } else {
      const custRes = db
        .prepare(
          `INSERT INTO Customers (full_name, phone, email, address, city, region)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          payload.customer_name,
          payload.customer_phone,
          payload.customer_email,
          payload.address,
          payload.city,
          payload.region
        );
      customerId = Number(custRes.lastInsertRowid);
    }

    const year = new Date().getFullYear();
    const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    const countRow = db.prepare('SELECT COUNT(*) as c FROM Orders').get() as { c: number };
    const orderNumber = `MK-${year}-${String(countRow.c + 1).padStart(4, '0')}-${randomPart}`;

    const orderRes = db
      .prepare(
        `INSERT INTO Orders (
          order_number, customer_id, customer_name, customer_phone, customer_email,
          address, city, region, notes, payment_method, status, delivery_fee, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paiement à la livraison', 'en_attente', ?, ?)`
      )
      .run(
        orderNumber,
        customerId,
        payload.customer_name,
        payload.customer_phone,
        payload.customer_email,
        payload.address,
        payload.city,
        payload.region,
        payload.notes,
        deliveryFee,
        totalAmount
      );

    const orderId = Number(orderRes.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO OrderItems (order_id, product_id, product_name, product_reference, unit_price, quantity, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const pi of preparedItems) {
      insertItem.run(
        orderId,
        pi.product_id,
        pi.product_name,
        pi.product_reference,
        pi.unit_price,
        pi.quantity,
        pi.line_subtotal
      );
    }

    const createdOrder = db.prepare('SELECT * FROM Orders WHERE id = ?').get(orderId) as any;
    const createdItems = db.prepare('SELECT * FROM OrderItems WHERE order_id = ?').all(orderId);
    return { ...createdOrder, items: createdItems };
  })();
}

export async function getAdminOrders(filters: {
  status?: string;
  search?: string;
}): Promise<any[]> {
  if (supabase) {
    await ensureSupabaseSeeded();
    let query = supabase.from('orders').select('*').order('id', { ascending: false });
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);

    let list = orders || [];
    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (o: any) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_phone.toLowerCase().includes(q)
      );
    }

    if (list.length === 0) return [];
    const orderIds = list.map((o: any) => o.id);
    const { data: allItems } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    const itemsByOrder = new Map<number, any[]>();
    for (const it of allItems || []) {
      const oid = Number(it.order_id);
      if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
      itemsByOrder.get(oid)!.push(it);
    }

    return list.map((o: any) => formatOrderRow(o, itemsByOrder.get(Number(o.id)) || []));
  }

  const { db } = await getSqlite();
  let sql = 'SELECT * FROM Orders WHERE 1=1';
  const params: any[] = [];
  if (filters.status && filters.status !== 'all') {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.search && filters.search.trim() !== '') {
    const q = `%${filters.search.trim()}%`;
    sql += ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
    params.push(q, q, q);
  }
  sql += ' ORDER BY id DESC';

  const orders = db.prepare(sql).all(...params) as any[];
  const getItems = db.prepare('SELECT * FROM OrderItems WHERE order_id = ?');
  return orders.map((o) => ({ ...o, items: getItems.all(o.id) }));
}

export async function updateOrderStatus(id: number, status: string): Promise<any | null> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: existing } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (!existing) return null;

    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', id);

    if (existing.status !== 'annulee' && status === 'annulee') {
      for (const item of items || []) {
        if (item.product_id) {
          const { data: p } = await supabase
            .from('products')
            .select('stock_qty')
            .eq('id', item.product_id)
            .maybeSingle();
          if (p) {
            await supabase
              .from('products')
              .update({ stock_qty: Number(p.stock_qty) + Number(item.quantity) })
              .eq('id', item.product_id);
          }
        }
      }
    }

    if (existing.status === 'annulee' && status !== 'annulee') {
      for (const item of items || []) {
        if (item.product_id) {
          const { data: p } = await supabase
            .from('products')
            .select('stock_qty')
            .eq('id', item.product_id)
            .maybeSingle();
          if (p) {
            await supabase
              .from('products')
              .update({ stock_qty: Math.max(0, Number(p.stock_qty) - Number(item.quantity)) })
              .eq('id', item.product_id);
          }
        }
      }
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return formatOrderRow(updated, items || []);
  }

  const { db } = await getSqlite();
  return db.transaction(() => {
    const existing = db.prepare('SELECT * FROM Orders WHERE id = ?').get(id) as any;
    if (!existing) return null;

    const items = db.prepare('SELECT * FROM OrderItems WHERE order_id = ?').all(id) as any[];
    if (existing.status !== 'annulee' && status === 'annulee') {
      for (const item of items) {
        if (item.product_id) {
          db.prepare('UPDATE Products SET stock_qty = stock_qty + ? WHERE id = ?').run(
            item.quantity,
            item.product_id
          );
        }
      }
    }
    if (existing.status === 'annulee' && status !== 'annulee') {
      for (const item of items) {
        if (item.product_id) {
          db.prepare(
            'UPDATE Products SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?'
          ).run(item.quantity, item.product_id);
        }
      }
    }

    db.prepare("UPDATE Orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      id
    );
    const order = db.prepare('SELECT * FROM Orders WHERE id = ?').get(id) as any;
    return { ...order, items };
  })();
}

// ==================== AVAILABILITY & APPOINTMENTS ====================

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

export async function getDayAvailability(dateStr: string) {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr < todayStr) {
    return { isWorkingDay: false, isBlockedDay: false, slots: [], past: true };
  }

  let info: { isWorkingDay: boolean; isBlockedDay: boolean; slots: string[] };

  if (supabase) {
    await ensureSupabaseSeeded();
    const [{ data: slotRows }, { data: bookedRows }] = await Promise.all([
      supabase.from('availability_slots').select('*'),
      supabase
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
    info = computeDaySlotsFromData(dateStr, schedulesByDay, blockedForDate, bookedSet);
  } else {
    const { getAvailableSlotsForDate } = await getSqlite();
    info = getAvailableSlotsForDate(dateStr);
  }

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

export async function getMonthAvailability(monthStr: string) {
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const result: Record<
    string,
    { availableCount: number; isWorkingDay: boolean; isBlockedDay: boolean; isPast: boolean }
  > = {};

  if (supabase) {
    await ensureSupabaseSeeded();
    const monthStart = `${monthStr}-01`;
    const monthEnd = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    const [{ data: slotRows }, { data: bookedRows }] = await Promise.all([
      supabase.from('availability_slots').select('*'),
      supabase
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

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      if (dateStr < todayStr) {
        result[dateStr] = {
          availableCount: 0,
          isWorkingDay: false,
          isBlockedDay: false,
          isPast: true,
        };
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
    return result;
  }

  const { getAvailableSlotsForDate } = await getSqlite();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
    if (dateStr < todayStr) {
      result[dateStr] = {
        availableCount: 0,
        isWorkingDay: false,
        isBlockedDay: false,
        isPast: true,
      };
      continue;
    }
    const info = getAvailableSlotsForDate(dateStr);
    result[dateStr] = {
      availableCount: info.slots.length,
      isWorkingDay: info.isWorkingDay,
      isBlockedDay: info.isBlockedDay,
      isPast: false,
    };
  }
  return result;
}

export async function createPublicAppointment(payload: {
  customer_name: string;
  customer_phone: string;
  watch_type: string;
  problem_description: string;
  appointment_date: string;
  appointment_time: string;
}) {
  if (supabase) {
    await ensureSupabaseSeeded();
    const avail = await getDayAvailability(payload.appointment_date);
    if (!avail.slots.includes(payload.appointment_time)) {
      throw new Error('SLOT_TAKEN');
    }

    const { data: existingCust } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', payload.customer_phone)
      .maybeSingle();

    let customerId: number;
    if (existingCust) {
      customerId = Number(existingCust.id);
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert({ full_name: payload.customer_name, phone: payload.customer_phone })
        .select('id')
        .single();
      if (custErr) throw new Error(custErr.message);
      customerId = Number(newCust.id);
    }

    const refCode = `RDV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        reference_code: refCode,
        customer_id: customerId,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        watch_type: payload.watch_type,
        problem_description: payload.problem_description,
        appointment_date: payload.appointment_date,
        appointment_time: payload.appointment_time,
        status: 'en_attente',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || String(error.message).toLowerCase().includes('unique')) {
        throw new Error('SLOT_TAKEN');
      }
      throw new Error(error.message);
    }
    return data;
  }

  const { db, getAvailableSlotsForDate } = await getSqlite();
  return db.transaction(() => {
    const availability = getAvailableSlotsForDate(payload.appointment_date);
    if (!availability.slots.includes(payload.appointment_time)) {
      throw new Error('SLOT_TAKEN');
    }

    const existingCustomer = db
      .prepare('SELECT id FROM Customers WHERE phone = ?')
      .get(payload.customer_phone) as { id: number } | undefined;

    let customerId: number;
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const custRes = db
        .prepare('INSERT INTO Customers (full_name, phone) VALUES (?, ?)')
        .run(payload.customer_name, payload.customer_phone);
      customerId = Number(custRes.lastInsertRowid);
    }

    const refCode = `RDV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const ins = db
      .prepare(
        `INSERT INTO Appointments (
          reference_code, customer_id, customer_name, customer_phone,
          watch_type, problem_description, appointment_date, appointment_time, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')`
      )
      .run(
        refCode,
        customerId,
        payload.customer_name,
        payload.customer_phone,
        payload.watch_type,
        payload.problem_description,
        payload.appointment_date,
        payload.appointment_time
      );

    return db.prepare('SELECT * FROM Appointments WHERE id = ?').get(ins.lastInsertRowid);
  })();
}

export async function getAdminAppointments(filters: { date?: string; status?: string }) {
  if (supabase) {
    await ensureSupabaseSeeded();
    let query = supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });
    if (filters.date) query = query.eq('appointment_date', filters.date);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  const { db } = await getSqlite();
  let sql = 'SELECT * FROM Appointments WHERE 1=1';
  const params: any[] = [];
  if (filters.date) {
    sql += ' AND appointment_date = ?';
    params.push(filters.date);
  }
  if (filters.status && filters.status !== 'all') {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  sql += ' ORDER BY appointment_date ASC, appointment_time ASC';
  return db.prepare(sql).all(...params);
}

export async function createAdminAppointment(payload: {
  customer_name: string;
  customer_phone: string;
  watch_type: string;
  problem_description: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  admin_notes: string;
}) {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('appointment_date', payload.appointment_date)
      .eq('appointment_time', payload.appointment_time)
      .neq('status', 'annule')
      .maybeSingle();

    if (conflict) {
      throw new Error('Ce créneau est déjà occupé par un autre rendez-vous.');
    }

    const { data: existingCust } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', payload.customer_phone)
      .maybeSingle();

    let customerId: number;
    if (existingCust) {
      customerId = Number(existingCust.id);
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert({ full_name: payload.customer_name, phone: payload.customer_phone })
        .select('id')
        .single();
      if (custErr) throw new Error(custErr.message);
      customerId = Number(newCust.id);
    }

    const refCode = `RDV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        reference_code: refCode,
        customer_id: customerId,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
        watch_type: payload.watch_type,
        problem_description: payload.problem_description,
        appointment_date: payload.appointment_date,
        appointment_time: payload.appointment_time,
        status: payload.status,
        admin_notes: payload.admin_notes,
      })
      .select()
      .single();

    if (error) throw new Error('Ce créneau est déjà occupé par un autre rendez-vous.');
    return data;
  }

  const { db } = await getSqlite();
  return db.transaction(() => {
    const conflict = db
      .prepare(
        "SELECT id FROM Appointments WHERE appointment_date = ? AND appointment_time = ? AND status != 'annule'"
      )
      .get(payload.appointment_date, payload.appointment_time);

    if (conflict) {
      throw new Error('Ce créneau est déjà occupé par un autre rendez-vous.');
    }

    const existingCust = db
      .prepare('SELECT id FROM Customers WHERE phone = ?')
      .get(payload.customer_phone) as { id: number } | undefined;
    let customerId: number;
    if (existingCust) {
      customerId = existingCust.id;
    } else {
      const custRes = db
        .prepare('INSERT INTO Customers (full_name, phone) VALUES (?, ?)')
        .run(payload.customer_name, payload.customer_phone);
      customerId = Number(custRes.lastInsertRowid);
    }

    const refCode = `RDV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const ins = db
      .prepare(
        `INSERT INTO Appointments (
          reference_code, customer_id, customer_name, customer_phone,
          watch_type, problem_description, appointment_date, appointment_time,
          status, admin_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        refCode,
        customerId,
        payload.customer_name,
        payload.customer_phone,
        payload.watch_type,
        payload.problem_description,
        payload.appointment_date,
        payload.appointment_time,
        payload.status,
        payload.admin_notes
      );

    return db.prepare('SELECT * FROM Appointments WHERE id = ?').get(ins.lastInsertRowid);
  })();
}

export async function updateAdminAppointment(id: number, payload: any) {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: existing } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return { notFound: true };

    const nextDate = payload.appointment_date ?? existing.appointment_date;
    const nextTime = payload.appointment_time ?? existing.appointment_time;
    const nextStatus = payload.status ?? existing.status;

    if (
      nextStatus !== 'annule' &&
      (nextDate !== existing.appointment_date || nextTime !== existing.appointment_time)
    ) {
      const { data: conflict } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', nextDate)
        .eq('appointment_time', nextTime)
        .neq('status', 'annule')
        .neq('id', id)
        .maybeSingle();

      if (conflict) {
        return { conflict: true };
      }
    }

    const { data, error } = await supabase
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
      if (error.code === '23505') return { conflict: true };
      throw new Error(error.message);
    }
    return { appointment: data };
  }

  const { db } = await getSqlite();
  const existing = db.prepare('SELECT * FROM Appointments WHERE id = ?').get(id) as any;
  if (!existing) return { notFound: true };

  const {
    appointment_date = existing.appointment_date,
    appointment_time = existing.appointment_time,
    status = existing.status,
    admin_notes = existing.admin_notes,
    watch_type = existing.watch_type,
    problem_description = existing.problem_description,
  } = payload;

  if (
    status !== 'annule' &&
    (appointment_date !== existing.appointment_date || appointment_time !== existing.appointment_time)
  ) {
    const conflict = db
      .prepare(
        "SELECT id FROM Appointments WHERE appointment_date = ? AND appointment_time = ? AND status != 'annule' AND id != ?"
      )
      .get(appointment_date, appointment_time, id);
    if (conflict) return { conflict: true };
  }

  db.prepare(
    `UPDATE Appointments
     SET appointment_date = ?, appointment_time = ?, status = ?, admin_notes = ?,
         watch_type = ?, problem_description = ?
     WHERE id = ?`
  ).run(appointment_date, appointment_time, status, admin_notes, watch_type, problem_description, id);

  return { appointment: db.prepare('SELECT * FROM Appointments WHERE id = ?').get(id) };
}

export async function getAdminAvailability() {
  if (supabase) {
    await ensureSupabaseSeeded();
    const [{ data: schedules }, { data: blocked }] = await Promise.all([
      supabase
        .from('availability_slots')
        .select('*')
        .eq('slot_type', 'schedule')
        .order('day_of_week', { ascending: true }),
      supabase
        .from('availability_slots')
        .select('*')
        .eq('slot_type', 'blocked')
        .order('specific_date', { ascending: true })
        .order('start_time', { ascending: true }),
    ]);

    return {
      schedules: (schedules || []).map((r: any) => ({
        ...r,
        is_working_day: Boolean(r.is_working_day),
      })),
      blocked: blocked || [],
    };
  }

  const { db } = await getSqlite();
  const schedules = db
    .prepare("SELECT * FROM AvailabilitySlots WHERE slot_type = 'schedule' ORDER BY day_of_week ASC")
    .all()
    .map((r: any) => ({ ...r, is_working_day: Boolean(r.is_working_day) }));

  const blocked = db
    .prepare(
      "SELECT * FROM AvailabilitySlots WHERE slot_type = 'blocked' ORDER BY specific_date ASC, start_time ASC"
    )
    .all();

  return { schedules, blocked };
}

export async function updateAvailabilitySchedule(schedules: any[]) {
  if (supabase) {
    await ensureSupabaseSeeded();
    for (const s of schedules) {
      await supabase
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
    return;
  }

  const { db } = await getSqlite();
  const updateStmt = db.prepare(`
    UPDATE AvailabilitySlots
    SET start_time = ?, end_time = ?, slot_duration_min = ?, is_working_day = ?
    WHERE slot_type = 'schedule' AND day_of_week = ?
  `);

  db.transaction(() => {
    for (const s of schedules) {
      updateStmt.run(
        s.start_time || '09:00',
        s.end_time || '18:00',
        Number(s.slot_duration_min) || 60,
        s.is_working_day ? 1 : 0,
        Number(s.day_of_week)
      );
    }
  })();
}

export async function blockAvailabilitySlot(payload: {
  specific_date: string;
  start_time: string | null;
  reason: string;
}) {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data, error } = await supabase
      .from('availability_slots')
      .insert({
        slot_type: 'blocked',
        specific_date: payload.specific_date,
        start_time: payload.start_time || null,
        is_blocked: true,
        reason: payload.reason,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { db } = await getSqlite();
  const ins = db
    .prepare(
      `INSERT INTO AvailabilitySlots (slot_type, specific_date, start_time, is_blocked, reason)
       VALUES ('blocked', ?, ?, 1, ?)`
    )
    .run(payload.specific_date, payload.start_time || null, payload.reason);

  return db.prepare('SELECT * FROM AvailabilitySlots WHERE id = ?').get(ins.lastInsertRowid);
}

export async function unblockAvailabilitySlot(id: number) {
  if (supabase) {
    await ensureSupabaseSeeded();
    await supabase.from('availability_slots').delete().eq('id', id).eq('slot_type', 'blocked');
    return;
  }
  const { db } = await getSqlite();
  db.prepare("DELETE FROM AvailabilitySlots WHERE id = ? AND slot_type = 'blocked'").run(id);
}

// ==================== ADMIN AUTH & STATS ====================

export async function loginAdmin(username: string, password: string) {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return null;
    }

    await supabase
      .from('admin_sessions')
      .delete()
      .lte('expires_at', new Date().toISOString());

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('admin_sessions').insert({
      token,
      admin_id: admin.id,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    return {
      token,
      admin: {
        id: Number(admin.id),
        username: admin.username,
        full_name: admin.full_name,
        role: admin.role,
      },
    };
  }

  const { db } = await getSqlite();
  const admin = db.prepare('SELECT * FROM Admins WHERE username = ?').get(username) as any;
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return null;
  }

  db.prepare("DELETE FROM AdminSessions WHERE expires_at <= datetime('now')").run();
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    "INSERT INTO AdminSessions (token, admin_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))"
  ).run(token, admin.id);

  return {
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      full_name: admin.full_name,
      role: admin.role,
    },
  };
}

export async function getAdminSession(token: string) {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data } = await supabase
      .from('admin_sessions')
      .select('token, expires_at, admins!inner(id, username, full_name, role)')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!data || !data.admins) return null;
    const adm: any = Array.isArray(data.admins) ? data.admins[0] : data.admins;
    return {
      token: data.token,
      admin: {
        id: Number(adm.id),
        username: adm.username,
        full_name: adm.full_name,
        role: adm.role,
      },
    };
  }

  const { db } = await getSqlite();
  const session = db
    .prepare(
      `SELECT s.token, a.id, a.username, a.full_name, a.role
       FROM AdminSessions s
       JOIN Admins a ON a.id = s.admin_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as
    | { token: string; id: number; username: string; full_name: string; role: string }
    | undefined;

  if (!session) return null;
  return {
    token: session.token,
    admin: {
      id: session.id,
      username: session.username,
      full_name: session.full_name,
      role: session.role,
    },
  };
}

export async function logoutAdmin(token: string) {
  if (supabase) {
    await supabase.from('admin_sessions').delete().eq('token', token);
    return;
  }
  const { db } = await getSqlite();
  db.prepare('DELETE FROM AdminSessions WHERE token = ?').run(token);
}

export async function changeAdminPassword(
  adminId: number,
  currentToken: string,
  currentPass: string,
  newPass: string
): Promise<'ok' | 'bad_password'> {
  if (supabase) {
    await ensureSupabaseSeeded();
    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .maybeSingle();

    if (!admin || !bcrypt.compareSync(currentPass, admin.password_hash)) {
      return 'bad_password';
    }

    const nextHash = bcrypt.hashSync(newPass, 12);
    await supabase.from('admins').update({ password_hash: nextHash }).eq('id', adminId);
    await supabase
      .from('admin_sessions')
      .delete()
      .eq('admin_id', adminId)
      .neq('token', currentToken);
    return 'ok';
  }

  const { db } = await getSqlite();
  const admin = db.prepare('SELECT * FROM Admins WHERE id = ?').get(adminId) as any;
  if (!admin || !bcrypt.compareSync(currentPass, admin.password_hash)) {
    return 'bad_password';
  }
  const nextHash = bcrypt.hashSync(newPass, 12);
  db.prepare('UPDATE Admins SET password_hash = ? WHERE id = ?').run(nextHash, adminId);
  db.prepare('DELETE FROM AdminSessions WHERE admin_id = ? AND token != ?').run(
    adminId,
    currentToken
  );
  return 'ok';
}

function toLocalYMD(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function getAdminStats(period: 'today' | 'week' | 'month') {
  if (supabase) {
    await ensureSupabaseSeeded();
    const [
      { data: allOrders },
      { count: availableProducts },
      { count: totalCustomers },
      { data: allAppts },
    ] = await Promise.all([
      supabase.from('orders').select('total_amount, status, created_at'),
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gt('stock_qty', 0),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('appointments').select('status'),
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
        const rev = (byHour.get(h1)?.revenue || 0) + (byHour.get(h2)?.revenue || 0);
        const ord = (byHour.get(h1)?.orders || 0) + (byHour.get(h2)?.orders || 0);
        chartData.push({ date: `${h1}:00`, label: `${h1}h`, revenue: rev, orders: ord });
      }
    } else {
      const daysCount = period === 'week' ? 7 : 30;
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = toLocalYMD(d);
        const label = `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
        chartData.push({
          date: dateKey,
          label,
          revenue: byDay.get(dateKey)?.revenue || 0,
          orders: byDay.get(dateKey)?.orders || 0,
        });
      }
    }

    const apptsList = allAppts || [];
    const pendingAppts = apptsList.filter((a: any) => a.status === 'en_attente').length;

    return {
      period,
      total_revenue: totalRevenue,
      today_revenue: todayRevenue,
      week_revenue: weekRevenue,
      month_revenue: monthRevenue,
      period_revenue:
        period === 'today' ? todayRevenue : period === 'week' ? weekRevenue : monthRevenue,
      period_orders:
        period === 'today' ? todayOrders : period === 'week' ? weekOrders : monthOrders,
      total_orders: ordersList.length,
      pending_orders: pendingOrders,
      available_products: availableProducts || 0,
      total_customers: totalCustomers || 0,
      total_appointments: apptsList.length,
      pending_appointments: pendingAppts,
      chart_data: chartData,
    };
  }

  // SQLite path
  const { db } = await getSqlite();
  const totalRevRow = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) as v FROM Orders WHERE status != 'annulee'")
    .get() as { v: number };
  const todayRevRow = db
    .prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as v, COUNT(*) as c FROM Orders WHERE status != 'annulee' AND date(created_at, 'localtime') = date('now', 'localtime')"
    )
    .get() as { v: number; c: number };
  const weekRevRow = db
    .prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as v, COUNT(*) as c FROM Orders WHERE status != 'annulee' AND date(created_at, 'localtime') >= date('now', 'localtime', '-6 days')"
    )
    .get() as { v: number; c: number };
  const monthRevRow = db
    .prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as v, COUNT(*) as c FROM Orders WHERE status != 'annulee' AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')"
    )
    .get() as { v: number; c: number };

  const totalOrdersRow = db.prepare('SELECT COUNT(*) as c FROM Orders').get() as { c: number };
  const pendingOrdersRow = db
    .prepare("SELECT COUNT(*) as c FROM Orders WHERE status = 'en_attente'")
    .get() as { c: number };
  const availableProductsRow = db
    .prepare('SELECT COUNT(*) as c FROM Products WHERE is_active = 1 AND stock_qty > 0')
    .get() as { c: number };
  const customersRow = db.prepare('SELECT COUNT(*) as c FROM Customers').get() as { c: number };
  const appointmentsRow = db.prepare('SELECT COUNT(*) as c FROM Appointments').get() as {
    c: number;
  };
  const pendingAppRow = db
    .prepare("SELECT COUNT(*) as c FROM Appointments WHERE status = 'en_attente'")
    .get() as { c: number };

  const daysCount = period === 'today' ? 1 : period === 'week' ? 7 : 30;
  const chartData: Array<{ date: string; label: string; revenue: number; orders: number }> = [];

  if (period === 'today') {
    const hourlyRows = db
      .prepare(
        `SELECT strftime('%H', created_at, 'localtime') as hr,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as orders
         FROM Orders
         WHERE status != 'annulee' AND date(created_at, 'localtime') = date('now', 'localtime')
         GROUP BY hr`
      )
      .all() as Array<{ hr: string; revenue: number; orders: number }>;
    const hrMap = Object.fromEntries(hourlyRows.map((r) => [r.hr, r]));
    for (let h = 8; h <= 22; h += 2) {
      const h1 = String(h).padStart(2, '0');
      const h2 = String(h + 1).padStart(2, '0');
      const rev = (hrMap[h1]?.revenue || 0) + (hrMap[h2]?.revenue || 0);
      const ord = (hrMap[h1]?.orders || 0) + (hrMap[h2]?.orders || 0);
      chartData.push({ date: `${h1}:00`, label: `${h1}h`, revenue: Number(rev), orders: Number(ord) });
    }
  } else {
    const dailyRows = db
      .prepare(
        `SELECT date(created_at, 'localtime') as day,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as orders
         FROM Orders
         WHERE status != 'annulee' AND date(created_at, 'localtime') >= date('now', 'localtime', ?)
         GROUP BY day`
      )
      .all(`-${daysCount - 1} days`) as Array<{ day: string; revenue: number; orders: number }>;
    const dayMap = Object.fromEntries(dailyRows.map((r) => [r.day, r]));

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = toLocalYMD(d);
      const label = `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
      chartData.push({
        date: dateKey,
        label,
        revenue: Number(dayMap[dateKey]?.revenue || 0),
        orders: Number(dayMap[dateKey]?.orders || 0),
      });
    }
  }

  return {
    period,
    total_revenue: Number(totalRevRow.v),
    today_revenue: Number(todayRevRow.v),
    week_revenue: Number(weekRevRow.v),
    month_revenue: Number(monthRevRow.v),
    period_revenue: Number(
      period === 'today' ? todayRevRow.v : period === 'week' ? weekRevRow.v : monthRevRow.v
    ),
    period_orders: Number(
      period === 'today' ? todayRevRow.c : period === 'week' ? weekRevRow.c : monthRevRow.c
    ),
    total_orders: Number(totalOrdersRow.c),
    pending_orders: Number(pendingOrdersRow.c),
    available_products: Number(availableProductsRow.c),
    total_customers: Number(customersRow.c),
    total_appointments: Number(appointmentsRow.c),
    pending_appointments: Number(pendingAppRow.c),
    chart_data: chartData,
  };
}
