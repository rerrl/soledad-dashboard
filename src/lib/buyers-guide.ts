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
