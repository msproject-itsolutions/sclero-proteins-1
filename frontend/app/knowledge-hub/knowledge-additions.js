// Additional Knowledge Hub articles from the approved collagen and ESC topic index.
// These entries share the reader shape used by page.jsx.
const COLLAGEN_CATEGORY = 'Collagen Science';
const ESC_CATEGORY = 'ESC Science';

export const KNOWLEDGE_ADDITIONS = {
  collagen_stability_factors: {
    title: 'B3. What Keeps Collagen Strong and Stable',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Biochemistry & Cellular Mechanisms',
    specs: {
      origin: 'Molecular & Matrix Support',
      weight: 'Multi-Factor Stability',
      target: 'Triple Helix & Fibrils'
    },
    desc: 'Collagen strength depends on more than the protein itself. Amino-acid sequence, vitamin-dependent maturation, hydration, crosslinks and the surrounding extracellular matrix all help fibres remain organised and resilient.',
    content: `A stable collagen fibre begins with a correctly folded triple helix and ends with an organised, well-maintained matrix. Glycine permits tight packing at the centre of the helix, while proline and hydroxyproline restrict movement and help the chains retain their shape. Enzymatic crosslinks then reinforce neighbouring molecules without removing the flexibility tissues need.

### Main Stability Factors
- **Amino-Acid Pattern**: Repeating glycine-rich sequences allow the three collagen chains to pack closely.
- **Hydroxylation**: Vitamin C-dependent modification of proline and lysine supports helix stability and later crosslink formation.
- **Controlled Crosslinking**: Lysyl oxidase creates structural links that strengthen fibrils; too few weaken tissue, while excessive non-enzymatic links increase stiffness.
- **Matrix Environment**: Water, proteoglycans, pH and mineral balance influence how collagen fibres organise and bear load.`
  },
  collagen_mineral_interactions: {
    title: 'B4. How Collagen Interacts with Minerals',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Biochemistry & Cellular Mechanisms',
    specs: {
      origin: 'Organic–Mineral Interface',
      weight: 'Composite Matrix',
      target: 'Bone & Mineralised Tissue'
    },
    desc: 'In mineralised tissues, collagen provides an organised organic scaffold while calcium-phosphate crystals supply compressive strength. Their interface gives bone a balance of toughness and rigidity.',
    content: `Type I collagen fibrils create nanoscale gaps and charged surfaces where mineral crystals can nucleate and grow. Non-collagenous proteins help regulate this process so mineral is deposited in the right place and orientation. The result is a composite: collagen helps resist tension and crack propagation, while hydroxyapatite helps resist compression.

### Mineral–Matrix Relationship
- **Scaffold Formation**: Collagen fibrils establish the geometry on which mineral can be organised.
- **Crystal Nucleation**: Charged matrix regions and associated proteins help initiate calcium-phosphate deposition.
- **Load Sharing**: Mineral carries compressive load while collagen contributes tensile strength and toughness.
- **Remodelling Control**: Osteoblasts and osteoclasts renew both the mineral and organic phases together.`
  },
  collagen_matrix_repair: {
    title: 'B5. How Your Body Repairs the Collagen Matrix',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Biochemistry & Cellular Mechanisms',
    specs: {
      origin: 'Coordinated Tissue Repair',
      weight: 'Cell–Matrix Remodelling',
      target: 'Damaged Extracellular Matrix'
    },
    desc: 'Matrix repair is a coordinated sequence of clean-up, cell signalling, new collagen production and fibre remodelling. Each phase must be controlled for the tissue to regain useful structure.',
    content: `After tissue damage, platelets and immune cells release signals that recruit repair cells and prepare the site. Fibroblasts then migrate into the provisional matrix and produce collagen, proteoglycans and other extracellular components. Early collagen is gradually reorganised and crosslinked along the directions of mechanical load.

### Repair Sequence
- **Damage Recognition**: Local cells detect disrupted matrix and release inflammatory and growth signals.
- **Provisional Matrix**: Fibrin and fibronectin create a temporary framework for incoming cells.
- **Fibroblast Activity**: Fibroblasts deposit new collagen and supporting matrix molecules.
- **Remodelling**: Matrix metalloproteinases and their inhibitors reshape the repair while mechanical loading guides fibre alignment.`
  },
  fibroblast_collagen_building: {
    title: 'B6. How Fibroblasts Build New Collagen',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Biochemistry & Cellular Mechanisms',
    specs: {
      origin: 'Fibroblast Biosynthesis',
      weight: 'Procollagen Assembly',
      target: 'Connective-Tissue Matrix'
    },
    desc: 'Fibroblasts are the principal matrix-building cells in many connective tissues. They translate collagen genes, assemble procollagen and coordinate its organisation outside the cell.',
    content: `Inside a fibroblast, collagen alpha chains are produced on the rough endoplasmic reticulum. Selected proline and lysine residues are modified, carbohydrate groups are added and three chains assemble into procollagen. The cell secretes procollagen, removes its terminal propeptides and helps organise the resulting collagen molecules into fibrils.

### Fibroblast Workflow
- **Gene Activation**: Mechanical and chemical signals regulate transcription of collagen genes.
- **Intracellular Maturation**: Hydroxylation, glycosylation and triple-helix folding prepare procollagen for secretion.
- **Extracellular Processing**: Propeptides are removed so collagen molecules can assemble into fibrils.
- **Matrix Organisation**: Fibroblasts apply tension and deposit accessory proteins that guide fibre alignment and remodelling.`
  },
  collagen_ageing: {
    title: 'C3. How Collagen Declines with Age',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Dermatology, Beauty & Anti-Ageing',
    specs: {
      origin: 'Age-Related Remodelling',
      weight: 'Reduced Matrix Turnover',
      target: 'Dermal Collagen Network'
    },
    desc: 'With age, collagen production slows, existing fibres accumulate damage and the balance between synthesis and breakdown shifts. In skin, this contributes to thinning, reduced elasticity and slower repair.',
    content: `Ageing fibroblasts receive weaker mechanical signals from a fragmented matrix and generally make less new collagen. At the same time, long-lived fibres accumulate crosslinks and oxidative modifications. Hormonal changes, ultraviolet exposure and lifestyle factors can accelerate these intrinsic changes.

### Ageing Pathways
- **Lower Synthesis**: Fibroblast activity and procollagen production tend to decline over time.
- **Matrix Fragmentation**: Enzyme activity and repeated environmental stress break the organised fibril network into shorter segments.
- **Crosslink Accumulation**: Advanced glycation end products can make long-lived fibres stiffer and less soluble.
- **Slower Repair**: Reduced cell responsiveness and circulation can extend tissue-recovery times.`
  },
  stress_pollution_collagen_damage: {
    title: 'C4. How Stress and Pollution Damage Collagen',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Dermatology, Beauty & Anti-Ageing',
    specs: {
      origin: 'Environmental Exposure',
      weight: 'Oxidative & Hormonal Load',
      target: 'Skin Barrier & Dermis'
    },
    desc: 'Chronic stress and air pollution can amplify oxidative and inflammatory signals in skin. These signals may impair barrier function, alter fibroblast activity and increase enzymes involved in collagen breakdown.',
    content: `Particulate matter, ozone and other pollutants can generate reactive oxygen species at the skin surface. If antioxidant defences are exceeded, redox-sensitive pathways increase inflammatory mediators and matrix metalloproteinases. Persistent psychological stress can also influence repair through cortisol, sleep disruption and behaviour.

### Damage Pathways
- **Reactive Oxygen Species**: Pollutant exposure can oxidise lipids, proteins and cellular DNA.
- **MMP Activation**: Stress-responsive signalling can increase enzymes that cleave dermal collagen.
- **Barrier Disruption**: A weakened skin barrier permits greater irritation and water loss.
- **Recovery Pressure**: Poor sleep, smoking and inadequate nutrition can compound environmental stress.`
  },
  collagen_glycation: {
    title: 'C5. How Sugar Damages Collagen',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Dermatology, Beauty & Anti-Ageing',
    specs: {
      origin: 'Non-Enzymatic Glycation',
      weight: 'AGE Crosslinks',
      target: 'Long-Lived Collagen Fibres'
    },
    desc: 'Glycation occurs when reducing sugars react non-enzymatically with proteins. Because collagen turns over slowly, advanced glycation end products can accumulate and make fibres stiffer and harder to remodel.',
    content: `Early sugar–protein reactions can rearrange into advanced glycation end products, or AGEs. Some AGEs form links between neighbouring collagen molecules. Others bind cellular receptors and stimulate oxidative or inflammatory signalling, placing additional pressure on the extracellular matrix.

### Effects of Glycation
- **Fibre Stiffening**: AGE crosslinks reduce collagen flexibility and change tissue mechanics.
- **Reduced Solubility**: Heavily crosslinked collagen becomes more resistant to normal enzymatic turnover.
- **Cell Signalling**: AGE receptors can activate pathways linked with inflammation and oxidative stress.
- **Cumulative Exposure**: Age, blood-glucose control, smoking and high-temperature cooking patterns can influence total AGE burden.`
  },
  mitochondria_collagen_support: {
    title: 'C6. How Mitochondria Support Collagen Health',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Dermatology, Beauty & Anti-Ageing',
    specs: {
      origin: 'Cellular Energy Metabolism',
      weight: 'ATP & Redox Balance',
      target: 'Matrix-Producing Cells'
    },
    desc: 'Mitochondria support collagen-producing cells by supplying energy, coordinating redox balance and helping regulate the signals that determine whether a cell builds, repairs or degrades matrix.',
    content: `Collagen biosynthesis is energy intensive: cells must translate large proteins, modify them, fold triple helices and transport procollagen through the secretory pathway. Healthy mitochondrial function supplies ATP for these steps and helps keep reactive oxygen species within signalling rather than damaging ranges.

### Mitochondrial Support
- **Energy Supply**: ATP powers protein synthesis, secretion, cell migration and matrix organisation.
- **Redox Control**: Antioxidant systems limit oxidative damage to fibroblasts and extracellular proteins.
- **Metabolic Signalling**: Mitochondria help cells adapt collagen production to nutrient and oxygen availability.
- **Quality Control**: Balanced mitochondrial turnover supports fibroblast resilience during ageing and repair.`
  },
  inflammation_collagen_breakdown: {
    title: 'C7. How Inflammation Breaks Down Collagen',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Dermatology, Beauty & Anti-Ageing',
    specs: {
      origin: 'Immune–Matrix Signalling',
      weight: 'Protease Activation',
      target: 'Inflamed Connective Tissue'
    },
    desc: 'Short-term inflammation is part of normal repair, but persistent inflammatory signalling can keep collagen-degrading enzymes active and prevent the matrix from returning to balance.',
    content: `Cytokines released by immune and tissue cells can increase matrix metalloproteinases and other proteases. These enzymes open damaged matrix for clean-up, but prolonged activity may outpace new collagen synthesis. Endogenous tissue inhibitors normally restrain the response and help close the remodelling phase.

### Inflammatory Matrix Effects
- **Cytokine Signalling**: Mediators such as interleukins can change fibroblast and immune-cell behaviour.
- **Protease Release**: MMPs cleave collagen and other extracellular-matrix components.
- **Synthesis Suppression**: Chronic inflammatory signals may reduce productive collagen deposition.
- **Resolution Phase**: Anti-inflammatory and pro-resolving pathways are needed to restore controlled remodelling.`
  },
  oxidative_stress_collagen_loss: {
    title: 'C8. How Oxidative Stress Accelerates Collagen Loss',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Dermatology, Beauty & Anti-Ageing',
    specs: {
      origin: 'Reactive Oxygen Imbalance',
      weight: 'Protein Oxidation',
      target: 'Fibroblasts & Matrix'
    },
    desc: 'Oxidative stress develops when reactive molecules exceed antioxidant control. It can damage collagen directly and activate cellular pathways that favour matrix breakdown over replacement.',
    content: `Ultraviolet radiation, pollution, smoking, inflammation and normal metabolism can all generate reactive oxygen species. In excess, these molecules modify collagen and impair fibroblast function. They also activate transcription factors that increase collagen-degrading enzymes.

### Oxidative Loss Pathways
- **Direct Modification**: Reactive molecules alter amino-acid side chains and weaken protein structure.
- **Fibroblast Stress**: Oxidative damage can reduce matrix production and accelerate cellular ageing.
- **Protease Signalling**: Redox-sensitive pathways can increase MMP expression and collagen fragmentation.
- **Defence Systems**: Enzymatic antioxidants and dietary nutrients help maintain redox balance but do not eliminate normal ageing.`
  },
  collagen_mineral_scaffold: {
    title: 'D2. Collagen’s Role in Bone Strength',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Joints, Bones & Structural Health',
    specs: {
      origin: 'Type I Collagen Scaffold',
      weight: 'Mineralised Composite',
      target: 'Bone Extracellular Matrix'
    },
    desc: 'Bone is a composite material. Type I collagen provides an organised, tough framework, while hydroxyapatite crystals add hardness and compressive strength.',
    content: `Osteoblasts first lay down an organic matrix called osteoid, rich in Type I collagen. Mineral is then deposited within and around the fibrils. This arrangement helps bone absorb energy and resist crack growth rather than behaving like a brittle block of mineral.

### Bone Strength Framework
- **Osteoid Scaffold**: Collagen establishes the initial shape and tensile architecture of new bone.
- **Mineral Deposition**: Calcium-phosphate crystals reinforce the scaffold after osteoid formation.
- **Composite Mechanics**: Collagen contributes toughness; mineral contributes stiffness and compressive resistance.
- **Continuous Renewal**: Bone remodelling replaces both fatigued collagen and old mineral.`
  },
  nutrient_delivery_network: {
    title: 'D3. Nutrient Delivery Pathways',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Joints, Bones & Structural Health',
    specs: {
      origin: 'Vascular & Diffusive Transport',
      weight: 'Tissue-Specific Delivery',
      target: 'Bone, Tendon & Cartilage'
    },
    desc: 'Collagen-rich tissues receive nutrients in different ways. Bone is well vascularised, tendons have more limited blood flow and articular cartilage depends heavily on diffusion from synovial fluid.',
    content: `After digestion and absorption, amino acids, vitamins and minerals circulate in blood. Their final delivery depends on tissue structure, local blood supply, fluid movement and cellular transport. Exercise and normal joint loading can aid fluid exchange, especially in tissues without direct blood vessels.

### Delivery Routes
- **Blood Vessels**: Bone and surrounding connective tissues receive oxygen and nutrients through local microcirculation.
- **Synovial Diffusion**: Cartilage chondrocytes obtain nutrients from synovial fluid moving through the matrix.
- **Tendon Microcirculation**: Tendons use relatively sparse vessels, contributing to slower adaptation and repair.
- **Cellular Uptake**: Transporters move amino acids, glucose, vitamin C and minerals into matrix-producing cells.`
  },
  collagen_matrix_integrity: {
    title: 'D4. What Keeps the Collagen Matrix Healthy',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Joints, Bones & Structural Health',
    specs: {
      origin: 'Whole-Matrix Homeostasis',
      weight: 'Synthesis–Breakdown Balance',
      target: 'Structural Connective Tissue'
    },
    desc: 'Matrix integrity reflects the balance between fibre quality, hydration, crosslinking, cell activity and mechanical use. No single nutrient or pathway maintains it alone.',
    content: `A healthy collagen matrix is continuously inspected and remodelled by resident cells. Appropriate loading provides signals that maintain alignment and strength, while recovery allows new material to mature. Protein, vitamin C and other essential nutrients supply raw materials, and normal enzyme regulation prevents either excessive breakdown or excessive scar-like deposition.

### Integrity Framework
- **Balanced Turnover**: Collagen synthesis must keep pace with planned removal of damaged fibres.
- **Appropriate Loading**: Regular, progressive mechanical stress helps organise tissue-specific fibre patterns.
- **Nutrient Sufficiency**: Amino acids, vitamin C and adequate overall energy support biosynthesis.
- **Inflammation Control**: Timely resolution limits prolonged protease activity and disordered repair.`
  },
  tendon_ligament_adaptation: {
    title: 'E2. How Tendons and Ligaments Adapt to Stress',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Sports Science & Performance',
    specs: {
      origin: 'Mechanoadaptation',
      weight: 'Load-Directed Remodelling',
      target: 'Tendon & Ligament Fibres'
    },
    desc: 'Tendons and ligaments adapt to repeated mechanical load by changing collagen synthesis, fibre alignment, crosslinking and matrix composition. Adaptation is gradual and specific to the load applied.',
    content: `When a tendon or ligament is strained within a tolerable range, resident cells sense matrix deformation through integrins and other mechanosensors. This triggers signalling that can increase matrix production. Over time, appropriately progressed training can improve load tolerance, but connective-tissue adaptation is slower than many muscular changes.

### Adaptation Cycle
- **Load Sensing**: Tenocytes and ligament fibroblasts detect strain in the surrounding matrix.
- **Collagen Turnover**: Exercise temporarily increases both synthesis and remodelling signals.
- **Fibre Alignment**: Repeated directional load helps organise fibrils along stress lines.
- **Recovery & Progression**: Rest and gradual overload allow new matrix to mature without persistent irritation.`
  },
  collagen_injury_prevention: {
    title: 'E3. How Collagen Helps Prevent Injuries',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Sports Science & Performance',
    specs: {
      origin: 'Structural Load Tolerance',
      weight: 'Tensile Matrix Support',
      target: 'Tendons, Ligaments & Fascia'
    },
    desc: 'Well-organised collagen helps connective tissues transmit force and tolerate repeated loading. Injury risk, however, depends on training, recovery, technique, health and tissue capacity—not collagen alone.',
    content: `Tendons transmit muscle force to bone, ligaments guide joint motion and fascia distributes load across regions. Their collagen fibres are crimped and aligned to stretch slightly before resisting higher forces. Progressive training develops capacity, while sudden spikes in load can exceed the speed of matrix adaptation.

### Protective Mechanisms
- **Force Transmission**: Aligned collagen carries tensile load between muscles, joints and bones.
- **Elastic Buffering**: Fibre crimp and associated matrix components absorb and release mechanical energy.
- **Load Adaptation**: Regular progressive exercise stimulates tissue remodelling and improves tolerance.
- **Risk Context**: Warm-up, strength, sleep, nutrition, prior injury and workload management remain important.`
  },
  collagen_muscle_recovery: {
    title: 'E4. How Collagen Supports Muscle Recovery',
    category: COLLAGEN_CATEGORY,
    subcategory: 'Sports Science & Performance',
    specs: {
      origin: 'Muscle–Matrix Interface',
      weight: 'Extracellular Support',
      target: 'Endomysium, Perimysium & Tendon'
    },
    desc: 'Collagen surrounds muscle fibres and connects muscle to tendon. During recovery, this extracellular matrix provides structure for force transfer and is remodelled alongside muscle tissue.',
    content: `The endomysium, perimysium and epimysium form collagen-rich layers around muscle fibres and bundles. Exercise changes both muscle proteins and this supporting matrix. Fibroblasts, immune cells and muscle cells coordinate repair, while the tendon interface adapts to renewed loading.

### Recovery Roles
- **Structural Framework**: Collagen-rich sheaths maintain alignment among recovering muscle fibres.
- **Force Transfer**: The extracellular matrix distributes force from contracting fibres toward tendons.
- **Repair Coordination**: Matrix signals influence immune cells, fibroblasts and muscle stem cells.
- **Nutrition Perspective**: Collagen supplies glycine-rich amino acids, while complete dietary protein remains important for muscle-protein synthesis.`
  },
  esc_nutrient_delivery: {
    title: 'B-III. How ESC Travels Through Your Nutrient Delivery Pathways',
    category: ESC_CATEGORY,
    subcategory: 'ESC Absorption & Bioavailability',
    specs: {
      origin: 'Digestive Mineral Release',
      weight: 'Ionised Calcium Transport',
      target: 'Gut, Blood & Bone'
    },
    desc: 'Eggshell calcium follows the same regulated physiology as other dietary calcium: dissolution in the digestive tract, uptake across the intestine, transport in blood and controlled use or storage by tissues.',
    content: `Stomach acid helps dissolve calcium carbonate and release calcium ions. In the small intestine, calcium crosses the epithelium by vitamin D-regulated active transport and passive movement between cells. Circulating calcium is tightly controlled because it is required for nerve, muscle and cellular functions as well as bone.

### Delivery Pathway
- **Gastric Dissolution**: Acid and mixing expose the porous mineral surface and release calcium ions.
- **Intestinal Uptake**: Transcellular and paracellular routes move calcium into circulation.
- **Blood Transport**: Calcium circulates as free ions or bound to proteins and small anions.
- **Tissue Regulation**: Hormones coordinate intestinal absorption, kidney handling and exchange with the skeleton.`
  },
  esc_calcium_comparison: {
    title: 'B-IV. ESC vs Carbonate vs Citrate — The Complete Body-Wide Comparison',
    category: ESC_CATEGORY,
    subcategory: 'ESC Absorption & Bioavailability',
    specs: {
      origin: 'Calcium Source Comparison',
      weight: 'Formulation Dependent',
      target: 'Digestive & Skeletal Use'
    },
    desc: 'Eggshell calcium is predominantly calcium carbonate in a biological shell matrix. Purified carbonate and calcium citrate differ in elemental-calcium content, acid dependence, serving size and tolerance.',
    content: `Calcium source is only one part of effective intake. Dose, meal timing, vitamin D status, digestive conditions, medicines and total dietary calcium all influence absorption. Eggshell calcium retains a naturally formed porous structure and trace mineral profile when processing preserves them; calcium citrate is less dependent on stomach acidity; purified carbonate supplies more elemental calcium per gram.

### Practical Comparison
- **Eggshell Calcium (ESC)**: A naturally formed, mainly calcite source whose composition and purity depend on processing and batch testing.
- **Calcium Carbonate**: High in elemental calcium and generally best dissolved with adequate stomach acid and food.
- **Calcium Citrate**: Lower elemental calcium per gram but less dependent on gastric acidity, often requiring more tablets for an equal dose.
- **Shared Physiology**: Once ionised, calcium enters the same regulated intestinal and systemic pathways regardless of source.`
  },
  esc_bone_strength: {
    title: 'C-I. How ESC Helps Build Stronger Bones',
    category: ESC_CATEGORY,
    subcategory: 'ESC Functional Benefits',
    specs: {
      origin: 'Dietary Calcium Source',
      weight: 'Mineral Substrate',
      target: 'Bone Remodelling Units'
    },
    desc: 'Eggshell calcium supplies calcium, an essential mineral for normal bone structure. Bone outcomes also depend on vitamin D, protein, exercise, hormones and overall dietary adequacy.',
    content: `After intestinal absorption, calcium joins the tightly regulated circulating pool. Osteoblasts can use calcium and phosphate to mineralise newly formed osteoid, while osteoclasts remove older bone during remodelling. Adequate intake helps reduce the need to draw calcium from the skeleton to maintain blood-calcium functions.

### Bone-Building Context
- **Mineral Supply**: Dietary calcium provides substrate for hydroxyapatite formation.
- **Osteoid Mineralisation**: Osteoblasts coordinate mineral deposition onto a collagen-rich matrix.
- **Remodelling Balance**: Healthy bone continuously couples resorption with new formation.
- **Whole-System Support**: Vitamin D, resistance and impact exercise, protein and hormonal health all influence results.`
  },
  esc_joint_comfort: {
    title: 'C-II. How ESC Supports Joint Comfort & Mobility',
    category: ESC_CATEGORY,
    subcategory: 'ESC Functional Benefits',
    specs: {
      origin: 'Mineral–Movement Context',
      weight: 'Calcium-Dependent Function',
      target: 'Bone, Muscle & Joint System'
    },
    desc: 'Calcium contributes to normal muscle contraction, nerve signalling and bone maintenance around joints. Joint comfort itself is multi-factorial and also depends on cartilage, synovium, connective tissue and movement.',
    content: `A mobile joint works as a system: muscles control motion, bones carry load, cartilage reduces friction and ligaments guide stability. Adequate calcium supports the muscular and skeletal parts of that system, while eggshell-membrane components—when present in a formulation—provide a separate protein-rich matrix.

### Mobility Support Context
- **Muscle Contraction**: Calcium ions participate in the signals that enable muscles to contract and relax.
- **Subchondral Bone**: Normal bone remodelling helps maintain the platform beneath articular cartilage.
- **Neuromuscular Signalling**: Calcium contributes to nerve transmission and coordinated movement.
- **Multi-Factor Comfort**: Training load, strength, body weight, prior injury and inflammation also affect how joints feel.`
  },
  esc_cartilage_cushioning: {
    title: 'C-III. How ESC Helps Cartilage Stay Cushioned',
    category: ESC_CATEGORY,
    subcategory: 'ESC Functional Benefits',
    specs: {
      origin: 'Joint-System Support',
      weight: 'Mineral & Matrix Context',
      target: 'Cartilage–Bone Interface'
    },
    desc: 'Cartilage cushioning comes primarily from its Type II collagen and proteoglycan network. Calcium supports the underlying bone and muscle function, while eggshell membrane—if included—contributes separate matrix components.',
    content: `Articular cartilage contains little or no direct blood supply. Its water-rich proteoglycan matrix swells within a collagen network, allowing it to resist compression. Healthy subchondral bone distributes load beneath this surface, so bone nutrition and cartilage mechanics are related but distinct.

### Cushioning Framework
- **Water-Rich Proteoglycans**: Charged molecules attract water and create resistance to compression.
- **Type II Collagen Network**: Fibrils contain the swollen matrix and maintain surface integrity.
- **Subchondral Support**: Bone beneath cartilage spreads load across the joint.
- **Movement-Driven Exchange**: Normal loading and unloading help nutrients diffuse through synovial fluid into cartilage.`
  },
  esc_osteoblast_activation: {
    title: 'C-IV. How ESC Activates Bone-Building Cells',
    category: ESC_CATEGORY,
    subcategory: 'ESC Functional Benefits',
    specs: {
      origin: 'Mineralisation Signals',
      weight: 'Calcium-Sensing Pathways',
      target: 'Osteoblast Lineage Cells'
    },
    desc: 'Osteoblasts build bone in response to hormones, mechanical loading and local growth signals. Calcium supplies mineral substrate and can participate in cellular signalling, but it is one part of this regulated process.',
    content: `Osteoblast-lineage cells produce collagen-rich osteoid and regulate its later mineralisation. Extracellular calcium can be sensed through membrane receptors, while vitamin D and other hormones influence calcium handling and osteoblast gene expression. Evidence for a finished ESC ingredient depends on its composition, dose and study design.

### Osteoblast Pathways
- **Osteoid Production**: Osteoblasts secrete Type I collagen and non-collagenous matrix proteins.
- **Matrix Vesicles**: Cells create local conditions that favour calcium-phosphate crystal formation.
- **Mechanosignalling**: Weight-bearing activity helps direct bone formation toward loaded regions.
- **Endocrine Control**: Vitamin D, parathyroid hormone and other signals coordinate mineral availability and remodelling.`
  },
  esc_matrix_integrity: {
    title: 'D-II. How ESC Enhances Collagen Matrix Integrity',
    category: ESC_CATEGORY,
    subcategory: 'ESC (Eggshell Calcium) + ESM (Eggshell Membrane) Synergy',
    specs: {
      origin: 'Mineral–Collagen Composite',
      weight: 'Complementary Substrates',
      target: 'Bone Matrix Organisation'
    },
    desc: 'In bone, calcium-containing mineral and collagen perform complementary jobs. A combined ESC and ESM formulation brings mineral and protein-matrix components together, while the body controls how each is digested and used.',
    content: `Collagen-rich osteoid must be formed before it can mineralise normally. Calcium and phosphate then add rigidity to that organic scaffold. ESC contributes a dietary calcium source; ESM contributes proteins and peptides. Their co-presence does not bypass digestion, but it mirrors the two broad material classes found in skeletal tissue.

### Matrix Integrity Model
- **Organic Phase**: Collagen provides tensile organisation and a framework for mineral deposition.
- **Mineral Phase**: Calcium phosphate supplies stiffness and compression resistance.
- **Cell Coordination**: Osteoblasts regulate both osteoid production and subsequent mineralisation.
- **Formulation Context**: Dose, digestibility, vitamin status and total diet determine practical utilisation.`
  },
  esm_peptide_mineral_use: {
    title: 'D-III. How ESM Peptides Improve ESC Mineral Utilisation',
    category: ESC_CATEGORY,
    subcategory: 'ESC (Eggshell Calcium) + ESM (Eggshell Membrane) Synergy',
    specs: {
      origin: 'Peptide–Mineral Co-Delivery',
      weight: 'Sequence Dependent',
      target: 'Digestive & Bone Pathways'
    },
    desc: 'Eggshell-membrane peptides may interact with minerals or matrix-producing cells, but effects are sequence- and formulation-specific. Calcium still relies on established digestive and hormonal transport pathways.',
    content: `During digestion, membrane proteins are broken into amino acids and peptides while ESC releases calcium ions. Some food-derived peptides can bind minerals and influence their solubility in laboratory systems. Demonstrating improved mineral utilisation in people requires evidence for the specific processed ingredient and dose.

### Peptide–Mineral Considerations
- **Co-Digestion**: Protein fragments and calcium ions are released in the same digestive environment.
- **Mineral Binding**: Selected peptide sequences may form soluble complexes with calcium under particular conditions.
- **Matrix Signalling**: Bioactive peptides can interact with cell pathways, but activity varies by sequence and concentration.
- **Evidence Standard**: Ingredient-specific human studies are needed before translating laboratory mechanisms into outcome claims.`
  },
  multitype_collagen_esc: {
    title: 'D-IV. How Multi-Class Collagen Shapes ESC’s Structural Impact',
    category: ESC_CATEGORY,
    subcategory: 'ESC (Eggshell Calcium) + ESM (Eggshell Membrane) Synergy',
    specs: {
      origin: 'Types I, V & X Context',
      weight: 'Multi-Protein Matrix',
      target: 'Bone & Connective Tissue'
    },
    desc: 'Collagen Types I, V and X have different structural roles. Eggshell membrane can contain several collagen classes, while ESC supplies mineral; digestion separates these materials before the body selectively uses their components.',
    content: `Type I is the dominant fibrillar collagen of bone and many connective tissues. Type V helps regulate fibril assembly alongside Type I. Type X is associated with hypertrophic cartilage and endochondral mineralisation. Their biological roles explain the structural logic of a multi-class matrix, but ingested collagen is not delivered intact to a matching tissue.

### Multi-Class Perspective
- **Type I**: Forms strong fibrils in bone, tendon, skin and other connective tissues.
- **Type V**: Co-assembles with Type I and helps control fibril diameter and organisation.
- **Type X**: Appears in mineralising cartilage during skeletal development and repair contexts.
- **Nutritional Fate**: Digestion produces peptides and amino acids whose use is governed by absorption and tissue demand.`
  },
  esc_purity_safety: {
    title: 'E-I. Why ESC Is Cleaner Than Mined Calcium',
    category: ESC_CATEGORY,
    subcategory: 'ESC Purity, Safety & Processing',
    specs: {
      origin: 'Food-Chain Raw Material',
      weight: 'Batch-Tested Purity',
      target: 'Contaminant Control'
    },
    desc: 'Eggshell calcium comes from a food-chain biomineral rather than a geological deposit. Its cleanliness is not automatic: sourcing, sanitation, purification and batch testing determine finished-ingredient safety.',
    content: `Geological and biological calcium sources have different contaminant profiles. Carefully controlled eggshell upcycling can provide a traceable raw material while reducing food-industry waste. A robust programme verifies microbiology, heavy metals, allergens, composition and process residues against relevant specifications.

### Purity Controls
- **Traceable Sourcing**: Supplier and flock documentation help define the raw-material history.
- **Validated Sanitation**: Time, temperature and cleaning controls reduce microbiological risk.
- **Contaminant Testing**: Finished lots should be checked for heavy metals and other specification limits.
- **Allergen Communication**: Egg-derived origin and cross-contact controls must be clearly managed and labelled where required.`
  },
  esc_low_temperature_processing: {
    title: 'E-II. How Low-Temperature Processing Protects ESC Quality',
    category: ESC_CATEGORY,
    subcategory: 'ESC Purity, Safety & Processing',
    specs: {
      origin: 'Controlled Processing',
      weight: 'Structure Preservation',
      target: 'Mineral & Protein Quality'
    },
    desc: 'Controlled low-temperature steps can limit unnecessary protein damage and preserve physical structure, but safety targets must still be achieved through a validated process.',
    content: `Eggshell mineral is relatively heat stable, while membrane proteins and some associated compounds are more sensitive. Processing therefore balances cleaning, microbial reduction, drying efficiency and preservation of the desired particle and matrix properties. “Low temperature” is meaningful only when paired with defined limits and test results.

### Processing Balance
- **Protein Preservation**: Moderated heat exposure can reduce denaturation of membrane-associated proteins.
- **Moisture Control**: Effective drying limits microbial growth and improves storage stability.
- **Particle Architecture**: Milling and separation conditions influence surface area, flow and dissolution behaviour.
- **Validated Safety**: Temperature, time, hygiene and finished-product testing must work as one documented control system.`
  }
};
