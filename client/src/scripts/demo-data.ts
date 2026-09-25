/**
 * Demo dataset — partners, projects and content line-ups.
 *
 * Company names are realistic but fictional on purpose: a demo shown to a
 * prospect should not imply client relationships that do not exist. Swap in
 * real names here if you would rather show actual accounts.
 */

export interface DemoPartner {
  name: string; type: "Receivable" | "Payable" | "Barter";
  contact: string; email: string; mobile: string; gstin: string;
  city: string; state: string; addr: string;
}

const p = (
  name: string, type: DemoPartner["type"], contact: string, email: string,
  mobile: string, gstin: string, city: string, state: string, addr: string
): DemoPartner => ({ name, type, contact, email, mobile, gstin, city, state, addr });

/* ------------------------------------------------------------------ partners */
export const PARTNERS: DemoPartner[] = [
  // Pharmaceutical — the core revenue base
  p("Zenvia Healthcare Ltd.", "Receivable", "R. Menon, Brand Manager", "r.menon@zenviahealth.example", "+91 98200 41127", "27AAACZ4521K1ZP", "Mumbai", "Maharashtra", "Zenvia House, 4th Floor, Andheri Kurla Road\nAndheri (E), Mumbai — 400059"),
  p("Corvin Pharmaceuticals Pvt. Ltd.", "Receivable", "S. Bhandari, Marketing Head", "s.bhandari@corvinpharma.example", "+91 98250 33418", "24AABCC7734M1Z9", "Ahmedabad", "Gujarat", "Corvin Tower, Prahlad Nagar\nAhmedabad — 380015"),
  p("Aurelis Life Sciences Ltd.", "Receivable", "N. Iyer, Product Lead", "n.iyer@aurelislife.example", "+91 99400 26610", "33AAECA1189J1ZK", "Chennai", "Tamil Nadu", "Aurelis Campus, Guindy Industrial Estate\nChennai — 600032"),
  p("Medhavi Pharma Ltd.", "Receivable", "A. Deshpande, DGM Marketing", "a.deshpande@medhavipharma.example", "+91 98220 71903", "27AADCM5567L1ZR", "Pune", "Maharashtra", "Medhavi Square, Baner Road\nPune — 411045"),
  p("Nirvaan Therapeutics Pvt. Ltd.", "Receivable", "K. Raghavan, Brand Manager", "k.raghavan@nirvaantx.example", "+91 90040 55281", "36AAFCN2298P1ZT", "Hyderabad", "Telangana", "Nirvaan Centre, HITEC City\nHyderabad — 500081"),
  p("Sanjeevani Remedies Ltd.", "Receivable", "P. Kulkarni, Head — Medical Affairs", "p.kulkarni@sanjeevanirx.example", "+91 98901 12674", "07AAGCS8812H1ZW", "New Delhi", "Delhi", "Sanjeevani Bhawan, Nehru Place\nNew Delhi — 110019"),
  p("Vitaris Healthcare Pvt. Ltd.", "Receivable", "M. Fernandes, Marketing Manager", "m.fernandes@vitarishc.example", "+91 98670 40093", "27AAHCV3345N1ZB", "Mumbai", "Maharashtra", "Vitaris Plaza, Turner Road\nBandra (W), Mumbai — 400050"),
  p("Prakash Biotech Ltd.", "Receivable", "D. Sharma, VP Commercial", "d.sharma@prakashbiotech.example", "+91 98110 65529", "06AAJCP9901F1ZD", "Gurugram", "Haryana", "Prakash Tower, Sector 44\nGurugram — 122003"),
  p("Arogyam Labs Pvt. Ltd.", "Receivable", "T. Nair, Brand Lead", "t.nair@arogyamlabs.example", "+91 99450 38812", "29AAKCA4478R1ZG", "Bengaluru", "Karnataka", "Arogyam House, Koramangala 5th Block\nBengaluru — 560095"),
  p("Trivedi Pharmaceuticals Ltd.", "Receivable", "H. Trivedi, Director", "h.trivedi@trivedipharma.example", "+91 98240 91145", "24AALCT6690Q1ZM", "Vadodara", "Gujarat", "Trivedi Estate, Gorwa Road\nVadodara — 390016"),
  p("Nucleus Formulations Pvt. Ltd.", "Receivable", "V. Rao, Marketing Head", "v.rao@nucleusform.example", "+91 90300 27764", "36AAMCN1123S1ZY", "Hyderabad", "Telangana", "Nucleus Point, Gachibowli\nHyderabad — 500032"),
  p("Vaidya Life Sciences Ltd.", "Receivable", "S. Joshi, Senior Brand Manager", "s.joshi@vaidyalifesci.example", "+91 98920 55437", "27AANCV7756T1ZH", "Navi Mumbai", "Maharashtra", "Vaidya Corporate Park, Vashi\nNavi Mumbai — 400703"),
  p("Kritin Pharma Pvt. Ltd.", "Receivable", "G. Sethi, Marketing Manager", "g.sethi@kritinpharma.example", "+91 98180 33902", "09AAPCK3387U1ZJ", "Noida", "Uttar Pradesh", "Kritin Business Park, Sector 62\nNoida — 201309"),
  p("Ojas Healthcare Ltd.", "Receivable", "L. Menon, Head — Brand", "l.menon@ojashealth.example", "+91 99620 74418", "32AAQCO5514V1ZL", "Kochi", "Kerala", "Ojas Towers, Kaloor\nKochi — 682017"),
  p("Samvedna Biosciences Pvt. Ltd.", "Receivable", "R. Chatterjee, Product Manager", "r.chatterjee@samvednabio.example", "+91 98310 60027", "19AARCS8845W1ZN", "Kolkata", "West Bengal", "Samvedna House, Salt Lake Sector V\nKolkata — 700091"),
  p("Anantara Pharma Ltd.", "Receivable", "B. Shetty, GM Marketing", "b.shetty@anantarapharma.example", "+91 98450 21193", "29AASCA2276X1ZQ", "Bengaluru", "Karnataka", "Anantara Centre, Whitefield Main Road\nBengaluru — 560066"),
  p("Shakti Remedies Pvt. Ltd.", "Receivable", "A. Verma, Brand Manager", "a.verma@shaktiremedies.example", "+91 98290 47730", "08AATCS6602Y1ZS", "Jaipur", "Rajasthan", "Shakti Bhawan, Malviya Nagar\nJaipur — 302017"),
  p("Vardaan Life Sciences Ltd.", "Receivable", "N. Pillai, Marketing Director", "n.pillai@vardaanlife.example", "+91 98860 15548", "23AAUCV9938Z1ZV", "Indore", "Madhya Pradesh", "Vardaan Corporate House, Vijay Nagar\nIndore — 452010"),

  // Devices and diagnostics
  p("Precision Medtech India Pvt. Ltd.", "Receivable", "J. Kapoor, Country Manager", "j.kapoor@precisionmedtech.example", "+91 98111 82234", "07AAVCP4471B1ZX", "New Delhi", "Delhi", "Precision House, Okhla Phase III\nNew Delhi — 110020"),
  p("Dhruva Diagnostics Ltd.", "Receivable", "M. Saxena, Head — Marketing", "m.saxena@dhruvadiag.example", "+91 98995 30076", "06AAWCD7719C1ZA", "Faridabad", "Haryana", "Dhruva Lab Complex, Sector 21\nFaridabad — 121001"),
  p("CardioSense Devices Pvt. Ltd.", "Receivable", "S. Reddy, Business Head", "s.reddy@cardiosense.example", "+91 99490 66102", "36AAXCC3350D1ZC", "Hyderabad", "Telangana", "CardioSense Park, Kondapur\nHyderabad — 500084"),
  p("LabOne Diagnostics Pvt. Ltd.", "Receivable", "P. Bhatt, Regional Head", "p.bhatt@labonediag.example", "+91 98250 74419", "24AAYCL8867E1ZE", "Surat", "Gujarat", "LabOne Centre, Ring Road\nSurat — 395002"),
  p("Vision Optics Medical Ltd.", "Receivable", "K. Menon, Marketing Lead", "k.menon@visionoptics.example", "+91 99400 51138", "33AAZCV1194F1ZF", "Coimbatore", "Tamil Nadu", "Vision House, Avinashi Road\nCoimbatore — 641018"),
  p("SteriTech Surgical Pvt. Ltd.", "Receivable", "R. Gowda, Sales Director", "r.gowda@steritechsurgical.example", "+91 98860 29947", "29ABACS5523G1ZH", "Bengaluru", "Karnataka", "SteriTech Works, Peenya Industrial Area\nBengaluru — 560058"),

  // Hospitals and provider groups
  p("Meridian Superspeciality Hospital", "Receivable", "Dr. A. Khanna, Medical Director", "a.khanna@meridianhospital.example", "+91 98200 77410", "27ABBCM9046H1ZK", "Mumbai", "Maharashtra", "Meridian Hospital, Linking Road\nSantacruz (W), Mumbai — 400054"),
  p("Sanjeevan Multispeciality Hospital", "Receivable", "Dr. P. Rane, CMO", "p.rane@sanjeevanhospital.example", "+91 98220 44815", "27ABCCS2673J1ZM", "Pune", "Maharashtra", "Sanjeevan Hospital, Karve Road\nPune — 411004"),
  p("Aarogya Hospitals Group", "Barter", "Dr. S. Menon, Group Director", "s.menon@aarogyagroup.example", "+91 99450 90021", "29ABDCA6640K1ZN", "Bengaluru", "Karnataka", "Aarogya Group HQ, Jayanagar 4th Block\nBengaluru — 560011"),
  p("Nightingale Women's Hospital", "Receivable", "Dr. R. Pandey, Director", "r.pandey@nightingalewh.example", "+91 98110 36628", "07ABECN1187L1ZP", "New Delhi", "Delhi", "Nightingale Hospital, Greater Kailash I\nNew Delhi — 110048"),
  p("Lifeline Institute of Medical Sciences", "Barter", "Dr. V. Kulkarni, Dean", "v.kulkarni@lifelineims.example", "+91 98310 22094", "19ABFCL4419M1ZR", "Kolkata", "West Bengal", "Lifeline IMS Campus, EM Bypass\nKolkata — 700107"),

  // Associations and societies
  p("Indian Society of Reproductive Medicine", "Barter", "Dr. M. Bose, Secretary", "secretary@isrm.example", "+91 98300 15572", "19ABGCI7736N1ZT", "Kolkata", "West Bengal", "ISRM Secretariat, Park Street\nKolkata — 700016"),
  p("Association of Clinical Cardiologists", "Barter", "Dr. T. Ramesh, Convener", "convener@acc-india.example", "+91 99400 83319", "33ABHCA3063P1ZW", "Chennai", "Tamil Nadu", "ACC Office, Anna Salai\nChennai — 600002"),
  p("National Academy of Paediatrics", "Payable", "Dr. K. Shah, Programme Chair", "programmes@nap-india.example", "+91 98250 60047", "24ABICN9390Q1ZY", "Ahmedabad", "Gujarat", "NAP House, CG Road\nAhmedabad — 380009"),
  p("Federation of Diabetes Educators", "Barter", "Dr. N. Agarwal, President", "president@fde-india.example", "+91 98180 71165", "09ABJCF5717R1ZB", "Lucknow", "Uttar Pradesh", "FDE Centre, Gomti Nagar\nLucknow — 226010"),
  p("Society of Critical Care Practitioners", "Barter", "Dr. J. Thomas, Hon. Secretary", "secretary@sccp-india.example", "+91 99620 40883", "32ABKCS2044S1ZD", "Thiruvananthapuram", "Kerala", "SCCP Secretariat, Vazhuthacaud\nThiruvananthapuram — 695014"),
  p("Indian College of Dermatology", "Payable", "Dr. A. Fernandes, Registrar", "registrar@icd-india.example", "+91 98200 93316", "27ABLCI8371T1ZF", "Mumbai", "Maharashtra", "ICD House, Worli Sea Face\nMumbai — 400018"),

  // Production vendors — the payable side
  p("Frameworks Studio LLP", "Payable", "N. Dsouza, Producer", "n.dsouza@frameworksstudio.example", "+91 98670 55229", "27ABMCF4698U1ZH", "Mumbai", "Maharashtra", "Frameworks Studio, Aram Nagar\nVersova, Mumbai — 400061"),
  p("Kalakriti Post Production Pvt. Ltd.", "Payable", "S. Iyer, Post Supervisor", "s.iyer@kalakritipost.example", "+91 98450 11704", "29ABNCK1025V1ZJ", "Bengaluru", "Karnataka", "Kalakriti House, Indiranagar\nBengaluru — 560038"),
  p("Soundstage Audio Labs", "Payable", "R. Gupta, Studio Head", "r.gupta@soundstageaudio.example", "+91 98110 47752", "07ABOCS7352W1ZL", "New Delhi", "Delhi", "Soundstage Labs, Lajpat Nagar II\nNew Delhi — 110024"),
  p("BrightPixel Motion Graphics", "Payable", "A. Menon, Creative Director", "a.menon@brightpixel.example", "+91 99400 62288", "33ABPCB3679X1ZN", "Chennai", "Tamil Nadu", "BrightPixel Studio, T. Nagar\nChennai — 600017"),
];

/* ------------------------------------------------------------------ rate card */
export const RATE_CARD: Record<string, number> = {
  "DP1 - Case Insight": 45000,
  "DP2 - CME - 1 Hr": 125000,
  "DP3 - CPD - 3 Hr": 285000,
  "DP4 - Cross Guidelines": 38000,
  "DP5 - Did You Know": 32000,
  "DP6 - Journal Digest": 36000,
  "DP7 - Myths & Facts": 34000,
  "DP8 - News": 28000,
  "DP9 - Poll": 22000,
  "DP10 - Q&A": 40000,
  "DP11 - TDIF": 30000,
  "EM1 - IP": 385000,
  "EM2 - Co-Produced": 295000,
  "EM3 - Subscription": 175000,
  "MS1. Curated Watchlist": 95000,
  "MS2. Promoted Watchlist": 145000,
  "MS3. Feature on DP+Email+PN": 85000,
  "MS4. Feature on WA Channel": 65000,
  "MS5. Customised branded courses": 450000,
  "MS6. Digital Collaterals (E-Brochure, Monthly Watchlist, OnfTV Calender, Video Trailer, Certificate)": 75000,
  "MS7. Webinar": 225000,
};

/* ------------------------------------------------------------------ projects */
export type Phase = "delivered" | "active" | "upcoming";

export interface DemoProject {
  name: string;
  partner: number;          // index into PARTNERS
  phase: Phase;
  owner: "admin" | "sales" | "priya" | "rahul";
  pos: string;              // place of supply
  mix: string[];            // offering names
  topics: string[];         // one per line item, cycled
  notes: string;
}

export const PROJECTS: DemoProject[] = [
  {
    name: "Femiforte Q3 Awareness Series", partner: 0, phase: "active", owner: "sales", pos: "Maharashtra",
    mix: ["DP1 - Case Insight", "DP2 - CME - 1 Hr", "DP7 - Myths & Facts", "EM1 - IP", "MS3. Feature on DP+Email+PN"],
    topics: ["PCOS in adolescents", "Managing PCOS: an hour with the experts", "Myths about hormonal therapy", "Fertility preservation masterclass", "Women's health awareness feature"],
    notes: "Faculty confirmed for all five cards. Creative kit approved by brand on the first pass.",
  },
  {
    name: "CardioPulse CME Series 2026", partner: 20, phase: "active", owner: "sales", pos: "Telangana",
    mix: ["DP2 - CME - 1 Hr", "DP3 - CPD - 3 Hr", "DP6 - Journal Digest", "EM2 - Co-Produced"],
    topics: ["Acute coronary syndrome pathways", "Heart failure: three-hour intensive", "Latest from the European Heart Journal", "Interventional cardiology series"],
    notes: "Co-produced with the Association of Clinical Cardiologists. Device footage supplied by the client.",
  },
  {
    name: "Diabetes Awareness Month 2026", partner: 33, phase: "upcoming", owner: "priya", pos: "Uttar Pradesh",
    mix: ["DP5 - Did You Know", "DP9 - Poll", "DP11 - TDIF", "MS1. Curated Watchlist", "MS4. Feature on WA Channel"],
    topics: ["Insulin storage in Indian summers", "How do you screen for prediabetes?", "This day in diabetes care", "Diabetes educator watchlist", "WA channel push for November"],
    notes: "November campaign. Association supplies faculty; we supply production and distribution.",
  },
  {
    name: "OncoConnect Tumour Board Series", partner: 2, phase: "active", owner: "admin", pos: "Tamil Nadu",
    mix: ["DP1 - Case Insight", "DP3 - CPD - 3 Hr", "EM1 - IP", "MS7. Webinar"],
    topics: ["Triple-negative breast cancer board", "Multidisciplinary tumour board intensive", "Precision oncology library", "Live tumour board webinar"],
    notes: "Tumour board recordings require anonymisation sign-off before release.",
  },
  {
    name: "NeuroInsights Case Library", partner: 4, phase: "active", owner: "rahul", pos: "Telangana",
    mix: ["DP1 - Case Insight", "DP4 - Cross Guidelines", "DP10 - Q&A", "EM2 - Co-Produced"],
    topics: ["Stroke thrombolysis window", "Epilepsy guidelines side by side", "Ask the neurologist", "Movement disorders series"],
    notes: "Neurology faculty panel locked. Second wave planned for the next quarter.",
  },
  {
    name: "PediaCare Immunisation Drive", partner: 32, phase: "delivered", owner: "sales", pos: "Gujarat",
    mix: ["DP5 - Did You Know", "DP8 - News", "DP9 - Poll", "MS3. Feature on DP+Email+PN"],
    topics: ["Cold chain essentials", "Updated national immunisation schedule", "Which vaccine do you counsel first?", "Immunisation drive feature"],
    notes: "Delivered on schedule. Academy requested a repeat in the next financial year.",
  },
  {
    name: "DermaFocus Clinical Updates", partner: 35, phase: "active", owner: "priya", pos: "Maharashtra",
    mix: ["DP1 - Case Insight", "DP6 - Journal Digest", "DP7 - Myths & Facts", "MS1. Curated Watchlist"],
    topics: ["Atopic dermatitis in skin of colour", "Dermatology journal digest", "Myths about steroid creams", "Dermatology watchlist"],
    notes: "College supplies faculty; honorarium handled directly by them.",
  },
  {
    name: "RespiroCare COPD Programme", partner: 6, phase: "active", owner: "sales", pos: "Maharashtra",
    mix: ["DP2 - CME - 1 Hr", "DP4 - Cross Guidelines", "EM1 - IP", "MS7. Webinar"],
    topics: ["COPD exacerbation management", "GOLD guidelines compared", "Inhaler technique library", "COPD in primary care webinar"],
    notes: "Inhaler demonstration footage to be reshot in the studio, not on location.",
  },
  {
    name: "GastroGuide Endoscopy Series", partner: 8, phase: "upcoming", owner: "rahul", pos: "Karnataka",
    mix: ["DP1 - Case Insight", "DP3 - CPD - 3 Hr", "EM2 - Co-Produced"],
    topics: ["Upper GI bleed triage", "Therapeutic endoscopy intensive", "Endoscopy technique library"],
    notes: "Endoscopy suite access confirmed for two shoot days in the first week.",
  },
  {
    name: "OrthoMotion Joint Health Series", partner: 23, phase: "active", owner: "admin", pos: "Karnataka",
    mix: ["DP1 - Case Insight", "DP5 - Did You Know", "DP10 - Q&A", "MS2. Promoted Watchlist"],
    topics: ["Revision arthroplasty decisions", "Implant materials explained", "Ask the orthopaedic surgeon", "Joint health promoted watchlist"],
    notes: "Implant imagery supplied by the client under their own regulatory approval.",
  },
  {
    name: "NephroCare Dialysis Education", partner: 10, phase: "delivered", owner: "sales", pos: "Telangana",
    mix: ["DP2 - CME - 1 Hr", "DP6 - Journal Digest", "EM3 - Subscription"],
    topics: ["Dialysis adequacy in practice", "Nephrology journal digest", "Nephrology subscription bundle"],
    notes: "Closed out last quarter. Subscription cards continue to run on the platform.",
  },
  {
    name: "IVF Excellence Masterclass", partner: 30, phase: "active", owner: "priya", pos: "West Bengal",
    mix: ["DP3 - CPD - 3 Hr", "EM1 - IP", "MS5. Customised branded courses", "MS6. Digital Collaterals (E-Brochure, Monthly Watchlist, OnfTV Calender, Video Trailer, Certificate)"],
    topics: ["Embryo transfer intensive", "IVF laboratory library", "Certified IVF course", "Course collateral pack"],
    notes: "Certification points pending confirmation from the society. Certificates blocked until then.",
  },
  {
    name: "Critical Care Sepsis Bundle", partner: 34, phase: "active", owner: "rahul", pos: "Kerala",
    mix: ["DP2 - CME - 1 Hr", "DP4 - Cross Guidelines", "DP8 - News", "MS7. Webinar"],
    topics: ["Sepsis hour-one bundle", "Surviving Sepsis compared", "Critical care news round-up", "Sepsis live webinar"],
    notes: "Society co-branding approved. Webinar scheduled for a weekday evening slot.",
  },
  {
    name: "Rheumatology Rounds 2026", partner: 12, phase: "upcoming", owner: "sales", pos: "Uttar Pradesh",
    mix: ["DP1 - Case Insight", "DP6 - Journal Digest", "DP10 - Q&A", "EM2 - Co-Produced"],
    topics: ["Early rheumatoid arthritis", "Rheumatology journal digest", "Ask the rheumatologist", "Biologics in practice"],
    notes: "Biologics messaging must clear the client's medical-legal review before release.",
  },
  {
    name: "Urology Update Series", partner: 14, phase: "active", owner: "admin", pos: "Kerala",
    mix: ["DP1 - Case Insight", "DP7 - Myths & Facts", "MS1. Curated Watchlist"],
    topics: ["BPH management pathways", "Myths about prostate screening", "Urology watchlist"],
    notes: "Screening messaging kept strictly non-promotional at the client's request.",
  },
  {
    name: "Hepatology Liver Health Week", partner: 16, phase: "upcoming", owner: "priya", pos: "Rajasthan",
    mix: ["DP5 - Did You Know", "DP9 - Poll", "DP11 - TDIF", "MS4. Feature on WA Channel"],
    topics: ["Fatty liver in young adults", "How early do you screen for NAFLD?", "This day in hepatology", "Liver week WA push"],
    notes: "Awareness week campaign. All five cards go live on consecutive days.",
  },
  {
    name: "Anaesthesia Safety Series", partner: 22, phase: "delivered", owner: "rahul", pos: "Gujarat",
    mix: ["DP2 - CME - 1 Hr", "DP4 - Cross Guidelines", "EM2 - Co-Produced"],
    topics: ["Difficult airway algorithm", "Airway guidelines compared", "Perioperative safety library"],
    notes: "Delivered and archived. Client asked for viewership data by speciality.",
  },
  {
    name: "Radiology AI Symposium", partner: 18, phase: "active", owner: "sales", pos: "Delhi",
    mix: ["DP3 - CPD - 3 Hr", "DP8 - News", "EM1 - IP", "MS7. Webinar"],
    topics: ["AI in chest radiography", "Radiology technology news", "Imaging AI library", "AI symposium webinar"],
    notes: "Vendor-neutral framing agreed in writing. No product names inside the sessions.",
  },
  {
    name: "Emergency Medicine Protocols", partner: 26, phase: "active", owner: "admin", pos: "Karnataka",
    mix: ["DP1 - Case Insight", "DP4 - Cross Guidelines", "DP10 - Q&A", "MS2. Promoted Watchlist"],
    topics: ["Polytrauma first hour", "Trauma protocols compared", "Ask the emergency physician", "Emergency medicine watchlist"],
    notes: "Barter arrangement: hospital provides faculty and location, we provide reach.",
  },
  {
    name: "Psychiatry Mental Health Month", partner: 28, phase: "upcoming", owner: "priya", pos: "Delhi",
    mix: ["DP5 - Did You Know", "DP7 - Myths & Facts", "DP9 - Poll", "MS3. Feature on DP+Email+PN"],
    topics: ["Screening for adolescent depression", "Myths about antidepressants", "How do you handle disclosure?", "Mental health month feature"],
    notes: "Sensitive-topic review completed. Helpline card required on every release.",
  },
  {
    name: "Endocrine Thyroid Awareness", partner: 3, phase: "delivered", owner: "sales", pos: "Maharashtra",
    mix: ["DP5 - Did You Know", "DP6 - Journal Digest", "DP11 - TDIF", "MS1. Curated Watchlist"],
    topics: ["Subclinical hypothyroidism", "Thyroid journal digest", "This day in endocrinology", "Thyroid watchlist"],
    notes: "Closed out with a full delivery report. Repeat pencilled in for next year.",
  },
  {
    name: "Vaccination Champions Programme", partner: 5, phase: "active", owner: "rahul", pos: "Delhi",
    mix: ["DP8 - News", "DP9 - Poll", "EM3 - Subscription", "MS4. Feature on WA Channel"],
    topics: ["Adult immunisation news", "Which adult vaccine is under-used?", "Vaccination subscription bundle", "Champions WA push"],
    notes: "Adult immunisation focus. Paediatric content deliberately out of scope.",
  },
  {
    name: "Antimicrobial Stewardship Series", partner: 24, phase: "upcoming", owner: "admin", pos: "Maharashtra",
    mix: ["DP2 - CME - 1 Hr", "DP4 - Cross Guidelines", "DP6 - Journal Digest", "EM2 - Co-Produced"],
    topics: ["Stewardship in the ICU", "AMR guidelines compared", "Infectious disease journal digest", "Stewardship library"],
    notes: "Hospital antibiogram data to be de-identified before any card is published.",
  },
  {
    name: "Geriatric Care Essentials", partner: 29, phase: "upcoming", owner: "sales", pos: "West Bengal",
    mix: ["DP1 - Case Insight", "DP5 - Did You Know", "DP10 - Q&A", "MS1. Curated Watchlist"],
    topics: ["Polypharmacy review", "Falls risk in the elderly", "Ask the geriatrician", "Geriatric care watchlist"],
    notes: "Institute supplies faculty under a barter arrangement; no cash consideration.",
  },
  {
    name: "Public Health Outreach Q4", partner: 27, phase: "upcoming", owner: "priya", pos: "Delhi",
    mix: ["DP8 - News", "DP11 - TDIF", "MS2. Promoted Watchlist", "MS6. Digital Collaterals (E-Brochure, Monthly Watchlist, OnfTV Calender, Video Trailer, Certificate)"],
    topics: ["Public health news round-up", "This day in public health", "Outreach promoted watchlist", "Outreach collateral pack"],
    notes: "Quarter-four outreach. Collateral pack doubles as the year-end report jacket.",
  },
];

/* ------------------------------------------------------------------ team */
export const TEAM = [
  { username: "priya", name: "Priya Nair", email: "priya.nair@onference.in", role: "sales" as const },
  { username: "rahul", name: "Rahul Mehta", email: "rahul.mehta@onference.in", role: "sales" as const },
  { username: "kavita", name: "Kavita Rao", email: "kavita.rao@onference.in", role: "ops" as const },
  { username: "arjun", name: "Arjun Pillai", email: "arjun.pillai@onference.in", role: "ops" as const },
];
