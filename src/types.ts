export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

export interface ProductSpecs {
  movement?: string;
  case_material?: string;
  diameter?: string;
  water_resistance?: string;
  strap?: string;
  warranty?: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  reference: string;
  description: string;
  specs: ProductSpecs;
  price: number;
  promo_price: number | null;
  stock_qty: number;
  is_active: boolean;
  is_bestseller: boolean;
  is_new: boolean;
  images: string[];
  primary_image: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus = 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'annulee';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number | null;
  product_name: string;
  product_reference: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  address: string;
  city: string;
  region: string;
  notes: string;
  payment_method: string;
  status: OrderStatus;
  delivery_fee: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export type AppointmentStatus = 'en_attente' | 'confirme' | 'termine' | 'annule';
export type WatchType = 'Montre classique' | 'Montre automatique' | 'Montre connectée' | 'Autre';

export interface Appointment {
  id: number;
  reference_code: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  watch_type: WatchType;
  problem_description: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  admin_notes: string;
  created_at: string;
}

export interface WorkingSchedule {
  id: number;
  day_of_week: number; // 0 = Dimanche .. 6 = Samedi
  start_time: string;
  end_time: string;
  slot_duration_min: number;
  is_working_day: boolean;
}

export interface BlockedSlot {
  id: number;
  specific_date: string;
  start_time: string | null;
  reason: string;
}

export interface BusinessSettings {
  brand_name: string;
  logo_url: string;
  hero_slogan: string;
  hero_subtitle: string;
  hero_image: string;
  repair_banner_image: string;
  repair_title: string;
  repair_description: string;
  about_title: string;
  about_text: string;
  phone: string;
  email: string;
  address: string;
  google_maps_url: string;
  instagram_url: string;
  facebook_url: string;
  whatsapp_number: string;
  currency: string;
  delivery_fee: string;
  free_delivery_threshold: string;
}

export interface DashboardStats {
  period: 'today' | 'week' | 'month';
  total_revenue: number;
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  period_revenue: number;
  period_orders: number;
  total_orders: number;
  pending_orders: number;
  available_products: number;
  total_customers: number;
  total_appointments: number;
  pending_appointments: number;
  chart_data: Array<{
    date: string;
    label: string;
    revenue: number;
    orders: number;
  }>;
}
