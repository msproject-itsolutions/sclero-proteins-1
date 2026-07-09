from django.core.management.base import BaseCommand
from django.db import transaction
from apps.glossary.models import GlossaryTerm

class Command(BaseCommand):
    help = 'Seeds the A-Z expanded glossary terms'

    def handle(self, *args, **options):
        self.stdout.write("Seeding A-Z Expanded Glossary...")

        glossary_data = [
            # A
            {
                "term": "Aeration",
                "definition": "The mechanical or chemical process of increasing soil pore space by relieving compaction. Aeration restores oxygen flow, improves infiltration, and allows roots and microbes to function properly.",
                "category": "Soil Physics"
            },
            {
                "term": "Aggregate Stability",
                "definition": "A measure of how well soil aggregates resist breakdown under water or pressure. High stability prevents crusting, improves infiltration, and supports strong root systems.",
                "category": "Soil Physics"
            },
            {
                "term": "Aggregates",
                "definition": "Clusters of sand, silt, clay, and organic matter bound by microbial glues and fungal hyphae. They form the physical framework that controls porosity, structure, and water movement.",
                "category": "Soil Physics"
            },
            {
                "term": "Anaerobic Soil",
                "definition": "Soil lacking oxygen due to waterlogging or compaction. Anaerobic conditions suppress beneficial microbes, promote pathogens, and severely restrict root growth.",
                "category": "Soil Physics"
            },
            {
                "term": "Antioxidants (Microbial)",
                "definition": "Protective compounds produced by soil microbes that shield roots from oxidative stress, heat, drought, and chemical damage.",
                "category": "Soil Biology"
            },
            {
                "term": "Available Nitrogen",
                "definition": "Nitrogen in plant usable forms (nitrate, ammonium) released through mineralisation, microbial activity, or fertilisation. Essential for chlorophyll and shoot growth.",
                "category": "Agronomy"
            },
            # B
            {
                "term": "Balanced Fertilisation",
                "definition": "Supplying nutrients in correct ratios to support steady, healthy turf growth. Prevents deficiencies, toxicity, and uneven colour.",
                "category": "Agronomy"
            },
            {
                "term": "Beneficial Bacteria",
                "definition": "Microbes that release growth hormones, solubilise nutrients, suppress pathogens, and stimulate root branching.",
                "category": "Soil Biology"
            },
            {
                "term": "Biological Activity",
                "definition": "The total metabolic activity of soil organisms — microbes, fungi, earthworms — that drive nutrient cycling, structure formation, and root health.",
                "category": "Soil Biology"
            },
            {
                "term": "Biological Channels",
                "definition": "Natural pathways created by roots, earthworms, and fungi that enhance infiltration, drainage, and aeration.",
                "category": "Soil Biology"
            },
            {
                "term": "Biological Gels",
                "definition": "Sticky polysaccharides produced by microbes that bind soil particles, retain moisture, and stabilise aggregates.",
                "category": "Soil Biology"
            },
            {
                "term": "Biology Stimulation",
                "definition": "Practices that increase microbial populations — organic matter, carbon sources, moisture balance, and reduced chemical stress.",
                "category": "Soil Biology"
            },
            {
                "term": "Blocky Structure",
                "definition": "A soil structure common in clay soils where particles form block like aggregates. Moderate drainage but prone to compaction.",
                "category": "Soil Physics"
            },
            # C
            {
                "term": "Capillary Action",
                "definition": "The upward or lateral movement of water through small pores due to adhesion and cohesion. Critical for moisture distribution.",
                "category": "Hydrology"
            },
            {
                "term": "Carbohydrate Reserves",
                "definition": "Stored sugars in turf crowns and roots that fuel recovery, regrowth, and stress tolerance.",
                "category": "Plant Physiology"
            },
            {
                "term": "Chlorophyll",
                "definition": "The green pigment that captures sunlight for photosynthesis. Determines turf colour, energy production, and growth rate.",
                "category": "Plant Physiology"
            },
            {
                "term": "Compaction",
                "definition": "Compression of soil particles that collapses pore spaces, restricts oxygen, slows infiltration, and blocks root penetration.",
                "category": "Soil Physics"
            },
            {
                "term": "Core Aeration",
                "definition": "A mechanical process that removes soil plugs to restore macropores, oxygen flow, and biological activity.",
                "category": "Soil Physics"
            },
            {
                "term": "Crusting (Surface)",
                "definition": "A hardened soil layer formed by raindrop impact or sodium dispersion. Prevents infiltration and seedling emergence.",
                "category": "Soil Physics"
            },
            {
                "term": "Crown Expansion",
                "definition": "The widening of the turfgrass crown, increasing shoot production and turf density.",
                "category": "Plant Physiology"
            },
            # D
            {
                "term": "Deep Percolation",
                "definition": "Movement of water beyond the root zone. Essential for drainage but excessive percolation wastes water and nutrients.",
                "category": "Hydrology"
            },
            {
                "term": "Deep Watering",
                "definition": "Irrigation that penetrates deeply into the soil, encouraging roots to grow downward and increasing drought tolerance.",
                "category": "Turf Management"
            },
            {
                "term": "Density (Turf)",
                "definition": "The number of grass plants per unit area. High density improves colour, weed suppression, and wear tolerance.",
                "category": "Turf Management"
            },
            {
                "term": "Disease Suppression",
                "definition": "Biological competition where beneficial microbes outcompete pathogens, reducing disease pressure naturally.",
                "category": "Soil Biology"
            },
            {
                "term": "Drainage",
                "definition": "The soil’s ability to remove excess water through macropores and channels, preventing waterlogging and root suffocation.",
                "category": "Hydrology"
            },
            # E
            {
                "term": "Earthworm Channels",
                "definition": "Vertical tunnels created by earthworms that dramatically improve infiltration, aeration, and root penetration.",
                "category": "Soil Biology"
            },
            {
                "term": "Electron Transport",
                "definition": "A key stage of photosynthesis where captured light energy is converted into chemical energy (ATP, NADPH).",
                "category": "Plant Physiology"
            },
            {
                "term": "Energy Reserves",
                "definition": "Stored carbohydrates that turf uses for recovery after stress, mowing, or damage.",
                "category": "Plant Physiology"
            },
            {
                "term": "Evaporation Loss",
                "definition": "Water lost from the soil surface due to heat, wind, and low humidity. High evaporation increases irrigation needs.",
                "category": "Hydrology"
            },
            # F
            {
                "term": "Fungal Hyphae",
                "definition": "Thread like fungal structures that bind soil particles, stabilise aggregates, and extend root access to water and nutrients.",
                "category": "Soil Biology"
            },
            {
                "term": "Fertilisation",
                "definition": "Supplying essential nutrients to turf to support growth, colour, density, and resilience.",
                "category": "Agronomy"
            },
            {
                "term": "Flow Paths",
                "definition": "Natural or biological channels that guide water movement through soil layers.",
                "category": "Hydrology"
            },
            # G
            {
                "term": "Granular Structure",
                "definition": "Loose, crumbly soil structure ideal for turf. High porosity, excellent infiltration, and easy root penetration.",
                "category": "Soil Physics"
            },
            {
                "term": "Greening",
                "definition": "Increase in chlorophyll concentration, resulting in deeper colour and improved photosynthetic efficiency.",
                "category": "Plant Physiology"
            },
            # H
            {
                "term": "Hydrophobic Soil",
                "definition": "Water repellent soil where water beads on the surface instead of infiltrating. Common in dry, organic poor soils.",
                "category": "Soil Physics"
            },
            {
                "term": "Humic Substances",
                "definition": "Complex organic molecules that improve nutrient retention, water holding capacity, and microbial activity.",
                "category": "Agronomy"
            },
            # I
            {
                "term": "Infiltration",
                "definition": "The rate at which water enters the soil surface. Controlled by structure, porosity, and biological activity.",
                "category": "Hydrology"
            },
            {
                "term": "Iron Availability",
                "definition": "The ability of soil to supply iron for chlorophyll synthesis. Low availability causes yellowing (chlorosis).",
                "category": "Agronomy"
            },
            # L
            {
                "term": "Lateral Movement",
                "definition": "Sideways water flow in dense or clay soils when downward movement is restricted.",
                "category": "Hydrology"
            },
            {
                "term": "Liquid Aeration",
                "definition": "Chemical loosening of soil bonds using surfactants or carbon sources to increase porosity without mechanical disruption.",
                "category": "Soil Physics"
            },
            {
                "term": "Light Exposure",
                "definition": "The amount of sunlight reaching turf leaves. Essential for photosynthesis, colour, and density.",
                "category": "Plant Physiology"
            },
            # M
            {
                "term": "Macropores",
                "definition": "Large soil pores that allow rapid drainage and air exchange. Essential for oxygenation and root growth.",
                "category": "Soil Physics"
            },
            {
                "term": "Magnesium",
                "definition": "The central atom in chlorophyll molecules. Deficiency causes pale, washed out turf.",
                "category": "Plant Physiology"
            },
            {
                "term": "Micro Aggregates",
                "definition": "Small, stable clusters of soil particles that form the foundation of soil structure.",
                "category": "Soil Physics"
            },
            {
                "term": "Micropores",
                "definition": "Small pores that store water for plant use. Critical for water retention.",
                "category": "Soil Physics"
            },
            {
                "term": "Mycorrhizal Fungi",
                "definition": "Symbiotic fungi that extend root systems, improve nutrient uptake, and increase drought tolerance.",
                "category": "Soil Biology"
            },
            # N
            {
                "term": "Nutrient Cycling",
                "definition": "The biological breakdown of organic matter into plant available nutrients. Drives natural fertility.",
                "category": "Soil Biology"
            },
            {
                "term": "Nutrient Uptake",
                "definition": "Absorption of nutrients through roots, influenced by soil biology, structure, and moisture.",
                "category": "Plant Physiology"
            },
            {
                "term": "Nitrogen Fixation",
                "definition": "Conversion of atmospheric nitrogen into plant usable forms by bacteria.",
                "category": "Soil Biology"
            },
            # O
            {
                "term": "Organic Matter",
                "definition": "Decomposed plant and animal material that improves structure, water retention, and microbial activity.",
                "category": "Soil Physics"
            },
            {
                "term": "Oxygen Availability",
                "definition": "The amount of oxygen in soil pores. Essential for root respiration and microbial processes.",
                "category": "Soil Physics"
            },
            {
                "term": "Overseeding",
                "definition": "Adding new grass seed to increase density, fill gaps, and improve turf uniformity.",
                "category": "Turf Management"
            },
            # P
            {
                "term": "Percolation",
                "definition": "Downward movement of water through soil layers. Essential for drainage and preventing waterlogging.",
                "category": "Hydrology"
            },
            {
                "term": "Photosynthesis",
                "definition": "The process by which plants convert sunlight into chemical energy for growth and recovery.",
                "category": "Plant Physiology"
            },
            {
                "term": "Pore Spaces",
                "definition": "Voids between soil particles that hold air and water. Their size and distribution determine soil function.",
                "category": "Soil Physics"
            },
            {
                "term": "Porosity",
                "definition": "The percentage of soil volume made up of pores. Controls infiltration, drainage, and aeration.",
                "category": "Soil Physics"
            },
            {
                "term": "Primary Root Extension",
                "definition": "Initial downward growth of roots seeking moisture and nutrients.",
                "category": "Plant Physiology"
            },
            # R
            {
                "term": "Rhizomes",
                "definition": "Underground stems that spread horizontally, increasing turf density and recovery.",
                "category": "Plant Physiology"
            },
            {
                "term": "Root Exudates",
                "definition": "Sugars and compounds released by roots that feed microbes and stimulate aggregation.",
                "category": "Soil Biology"
            },
            {
                "term": "Root Hair Formation",
                "definition": "Development of fine root hairs that dramatically increase nutrient and water absorption.",
                "category": "Plant Physiology"
            },
            {
                "term": "Root Mass",
                "definition": "Total volume of roots supporting turf growth, density, and resilience.",
                "category": "Plant Physiology"
            },
            {
                "term": "Runoff",
                "definition": "Water that escapes across the surface instead of infiltrating due to compaction or crusting.",
                "category": "Hydrology"
            },
            # S
            {
                "term": "Salt/Sodium Issues",
                "definition": "High sodium disperses soil particles, destroys structure, and reduces infiltration.",
                "category": "Soil Physics"
            },
            {
                "term": "Shade Stress",
                "definition": "Reduced growth and colour due to insufficient light for photosynthesis.",
                "category": "Plant Physiology"
            },
            {
                "term": "Soil Conditioners",
                "definition": "Amendments that improve structure, porosity, and biological activity.",
                "category": "Soil Physics"
            },
            {
                "term": "Soil Structure",
                "definition": "The arrangement of soil particles into aggregates that determine aeration, drainage, and root penetration.",
                "category": "Soil Physics"
            },
            {
                "term": "Soil Texture",
                "definition": "The proportion of sand, silt, and clay that controls drainage, retention, and compaction risk.",
                "category": "Soil Physics"
            },
            {
                "term": "Stolons",
                "definition": "Above ground runners that spread turf horizontally.",
                "category": "Plant Physiology"
            },
            {
                "term": "Surface Shedding",
                "definition": "Water movement off the turf surface before infiltration.",
                "category": "Hydrology"
            },
            # T
            {
                "term": "Thatch",
                "definition": "A layer of undecomposed stems and roots that restricts infiltration and causes shallow rooting.",
                "category": "Turf Management"
            },
            {
                "term": "Tillering",
                "definition": "Production of new shoots from the plant base, increasing turf density.",
                "category": "Plant Physiology"
            },
            {
                "term": "Topdressing",
                "definition": "Applying a thin layer of sand or compost to improve soil structure and smooth the surface.",
                "category": "Turf Management"
            },
            {
                "term": "Turf Density",
                "definition": "The thickness and coverage of turf, driven by tillering, rhizomes, and stolons.",
                "category": "Turf Management"
            },
            {
                "term": "Turf Resilience",
                "definition": "The turf’s ability to withstand stress and recover quickly.",
                "category": "Turf Management"
            },
            # W
            {
                "term": "Water Balance",
                "definition": "The relationship between infiltration, retention, and drainage that determines soil moisture availability.",
                "category": "Hydrology"
            },
            {
                "term": "Water Infiltration",
                "definition": "The process by which water enters the soil surface and moves downward.",
                "category": "Hydrology"
            },
            {
                "term": "Waterlogging",
                "definition": "Soil saturation that removes oxygen and suffocates roots.",
                "category": "Hydrology"
            },
            {
                "term": "Water Retention",
                "definition": "The soil’s ability to store moisture and release it slowly to roots.",
                "category": "Hydrology"
            },
            {
                "term": "Wetting Agents",
                "definition": "Surfactants that break hydrophobic barriers and improve water penetration.",
                "category": "Soil Physics"
            }
        ]

        with transaction.atomic():
            for item in glossary_data:
                term, created = GlossaryTerm.objects.update_or_create(
                    term=item["term"],
                    defaults={
                        "definition": item["definition"],
                        "category": item["category"]
                    }
                )
                action = "Created" if created else "Updated"
                self.stdout.write(f"  {action}: {term.term}")

        self.stdout.write(self.style.SUCCESS("Glossary seeded successfully!"))
