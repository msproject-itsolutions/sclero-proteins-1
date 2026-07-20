"""
Seed / refresh the full Sclero Proteins catalog from the brand product docs.

The catalog is exactly these five sellable SKUs plus the OvoMatrix™ master
technology ContentPage:

  1. Combo Collagen®                  (COMBO-COLLAGEN-60)
  2. OvoShell Collagen™               (OVOSHELL-COLLAGEN-60)
  3. BJC® — Bone & Joint Care         (BJC-BONE-JOINT)
  4. SoilPro™ (OvoMatrix)             (SOILPRO-1KG)
  5. LawnCal™                         (LAWNCAL-25KG)
  +  OvoMatrix™ technology page       (/pages/ovomatrix)

Idempotent: safe to re-run. Updates content in place, (re)creates region
pricing, stock, media images, and category links, then PRUNES the rest of the
catalog — any product whose SKU is not listed above is archived (is_active
False + is_archived True, region configs hidden) rather than deleted, so
historical orders keep their references. Categories left with no active
product are deactivated.

NOTE: agri prices (SoilPro/LawnCal) are indicative placeholders — confirm with
the business before go-live.

Usage:  python manage.py seed_catalog
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.products.models import Product, ProductRegionConfig, ProductMedia, Category
from apps.regions.models import Region, Warehouse
from apps.inventory.models import StockLevel
from apps.admin_dashboard.models import ContentPage


CATEGORIES = [
    ("collagen", "Collagen", 5),
    ("bone-joint-care", "Bone & Joint Care", 2),
    ("calcium", "Calcium", 6),
    ("skin-beauty", "Skin & Beauty", 7),
    ("soil-turf", "Soil & Turf", 8),
]


def faq(*pairs):
    return [{"q": q, "a": a} for q, a in pairs]


# Shared accordion blocks reused across the two collagen SKUs.
ECM_FAQ = (
    "What is the Extracellular Matrix (ECM)?",
    "The ECM is the body's natural structural network — the framework that surrounds and "
    "supports your cells, keeping skin firm, joints cushioned, hair and nails strong, and "
    "connective tissues resilient. It is made of collagen (Types I, V, X), elastin, hyaluronic "
    "acid, glycosaminoglycans, keratin-related proteins, and protective proteins like "
    "ovotransferrin and lysozyme. As we age the ECM weakens — collagen declines, elastin "
    "fragments, and hydration drops. This product provides ECM-rich nutrition, giving your body "
    "the same components it uses to maintain structure, firmness, and resilience.",
)
CONSISTENCY_FAQ = (
    "Understanding collagen: consistency is the key",
    "Collagen is not a quick-action ingredient. Renewal is a gradual biological process — "
    "collagen fibres take weeks to rebuild, skin turnover cycles last 28–45 days, and bioactive "
    "peptides need consistent intake to accumulate. Most users prefer 8–12 weeks of daily use to "
    "observe improvements in hydration, texture, firmness, and overall structural support.",
)
CAUTIONS_FAQ = (
    "Cautions & warnings",
    "Not intended for children. Do not use if allergic to eggs or eggshell-derived ingredients. "
    "If pregnant or breastfeeding, consult a healthcare professional. Do not exceed the "
    "recommended daily intake. Avoid combining with other calcium supplements unless advised. "
    "Discontinue use if adverse effects occur. Food supplements should not replace a varied diet "
    "and healthy lifestyle.",
)


PRODUCTS = [
    # ------------------------------------------------------------------ COMBO
    {
        "sku": "COMBO-COLLAGEN-60",
        "name": "Combo Collagen®",
        "hsn_code": "21069099",
        "short_benefit": "3-in-1: Beauty · Health · Anti-Ageing",
        "dietary_tags": ["gmp_certified"],
        "categories": ["collagen", "skin-beauty", "bone-joint-care"],
        "description": (
            "Combo Collagen® — Beyond Collagen. A pure, single-ingredient collagen complex made "
            "from 100% purified eggshell membrane in 500 mg capsules. It naturally provides a "
            "complete matrix of structural proteins — collagen types I, V and X, elastin, keratin, "
            "hyaluronic acid, glycosaminoglycans (chondroitin, dermatan & keratan sulfate), "
            "ovotransferrin, lysozyme and bioactive peptides. Designed as a 3-in-1 Beauty, Health "
            "& Anti-Ageing supplement, it delivers clean, unaltered structural protein nutrition "
            "with no fillers, no additives, and no artificial ingredients."
        ),
        "benefits": (
            "Beauty — skin firmness (Type I & V collagen), hydration & glow (hyaluronic acid & "
            "glycosaminoglycans), elasticity & bounce (elastin), smoother appearance (bioactive "
            "peptides). Health — structural protein nutrition for connective tissues, joint "
            "comfort (Type X collagen & GAGs), hair & nail strength (keratin-supporting amino "
            "acids). Anti-ageing — oxidative support (ovotransferrin), barrier strength, and "
            "support for age-related collagen decline after the mid-20s."
        ),
        "ingredients": (
            "Eggshell Membrane Powder — 500 mg per capsule, naturally containing collagen types I, "
            "V, X, elastin, keratin, glycosaminoglycans (chondroitin/dermatan/keratan sulfate), "
            "hyaluronic acid, ovotransferrin, lysozyme, bioactive peptides, and amino acids "
            "(glycine, proline, hydroxyproline, alanine, serine). No fillers. No flow agents. No additives."
        ),
        "nutrition_facts": {
            "Serving Size": "1 capsule daily",
            "Servings Per Pack": "60",
            "Capsule Weight": "500 mg",
            "Net Weight": "30 g",
            "Capsule Shell": "Gelatin",
            "Collagen Types": "I, V, X",
            "Ingredient": "100% purified eggshell membrane",
            "Manufacturing": "GMP aligned, ISO certified facility",
            "Allergens": "Contains egg derivatives",
        },
        "faq": faq(
            ECM_FAQ,
            ("Mechanism of action",
             "Beauty: Type I & V collagen support firmness, hyaluronic acid & GAGs support "
             "hydration, elastin supports elasticity, peptides support renewal. Health: Type X "
             "collagen supports cartilage, keratin-related amino acids support hair & nails, GAGs "
             "support joint lubrication. Anti-ageing: ovotransferrin supports antioxidant pathways, "
             "lysozyme supports natural defence, and the collagen matrix complements age-related decline."),
            ("Why Combo Collagen is different",
             "Multi-type collagen (I, V, X) plus elastin, keratin, hyaluronic acid and "
             "glycosaminoglycans with naturally occurring bioactive peptides — from purified "
             "eggshell membrane, low-temperature processed, zero fillers or additives, a complete "
             "ECM-support profile in a clean single-ingredient formulation."),
            ("Sustainability & circular nutrition",
             "Made from eggshell membrane normally discarded as food-industry waste. Upcycling this "
             "structural protein source supports circular-economy principles, waste reduction, "
             "responsible sourcing, and a lower environmental footprint than bovine/marine collagen."),
            ("Usage guidance",
             "1 capsule daily, any time of day, with or without food; hydration recommended. Daily "
             "use supports structural protein nutrition. A nutritional supplement, not a substitute "
             "for a varied diet — not intended to diagnose, treat, cure or prevent any disease."),
            CONSISTENCY_FAQ,
            CAUTIONS_FAQ,
            ("What is Combo Collagen® made from?",
             "100% purified eggshell membrane, a natural source of multi-type collagen and ECM proteins."),
            ("What makes it a 3-in-1 supplement?",
             "It naturally supports Beauty (skin, hair, nails), Health (joints, connective tissues), "
             "and Anti-Ageing (oxidative support, structural-decline support)."),
            ("Are there any side effects?",
             "Generally well tolerated as a single-ingredient, food-derived structural protein. "
             "Everyone is different — discontinue and consult a professional if you react."),
            ("Does it contain allergens?", "Yes. It contains egg derivatives."),
            ("Can it be taken with other supplements?",
             "Yes. As a single-ingredient structural protein it can be taken alongside most products."),
            ("Does it contain artificial ingredients?",
             "No — 100% natural, with no artificial colours, flavours or preservatives."),
            ("Capsules or liquid collagen — which is better?",
             "Capsules are cleaner and more convenient, avoiding the sugars, flavours and "
             "preservatives often added to liquids. Absorption depends on digestion, not format, so "
             "both work the same when taken consistently."),
            ("Can it help with joint comfort?",
             "It is not a medicine and does not treat joint pain, but it naturally contains Type X "
             "collagen and glycosaminoglycans found in healthy cartilage, supporting normal joint "
             "structure and comfort with consistent use. Consult a professional for ongoing issues."),
        ),
        "price_gbp": ("32.00", "27.20"),
        "price_inr": ("2499.00", "2199.00"),
        "stock": 300,
        "images": [
            "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600",
            "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600",
        ],
    },
    # --------------------------------------------------------------- OVOSHELL
    {
        "sku": "OVOSHELL-COLLAGEN-60",
        "name": "OvoShell Collagen™",
        "hsn_code": "21069099",
        "short_benefit": "Natural OvoShell membrane · Type I, V & X collagen",
        "dietary_tags": ["gmp_certified"],
        "categories": ["collagen", "skin-beauty", "bone-joint-care"],
        "description": (
            "OvoShell Collagen™ — Beyond Collagen. A pure, single-ingredient collagen complex made "
            "using premium OvoShell membrane, a naturally rich source of structural proteins. Each "
            "500 mg capsule contains collagen types I, V and X, elastin, keratin, hyaluronic acid, "
            "glycosaminoglycans, ovotransferrin, lysozyme and bioactive peptides. A 3-in-1 Beauty, "
            "Health & Anti-Ageing supplement delivering clean, unaltered structural protein "
            "nutrition with no fillers, additives or artificial ingredients."
        ),
        "benefits": (
            "Beauty — skin firmness, hydration & glow, elasticity & bounce, smoother appearance. "
            "Health — structural protein nutrition, joint comfort, hair & nail strength. "
            "Anti-ageing — oxidative support, barrier strength, and support for age-related "
            "collagen decline after the mid-20s."
        ),
        "ingredients": (
            "Purified Eggshell Membrane — 500 mg per capsule, naturally containing collagen types "
            "I, V, X, elastin, keratin, glycosaminoglycans, hyaluronic acid, ovotransferrin, "
            "lysozyme and bioactive peptides. No fillers. No flow agents. No additives."
        ),
        "nutrition_facts": {
            "Serving Size": "1–2 capsules daily",
            "Servings Per Pack": "60 capsules",
            "Capsule Weight": "500 mg",
            "Net Weight": "30 g",
            "Capsule Shell": "Gelatin",
            "Collagen Types": "I, V, X",
            "Ingredient": "100% purified eggshell membrane",
            "Manufacturing": "GMP aligned, ISO certified facility",
            "Allergens": "Contains egg derivatives",
        },
        "faq": faq(
            ECM_FAQ,
            ("Mechanism of action",
             "Beauty: Type I & V collagen support firmness, hyaluronic acid supports hydration, "
             "elastin supports elasticity, peptides support renewal. Health: Type X collagen "
             "supports cartilage, keratin amino acids support hair & nails, GAGs support joint "
             "lubrication. Anti-ageing: ovotransferrin supports antioxidant pathways and lysozyme "
             "supports natural defence."),
            ("Why OvoShell Collagen™ is different",
             "Multi-type collagen (I, V, X) plus elastin, keratin, hyaluronic acid and GAGs with "
             "naturally occurring bioactive peptides, from a premium upcycled OvoShell membrane — "
             "low-temperature processed, zero fillers, a complete ECM-support profile."),
            ("Sustainability & circular nutrition",
             "Made from OvoShell membrane normally discarded as food-industry waste; upcycling it "
             "supports circular-economy principles, waste reduction and a lower footprint than "
             "bovine/marine collagen."),
            ("Usage guidance",
             "1–2 capsules daily, any time, with or without food; hydration recommended. A "
             "nutritional supplement, not a substitute for a varied diet."),
            CONSISTENCY_FAQ,
            CAUTIONS_FAQ,
            ("What makes it a 3-in-1 supplement?",
             "It supports Beauty (skin, hair, nails), Health (joints, connective tissues) and "
             "Anti-Ageing (oxidative support, structural-decline support)."),
            ("Does it contain allergens?",
             "Yes. It contains derivatives of natural eggshell membrane proteins."),
            ("Does it contain artificial ingredients?",
             "No — 100% natural, with no artificial colours, flavours or preservatives."),
            ("How is it different from regular collagen powders?",
             "Multi-type collagen, elastin + keratin + hyaluronic acid + GAGs, bioactive peptides, "
             "single-ingredient purity, ECM-support profile, a sustainable upcycled ingredient, and "
             "3-in-1 Beauty/Health/Anti-Ageing."),
            ("Capsules or liquid collagen — which is better?",
             "Capsules are cleaner and more convenient, avoiding the sugars, flavours and "
             "preservatives often added to liquids. Absorption depends on digestion, not format, so "
             "both work the same when taken consistently."),
            ("Can it help with joint comfort?",
             "It is not a medicine and does not treat joint pain, but it naturally contains Type X "
             "collagen and glycosaminoglycans found in healthy cartilage, supporting normal joint "
             "structure and comfort with consistent use. Consult a professional for ongoing issues."),
            ("What visible benefits can I expect with consistent use?",
             "With daily use, many users report improvements in skin smoothness, hydration and "
             "overall appearance thanks to the natural collagen, elastin and hyaluronic-acid "
             "precursors supporting the body's normal structural processes."),
        ),
        "price_gbp": ("34.00", "28.90"),
        "price_inr": ("2699.00", "2299.00"),
        "stock": 250,
        "images": [
            "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600",
            "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600",
        ],
    },
    # -------------------------------------------------------------------- BJC
    {
        "sku": "BJC-BONE-JOINT",
        "name": "BJC® — Bone & Joint Care",
        "hsn_code": "21069099",
        "short_benefit": "Natural calcium + structural proteins for daily mobility",
        "dietary_tags": ["gmp_certified"],
        "categories": ["bone-joint-care", "collagen", "calcium"],
        "description": (
            "BJC® — Bone & Joint Care. A natural structural-support supplement providing elemental "
            "calcium, collagen, glycosaminoglycans and trace minerals — nutrients already present "
            "in bones, cartilage and connective tissues. Made from eggshell calcium and eggshell "
            "membrane structural proteins, with collagen types I, V & X, GAGs, hyaluronic acid "
            "precursors, elastin, keratin, bioactive peptides and over 25 trace minerals. Designed "
            "for adults seeking daily support for bone maintenance, joint comfort and active living."
        ),
        "benefits": (
            "Supports the maintenance of normal bones; provides structural proteins naturally found "
            "in joints; supplies collagen + GAGs for connective-tissue support; a natural source of "
            "elemental calcium; supports everyday mobility and flexibility. No artificial "
            "preservatives, binders, fillers or colours; made from a natural, upcycled source."
        ),
        "ingredients": (
            "Natural Eggshell Calcium (elemental calcium + over 25 trace minerals) and Natural "
            "Eggshell Membrane Proteins (collagen types I, V, X; glycosaminoglycans; hyaluronic "
            "acid precursors; elastin, keratin, ovotransferrin, lysozyme; bioactive peptides). "
            "Capsule shell: gelatin. No fillers, binders or artificial preservatives."
        ),
        "nutrition_facts": {
            "Serving Size": "2 capsules daily (max 4)",
            "Servings Per Pack": "30 (at 2/day)",
            "Capsule Weight": "750 mg",
            "Format": "60 capsules",
            "Net Weight": "45 g",
            "Capsule Shell": "Hard gelatin",
            "Ingredients": "Eggshell calcium + eggshell membrane proteins",
            "Manufacturing": "GMP aligned, ISO certified facility",
            "Allergens": "Contains egg & eggshell derivatives",
        },
        "faq": faq(
            ("Who is BJC® for?",
             "Adults seeking daily bone & joint support, people with active or physically demanding "
             "lifestyles, office workers with stiffness from long sitting, and older adults wanting "
             "to maintain mobility and independence."),
            ("Mechanism of action",
             "Bone support: natural elemental calcium supports normal bones, with trace minerals "
             "complementing bone structure and density. Joint & cartilage: collagen types I, V, X "
             "and GAGs are naturally present in cartilage and support normal joint structure and "
             "comfort. Connective tissue: elastin, keratin, hyaluronic acid precursors and peptides "
             "support natural renewal processes."),
            ("Why choose BJC®",
             "Natural calcium from eggshell (not synthetic carbonate), natural collagen + GAGs from "
             "membrane proteins, a multi-component structural matrix from a single natural source, "
             "no chemical extraction and no artificial additives."),
            ("Suggested use",
             "Recommended daily dose 2 capsules (up to 4/day); if taking more than 2, space evenly "
             "between meals. Daily use recommended; hydration encouraged. A nutritional supplement, "
             "not a substitute for a varied diet."),
            CAUTIONS_FAQ,
            ("How is it different from Combo Collagen?",
             "Combo Collagen is whole-body collagen; BJC® is specifically engineered for bone + "
             "joint care, combining natural calcium with collagen-rich membrane components."),
            ("Is the calcium natural?", "Yes — it comes from eggshell, not synthetic sources."),
            ("Are there any side effects?",
             "Generally well tolerated as a natural, food-derived structural supplement."),
            ("Is BJC® suitable for long-term daily use?",
             "Yes — it is designed for everyday nutritional support."),
            ("What benefits can I expect with consistent use?",
             "Many users report feeling more comfortable during movement and better ease in "
             "everyday activities."),
        ),
        "price_gbp": ("34.99", "29.99"),
        "price_inr": ("2499.00", "2199.00"),
        "stock": 280,
        "images": [
            "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600",
        ],
    },
    # ---------------------------------------------------------------- SOILPRO
    # ---------------------------------------------------------------- SOILPRO
    {
        "sku": "SOILPRO-1KG",
        "name": "SoilPro™ — Premium Natural Bio Mineral Soil Health Conditioner",
        "hsn_code": "31010099",
        "short_benefit": "Powered by OvoMatrix™ · Available in 1 kg, 5 kg, 25 kg · chemical free",
        "dietary_tags": [],
        "categories": ["soil-turf"],
        "description": (
            "SoilPro™ — a premium natural bio-mineral soil-health conditioner powered by "
            "OvoMatrix™. A calcium-rich, multi-component blend of natural mineral "
            "inputs, organic matter, plant-derived compounds and bioactive soil conditioners that "
            "improves soil structure, stimulates microbial activity, increases organic matter and "
            "strengthens plant resilience — without synthetic fertilisers, pesticides or "
            "herbicides. Safe for pets, children and wildlife, and suitable for organic gardening."
        ),
        "benefits": (
            "Improves soil structure and porosity; boosts microbial activity and soil biology; "
            "enhances root development and plant resilience; provides natural calcium for stronger "
            "turf and plants; deepens natural green colour; improves nutrient-uptake efficiency; "
            "supports stress tolerance and natural soil-pest suppression. 100% natural and chemical "
            "free — no herbicides, no synthetic fertilisers, no NPK."
        ),
        "ingredients": (
            "Natural calcium-rich mineral base, marine-derived bioactive complex, carbon-rich "
            "porous material, humic substances, organic-matter source, and natural amino-based "
            "activators. Natural mineral and organic components only."
        ),
        "nutrition_facts": {
            "Format": "LDPE retail pouch & heavy-duty bulk bags",
            "Blend Type": "Natural bio-mineral soil conditioner",
            "Granularity": "Fine powder blend",
            "Shelf Life": "24 months",
            "Storage": "Cool, dry place; keep sealed; avoid moisture",
            "Safety": "100% natural; safe for pets, children, wildlife",
            "Regulatory Class": "Non-fertiliser, non-pesticide, non-herbicidal",
        },
        "faq": faq(
            ("How it works",
             "Calcium-rich and carbon-rich materials improve soil porosity and aeration; humic "
             "substances and amino activators stimulate microbial activity and nutrient uptake; "
             "marine bioactives support stress tolerance, chlorophyll formation and root "
             "development; organic matter strengthens soil health and microbial diversity."),
            ("Suggested use",
             "Lawns: 75 g/m² every 3–4 weeks (rake in, water). Garden beds: 120 g/m² every 4 weeks. "
             "Pots/indoor: a 5–10 mm layer mixed in every 4–6 weeks."),
            ("Is SoilPro™ a fertiliser?",
             "No. It contains no NPK and is not classified as a fertiliser — it is a soil conditioner."),
        ),
        "price_gbp": ("14.99", None),
        "price_inr": ("899.00", None),
        "stock": 1050,
        "images": [
            "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600",
        ],
        "variants": [
            {
                "sku": "SOILPRO-1KG",
                "name": "1 kg Pouch",
                "option_name": "Weight",
                "option_value": "1 kg",
                "price_gbp": 14.99,
                "price_inr": 899.00,
                "stock_qty": 500,
            },
            {
                "sku": "SOILPRO-5KG",
                "name": "5 kg Pouch",
                "option_name": "Weight",
                "option_value": "5 kg",
                "price_gbp": 49.99,
                "price_inr": 2999.00,
                "stock_qty": 350,
            },
            {
                "sku": "SOILPRO-25KG",
                "name": "25 kg Bag",
                "option_name": "Weight",
                "option_value": "25 kg",
                "price_gbp": 189.00,
                "price_inr": 11499.00,
                "stock_qty": 200,
            },
        ],
    },
    # ---------------------------------------------------------------- LAWNCAL
    {
        "sku": "LAWNCAL-25KG",
        "name": "LawnCal™ — Premium Natural Soil Health Mineral Conditioner",
        "hsn_code": "31010099",
        "short_benefit": "Powered by OvoMatrix™ · 25 kg turf system · chemical free",
        "dietary_tags": [],
        "categories": ["soil-turf"],
        "description": (
            "LawnCal™ — a premium natural multi-mineral turf & lawn conditioner powered by "
            "OvoMatrix™ (25 kg industrial bag). A blend of natural calcium, magnesium, sulphur and "
            "iron-based minerals plus organic matter that reduces compaction, improves drainage, "
            "strengthens turf density and deepens natural greening — without chemicals, fertilisers "
            "or pesticides. Engineered for lawns, sports grounds, golf fairways and landscape areas."
        ),
        "benefits": (
            "Reduces soil compaction; improves drainage and aeration; deepens natural greening; "
            "strengthens turf density and resilience; supports chlorophyll production; enhances "
            "nutrient uptake; boosts root development; helps grass outcompete weeds naturally. 100% "
            "natural and chemical free — no herbicides, synthetic fertilisers or NPK."
        ),
        "ingredients": (
            "Calcium-based structural minerals, magnesium-rich greening minerals, compaction-"
            "reduction minerals, a natural iron-based greening complex, a soil-bioactivation "
            "system, and stability/flowability minerals. Natural mineral and organic components only."
        ),
        "nutrition_facts": {
            "Format": "25 kg PP woven industrial bag",
            "Blend Type": "Natural mineral soil conditioner",
            "Granularity": "80–100 mesh",
            "Moisture Target": "< 1.5%",
            "Shelf Life": "36 months",
            "Storage": "Cool, dry place; keep sealed",
            "Regulatory Class": "Non-fertiliser, non-pesticide, non-herbicidal",
        },
        "faq": faq(
            ("How it works",
             "Structural minerals enhance soil porosity and aeration; magnesium-rich minerals and "
             "the natural greening complex support chlorophyll and turf density; compaction-"
             "reduction minerals break hard layers and improve water movement; the bioactivation "
             "system increases microbial activity and nutrient uptake."),
            ("Suggested use",
             "Home lawns: 100 g/m² every 4–6 weeks (broadcast, water). Sports grounds/large lawns: "
             "75 kg/acre via spreader every 4–6 weeks. Compacted lawns: recovery 100 kg/acre every "
             "4 weeks. Nursery beds: 120 g/m² mixed into the top 2–3 cm."),
            ("Is LawnCal™ a fertiliser?",
             "No. It contains no NPK and is not classified as a fertiliser."),
            ("Does it kill moss or weeds?",
             "No — it is not a chemical moss killer or herbicide; it strengthens turf so it "
             "outcompetes weeds naturally."),
            ("Is it safe for pets and children?",
             "Yes. It is 100% natural and safe for all home environments."),
            ("Can it be used with chemical fertilisers?",
             "Yes — it is compatible with all fertiliser programs."),
            ("Does it change soil pH?",
             "It provides mild pH correction without over-alkalising."),
            ("Is it suitable for sports grounds?",
             "Yes — ideal for high-traffic turf areas, golf fairways and public parks."),
            ("Does it help with root development?",
             "Yes. The soil bioactivation system supports deeper, stronger roots."),
            ("Can it be used year round?", "Yes — suitable for all seasons, climates and turfgrass varieties."),
            ("How long until results are visible?", "Typically within 2–4 weeks."),
        ),
        "price_gbp": ("39.99", None),
        "price_inr": ("2999.00", None),
        "stock": 120,
        "images": [
            "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600",
        ],
    },
]


OVOMATRIX_PAGE = {
    "slug": "ovomatrix",
    "title": "OvoMatrix™ — Master Ingredient Technology",
    "meta_title": "OvoMatrix™ — Master Ingredient Technology",
    "meta_description": (
        "OvoMatrix™ is Sclero Proteins' proprietary eggshell-derived ingredient platform "
        "powering SoilPro™, LawnCal™, OvoShell Collagen™, Combo Collagen® and B2B ingredient "
        "solutions across soil health, turf conditioning, calcium nutrition and collagen innovation."
    ),
    "content": """# A next-generation ingredient platform

OvoMatrix™ is a next generation ingredient platform engineered from purified eggshell and eggshell membrane. It powers soil conditioners, turf enhancement systems, calcium complexes, collagen blends, and B2B ingredient solutions across multiple industries.

OvoMatrix™ forms the scientific foundation behind SoilPro™, LawnCal™, OvoShell Collagen™, Combo Collagen®, and all future Sclero Proteins™ innovations.

# What is OvoMatrix™?

OvoMatrix™ is a natural mineral–protein matrix derived from eggshell and eggshell membrane, transformed into a high performance functional ingredient platform. Its applications span:

- Soil conditioning
- Turf management
- Calcium fortification
- Collagen complexes
- Bulk ingredient supply
- OEM & private label formulations

OvoMatrix™ is not a single product — it is a technology layer that powers multiple product lines with precision, consistency, and scientific integrity.

# Technology pillars

The eight scientific pillars that define OvoMatrix™:

- **Mineral–Protein Matrix** — the foundational structure combining eggshell minerals with membrane proteins.
- **Natural Calcium Lattice** — the micro-crystalline mineral architecture responsible for structural strength and bioavailability.
- **Bioactive Protein Fraction** — functional membrane proteins that support biological activation and structural integrity.
- **Bioactive Peptides** — short-chain peptides that influence cellular activity, regeneration, and nutrient signalling.
- **Micro-Porous Architecture** — a naturally occurring pore network that enhances water movement, aeration, and microbial colonisation.
- **High Bioavailability Pathways** — natural absorption pathways enabling efficient mineral and peptide utilisation.
- **Multi-Class Collagen Synergy** — the combined functionality of Type I, V, and X collagen.
- **Calcium–Collagen Interaction** — the synergistic interface between mineral and protein layers that enhances structural and biological performance.

# Applications powered by OvoMatrix™

## Soil & turf health

**SoilPro™** (soil conditioner) and **LawnCal™** (turf conditioner) — powered by soil conditioning, soil biology, soil structure and porosity science, water infiltration and retention, root development, and turf density & resilience research.

## Human nutrition

**OvoShell Collagen™** (Type I/V/X) and **Combo Collagen®** (multi-class collagen) — powered by the natural calcium lattice, bioactive peptides, high-bioavailability pathways, multi-class collagen synergy, and calcium–collagen interaction.

## B2B ingredient supply

Bulk eggshell mineral matrix (ESC, 25 kg), collagen complexes (5–10 kg), custom blends, OEM support, private label, and distributor partnerships.

# OEM & bulk supply

OEM (Original Equipment Manufacturer) support means you use our ingredients, you create your own branded product, and we provide the science, documentation, and technical backbone — premium ingredients plus expert support, while keeping your own brand identity.

## Bulk ingredients available

- SoilPro™ Mineral Complex — 25 kg
- LawnCal™ Turf Mineral — 25 kg
- Eggshell Mineral Matrix (ESC) — 25 kg
- OvoShell Collagen™ (Type I/V/X) — 5 kg / 10 kg
- Combo Collagen® Multi-Class Complex — 5 kg / 10 kg

## Who we supply

Supplement brands, soil & turf companies, garden product manufacturers, cosmetic formulators, private label brands, distributors & wholesalers, and research & development teams.

## Why brands choose OvoMatrix™

- **Proven ingredient technology** — built on the mineral–protein matrix, bioactive protein fraction, and micro-porous architecture.
- **Clean, natural, traceable** — eggshell derived, non-synthetic, processed under strict quality standards.
- **High bioavailability & performance** — natural mineral and protein synergy for superior functional outcomes.
- **Scalable supply** — consistent quality, reliable logistics, and export-ready documentation.

## What OEM support includes

Bulk ingredient supply, custom blend development, private label support, technical guidance, product positioning support, distributor partnerships, and access to the OvoMatrix™ knowledge base.

## Documentation hub

Product specification sheets, COA samples, safety & compliance sheets, white papers, the bulk ingredient catalogue, and the OEM support pack are available on request.

## How to start an OEM partnership

1. Share your product idea or requirement
2. We recommend the right OvoMatrix™ ingredient
3. You receive bulk pricing & MOQ
4. We support your formulation & label development
5. You launch your own branded product — simple, fast, and professional

## Contact the OvoMatrix™ OEM team

Email **oem@scleroproteins.com** for bulk pricing, samples, or OEM partnerships. MOQ: 25 kg (minerals) / 5–10 kg (collagen). Global shipping available.
""",
}

# The catalog is exactly these SKUs — everything else gets archived.
KEEP_SKUS = {p["sku"] for p in PRODUCTS}


class Command(BaseCommand):
    help = "Seed/refresh the Sclero catalog (5 OvoMatrix products + OvoMatrix page) and archive the rest."

    @transaction.atomic
    def handle(self, *args, **options):
        cats = {}
        for slug, name, order in CATEGORIES:
            cat, _ = Category.objects.get_or_create(
                slug=slug, defaults={"name": name, "display_order": order}
            )
            cats[slug] = cat

        region_uk = Region.objects.filter(code="UK").first()
        region_in = Region.objects.filter(code="IN").first()
        wh_uk = Warehouse.objects.filter(region=region_uk).first() if region_uk else None
        wh_in = Warehouse.objects.filter(region=region_in).first() if region_in else None

        for p in PRODUCTS:
            product, created = Product.objects.update_or_create(
                sku=p["sku"],
                defaults={
                    "name": p["name"],
                    "hsn_code": p["hsn_code"],
                    "description": p["description"],
                    "benefits": p["benefits"],
                    "ingredients": p["ingredients"],
                    "nutrition_facts": p["nutrition_facts"],
                    "faq": p["faq"],
                    "short_benefit": p.get("short_benefit", ""),
                    "dietary_tags": p.get("dietary_tags", []),
                    "is_active": True,
                    "is_archived": False,
                },
            )

            product.categories.set([cats[s] for s in p["categories"] if s in cats])

            if region_uk:
                price, promo = p["price_gbp"]
                ProductRegionConfig.objects.update_or_create(
                    product=product, region=region_uk,
                    defaults={"price": price, "promotional_price": promo, "is_visible": True},
                )
            if region_in:
                price, promo = p["price_inr"]
                ProductRegionConfig.objects.update_or_create(
                    product=product, region=region_in,
                    defaults={"price": price, "promotional_price": promo, "is_visible": True},
                )

            if wh_uk:
                StockLevel.objects.update_or_create(
                    warehouse=wh_uk, product=product,
                    defaults={"available": p["stock"], "low_stock_threshold": 20},
                )
            if wh_in:
                StockLevel.objects.update_or_create(
                    warehouse=wh_in, product=product,
                    defaults={"available": p["stock"], "low_stock_threshold": 20},
                )

            product.media.filter(media_type="IMAGE").delete()
            for i, url in enumerate(p["images"]):
                ProductMedia.objects.create(
                    product=product, file_url=url, media_type="IMAGE", display_order=i + 1
                )

            if "variants" in p:
                from apps.products.models import ProductVariant
                product.variants.all().delete()
                for idx, v in enumerate(p["variants"]):
                    ProductVariant.objects.create(
                        product=product,
                        sku=v["sku"],
                        name=v["name"],
                        option_name=v.get("option_name", "Size"),
                        option_value=v.get("option_value", v["name"]),
                        price_gbp=v.get("price_gbp"),
                        price_inr=v.get("price_inr"),
                        stock_qty=v.get("stock_qty", 100),
                        sort_order=idx,
                    )

            self.stdout.write(self.style.SUCCESS(
                f"{'Created' if created else 'Updated'} {p['sku']} — {p['name']}"))

        # ---- Prune: archive everything that is not in the fixed catalog ----
        # Archived (not deleted) so historical orders keep their product refs.
        stale = Product.objects.exclude(sku__in=KEEP_SKUS).filter(is_archived=False)
        for prod in stale:
            prod.is_active = False
            prod.is_archived = True
            prod.save(update_fields=["is_active", "is_archived"])
            ProductRegionConfig.objects.filter(product=prod).update(is_visible=False)
            self.stdout.write(self.style.WARNING(f"Archived {prod.sku} — {prod.name}"))

        # Deactivate categories that no longer hold any active product.
        for cat in Category.objects.filter(is_active=True):
            if not cat.products.filter(is_active=True, is_archived=False).exists():
                cat.is_active = False
                cat.save(update_fields=["is_active"])
                self.stdout.write(self.style.WARNING(f"Deactivated empty category {cat.slug}"))

        # ---- OvoMatrix™ master ingredient technology page ----
        ContentPage.objects.update_or_create(
            slug=OVOMATRIX_PAGE["slug"],
            defaults={
                "title": OVOMATRIX_PAGE["title"],
                "content": OVOMATRIX_PAGE["content"],
                "page_type": "LANDING",
                "is_published": True,
                "meta_title": OVOMATRIX_PAGE["meta_title"],
                "meta_description": OVOMATRIX_PAGE["meta_description"],
            },
        )
        self.stdout.write(self.style.SUCCESS("OvoMatrix™ technology page published at /pages/ovomatrix"))

        self.stdout.write(self.style.SUCCESS("Full catalog seed complete."))
