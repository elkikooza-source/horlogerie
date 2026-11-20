import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'horlogerie-zeina-data')
  : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'horlogerie.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS AdminSessions (
      token TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES Admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      reference TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      specs_json TEXT NOT NULL DEFAULT '{}',
      price REAL NOT NULL,
      promo_price REAL,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      is_new INTEGER NOT NULL DEFAULT 0,
      images_json TEXT NOT NULL DEFAULT '[]',
      primary_image TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES Categories(id)
    );

    CREATE TABLE IF NOT EXISTS Customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS Orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'Paiement à la livraison',
      status TEXT NOT NULL DEFAULT 'en_attente',
      delivery_fee REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS OrderItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      product_reference TEXT NOT NULL DEFAULT '',
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      watch_type TEXT NOT NULL,
      problem_description TEXT NOT NULL DEFAULT '',
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'en_attente',
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_appointment
      ON Appointments(appointment_date, appointment_time)
      WHERE status != 'annule';

    CREATE TABLE IF NOT EXISTS AvailabilitySlots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_type TEXT NOT NULL, -- 'schedule' | 'blocked'
      day_of_week INTEGER,     -- 0..6 for 'schedule'
      specific_date TEXT,      -- YYYY-MM-DD for 'blocked'
      start_time TEXT,         -- HH:MM
      end_time TEXT,           -- HH:MM
      slot_duration_min INTEGER NOT NULL DEFAULT 60,
      is_working_day INTEGER NOT NULL DEFAULT 1,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS BusinessSettings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  // 1. Default Admin
  const adminCount = (db.prepare('SELECT COUNT(*) as c FROM Admins').get() as { c: number }).c;
  if (adminCount === 0) {
    const hash = bcrypt.hashSync('Kanalou2026!', 10);
    db.prepare(
      'INSERT INTO Admins (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run('admin', hash, 'Maître Horloger — Direction', 'superadmin');
  }

  // 2. Categories
  const catCount = (db.prepare('SELECT COUNT(*) as c FROM Categories').get() as { c: number }).c;
  if (catCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO Categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)'
    );
    insertCat.run(
      'Montres Hommes',
      'hommes',
      'Chronographes mécaniques, calibres automatiques et garde-temps de caractère.',
      1
    );
    insertCat.run(
      'Montres Femmes',
      'femmes',
      'Pièces raffinées en or champagne, cadrans nacrés et mailles milanaises.',
      2
    );
    insertCat.run(
      'Bracelets & Accessoires',
      'accessoires',
      'Bracelets en cuir italien cousu main, boucles déployantes et outils horlogers.',
      3
    );
  }

  // 3. Initial Curated Products
  const prodCount = (db.prepare('SELECT COUNT(*) as c FROM Products').get() as { c: number }).c;
  if (prodCount === 0) {
    const cats = db.prepare('SELECT id, slug FROM Categories').all() as Array<{
      id: number;
      slug: string;
    }>;
    const catMap = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

    const insertProd = db.prepare(`
      INSERT INTO Products (
        category_id, name, slug, reference, description, specs_json,
        price, promo_price, stock_qty, is_active, is_bestseller, is_new,
        images_json, primary_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `);

    const heroImg = '/src/assets/images/hero_luxury_watch_1795182946775.jpg';
    const menChrono = '/src/assets/images/watch_men_chronograph_1795182913892.jpg';
    const menSteel = '/src/assets/images/watch_men_steel_1795182913137.jpg';
    const womenGold = '/src/assets/images/watch_women_gold_1795182912356.jpg';
    const accStraps = '/src/assets/images/watch_accessories_straps_1795182913032.jpg';

    insertProd.run(
      catMap['hommes'],
      'Chronographe Zeina Obsidienne',
      'chronographe-zeina-obsidienne',
      'MK-CHR-01',
      'Boîtier en acier brossé PVD obsidienne rehaussé d’une lunette cannelée en or champagne. Mouvement chronographe automatique de haute précision avec réserve de marche de 48 heures et verre saphir antireflet.',
      JSON.stringify({
        movement: 'Automatique Calibre MK-7750',
        case_material: 'Acier 316L PVD Obsidienne & Or Champagne',
        diameter: '41 mm',
        water_resistance: '100 m (10 ATM)',
        strap: 'Acier brossé intégral',
        warranty: '2 ans Atelier Horlogerie Zeina',
      }),
      1890,
      1650,
      7,
      1,
      1,
      JSON.stringify([heroImg, menChrono]),
      heroImg
    );

    insertProd.run(
      catMap['hommes'],
      'Chronographe Héritage Or & Alligator',
      'chronographe-heritage-or-alligator',
      'MK-HER-02',
      'Un grand classique horloger associant un boîtier poli doré champagne à un cadran anthracite soleillé et trois compteurs harmonieusement équilibrés. Monté sur un bracelet en cuir noir grain alligator.',
      JSON.stringify({
        movement: 'Automatique Suisse 28 800 A/h',
        case_material: 'Acier inoxydable plaqué Or Champagne 18k',
        diameter: '40 mm',
        water_resistance: '50 m (5 ATM)',
        strap: 'Cuir noir surpiqué main',
        warranty: '2 ans Atelier Horlogerie Zeina',
      }),
      1540,
      null,
      5,
      1,
      0,
      JSON.stringify([menChrono, heroImg]),
      menChrono
    );

    insertProd.run(
      catMap['hommes'],
      'Zaghouan Acier Calibre 01',
      'zaghouan-acier-calibre-01',
      'MK-ZAG-03',
      'Dessinée pour le quotidien exigeant, la Zaghouan Calibre 01 allie sobriété architecturale, index bâtons dorés luminescents et bracelet en acier brossé à maillons pleins avec boucle déployante.',
      JSON.stringify({
        movement: 'Automatique 3 aiguilles + date',
        case_material: 'Acier chirurgical 316L brossé satin',
        diameter: '39 mm',
        water_resistance: '100 m (10 ATM)',
        strap: 'Acier brossé massif',
        warranty: '2 ans Atelier Horlogerie Zeina',
      }),
      1180,
      980,
      11,
      0,
      1,
      JSON.stringify([menSteel, menChrono]),
      menSteel
    );

    insertProd.run(
      catMap['femmes'],
      'Aurore Nacre Champagne',
      'aurore-nacre-champagne',
      'MK-AUR-04',
      'D’une finesse remarquable (6,4 mm d’épaisseur), le modèle Aurore marie la luminosité naturelle de la nacre véritable à la souplesse d’un bracelet en maille milanaise tissée or champagne.',
      JSON.stringify({
        movement: 'Quartz Suisse Haute Précision',
        case_material: 'Acier doré champagne poli miroir',
        diameter: '34 mm',
        water_resistance: '30 m (3 ATM)',
        strap: 'Maille milanaise ajustable',
        warranty: '2 ans Atelier Horlogerie Zeina',
      }),
      790,
      690,
      9,
      1,
      1,
      JSON.stringify([womenGold]),
      womenGold
    );

    insertProd.run(
      catMap['femmes'],
      'Solstice Maille Dorée 32mm',
      'solstice-maille-doree-32',
      'MK-SOL-05',
      'Épure absolue au poignet féminin. Cadran nacre ivoire sans chiffres, aiguilles dauphines facettées et verre saphir inrayable pour accompagner chaque instant avec discrétion.',
      JSON.stringify({
        movement: 'Mouvement Suisse Ronda',
        case_material: 'Acier inoxydable PVD Or Champagne',
        diameter: '32 mm',
        water_resistance: '50 m (5 ATM)',
        strap: 'Maille milanaise fine 14 mm',
        warranty: '2 ans Atelier Horlogerie Zeina',
      }),
      720,
      null,
      6,
      0,
      1,
      JSON.stringify([womenGold]),
      womenGold
    );

    insertProd.run(
      catMap['accessoires'],
      'Duo Bracelets Cuir Italien & Outil',
      'duo-bracelets-cuir-italien-outil',
      'MK-ACC-06',
      'Ensemble complet comprenant deux bracelets en cuir pleine fleur italien (Cognac patiné et Noir grainé) équipés de pompes rapides et d’un outil chasse-pompe en laiton massif.',
      JSON.stringify({
        movement: 'Compatible entrecornes 20 mm',
        case_material: 'Boucles ardillon acier doré champagne',
        diameter: 'Largeur 20 mm / 18 mm',
        water_resistance: 'Cuir traité hydrofuge',
        strap: 'Cuir pleine fleur tannage végétal',
        warranty: '1 an Atelier Horlogerie Zeina',
      }),
      260,
      215,
      18,
      1,
      1,
      JSON.stringify([accStraps]),
      accStraps
    );

    insertProd.run(
      catMap['accessoires'],
      'Rouleau de Voyage Horloger Suédine',
      'rouleau-voyage-horloger-suedine',
      'MK-ACC-07',
      'Étui de transport artisanal pour 3 montres, confectionné en suédine chocolat doublée de velours beige protecteur avec boutons-pression dorés et coussins amovibles.',
      JSON.stringify({
        movement: 'Capacité 3 garde-temps',
        case_material: 'Suédine & cuir grainé',
        diameter: '22 × 10 × 9 cm',
        water_resistance: 'Doublure anti-rayures',
        strap: 'Sangles de maintien cuir',
        warranty: '1 an Atelier Horlogerie Zeina',
      }),
      340,
      null,
      12,
      0,
      0,
      JSON.stringify([accStraps]),
      accStraps
    );
  }

  // 4. Default BusinessSettings
  const defaultSettings: Record<string, string> = {
    brand_name: 'Horlogerie Zeina',
    logo_url: '',
    hero_slogan: 'Pas besoin de courir après le temps… laissez-nous nous en occuper',
    hero_subtitle:
      'Garde-temps de caractère pour hommes et femmes, bracelets sur mesure et atelier de haute réparation horlogère au cœur de Zaghouan.',
    hero_image: '/src/assets/images/hero_luxury_watch_1795182946775.jpg',
    repair_banner_image: '/src/assets/images/atelier_watchmaker_repair_1795182913427.jpg',
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

  const upsertSetting = db.prepare(
    'INSERT OR IGNORE INTO BusinessSettings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(defaultSettings)) {
    upsertSetting.run(k, v);
  }

  // Migrate legacy brand name if database already existed
  db.prepare(
    "UPDATE BusinessSettings SET value = 'Horlogerie Zeina' WHERE key = 'brand_name' AND value = 'Maison Kanalou'"
  ).run();
  db.prepare(
    "UPDATE BusinessSettings SET value = replace(value, 'Maison Kanalou', 'Horlogerie Zeina') WHERE key = 'about_text' AND value LIKE '%Maison Kanalou%'"
  ).run();
  db.prepare(
    "UPDATE BusinessSettings SET value = 'contact@horlogeriezeina.tn' WHERE key = 'email' AND value = 'contact@maisonkanalou.tn'"
  ).run();
  db.prepare(
    "UPDATE Products SET specs_json = replace(specs_json, 'Maison Kanalou', 'Horlogerie Zeina') WHERE specs_json LIKE '%Maison Kanalou%'"
  ).run();
  db.prepare(
    "UPDATE Products SET name = 'Chronographe Zeina Obsidienne' WHERE name = 'Chronographe Kanalou Obsidienne'"
  ).run();
  db.prepare(
    "UPDATE BusinessSettings SET value = 'https://www.instagram.com/horlogerie_zeina/' WHERE key = 'instagram_url' AND value = 'https://instagram.com'"
  ).run();
  db.prepare(
    "UPDATE BusinessSettings SET value = 'https://www.facebook.com/p/Zeina-61556602533155/' WHERE key = 'facebook_url' AND value = 'https://facebook.com'"
  ).run();

  // 5. Default Working Schedule (AvailabilitySlots)
  const schedCount = (
    db.prepare("SELECT COUNT(*) as c FROM AvailabilitySlots WHERE slot_type = 'schedule'").get() as {
      c: number;
    }
  ).c;
  if (schedCount === 0) {
    const insertSched = db.prepare(`
      INSERT INTO AvailabilitySlots (slot_type, day_of_week, start_time, end_time, slot_duration_min, is_working_day)
      VALUES ('schedule', ?, ?, ?, 60, ?)
    `);
    // 0 = Dimanche (closed), 1..6 = Lundi..Samedi (09:00 - 18:00)
    insertSched.run(0, '09:00', '13:00', 0);
    for (let day = 1; day <= 6; day++) {
      insertSched.run(day, '09:00', day === 6 ? '16:00' : '18:00', 1);
    }
  }
}

export function getSettingsObject(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM BusinessSettings').all() as Array<{
    key: string;
    value: string;
  }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function getAvailableSlotsForDate(dateStr: string): {
  isWorkingDay: boolean;
  isBlockedDay: boolean;
  slots: string[];
  allDaySlots: string[];
  takenSlots: string[];
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { isWorkingDay: false, isBlockedDay: false, slots: [], allDaySlots: [], takenSlots: [] };
  }

  const parsed = new Date(`${dateStr}T12:00:00Z`);
  const dayOfWeek = parsed.getUTCDay();

  const sched = db
    .prepare(
      "SELECT * FROM AvailabilitySlots WHERE slot_type = 'schedule' AND day_of_week = ? LIMIT 1"
    )
    .get(dayOfWeek) as
    | {
        start_time: string;
        end_time: string;
        slot_duration_min: number;
        is_working_day: number;
      }
    | undefined;

  if (!sched || !sched.is_working_day) {
    return { isWorkingDay: false, isBlockedDay: false, slots: [], allDaySlots: [], takenSlots: [] };
  }

  const allDayBlock = db
    .prepare(
      "SELECT id FROM AvailabilitySlots WHERE slot_type = 'blocked' AND specific_date = ? AND (start_time IS NULL OR start_time = '') LIMIT 1"
    )
    .get(dateStr);

  if (allDayBlock) {
    return { isWorkingDay: true, isBlockedDay: true, slots: [], allDaySlots: [], takenSlots: [] };
  }

  const [startH, startM] = sched.start_time.split(':').map(Number);
  const [endH, endM] = sched.end_time.split(':').map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  const step = sched.slot_duration_min || 60;

  const allDaySlots: string[] = [];
  for (let mins = startTotal; mins + step <= endTotal; mins += step) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    // Skip standard lunch hour 13:00-14:00
    if (h === 13) continue;
    allDaySlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }

  const blockedRows = db
    .prepare(
      "SELECT start_time FROM AvailabilitySlots WHERE slot_type = 'blocked' AND specific_date = ? AND start_time IS NOT NULL AND start_time != ''"
    )
    .all(dateStr) as Array<{ start_time: string }>;
  const blockedSet = new Set(blockedRows.map((r) => r.start_time));

  const bookedRows = db
    .prepare(
      "SELECT appointment_time FROM Appointments WHERE appointment_date = ? AND status != 'annule'"
    )
    .all(dateStr) as Array<{ appointment_time: string }>;
  const bookedSet = new Set(bookedRows.map((r) => r.appointment_time));

  const takenSlots = Array.from(new Set([...blockedSet, ...bookedSet]));
  const slots = allDaySlots.filter((s) => !blockedSet.has(s) && !bookedSet.has(s));

  return { isWorkingDay: true, isBlockedDay: false, slots, allDaySlots, takenSlots };
}
