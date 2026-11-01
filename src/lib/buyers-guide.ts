/**
 * FTC Buyers Guide — dealer identity, overlay layout and page selection.
 *
 * Every used vehicle sold by the dealership needs a Buyers Guide posted on it.
 * We generate one per vehicle by filling the blank lines of the official form:
 * the front page is one of two pre-printed variants ("AS IS - NO DEALER
 * WARRANTY" or "IMPLIED WARRANTIES ONLY") and the back page is always the same
 * sheet. Only the vehicle fields, the dealer's contact details and the warranty
 * checkbox are drawn on top — nothing else is added or removed.
 *
 * Everything that may need tuning later (dealer details and the position of
 * every overlay) lives here, so re-aligning the output is a one-file change.
 *
 * Coordinates are PDF points measured from the BOTTOM-LEFT corner (pdf-lib's
 * origin). They were read off blank-page renders at 100 dpi (826 x 1169 px for
 * the A4 595 x 842 pt MediaBox) and converted with:
 *
 *   pt_x = px_x * 595 / 826
 *   pt_y = 842 - px_y * 842 / 1169
 */

/** Dealer identity printed on the back page. */
export const DEALER = {
  name: "Soledad Auto Sales",
  address: "300 Front St. Soledad CA 93960",
  phone: "831 678 2000",
  email: "josesoledadautosales@gmail.com",
} as const;

/** Blank template files, resolved under `public/`. */
export const BUYERS_GUIDE_FILES = {
  frontAsIs: "en-bg-asis.pdf",
  frontImplied: "en-bg-implied.pdf",
  back: "en-bg-back.pdf",
} as const;

/** Spanish blank template files, resolved under `public/`. */
export const ES_BUYERS_GUIDE_FILES = {
  frontAsIs: "es-bg-asis.pdf",
  frontImplied: "es-bg-implied.pdf",
  back: "es-bg-back.pdf",
} as const;

/** At or above this odometer reading the vehicle is sold AS IS. */
export const MILEAGE_AS_IS_THRESHOLD = 140000;

export type FrontVariant = "asis" | "implied";

const PX_X = 595 / 826;
const PX_Y = 842 / 1169;

/** 100 dpi render x (px) -> PDF point x. */
const x = (px: number) => px * PX_X;
/** 100 dpi render y from the top (px) -> PDF point y from the bottom. */
const y = (px: number) => 842 - px * PX_Y;

export type TextField = {
  text: string;
  /** Left edge, in points. */
  x: number;
  /** Text baseline, in points. */
  y: number;
  size: number;
};

export type CheckboxMark = {
  /** Bottom-left corner of the printed checkbox, in points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** How far the X stays away from the box border, in points. */
  inset: number;
};

/**
 * SERVICE CONTRACT checkbox — the small square at the start of the "SERVICE
 * CONTRACT. A service contract on this vehicle..." line under the NON-DEALER
 * WARRANTIES FOR THIS VEHICLE section. Measured off 100 dpi renders of both
 * blank fronts: the box occupies px (108, 822)–(120, 834) on BOTH the AS IS and
 * the IMPLIED variants (they line up to the pixel), but it is kept per-variant
 * so either template can be re-measured without touching the other.
 */
export const SERVICE_CONTRACT_CHECKBOX: Record<FrontVariant, CheckboxMark> = {
  asis: {
    x: x(108),
    y: y(834),
    width: x(120) - x(108),
    height: y(822) - y(834),
    inset: 1,
  },
  implied: {
    x: x(108),
    y: y(834),
    width: x(120) - x(108),
    height: y(822) - y(834),
    inset: 1,
  },
};

/**
 * Front page layout. Both variants share the header block and the position of
 * their first warranty checkbox: the "AS IS" and "IMPLIED WARRANTIES ONLY"
 * headings sit at the same height, so the box to tick is the same rectangle.
 */
export const FRONT_LAYOUT = {
  /** Underscore line at py 239; values are written just above it. */
  headerBaseline: y(232),
  makeX: x(109),
  modelX: x(276),
  yearX: x(398),
  vinX: x(562),
  /** STOCK NUMBER line at py 279. */
  stockBaseline: y(271),
  stockX: x(109),
  /** Warranty checkbox drawn at px (108,340)-(139,371). */
  checkbox: {
    x: x(108),
    y: y(371),
    width: x(139) - x(108),
    height: y(340) - y(371),
    inset: 1.5,
  } satisfies CheckboxMark,
  valueFontSize: 10,
} as const;

/**
 * Back page layout. The dealer block is prefixed by a rule at py 803. Each
 * field's printed label sits immediately BELOW its top rule (DEALER NAME at py
 * 826, ADDRESS at 860, TELEPHONE/EMAIL at 893, FOR COMPLAINTS at 927), so the
 * value is written just above the rule that closes that field's slot — one line
 * spacing (~34 px) below the label, not on the label's own top rule.
 */
export const BACK_LAYOUT = {
  /** DEALER NAME: label at py 826, value on the closing rule at py 857. */
  nameBaseline: y(851),
  nameX: x(109),
  /** ADDRESS: label at py 860, value on the closing rule at py 890. */
  addressBaseline: y(884),
  addressX: x(109),
  /** TELEPHONE / EMAIL share a slot: label at py 893, value on rule at py 924. */
  phoneBaseline: y(918),
  phoneX: x(109),
  emailX: x(413),
  /** FOR COMPLAINTS AFTER SALE: label at py 927, value on rule at py 958. */
  complaintsBaseline: y(952),
  complaintsX: x(109),
  valueFontSize: 10,
} as const;

export type BuyersGuideVehicle = {
  stock_number: string;
  dm_year: number | null;
  dm_make: string | null;
  dm_model: string | null;
  dm_vin: string | null;
  dm_mileage: number | null;
};

/**
 * Which pre-printed front page to use. Unknown mileage is treated as AS IS:
 * the stricter disclosure is the safe default when the odometer is missing.
 */
export function frontVariant(mileage: number | null | undefined): FrontVariant {
  if (mileage == null) return "asis";
  return mileage >= MILEAGE_AS_IS_THRESHOLD ? "asis" : "implied";
}

function value(v: string | number | null | undefined): string {
  return v == null ? "" : String(v);
}

/** Vehicle fields written onto the front page header. */
export function frontFields(vehicle: BuyersGuideVehicle): TextField[] {
  const size = FRONT_LAYOUT.valueFontSize;
  return [
    { text: value(vehicle.dm_make), x: FRONT_LAYOUT.makeX, y: FRONT_LAYOUT.headerBaseline, size },
    { text: value(vehicle.dm_model), x: FRONT_LAYOUT.modelX, y: FRONT_LAYOUT.headerBaseline, size },
    { text: value(vehicle.dm_year), x: FRONT_LAYOUT.yearX, y: FRONT_LAYOUT.headerBaseline, size },
    { text: value(vehicle.dm_vin), x: FRONT_LAYOUT.vinX, y: FRONT_LAYOUT.headerBaseline, size },
    { text: value(vehicle.stock_number), x: FRONT_LAYOUT.stockX, y: FRONT_LAYOUT.stockBaseline, size },
  ];
}

/** Dealer contact details written onto the back page. */
export function backFields(): TextField[] {
  const size = BACK_LAYOUT.valueFontSize;
  return [
    { text: DEALER.name, x: BACK_LAYOUT.nameX, y: BACK_LAYOUT.nameBaseline, size },
    { text: DEALER.address, x: BACK_LAYOUT.addressX, y: BACK_LAYOUT.addressBaseline, size },
    { text: DEALER.phone, x: BACK_LAYOUT.phoneX, y: BACK_LAYOUT.phoneBaseline, size },
    { text: DEALER.email, x: BACK_LAYOUT.emailX, y: BACK_LAYOUT.phoneBaseline, size },
    { text: DEALER.email, x: BACK_LAYOUT.complaintsX, y: BACK_LAYOUT.complaintsBaseline, size },
  ];
}

/*
 * ---------------------------------------------------------------------------
 * Spanish (ES) Buyers Guide — "Guía del Comprador".
 *
 * The Spanish pair uses its own blank templates (es-bg-asis / es-bg-implied /
 * es-bg-back) and its own layouts; the English maps above are kept untouched so
 * either language can be re-measured independently. Coordinates follow the same
 * 100 dpi convention (see the file header for the px -> pt conversion).
 */

/**
 * Spanish front service-contract checkbox — the small square at the start of
 * the "CONTRATO DE MANTENIMIENTO" line under "GARANTÍAS QUE NO PERTENECEN AL
 * CONCESIONARIO". Measured at px (108, 794)-(120, 806) on both variants.
 */
export const ES_SERVICE_CONTRACT_CHECKBOX: Record<FrontVariant, CheckboxMark> = {
  asis: {
    x: x(108),
    y: y(806),
    width: x(120) - x(108),
    height: y(794) - y(806),
    inset: 1,
  },
  implied: {
    x: x(108),
    y: y(806),
    width: x(120) - x(108),
    height: y(794) - y(806),
    inset: 1,
  },
};

/**
 * Spanish front layout. The write-in line for the vehicle row sits at py 252
 * with the MARCA DEL VEHÍCULO / MODELO / AÑO / NÚMERO DE IDENTIFICACIÓN DEL
 * VEHÍCULO (VIN) labels printed just BELOW it, so the values are written just
 * above that line. There is NO stock-number field on the Spanish front — only
 * the four vehicle fields are drawn.
 *
 * `checkbox` is the big square at the start of the first warranty heading
 * ("COMO ESTÁ - SIN GARANTÍA DEL CONCESIONARIO" on the AS IS variant, "SOLO
 * GARANTÍAS IMPLÍCITAS" on the IMPLIED variant). Both headings sit at the same
 * height, so the box to tick is the same rectangle on both variants.
 */
export const ES_FRONT_LAYOUT = {
  /** Write-in line at py 252; values sit just above it. */
  headerBaseline: y(245),
  makeX: x(110),
  modelX: x(276),
  yearX: x(399),
  vinX: x(517),
  /** Warranty checkbox drawn at px (108, 312)-(139, 343). */
  checkbox: {
    x: x(108),
    y: y(343),
    width: x(139) - x(108),
    height: y(312) - y(343),
    inset: 1.5,
  } satisfies CheckboxMark,
  valueFontSize: 10,
} as const;

/**
 * Spanish back layout. Same slot pattern as the English back: each printed
 * label sits immediately below its top rule and the value is written just
 * above the rule that closes its slot. The Spanish back rules sit a few pixels
 * lower than the English ones (e.g. NOMBRE DEL CONCESIONARIO closes at py 859).
 */
export const ES_BACK_LAYOUT = {
  /** NOMBRE DEL CONCESIONARIO: label at py 829, value on the closing rule. */
  nameBaseline: y(851),
  nameX: x(109),
  /** DIRECCIÓN DEL CONCESIONARIO. */
  addressBaseline: y(884),
  addressX: x(109),
  /** TELÉFONO / CORREO ELECTRÓNICO share a slot. */
  phoneBaseline: y(918),
  phoneX: x(109),
  emailX: x(413),
  /** PARA QUEJAS DESPUÉS DE LA VENTA. */
  complaintsBaseline: y(952),
  complaintsX: x(109),
  valueFontSize: 10,
} as const;

/**
 * Vehicle fields written onto the SPANISH front page header. Deliberately
 * omits the stock number: the Spanish template has no stock-number field.
 */
export function esFrontFields(vehicle: BuyersGuideVehicle): TextField[] {
  const size = ES_FRONT_LAYOUT.valueFontSize;
  return [
    { text: value(vehicle.dm_make), x: ES_FRONT_LAYOUT.makeX, y: ES_FRONT_LAYOUT.headerBaseline, size },
    { text: value(vehicle.dm_model), x: ES_FRONT_LAYOUT.modelX, y: ES_FRONT_LAYOUT.headerBaseline, size },
    { text: value(vehicle.dm_year), x: ES_FRONT_LAYOUT.yearX, y: ES_FRONT_LAYOUT.headerBaseline, size },
    { text: value(vehicle.dm_vin), x: ES_FRONT_LAYOUT.vinX, y: ES_FRONT_LAYOUT.headerBaseline, size },
  ];
}

/** Dealer contact details written onto the Spanish back page. */
export function esBackFields(): TextField[] {
  const size = ES_BACK_LAYOUT.valueFontSize;
  return [
    { text: DEALER.name, x: ES_BACK_LAYOUT.nameX, y: ES_BACK_LAYOUT.nameBaseline, size },
    { text: DEALER.address, x: ES_BACK_LAYOUT.addressX, y: ES_BACK_LAYOUT.addressBaseline, size },
    { text: DEALER.phone, x: ES_BACK_LAYOUT.phoneX, y: ES_BACK_LAYOUT.phoneBaseline, size },
    { text: DEALER.email, x: ES_BACK_LAYOUT.emailX, y: ES_BACK_LAYOUT.phoneBaseline, size },
    { text: DEALER.email, x: ES_BACK_LAYOUT.complaintsX, y: ES_BACK_LAYOUT.complaintsBaseline, size },
  ];
}
