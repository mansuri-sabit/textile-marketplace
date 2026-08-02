/** Shapes returned by the API, as the client consumes them. */

export type UserRole = "buyer" | "supplier";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  avatarUrl?: string | null;
  onboardingCompleted: boolean;
  buyerPreferences?: BuyerPreferences | null;
};

export type BuyerPreferences = {
  businessType?: string;
  industry?: string;
  interestedCategories?: string[];
  preferredFabricTypes?: string[];
  typicalOrderQuantity?: string;
  budgetRange?: string;
  notes?: string;
};

export type SupplierSummary = {
  _id: string;
  businessName: string;
  slug: string;
  verified?: boolean;
  rating?: number;
  address?: { city?: string; state?: string };
};

export type ProductSpecs = {
  gsm?: number;
  widthInches?: number;
  composition?: string;
  weave?: string;
  finish?: string;
  shrinkage?: string;
  careInstructions?: string;
  certifications?: string[];
};

export type ProductColor = { name: string; hex: string; inStock?: boolean };

export type ProductCard = {
  _id: string;
  name: string;
  slug: string;
  category: string;
  fabricType: string;
  images: string[];
  pricePerUnit: number;
  unit: string;
  currency?: string;
  stock: number;
  status: "draft" | "active" | "out_of_stock";
  featured?: boolean;
  rating?: number;
  ratingCount?: number;
  minimumOrderQuantity: number;
  specifications?: Pick<ProductSpecs, "gsm" | "composition">;
  supplier: SupplierSummary;
};

export type ProductDetail = Omit<ProductCard, "supplier" | "specifications"> & {
  description: string;
  colors: ProductColor[];
  specifications: ProductSpecs;
  bulkTiers: Array<{ minQuantity: number; pricePerUnit: number }>;
  imageCredits?: Array<{ photographer: string; sourceUrl: string }>;
  tags?: string[];
  viewCount?: number;
  orderCount?: number;
  supplier: SupplierSummary & {
    businessType?: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    minimumOrderQuantity?: number;
    yearEstablished?: number;
    ratingCount?: number;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
};

export type SearchMode = "semantic" | "keyword" | "browse";

export type ProductListResponse = {
  mode: SearchMode;
  products: ProductCard[];
  total: number;
  page: number;
  pages: number;
};

export type FacetValue = { value: string; count: number };

export type Facets = {
  categories: FacetValue[];
  fabricTypes: FacetValue[];
  units: FacetValue[];
  certifications: FacetValue[];
  price: { min: number; max: number };
  gsm: { min: number; max: number };
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  image?: string;
  category: string;
  color?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  priceChangedFrom?: number;
  minimumOrderQuantity: number;
  availableStock: number;
  supplier: { id: string; name: string; slug: string };
  issues: string[];
};

export type CartGroup = {
  supplier: CartItem["supplier"];
  items: CartItem[];
  subtotal: number;
};

export type CartState = {
  items: CartItem[];
  groups: CartGroup[];
  itemCount: number;
  lineCount: number;
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  total: number;
  hasIssues: boolean;
};

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready_for_dispatch"
  | "completed"
  | "cancelled";

export type OrderItem = {
  product: string;
  name: string;
  image?: string;
  color?: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  lineTotal: number;
};

export type Order = {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  buyerNote?: string;
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  total: number;
  status: OrderStatus;
  statusHistory: Array<{ status: OrderStatus; at: string; note?: string }>;
  createdAt: string;
  supplier: SupplierSummary & { contactEmail?: string; contactPhone?: string };
  buyer?: { _id: string; name: string; email: string; phone?: string };
};

export type SupplierDashboard = {
  products: { total: number; active: number; outOfStock: number; inventoryValue: number };
  orders: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    revenue: number;
  };
  recentOrders: Array<
    Pick<Order, "_id" | "orderNumber" | "status" | "total" | "createdAt" | "items"> & {
      buyer?: { name: string };
    }
  >;
  inventoryAlerts: Array<{
    _id: string;
    name: string;
    slug: string;
    stock: number;
    unit: string;
    status: string;
    images: string[];
  }>;
};
