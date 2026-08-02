import type {
  BusinessType,
  FabricType,
  ProductCategory,
} from "../constants/marketplace";

/**
 * Seed suppliers, placed in the textile clusters each fabric family actually
 * comes from — Surat for synthetics, Tirupur for knits, Bhilwara for suiting,
 * Kanchipuram for silk. Realistic geography makes the marketplace read as a
 * real sourcing tool rather than a demo with invented company names.
 */
export type SeedSupplier = {
  key: string;
  businessName: string;
  slug: string;
  businessType: BusinessType;
  description: string;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  categories: ProductCategory[];
  fabricTypes: FabricType[];
  minimumOrderQuantity: number;
  gstNumber: string;
  yearEstablished: number;
  verified: boolean;
  rating: number;
  ratingCount: number;
  /** Login for the demo account that owns this profile. */
  account: { name: string; email: string; password: string };
};

export const SEED_SUPPLIERS: SeedSupplier[] = [
  {
    key: "meridian",
    businessName: "Meridian Cotton Mills",
    slug: "meridian-cotton-mills",
    businessType: "Manufacturer",
    description:
      "Vertically integrated cotton mill running ring-spun and combed yarn lines. We supply shirting, poplin and cambric to domestic garment factories and export houses, with in-house dyeing and sanforizing.",
    contactEmail: "sales@meridiancotton.example.com",
    contactPhone: "+91 98250 41022",
    website: "https://meridiancotton.example.com",
    address: {
      line1: "Plot 44, GIDC Industrial Estate",
      line2: "Pandesara",
      city: "Surat",
      state: "Gujarat",
      postalCode: "395023",
    },
    categories: ["Cotton", "Linen", "Rayon & Viscose"],
    fabricTypes: ["Woven", "Dyed", "Printed"],
    minimumOrderQuantity: 50,
    gstNumber: "24AABCM1234K1Z9",
    yearEstablished: 1996,
    verified: true,
    rating: 4.6,
    ratingCount: 218,
    account: {
      name: "Rakesh Chauhan",
      email: "supplier.meridian@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "kanchi",
    businessName: "Kanchi Heritage Silks",
    slug: "kanchi-heritage-silks",
    businessType: "Manufacturer",
    description:
      "Third-generation handloom weavers working in pure mulberry silk with traditional zari. Every piece is loom-finished and degummed in-house. Silk Mark certified.",
    contactEmail: "orders@kanchiheritage.example.com",
    contactPhone: "+91 94430 77510",
    address: {
      line1: "18 Thirukachi Nambi Street",
      city: "Kanchipuram",
      state: "Tamil Nadu",
      postalCode: "631502",
    },
    categories: ["Silk", "Embroidered & Ethnic", "Velvet"],
    fabricTypes: ["Handloom", "Woven", "Embroidered"],
    minimumOrderQuantity: 20,
    gstNumber: "33AACCK5678L1ZB",
    yearEstablished: 1974,
    verified: true,
    rating: 4.8,
    ratingCount: 341,
    account: {
      name: "Lakshmi Narayanan",
      email: "supplier.kanchi@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "tirupur",
    businessName: "Tirupur Knit Works",
    slug: "tirupur-knit-works",
    businessType: "Manufacturer",
    description:
      "Circular knitting unit producing single jersey, interlock, rib and fleece. GOTS and OEKO-TEX certified lines available for export orders. Compact spinning and bio-washing on site.",
    contactEmail: "export@tirupurknit.example.com",
    contactPhone: "+91 90478 33261",
    website: "https://tirupurknit.example.com",
    address: {
      line1: "SF No. 212/3, Mannarai Road",
      line2: "Kongu Nagar",
      city: "Tirupur",
      state: "Tamil Nadu",
      postalCode: "641607",
    },
    categories: ["Knits & Jersey", "Cotton", "Technical & Performance"],
    fabricTypes: ["Knitted", "Dyed", "Blended"],
    minimumOrderQuantity: 100,
    gstNumber: "33AAGCT9012M1ZC",
    yearEstablished: 2004,
    verified: true,
    rating: 4.4,
    ratingCount: 176,
    account: {
      name: "Senthil Kumar",
      email: "supplier.tirupur@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "bhilwara",
    businessName: "Bhilwara Suiting Co.",
    slug: "bhilwara-suiting-co",
    businessType: "Wholesaler",
    description:
      "Suiting and uniform fabric specialists supplying poly-viscose, poly-wool and terry-rayon blends to institutional buyers, schools and corporate uniform programmes across India.",
    contactEmail: "trade@bhilwarasuiting.example.com",
    contactPhone: "+91 94140 62288",
    address: {
      line1: "C-7, Textile Market",
      line2: "Pur Road",
      city: "Bhilwara",
      state: "Rajasthan",
      postalCode: "311001",
    },
    categories: ["Wool", "Polyester & Blends", "Rayon & Viscose"],
    fabricTypes: ["Woven", "Blended", "Dyed"],
    minimumOrderQuantity: 75,
    gstNumber: "08AADCB3456N1ZD",
    yearEstablished: 1988,
    verified: true,
    rating: 4.2,
    ratingCount: 94,
    account: {
      name: "Mahesh Agarwal",
      email: "supplier.bhilwara@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "erode",
    businessName: "Erode Handloom Collective",
    slug: "erode-handloom-collective",
    businessType: "Manufacturer",
    description:
      "A weaver-owned collective of 240 handloom families producing cotton and linen yardage, bed linen and towelling. Fair-trade certified with transparent weaver payouts.",
    contactEmail: "hello@erodehandloom.example.com",
    contactPhone: "+91 87548 10934",
    address: {
      line1: "34 Perundurai Main Road",
      city: "Erode",
      state: "Tamil Nadu",
      postalCode: "638052",
    },
    categories: ["Cotton", "Linen", "Knits & Jersey"],
    fabricTypes: ["Handloom", "Woven", "Dyed"],
    minimumOrderQuantity: 30,
    gstNumber: "33AAJCE7890P1ZE",
    yearEstablished: 2011,
    verified: true,
    rating: 4.7,
    ratingCount: 129,
    account: {
      name: "Anitha Rajan",
      email: "supplier.erode@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "ludhiana",
    businessName: "Ludhiana Woollen House",
    slug: "ludhiana-woollen-house",
    businessType: "Wholesaler",
    description:
      "North India's winter-wear supply base. Merino, lambswool and acrylic blends in flat knit and woven tweed, stocked year-round for jacket, blazer and knitwear manufacturers.",
    contactEmail: "contact@ludhianawoollen.example.com",
    contactPhone: "+91 98155 20417",
    address: {
      line1: "Shop 112, Woollen Market",
      line2: "Gill Road",
      city: "Ludhiana",
      state: "Punjab",
      postalCode: "141003",
    },
    categories: ["Wool", "Knits & Jersey", "Polyester & Blends"],
    fabricTypes: ["Knitted", "Woven", "Blended"],
    minimumOrderQuantity: 40,
    gstNumber: "03AAECL2345Q1ZF",
    yearEstablished: 1982,
    verified: false,
    rating: 4.0,
    ratingCount: 63,
    account: {
      name: "Gurpreet Singh",
      email: "supplier.ludhiana@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "jaipur",
    businessName: "Jaipur Block Print Studio",
    slug: "jaipur-block-print-studio",
    businessType: "Boutique / Designer",
    description:
      "Hand block printing on cotton, mul and chanderi using natural dyes — indigo, madder and pomegranate. Small-batch runs for designers, with custom colourways on request.",
    contactEmail: "studio@jaipurblockprint.example.com",
    contactPhone: "+91 99290 44870",
    website: "https://jaipurblockprint.example.com",
    address: {
      line1: "Bagru Village, Ajmer Road",
      city: "Jaipur",
      state: "Rajasthan",
      postalCode: "303007",
    },
    categories: ["Cotton", "Embroidered & Ethnic", "Chiffon & Georgette"],
    fabricTypes: ["Printed", "Handloom", "Woven"],
    minimumOrderQuantity: 15,
    gstNumber: "08AAFCJ6789R1ZG",
    yearEstablished: 2015,
    verified: true,
    rating: 4.9,
    ratingCount: 87,
    account: {
      name: "Meera Sharma",
      email: "supplier.jaipur@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "vapi",
    businessName: "Vapi Synthetics Ltd.",
    slug: "vapi-synthetics-ltd",
    businessType: "Manufacturer",
    description:
      "Polyester and nylon weaving with in-house texturising. Performance finishes including water-repellent, anti-microbial and moisture-wicking for sportswear and workwear buyers.",
    contactEmail: "b2b@vapisynthetics.example.com",
    contactPhone: "+91 93270 55106",
    address: {
      line1: "Survey 88, GIDC Phase II",
      city: "Vapi",
      state: "Gujarat",
      postalCode: "396195",
    },
    categories: [
      "Polyester & Blends",
      "Technical & Performance",
      "Chiffon & Georgette",
    ],
    fabricTypes: ["Woven", "Knitted", "Blended"],
    minimumOrderQuantity: 200,
    gstNumber: "24AAGCV0123S1ZH",
    yearEstablished: 2009,
    verified: true,
    rating: 4.1,
    ratingCount: 152,
    account: {
      name: "Nilesh Patel",
      email: "supplier.vapi@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "kolkata",
    businessName: "Bengal Denim & Twill",
    slug: "bengal-denim-and-twill",
    businessType: "Manufacturer",
    description:
      "Rope-dyed indigo denim from 6oz chambray through 14oz raw selvedge, plus cotton twills and canvas. Stretch and rigid constructions for jeanswear and workwear labels.",
    contactEmail: "sales@bengaldenim.example.com",
    contactPhone: "+91 98304 71265",
    address: {
      line1: "12 Canal East Road",
      line2: "Ultadanga",
      city: "Kolkata",
      state: "West Bengal",
      postalCode: "700067",
    },
    categories: ["Denim", "Cotton", "Technical & Performance"],
    fabricTypes: ["Woven", "Dyed", "Blended"],
    minimumOrderQuantity: 60,
    gstNumber: "19AABCB4567T1ZI",
    yearEstablished: 1999,
    verified: true,
    rating: 4.5,
    ratingCount: 203,
    account: {
      name: "Arindam Bose",
      email: "supplier.kolkata@demo.test",
      password: "Supplier123",
    },
  },
  {
    key: "varanasi",
    businessName: "Varanasi Brocade House",
    slug: "varanasi-brocade-house",
    businessType: "Exporter",
    description:
      "Banarasi brocade, tissue and organza woven on jacquard looms. Real and tested zari work for bridal and occasion wear, exported to the UK, UAE and North America.",
    contactEmail: "export@varanasibrocade.example.com",
    contactPhone: "+91 94151 38820",
    address: {
      line1: "Kotwali, Chowk",
      line2: "Near Vishwanath Gali",
      city: "Varanasi",
      state: "Uttar Pradesh",
      postalCode: "221001",
    },
    categories: [
      "Embroidered & Ethnic",
      "Silk",
      "Velvet",
      "Chiffon & Georgette",
    ],
    fabricTypes: ["Woven", "Embroidered", "Handloom"],
    minimumOrderQuantity: 10,
    gstNumber: "09AACCV8901U1ZJ",
    yearEstablished: 1968,
    verified: true,
    rating: 4.7,
    ratingCount: 264,
    account: {
      name: "Imran Ansari",
      email: "supplier.varanasi@demo.test",
      password: "Supplier123",
    },
  },
];
