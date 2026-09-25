/** Master offering catalog, ported verbatim from the original tool's CATALOG. */
import { SEC_DP, SEC_EMA, SEC_MS } from "./defaults";

export {
  SEC_DP,
  SEC_EMA,
  SEC_MS,
  SECTIONS,
  STATUSES,
  PARTNER_TYPES,
} from "./defaults";

const PROMO_BOTH = ["Branded", "Non-Branded"];
const DP_STREAM = [
  "Live Only",
  "Live + DP",
  "Live + EMA",
  "Rec + DP",
  "Rec + EMA",
];
const EMA_STREAM = ["Live + EMA", "Rec + EMA"];
const PRODUCED = [
  "OnfTV",
  "Customer",
  "Association",
  "KOL",
  "Hospital",
  "Onf-Library",
];

const DP_INCL =
  "Card visible for 72 hours, UTM tracking link with standard creative jpg/pdf for sharing, non-exclusive mktng via PN, WA channel, Emails";
const DP_EXCL =
  "Liaisoning with association or speaker coordination, Royalty to society, Honorarium to faculty and convener, if any, State Council Credit point, ICOG Points & certification charge, if any, Restreaming on any other channel, Any digital or print collateral apart from that mentioned in SOW will incur an additional cost, Video Snippets, Faculty TeleCalling for photographs or CVs, Content video will not be provided offline";
const EMA_INCL =
  "Card visible for 90 days, Free to view, UTM tracking link with standard creative jpg/pdf for sharing, non-exclusive mktng via PN, WA channel, Emails";
const EMA_EXCL = "Content video will not be provided offline";
const EMA_CARDS = [
  "Horizontal Single",
  "Horizontal Series",
  "Vertical Single",
  "Vertical Series",
];

export interface OfferingSeed {
  section: string;
  name: string;
  cardTypes: string[];
  promo: string[];
  stream: string[];
  produced: string[];
  incl: string;
  excl: string;
  dev: string;
  duration: string;
}

const dp = (name: string, cards: string[]): OfferingSeed => ({
  section: SEC_DP,
  name,
  cardTypes: cards,
  promo: PROMO_BOTH,
  stream: DP_STREAM,
  produced: PRODUCED,
  incl: DP_INCL,
  excl: DP_EXCL,
  dev: "",
  duration: "72 Hours",
});
const ema = (
  name: string,
  cards: string[],
  incl: string,
  excl: string,
  dev = "",
): OfferingSeed => ({
  section: SEC_EMA,
  name,
  cardTypes: cards,
  promo: PROMO_BOTH,
  stream: EMA_STREAM,
  produced: PRODUCED,
  incl,
  excl,
  dev,
  duration: "90 Days",
});
const ms = (
  name: string,
  cards: string[],
  promo: string[],
  stream: string[],
  produced: string[],
  incl: string,
  excl: string,
  duration = "",
): OfferingSeed => ({
  section: SEC_MS,
  name,
  cardTypes: cards,
  promo,
  stream,
  produced,
  incl,
  excl,
  dev: "",
  duration,
});

export const CATALOG: OfferingSeed[] = [
  dp("DP1 - Case Insight", ["Vertical Video", "Horizontal Video"]),
  dp("DP2 - CME - 1 Hr", ["Horizontal Video"]),
  dp("DP3 - CPD - 3 Hr", ["Horizontal Video"]),
  dp("DP4 - Cross Guidelines", ["Blog"]),
  dp("DP5 - Did You Know", ["Vertical Video"]),
  dp("DP6 - Journal Digest", ["Vertical Video"]),
  dp("DP7 - Myths & Facts", ["Vertical Video"]),
  dp("DP8 - News", ["Vertical Video"]),
  dp("DP9 - Poll", ["Poll"]),
  dp("DP10 - Q&A", ["Vertical Video"]),
  dp("DP11 - TDIF", ["Blog"]),

  ema("EM1 - IP", EMA_CARDS, EMA_INCL, EMA_EXCL, "Honorariums, if any"),
  ema(
    "EM2 - Co-Produced",
    EMA_CARDS,
    EMA_INCL,
    EMA_EXCL,
    "Honorariums, if any",
  ),
  ema(
    "EM3 - Subscription",
    ["Not Applicable"],
    "Unlock credit pop up, OnfTV Digital Calender",
    "No print collaterals, No brand logos in any videos, No brand logo placements next to speaker names in any collaterals",
  ),

  ms(
    "MS1. Curated Watchlist",
    ["Watchlist Card"],
    ["Branded"],
    [],
    [],
    "minimum 1 month visible on my space, minimum 5 cards, max 10 cards in a month, maximum once a month list change, Watchlist only via links",
    "no branding on individual cards unless previously produced by same company",
    "1 Month",
  ),
  ms(
    "MS2. Promoted Watchlist",
    ["Watchlist Card"],
    [],
    [],
    [],
    "Visible to all users",
    "",
    "1 Month",
  ),
  ms(
    "MS3. Feature on DP+Email+PN",
    ["Daily Pulse Card"],
    PROMO_BOTH,
    ["Rec + DP"],
    ["OnfTV", "Customer"],
    "",
    "",
  ),
  ms("MS4. Feature on WA Channel", ["N/A"], [], [], [], "", ""),
  ms(
    "MS5. Customised branded courses",
    ["Single", "Series"],
    PROMO_BOTH,
    [],
    [],
    "Certificates",
    "",
  ),
  ms(
    "MS6. Digital Collaterals (E-Brochure, Monthly Watchlist, OnfTV Calender, Video Trailer, Certificate)",
    [],
    [],
    [],
    [],
    "",
    "",
  ),
  ms(
    "MS7. Webinar",
    ["Daily Pulse Card"],
    PROMO_BOTH,
    DP_STREAM,
    PRODUCED,
    DP_INCL,
    DP_EXCL,
    "72 Hours",
  ),
];
