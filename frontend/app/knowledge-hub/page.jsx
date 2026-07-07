'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  BookOpen, Brain, Search, ChevronRight, ChevronDown, Check, 
  Sparkles, Shield, Activity, HelpCircle, FileText, ArrowLeft, Heart, Sprout
} from 'lucide-react';
import StoreShell from '../../components/StoreShell';

// Comprehensive Scientific Database of all Knowledge Hub Topics
const KNOWLEDGE_BASE = {
  // COLLAGEN SCIENCE
  'collagen_structure': {
    title: 'A1. How Collagen Is Built',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen is the structural protein that gives your skin firmness, your joints cushioning, and your bones their underlying strength. What makes collagen so extraordinary is not just what it does — but how it is built. Its architecture is one of nature’s most elegant designs, engineered for durability, flexibility, and long lasting support throughout the body.',
    content: `At the heart of collagen’s strength is a unique twisting mechanism where three protein chains wrap tightly around each other. This creates a stable, rope-like formation ((triple_helix_formation)) that resists pulling, stretching, and mechanical stress. The stability of this helix comes from repeating amino acid patterns — especially glycine, proline, and hydroxyproline — arranged in a precise sequence ((amino_acid_repetition_patterns)). These patterns act like a biological code that locks collagen into its ideal shape.

Once the triple helix is formed, collagen molecules begin organising themselves into long, cable-like fibres. This natural self assembly process ((fibrillar_self_assembly)) is what allows collagen to form strong networks in skin, bone, cartilage, and connective tissues.

### Core Structural Elements
- **Glycine-Proline-Hydroxyproline repeats**: Stabilises the molecule’s geometry.
- **Triple Helix Structure**: Three chains twist into the iconic collagen helix, giving the molecule its durability.
- **Intermolecular Crosslinking**: Helices connect to one another through chemical bridges that reinforce the fibres.
- **Hydrogen Bond Networks**: Holds the entire structure tightly in place.

### Assembly and Organisation
- **Fibril Alignment**: Molecules line up in orderly rows, creating consistent structural patterns.
- **Fibrillar Periodicity**: Rows form repeating "gap and overlap" zones that give collagen its characteristic banded appearance.
- **Lysine-derived Crosslink Sites**: Specific sites on the molecule allow strong crosslinks to form, adding rigidity and long term stability.
- **Hierarchical Fibril Bundling**: Multiple fibrils twist and bundle together into thicker, rope-like structures that support tissues under load.

### Interactions with Minerals and Proteins
- **Mineral Nucleation Templates**: It provides surfaces where minerals like calcium can begin to crystallise, essential for bone formation.
- **Ion Binding Regions**: It contains regions that attract and bind ions such as calcium and phosphate.
- **Matrix Attachment Sites**: It binds to proteoglycans, helping tissues maintain hydration and resilience.
- **Extracellular Matrix Domains**: It connects with other extracellular proteins to form a strong, integrated support network.`
  },
  'collagen_digestion': {
    title: 'A2. How Your Body Breaks Down Collagen',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen digestion is the essential process that transforms large collagen fibres into smaller, usable building blocks your body can absorb. These building blocks are called peptides — short chains of amino acids that act as signals, repair molecules, and structural supporters throughout the body.',
    content: `This transformation begins in the stomach, where collagen’s tightly wound structure starts to loosen under acidic conditions ((gastric_hydrolysis)). Once the fibres begin to unwind, digestive enzymes can access and cut them into smaller fragments ((enzyme_specific_cleavage)). As digestion continues, these fragments are further reduced into peptides that your body can absorb and use for skin repair, joint regeneration, and metabolic activity.

### Core Digestive Processes
- **Stomach Unfolding**: Collagen fibres begin to loosen and unwind when exposed to stomach acid, making them accessible to enzymes.
- **Initial Enzyme Cleavage**: The enzyme pepsin targets exposed regions of the loosened collagen and cuts them into smaller fragments.
- **Small Intestine Breakdown**: Pancreatic enzymes continue reducing collagen into shorter peptides that are easier for the body to absorb.
- **Final Fragmentation**: Enzymes on the intestinal wall complete the breakdown into absorbable peptides.

### Peptide Fragment Formation
- **Stable Peptide Formation**: Digestion produces resilient peptide sequences such as proline-hydroxyproline, known for their stability.
- **Peptide Stability**: Hydroxylation helps certain fragments remain intact during digestion, allowing them to reach the bloodstream.
- **Sequence Specific Resistance**: Different peptides resist digestion at different rates depending on their amino acid sequence.`
  },
  'collagen_absorption': {
    title: 'A3. How Collagen Gets Absorbed',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen absorption is the stage where digested collagen peptides move from your gut into your bloodstream — the moment they become available to support your skin, joints, bones, and overall metabolic health.',
    content: `This movement depends on how peptides interact with transport systems ((peptide_transport_mechanisms)), how they pass through or between intestinal cells ((intestinal_barrier_interactions)), and whether their size fits within the body’s absorption limits ((molecular_size_thresholds)). Smaller, stable peptides are absorbed more easily, which is why the structure of collagen peptides strongly influences their bioavailability.

### Core Absorption Processes
- **Transcellular Movement**: Peptides move directly through intestinal cells using specialised carrier pathways.
- **Paracellular Diffusion**: Smaller fragments slip between epithelial cells through controlled openings.
- **Peptide Molecular Weight Limits**: Absorption depends on whether peptides fall within the body’s preferred molecular size range.
- **Proline-rich Peptide Stability**: Peptides rich in proline are more stable and therefore absorbed more efficiently.`
  },
  'collagen_bioavailability': {
    title: 'A4. How Much Collagen Your Body Can Use',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen bioavailability describes how effectively digested collagen peptides enter your bloodstream and reach the tissues where they can actually make a difference.',
    content: `After digestion, peptides must remain stable, cross the intestinal barrier efficiently, and circulate long enough to exert their biological effects. The more stable and transport-ready a peptide is, the more powerful its impact on human nutrition and whole body regeneration.

### Determinants of Bioavailability
- **Peptide Persistence**: Certain collagen fragments remain intact longer due to their structural stability.
- **Low Molecular Weight Advantage**: Smaller peptides cross membranes more easily, giving them a natural absorption advantage.
- **Enzyme Resistant Domains**: Some peptides resist further breakdown because of protective structural domains.
- **Peptide Solubility Profile**: How well a peptide dissolves in the intestinal environment influences its transport efficiency.`
  },
  'collagen_peptides': {
    title: 'A5. What Collagen Peptides Actually Do',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen peptides are short chains of amino acids created when full length collagen is broken down through controlled hydrolysis. These smaller fragments are far easier to utilize.',
    content: `Their functionality depends on how long the peptide chains are ((peptide_chain_length)), whether their sequences contain biologically active regions ((sequence_specific_bioactivity)), and how structurally stable they remain during digestion and absorption.

### Structural Characteristics
- **Defined Peptide Fragments**: Peptides are produced through precise enzymatic breakdown patterns.
- **Proline-Hydroxyproline Sequences**: Resilience comes from proline and hydroxyproline rich regions, which resist degradation.
- **Molecular Weight Distribution**: The functional behaviour of peptides depends on how their molecular weights are distributed.
- **Sequence Integrity**: Bioactivity relies on preserving key structural regions within the peptide chain.`
  },
  'collagen_metabolism': {
    title: 'A6. How Your Body Renews Collagen',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Our body is constantly rebuilding itself, and collagen renewal is one of the most remarkable examples of this natural intelligence. Worn out collagen is cleared, and new fibres are woven.',
    content: `This renewal depends on how gracefully your body maintains the balance between clearing out worn-out collagen ((matrix_turnover_balance)), regulating the enzymes that break it down ((enzyme_regulated_degradation)), and activating fibroblasts — the specialised cells that produce new collagen.

### Core Metabolic Processes
- **Procollagen Production Pathways**: Fibroblasts work continuously to create new collagen molecules.
- **Post-Translational Modification**: New collagen molecules undergo refinements that strengthen and stabilise their structure.
- **Extracellular Matrix Remodelling**: As collagen matures, it is woven into the extracellular matrix.
- **Collagenase-mediated Degradation**: Older or damaged collagen fibres are gently cleared away by collagen-specific enzymes.`
  },
  'collagen_synthesis': {
    title: 'A7. How Your Body Creates New Collagen',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen synthesis is a multi-stage cellular pathway starting from genetic transcription, chain assembly inside fibroblasts, to final extracellular fibril formation.',
    content: `Deep within your connective tissues, specialised cells called fibroblasts work like master craftsmen — reading genetic instructions, assembling collagen chains, and guiding them into organised fibrils.

### Core Synthesis Steps
- **Transcription of Collagen Genes**: Switched on specific genes that encode collagen proteins.
- **Procollagen Polypeptide Synthesis**: Translation of genetic instructions into long peptide chains.
- **Hydroxylation of Proline and Lysine**: Modification of chains to strengthen the structure and prepare it for assembly.
- **Procollagen Triple Helix Assembly**: Three peptide chains twist together into collagen's iconic triple helix shape.`
  },
  'collagen_degradation': {
    title: 'A8. How Your Body Breaks Down Old Collagen',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen degradation is the gentle, highly coordinated process through which your body clears away older collagen fibres to make room for new, healthier ones.',
    content: `The process relies on matrix metalloproteinases (MMPs) that target and cleave specific sites in the triple helix. Once cleaved, the structural integrity weakens and allows macrophages to sweep up the remnants.

### Key Degradation Stages
- **MMP-1, MMP-8, and MMP-13 Cleavage**: Primary site-specific cutting of the fibrillar structure.
- **Gelatinase Digestion**: Secondary breakdown of gelatin remnants into small amino chains.
- **TIMP Regulation**: Cellular inhibitors block excessive degradation to protect matrices.
- **Phagocytic Clearance**: Lysosomal digestions wrap up the matrix recycling loop.`
  },
  'collagen_crosslinking': {
    title: 'A9. How Collagen Fibres Become Stronger',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Collagen crosslinking is the quiet architectural reinforcement that locks adjacent fibrils together, giving structural tissues their tensile strength and rigidity.',
    content: `Mature collagen relies on crosslinks to withstand daily loads. Lysyl oxidase (LOX) enzymes catalyze the formation of stable covalent bonds, but age or glycation can lead to excessive, non-enzymatic stiffening.

### Crosslinking Framework
- **LOX-Mediated Oxidation**: Reactive aldehydes are generated on lysine residues.
- **Immature Divalent Bridges**: Initial links that remain highly dynamic.
- **Mature Trivalent Networks**: Pyridinoline and deoxypyridinoline lock the structure permanently.
- **Non-Enzymatic Glycation (AGEs)**: Sugars build stiff, brittle matrices that resist tissue turnover.`
  },
  'collagen_types': {
    title: 'A10. The Five Collagen Types Your Body Relies On',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'While there are 28 known types of collagen, human structural health is governed by five primary types, each localized to specific tissues.',
    content: `Different tissues demand different mechanical properties, which is why collagen occurs in diverse structural families:

### The Five Primary Types
- **Type I (Fibrillar)**: Located in skin, tendon, bone, and organs. Provides high tensile strength.
- **Type II (Fibrillar)**: Primarily found in cartilage. Supports joint articulation and shock loading.
- **Type III (Fibrillar)**: Reticular fibres in skin, blood vessels, and internal tissues.
- **Type V (Fibrillar)**: Co-localizes with Type I, regulating the diameter of major fibrils.
- **Type X (Network-Forming)**: Hypertrophic cartilage and mineralizing zones, crucial for bone development.`
  },
  'collagen_fibrillogenesis': {
    title: 'A11. How Collagen Fibres Form',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'Fibrillogenesis is the self-assembly process where extracellular collagen monomers arrange themselves into highly organized fibrils.',
    content: `This spontaneous self-assembly occurs after terminal propeptides are cleaved. The molecules align in a staggered parallel fashion, generating the characteristic D-periodic banding pattern seen under electron microscopes.

### Fibril Formation Mechanics
- **Propeptide Cleavage**: Enables solubility transitions and triggers self-assembly.
- **Microfibril Staggering**: Parallel alignment offsets molecules by 67nm.
- **Fibril Fusion**: Small microfibrils merge laterally to build thick fibres.
- **Matrix Integration**: Fibres anchor to proteoglycans and elastic elements.`
  },
  'triple_helix_stability': {
    title: 'A12. What Makes Collagen’s Triple Helix So Strong',
    category: 'Collagen Science',
    subcategory: 'Core Collagen Biology',
    desc: 'The collagen triple helix is a thermodynamic masterpiece. Its structural stability is driven by hydrogen bonding and steric locks.',
    content: `Each of the three chains is a left-handed polyproline-II helix. Together, they twist right-handed. This counter-twisting locks the chains, stabilized by repeating glycine residues packing tightly into the center.

### Triple Helix Stability Keys
- **Glycine Packing**: Glycine has only a hydrogen atom as a side chain, fitting perfectly into the tight core.
- **Proline Ring Rigidity**: Steric restrictions of proline rings limit conformational flexibility.
- **Hydroxyproline Hydrogen Bonds**: Hydroxylation adds water-bridge bindings that lock the helix.
- **Interchain Salt Bridges**: Electrostatic attractions align the chains.`
  },

  // BIOCHEMISTRY & CELLULAR MECHANISMS
  'vitamin_c_dependency': {
    title: 'B1. Why Vitamin C Is Needed for Collagen',
    category: 'Collagen Science',
    subcategory: 'Biochemistry & Cellular Mechanisms',
    desc: 'Vitamin C (Ascorbic Acid) is a mandatory cofactor for the enzymes prolyl hydroxylase and lysyl hydroxylase, which stabilize collagen’s triple helix.',
    content: `Without Vitamin C, these hydroxylase enzymes cannot maintain their active state (iron remains oxidized as Fe3+ instead of Fe2+). This results in weak, unhydroxylated collagen chains that denature at room temperature, leading to connective tissue failure (scurvy).

### Biochemical Pathway
- **Enzymatic Cofactor Role**: Fe2+ reduction is maintained by ascorbic acid.
- **Helix Thermal Stability**: Hydroxyproline residues are required to withstand body temperature (37°C).
- **Secretory Blockade**: Unhydroxylated procollagen is trapped inside the endoplasmic reticulum and degraded.`
  },
  'collagen_signalling': {
    title: 'B2. How Collagen Sends Signals for Repair',
    category: 'Collagen Science',
    subcategory: 'Biochemistry & Cellular Mechanisms',
    desc: 'Collagen is not just passive scaffolding; it is an active signaling molecule that communicates via integrin cell receptors.',
    content: `Digested collagen peptides circulate and bind to specific receptor sites on cell membranes. This activates intracellular cascades that instruct fibroblasts to synthesize new matrix components.

### Signaling Cascades
- **Integrin Binding**: Receptors (α1β1, α2β1) recognize collagen sequences.
- **MAPK/ERK Activation**: Triggers DNA transcription for cell division and matrix production.
- **DDR Receptor Kinase**: Coordinates cell adhesion and migration during wound healing.`
  },

  // DERMATOLOGY, BEAUTY & ANTI AGEING
  'collagen_in_skin': {
    title: 'C1. Collagen’s Role in Skin Firmness',
    category: 'Collagen Science',
    subcategory: 'Dermatology, Beauty & Anti Ageing',
    desc: 'Skin elasticity and density depend directly on the structural network of Type I and Type III collagen in the dermal layer.',
    content: `Fibroblasts in the dermis maintain this network. Balanced collagen levels preserve dermal thickness, supporting the epidermis and preventing fine lines and sagging.

### Dermal Structural Matrix
- **Dermal Density**: High concentration of collagen bundles keeps skin plump.
- **Fibroblast Stretching**: Mechanical tension on fibroblasts keeps them active.
- **Dermal-Epidermal Junction (DEJ)**: Supported by Type IV and VII collagen, ensuring nutrient flow to the epidermis.`
  },
  'collagen_hydration': {
    title: 'C2. How Collagen Holds Water in Skin',
    category: 'Collagen Science',
    subcategory: 'Dermatology, Beauty & Anti Ageing',
    desc: 'Collagen fibers bind water molecules, working alongside hyaluronic acid to maintain skin turgor and hydration.',
    content: `The amino acid structure of collagen contains hydrophilic residues that attract and hold moisture, keeping the dermal matrix hydrated and resilient against mechanical compressions.

### Hydration Mechanics
- **Hydrophilic Residues**: Polar side chains bind water molecules.
- **Glycosaminoglycan (GAG) Association**: Collagen fibers anchor hyaluronic acid.
- **Dermal Turgor**: High water-retention prevents deep wrinkling.`
  },

  // JOINTS, BONES & STRUCTURAL HEALTH
  'joint_comfort_collagen': {
    title: 'D1. Collagen’s Role in Joint Comfort',
    category: 'Collagen Science',
    subcategory: 'Joints, Bones & Structural Health',
    desc: 'Type II collagen forms the fibrillar network that keeps articular cartilage elastic, cushioning bones and absorbing daily impacts.',
    content: `Cartilage chondrocytes produce Type II collagen and proteoglycans. When this network is well-maintained, synovial joints remain lubricated, reducing friction and stiffness during movement.

### Cartilage Support
- **Fibrillar Network**: Type II collagen holds proteoglycan matrices.
- **Synovial Fluid Cushioning**: Shock absorption during joint loading.
- **Chondrocyte Health**: Extracellular signaling protects joints from mechanical wear.`
  },

  // SPORTS SCIENCE
  'exercise_induced_collagen': {
    title: 'E1. How Exercise Boosts Collagen Production',
    category: 'Collagen Science',
    subcategory: 'Sports Science & Performance',
    desc: 'Mechanical load from exercise triggers mechanotransduction, instructing fibroblasts in tendons and ligaments to build collagen.',
    content: `Physical movement deforms cell membranes, activating stretch-sensitive ion channels. This physical stimulus is translated into chemical signals that upregulate procollagen transcription.

### Load Activation
- **Mechanoreceptor Stretching**: Integrin receptors sense physical load.
- **Blood Flow & Delivery**: Improved circulation carries peptides to avascular tendons.
- **Tendon Hypertrophy**: Regular training thickens tendons, improving power transfer.`
  },

  // NUTRITION & METABOLISM
  'collagen_rebuilding_rate': {
    title: 'F1. How Fast Your Body Rebuilds Collagen',
    category: 'Collagen Science',
    subcategory: 'Nutrition & Metabolism',
    desc: 'Collagen is a long-lived protein, but its turnover rate varies dramatically by tissue type.',
    content: `Skin collagen has a half-life of roughly 15 years, while bone collagen is turned over as part of the remodel cycle. Tendons and articular cartilage have very slow turnover rates, making consistent nutrition essential.

### Turnover Framework
- **Skin Dermis**: Dynamic remodeling over weeks.
- **Joint Cartilage**: Very slow turnover, relying on daily peptide supply.
- **Bone Matrix**: Constant remodeling guided by osteoblast/osteoclast activity.`
  },

  // EGGSHELL CALCIUM (ESC) SCIENCE
  'esc_vs_mined': {
    title: 'A-I. What Makes ESC Different from Normal Calcium',
    category: 'ESC Science',
    subcategory: 'ESC Structure & Identity',
    desc: 'Eggshell Calcium (ESC) is a natural, organic-mineral composite that is highly bioavailable compared to mined chalk carbonates.',
    content: `Mined calcium is derived from geological limestone rock. ESC is synthesized biologically by avian shells, containing naturally occurring trace elements and matrix proteins that assist in human bone absorption.

### Structural Advantages
- **Organic Matrix**: Formed inside a biological matrix, not inorganic geological deposits.
- **Trace Minerals**: Natural boron, magnesium, strontium, and phosphorus.
- **Porosity**: Higher surface area helps gastric dissolution.`
  },
  'esc_lattice': {
    title: 'A-II. The Natural Calcium Lattice Inside ESC',
    category: 'ESC Science',
    subcategory: 'ESC Structure & Identity',
    desc: 'ESC features a unique crystalline arrangement of calcium carbonate that optimizes gastric dissolution.',
    content: `Avian eggshells are constructed of calcite crystals organized in a biological column structure. This vertical calcite lattice provides high mechanical strength while remaining highly soluble when exposed to stomach acids.

### Calcite Crystalline Structure
- **Calcite Form**: The most thermodynamically stable polymorph of calcium carbonate.
- **Columnar Shell Architecture**: Crystalline columns separated by protein channels.
- **Bio-Mineralization Guide**: Crystalline growth guided by shell matrix proteins.`
  },
  'esc_microporous': {
    title: 'A-III. Why ESC Has a Micro Porous Architecture',
    category: 'ESC Science',
    subcategory: 'ESC Structure & Identity',
    desc: 'The eggshell structure is naturally porous, allowing gas exchange during incubation. These pores increase solubility.',
    content: `This sponge-like microporous architecture creates a vast surface-area-to-mass ratio. When consumed, digestive juices can penetrate the pores rapidly, accelerating dissolution and absorption.

### Porosity Dynamics
- **Gas Exchange Canals**: Micro-pores built into the shell wall.
- **High Surface Area**: Speeds up acid dissolution in the stomach.
- **Steady Dissolution**: Avoids the concentrated dumping associated with chalk pills.`
  },
  'esc_mineral_protein': {
    title: 'A-IV. How ESC Forms a Mineral–Protein Matrix',
    category: 'ESC Science',
    subcategory: 'ESC Structure & Identity',
    desc: 'In eggshells, calcium crystals are bound together by an organic matrix of proteins, keeping the minerals structured.',
    content: `ESC is not just plain mineral powder. The calcite crystals are bound to eggshell proteins (including collagen type X and osteopontin-like fractions). This biological connection ensures the mineral behaves more like food during digestion.

### Organic-Mineral Connection
- **Calcite Binding Proteins**: Avian proteins guiding crystal placement.
- **Avian Eggshell Peptides**: Structural proteins bound directly to the mineral lattice.
- **Digestive Familiarity**: Recognised and digested as a biological food structure.`
  },
  'esc_absorption': {
    title: 'B-I. How Your Body Absorbs ESC Better Than Rock Calcium',
    category: 'ESC Science',
    subcategory: 'ESC Absorption & Bioavailability',
    desc: 'The biological origin and microporous lattice of ESC allow it to be absorbed more efficiently than rock-based calcium carbonate.',
    content: `Clinical studies demonstrate that eggshell-derived calcium has significantly higher absorption rates compared to limestone calcium carbonate. This is due to its rapid ionization in stomach acid and trace mineral cofactors.

### Absorption Mechanics
- **Rapid Ionization**: Converts to free Ca2+ ions easily.
- **Magnesium & Boron Presence**: Assist cellular transport across enterocytes.
- **Intestinal Tolerance**: Highly tolerated, reducing the constipation common with rock calcium.`
  },
  'esc_bioavailability': {
    title: 'B-II. Why ESC Is Naturally High Bioavailability Calcium',
    category: 'ESC Science',
    subcategory: 'ESC Absorption & Bioavailability',
    desc: 'Bioavailability depends on mineral transport across the gut wall. ESC aligns with cellular transport pathways.',
    content: `Soluble calcium ions use both active transport (via Calbindin and Vitamin D dependent channels) and passive paracellular diffusion. ESC's biological cofactors support these active transport pumps.

### Transport Pathways
- **Calbindin Binding**: Active transport pumps in the duodenum.
- **Vitamin D3 Coordination**: Upregulates calcium transporter channels.
- **Porous Solubility**: Sustains a steady concentration of ions in the intestinal lumen.`
  },
  'esc_synergy_story': {
    title: 'D I. Why ESC Works Better When Combined with ESM Collagen',
    category: 'ESC Science',
    subcategory: 'ESC (Eggshell Calcium) + ESM (Eggshell Membrane) Synergy',
    desc: 'Bones and joints are not made of calcium alone; they are a composite of calcium minerals embedded in a collagen scaffold.',
    content: `Consuming ESC (calcium) alongside ESM (collagen peptides) provides the body with both the raw mineral builder and the protein scaffold simultaneously. This matches the biological composite architecture of human bones and joints.

### Structural Synergy
- **Mineral Scaffold**: Calcium binds to collagen fibers.
- **Tensile + Compressive Strength**: Collagen provides flexibility; calcium provides compression resistance.
- **Peptide Directed Deposition**: Collagen peptides signal osteoblasts to deposit calcium where needed.`
  }
};

// Hierarchical Navigation Map
const NAVIGATION_MAP = [
  {
    section: '🧬 Collagen Science',
    subsections: [
      {
        name: 'A. Core Collagen Biology',
        topics: [
          { label: 'How Collagen Is Built', key: 'collagen_structure' },
          { label: 'Body Breaks Down Collagen', key: 'collagen_digestion' },
          { label: 'How Collagen Gets Absorbed', key: 'collagen_absorption' },
          { label: 'How Much Body Can Use', key: 'collagen_bioavailability' },
          { label: 'What Peptides Actually Do', key: 'collagen_peptides' },
          { label: 'How Your Body Renews Collagen', key: 'collagen_metabolism' },
          { label: 'How Body Creates New Collagen', key: 'collagen_synthesis' },
          { label: 'Body Breaks Down Old Collagen', key: 'collagen_degradation' },
          { label: 'How Fibres Become Stronger', key: 'collagen_crosslinking' },
          { label: 'Five Collagen Types Relied On', key: 'collagen_types' },
          { label: 'How Collagen Fibres Form', key: 'collagen_fibrillogenesis' },
          { label: 'Triple Helix Stability', key: 'triple_helix_stability' }
        ]
      },
      {
        name: 'B. Biochemistry & Cellular Mechanisms',
        topics: [
          { label: 'Vitamin C Dependency', key: 'vitamin_c_dependency' },
          { label: 'How Collagen Sends Signals', key: 'collagen_signalling' }
        ]
      },
      {
        name: 'C. Dermatology, Beauty & Anti Ageing',
        topics: [
          { label: 'Skin Firmness Role', key: 'collagen_in_skin' },
          { label: 'How Collagen Holds Water', key: 'collagen_hydration' }
        ]
      },
      {
        name: 'D. Joints, Bones & Structural Health',
        topics: [
          { label: 'Joint Comfort Role', key: 'joint_comfort_collagen' }
        ]
      },
      {
        name: 'E. Sports Science & Performance',
        topics: [
          { label: 'Exercise Induced Production', key: 'exercise_induced_collagen' }
        ]
      },
      {
        name: 'F. Nutrition & Metabolism',
        topics: [
          { label: 'Rebuilding Rate Framework', key: 'collagen_rebuilding_rate' }
        ]
      }
    ]
  },
  {
    section: '🥚 ESC (Eggshell Calcium) Science',
    subsections: [
      {
        name: 'A. ESC Structure & Identity',
        topics: [
          { label: 'What Makes ESC Different', key: 'esc_vs_mined' },
          { label: 'Natural Calcium Lattice', key: 'esc_lattice' },
          { label: 'Micro Porous Architecture', key: 'esc_microporous' },
          { label: 'Mineral-Protein Matrix', key: 'esc_mineral_protein' }
        ]
      },
      {
        name: 'B. ESC Absorption & Bioavailability',
        topics: [
          { label: 'Absorbs Better Than Rock', key: 'esc_absorption' },
          { label: 'High Bioavailability Calcium', key: 'esc_bioavailability' }
        ]
      },
      {
        name: 'D. ESC + ESM Synergy',
        topics: [
          { label: 'Why ESC Works Better with ESM', key: 'esc_synergy_story' }
        ]
      }
    ]
  }
];

export default function KnowledgeHub() {
  const [activeKey, setActiveKey] = useState('collagen_structure');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubsections, setExpandedSubsections] = useState({
    'A. Core Collagen Biology': true,
    'A. ESC Structure & Identity': true
  });

  const activeArticle = useMemo(() => {
    return KNOWLEDGE_BASE[activeKey] || KNOWLEDGE_BASE['collagen_structure'];
  }, [activeKey]);

  const toggleSubsection = (subName) => {
    setExpandedSubsections(prev => ({
      ...prev,
      [subName]: !prev[subName]
    }));
  };

  // Filter topics based on search query
  const filteredNavigation = useMemo(() => {
    if (!searchQuery.trim()) return NAVIGATION_MAP;

    return NAVIGATION_MAP.map(sect => {
      const filteredSubs = sect.subsections.map(sub => {
        const filteredTopics = sub.topics.filter(topic => {
          const detail = KNOWLEDGE_BASE[topic.key];
          return (
            topic.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (detail && detail.desc.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (detail && detail.content.toLowerCase().includes(searchQuery.toLowerCase()))
          );
        });
        return { ...sub, topics: filteredTopics };
      }).filter(sub => sub.topics.length > 0);

      return { ...sect, subsections: filteredSubs };
    }).filter(sect => sect.subsections.length > 0);
  }, [searchQuery]);

  return (
    <StoreShell>
      <div className="bg-brand-bg border-b border-edge py-10">
        <div className="container-page max-w-5xl text-center">
          <span className="kicker">Avian Research &amp; Clinical Bioactives</span>
          <h1 className="text-heading-1 mt-2">Sclero Knowledge Hub</h1>
          <p className="mt-3 text-xs md:text-sm text-ink-secondary max-w-xl mx-auto leading-relaxed">
            Explore peer-reviewed structural cell biology, absorption kinetics, and bioavailability research backing eggshell membrane bioactives and porous minerals.
          </p>
        </div>
      </div>

      <div className="container-page max-w-6xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT INDEX PANEL - SIDEBAR */}
          <aside className="lg:col-span-4 bg-surface border border-edge rounded-lg p-4 space-y-4 max-h-[85vh] overflow-y-auto sticky top-24">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-edge bg-brand-bg pl-9 pr-3 py-2 text-xs text-ink-primary focus:border-ink-primary focus:outline-none"
              />
            </div>

            <div className="space-y-4">
              {filteredNavigation.map((sectionNode, sIdx) => (
                <div key={sIdx} className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted border-b border-edge-subtle pb-1.5">
                    {sectionNode.section}
                  </h3>
                  
                  <div className="space-y-2 pl-1">
                    {sectionNode.subsections.map((sub, subIdx) => {
                      const isExpanded = !!expandedSubsections[sub.name] || !!searchQuery;
                      return (
                        <div key={subIdx} className="space-y-1">
                          <button
                            onClick={() => toggleSubsection(sub.name)}
                            className="flex items-center justify-between w-full text-left text-[11px] font-bold text-ink-primary hover:text-brand-muted py-1 transition"
                          >
                            <span>{sub.name}</span>
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>

                          {isExpanded && (
                            <div className="pl-2 border-l border-edge-subtle space-y-1 mt-1">
                              {sub.topics.map((topic) => (
                                <button
                                  key={topic.key}
                                  onClick={() => setActiveKey(topic.key)}
                                  className={`block w-full text-left text-[11px] py-1 px-2 rounded transition ${
                                    activeKey === topic.key
                                      ? 'bg-surface-muted border-l-2 border-brand-muted text-ink-primary font-semibold'
                                      : 'text-ink-secondary hover:text-ink-primary hover:bg-brand-bg'
                                  }`}
                                >
                                  {topic.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredNavigation.length === 0 && (
                <p className="text-center text-[11px] text-ink-muted py-4">No matching topics found.</p>
              )}
            </div>
          </aside>

          {/* RIGHT MAIN READER PANEL */}
          <main className="lg:col-span-8 bg-white border border-edge rounded-lg p-6 md:p-8 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-brand-muted mb-2">
                <span>{activeArticle.category}</span>
                <ChevronRight className="h-2.5 w-2.5" />
                <span>{activeArticle.subcategory}</span>
              </div>
              <h2 className="text-heading-2 text-ink-primary font-display">{activeArticle.title}</h2>
              <p className="mt-4 text-xs md:text-sm leading-relaxed text-ink-primary border-l-4 border-edge-focus pl-4 bg-surface-muted py-3 rounded-r">
                {activeArticle.desc}
              </p>
            </div>

            <div className="border-t border-edge-subtle pt-6 prose prose-xs max-w-none text-xs md:text-sm text-ink-secondary leading-relaxed space-y-4">
              {activeArticle.content.split('\n\n').map((paragraph, pIdx) => {
                if (paragraph.startsWith('### ')) {
                  return (
                    <h3 key={pIdx} className="text-sm font-bold text-ink-primary uppercase tracking-wide pt-4 mb-2 border-b border-edge-subtle pb-1">
                      {paragraph.replace('### ', '')}
                    </h3>
                  );
                }
                if (paragraph.startsWith('- ')) {
                  return (
                    <ul key={pIdx} className="space-y-2.5 my-3 pl-4 list-disc">
                      {paragraph.split('\n').map((li, liIdx) => {
                        const cleanLi = li.replace('- ', '').trim();
                        // Find bold text indicators
                        const boldParts = cleanLi.split(':');
                        if (boldParts.length > 1) {
                          return (
                            <li key={liIdx} className="leading-relaxed">
                              <strong className="text-ink-primary">{boldParts[0]}:</strong>
                              {boldParts.slice(1).join(':')}
                            </li>
                          );
                        }
                        return <li key={liIdx}>{cleanLi}</li>;
                      })}
                    </ul>
                  );
                }
                return (
                  <p key={pIdx} className="whitespace-pre-line leading-relaxed">
                    {paragraph}
                  </p>
                );
              })}
            </div>

            {/* Outcome Highlight Box */}
            <div className="border border-brand-success/20 bg-brand-success/5 rounded p-4 flex items-start gap-3 mt-6">
              <Check className="h-5 w-5 text-ink-success shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-ink-primary mb-1">Scientific Outcome &amp; Value</h4>
                <p className="text-[11px] text-ink-secondary leading-relaxed">
                  Purification preserves this biological structural matrix. By maintaining the natural ratio of calcite columns, fibrous collagen scaffolds, and bioactive elastin fractions, Sclero inputs achieve superior absorption and utility compared to geological limestone or synthetic minerals.
                </p>
              </div>
            </div>

            {/* Bottom Quick Navigation */}
            <div className="flex justify-between items-center border-t border-edge-subtle pt-6">
              <Link href="/products" className="text-[11px] font-semibold text-brand-muted hover:underline flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back to Products
              </Link>
              <div className="flex gap-2">
                <span className="text-[11px] text-brand-muted">Need wholesale/bulk parameters?</span>
                <Link href="/bulk" className="text-[11px] font-semibold text-brand-muted hover:underline">
                  Inquire Here
                </Link>
              </div>
            </div>

          </main>
          
        </div>
      </div>
    </StoreShell>
  );
}
