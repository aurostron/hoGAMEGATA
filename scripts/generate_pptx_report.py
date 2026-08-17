import os
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Initialize Presentation
prs = Presentation()
prs.slide_width = Inches(13.333)  # 16:9 Widescreen
prs.slide_height = Inches(7.5)

# Colors
BG_DARK = RGBColor(10, 10, 12)       # #0A0A0C Obsidian
CARD_DARK = RGBColor(22, 22, 28)     # #16161C Card Dark
RED_ACCENT = RGBColor(239, 68, 68)   # #EF4444 Crimson Red
TEXT_WHITE = RGBColor(255, 255, 255) # Pure White
TEXT_MUTED = RGBColor(161, 161, 170) # Zinc 400
TEXT_GRAY = RGBColor(113, 113, 122)  # Zinc 500
GREEN_ACCENT = RGBColor(16, 185, 129)# Emerald Green
PURPLE_ACCENT = RGBColor(168, 85, 247)# Purple Accent

def set_slide_background(slide):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = BG_DARK

def add_header(slide, category_text, title_text):
    # Category / Super-header
    cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(0.3))
    tf = cat_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = category_text.upper()
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = RED_ACCENT
    
    # Title
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(11.7), Inches(0.6))
    tf2 = title_box.text_frame
    tf2.word_wrap = True
    p2 = tf2.paragraphs[0]
    p2.text = title_text
    p2.font.size = Pt(24)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_WHITE

def add_card(slide, left, top, width, height, bg_color=CARD_DARK):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    shape.line.color.rgb = RGBColor(39, 39, 42)
    shape.line.width = Pt(1)
    return shape

# ==========================================
# SLIDE 1: TITLE SLIDE
# ==========================================
slide_layout = prs.slide_layouts[6] # Blank
s1 = prs.slides.add_slide(slide_layout)
set_slide_background(s1)

# Badge
badge = add_card(s1, Inches(0.8), Inches(1.8), Inches(3.2), Inches(0.4), RED_ACCENT)
badge_tf = badge.text_frame
badge_tf.vertical_anchor = MSO_ANCHOR.MIDDLE
bp = badge_tf.paragraphs[0]
bp.alignment = PP_ALIGN.CENTER
bp.text = "CATALOG INTELLIGENCE & AUDIT"
bp.font.size = Pt(10)
bp.font.bold = True
bp.font.color.rgb = TEXT_WHITE

# Main Title
title_box = s1.shapes.add_textbox(Inches(0.8), Inches(2.4), Inches(11.5), Inches(2.0))
tf = title_box.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Gamegata Master Catalog Analysis"
p.font.size = Pt(44)
p.font.bold = True
p.font.color.rgb = TEXT_WHITE

p_sub = tf.add_paragraph()
p_sub.text = "Deep-dive comprehensive audit of 107,805 games, 98k Itch.io horror migration, AI metadata taxonomy, developer mapping, and fast-redirect architecture."
p_sub.font.size = Pt(18)
p_sub.font.color.rgb = TEXT_MUTED
p_sub.space_before = Pt(14)

# KPI Bar on Title Slide
kpis = [
    ("107,805", "Total Master Games"),
    ("68,073", "Mapped Creators / Devs"),
    ("97,995", "Itch Horror Scraped"),
    ("15,830", "Indexed Tags & AI Flags")
]

for i, (val, lbl) in enumerate(kpis):
    x = Inches(0.8 + i * 2.95)
    card = add_card(s1, x, Inches(5.2), Inches(2.75), Inches(1.3))
    ctf = card.text_frame
    ctf.vertical_anchor = MSO_ANCHOR.MIDDLE
    cp1 = ctf.paragraphs[0]
    cp1.alignment = PP_ALIGN.CENTER
    cp1.text = val
    cp1.font.size = Pt(26)
    cp1.font.bold = True
    cp1.font.color.rgb = RED_ACCENT
    
    cp2 = ctf.add_paragraph()
    cp2.alignment = PP_ALIGN.CENTER
    cp2.text = lbl
    cp2.font.size = Pt(11)
    cp2.font.color.rgb = TEXT_MUTED

# ==========================================
# SLIDE 2: EXECUTIVE SUMMARY & CATALOG SCALE
# ==========================================
s2 = prs.slides.add_slide(slide_layout)
set_slide_background(s2)
add_header(s2, "Executive Overview", "Catalog Scale & Database Composition")

cards_s2 = [
    ("Catalog Transformation", "Gamegata's catalog grew from 18,767 to 107,805 games, establishing the largest dedicated horror & indie directory on the web."),
    ("Intelligent Deduplication", "9,090 titles already present in Gamegata were deduplicated and enriched with official Itch.io purchase links without catalog bloat."),
    ("Standalone Itch Ingestion", "88,905 new standalone games cataloged with creator profiles, price snapshots, ratings, and tag taxonomies."),
    ("Developer Ecosystem", "68,073 independent game creators and studios now have dedicated dynamic portfolio pages at /developer/[slug].")
]

for i, (head, body) in enumerate(cards_s2):
    x = Inches(0.8 + (i % 2) * 5.9)
    y = Inches(1.6 + (i // 2) * 2.6)
    card = add_card(s2, x, y, Inches(5.6), Inches(2.3))
    ctf = card.text_frame
    ctf.word_wrap = True
    cp1 = ctf.paragraphs[0]
    cp1.text = head
    cp1.font.size = Pt(18)
    cp1.font.bold = True
    cp1.font.color.rgb = RED_ACCENT
    
    cp2 = ctf.add_paragraph()
    cp2.text = body
    cp2.font.size = Pt(13)
    cp2.font.color.rgb = TEXT_WHITE
    cp2.space_before = Pt(10)

# ==========================================
# SLIDE 3: ITCH.IO MIGRATION & DEDUPLICATION
# ==========================================
s3 = prs.slides.add_slide(slide_layout)
set_slide_background(s3)
add_header(s3, "Migration Mechanics", "98k Scrape Breakdown & Ingestion Metrics")

# Left Big Stat Card
add_card(s3, Inches(0.8), Inches(1.6), Inches(4.5), Inches(5.2))
card_box = s3.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(4.1), Inches(4.8))
tf = card_box.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Ingestion Throughput"
p.font.size = Pt(20)
p.font.bold = True
p.font.color.rgb = RED_ACCENT

p2 = tf.add_paragraph()
p2.text = "154.1 Seconds"
p2.font.size = Pt(36)
p2.font.bold = True
p2.font.color.rgb = TEXT_WHITE
p2.space_before = Pt(8)

p3 = tf.add_paragraph()
p3.text = "Total processing time for all 97,995 records utilizing chunked transactional batches (250 statements/batch) via LibSQL/Turso client.\n\n• Average Rate: 636 - 1,292 games/sec\n• Error Rate: 0.00% (Zero dropped writes)\n• Network roundtrips reduced by 99.6%"
p3.font.size = Pt(12)
p3.font.color.rgb = TEXT_MUTED
p3.space_before = Pt(14)

# Right Stats Table / Cards
right_stats = [
    ("97,995", "Total Scraped Records in itch-horror.db"),
    ("9,090", "Matched Existing IGDB/Steam Titles (Deduplicated)"),
    ("88,905", "New Standalone Itch Games Created"),
    ("111,168", "Total Store Purchase Links Active in Catalog")
]

for i, (val, desc) in enumerate(right_stats):
    y = Inches(1.6 + i * 1.3)
    card = add_card(s3, Inches(5.6), y, Inches(6.9), Inches(1.15))
    ctf = card.text_frame
    ctf.vertical_anchor = MSO_ANCHOR.MIDDLE
    cp1 = ctf.paragraphs[0]
    cp1.text = val
    cp1.font.size = Pt(22)
    cp1.font.bold = True
    cp1.font.color.rgb = RED_ACCENT
    
    cp2 = ctf.add_paragraph()
    cp2.text = desc
    cp2.font.size = Pt(11)
    cp2.font.color.rgb = TEXT_WHITE

# ==========================================
# SLIDE 4: AI TRANSPARENCY & CLASSIFICATION
# ==========================================
s4 = prs.slides.add_slide(slide_layout)
set_slide_background(s4)
add_header(s4, "Metadata Taxonomy", "AI Content Transparency & Distribution")

ai_cards = [
    ("92,283 Games (94.2%)", "Verified No AI", "Titles explicitly verified to contain no generative AI assets, code, or dialog. Tagged as 'No AI'.", GREEN_ACCENT),
    ("5,712 Games (5.8%)", "AI-Assisted Production", "Games utilizing AI tools for partial concept art, audio synthesis, or programming assistance. Tagged as 'AI-Assisted'.", PURPLE_ACCENT),
    ("1,411 Games (1.4%)", "AI-Generated Text", "Games incorporating LLM-generated narrative, lore, or NPC dialog trees. Tagged as 'AI Text'.", RED_ACCENT)
]

for i, (kpi, title, desc, col) in enumerate(ai_cards):
    x = Inches(0.8 + i * 3.95)
    card = add_card(s4, x, Inches(1.6), Inches(3.75), Inches(5.2))
    ctf = card.text_frame
    ctf.word_wrap = True
    
    cp1 = ctf.paragraphs[0]
    cp1.text = title
    cp1.font.size = Pt(18)
    cp1.font.bold = True
    cp1.font.color.rgb = col
    
    cp2 = ctf.add_paragraph()
    cp2.text = kpi
    cp2.font.size = Pt(24)
    cp2.font.bold = True
    cp2.font.color.rgb = TEXT_WHITE
    cp2.space_before = Pt(8)
    
    cp3 = ctf.add_paragraph()
    cp3.text = desc
    cp3.font.size = Pt(12)
    cp3.font.color.rgb = TEXT_MUTED
    cp3.space_before = Pt(14)
    
    cp4 = ctf.add_paragraph()
    cp4.text = "✓ Filterable in Search & Catalog\n✓ Indexed in _GameToTag join table\n✓ Exported in detailed dataset"
    cp4.font.size = Pt(11)
    cp4.font.color.rgb = TEXT_WHITE
    cp4.space_before = Pt(20)

# ==========================================
# SLIDE 5: PRICING & MONETIZATION
# ==========================================
s5 = prs.slides.add_slide(slide_layout)
set_slide_background(s5)
add_header(s5, "Monetization Models", "Pricing Landscape & Storefront Economics")

p_cards = [
    ("Free / PWYW", "93,670 Titles (95.6%)", "Dominant indie horror distribution model. Completely free download with optional creator tips / donations.", GREEN_ACCENT),
    ("Commercial Indie", "4,325 Titles (4.4%)", "Paid games ranging from $1.00 to $19.99 USD. Most common price points: $1.00 (808 games), $2.99 (324 games), $4.99 (296 games).", RED_ACCENT)
]

for i, (title, kpi, desc, col) in enumerate(p_cards):
    x = Inches(0.8 + i * 5.9)
    card = add_card(s5, x, Inches(1.6), Inches(5.6), Inches(5.2))
    ctf = card.text_frame
    ctf.word_wrap = True
    
    cp1 = ctf.paragraphs[0]
    cp1.text = title
    cp1.font.size = Pt(22)
    cp1.font.bold = True
    cp1.font.color.rgb = col
    
    cp2 = ctf.add_paragraph()
    cp2.text = kpi
    cp2.font.size = Pt(30)
    cp2.font.bold = True
    cp2.font.color.rgb = TEXT_WHITE
    cp2.space_before = Pt(10)
    
    cp3 = ctf.add_paragraph()
    cp3.text = desc
    cp3.font.size = Pt(14)
    cp3.font.color.rgb = TEXT_MUTED
    cp3.space_before = Pt(16)

# ==========================================
# SLIDE 6: DATA EXPORTS & ARTIFACTS
# ==========================================
s6 = prs.slides.add_slide(slide_layout)
set_slide_background(s6)
add_header(s6, "Generated Artifacts", "Master Catalog Export Formats")

exports = [
    ("gamegata_catalog_detailed.csv", "54.04 MB", "Standard RFC 4180 CSV containing 21 rich columns across all 107,805 records. Compatible with Excel, Numbers, and Pandas."),
    ("gamegata_catalog_detailed.db", "70.59 MB", "Standalone indexed SQLite database with 'catalog_games' table and multi-column search indexes."),
    ("gamegata-db.db (Master)", "349.55 MB", "Live production database containing all relational tables: Game, Developer, PurchaseLink, PriceSnapshot, Tag, Genre, etc.")
]

for i, (filename, size, desc) in enumerate(exports):
    y = Inches(1.6 + i * 1.75)
    card = add_card(s6, Inches(0.8), y, Inches(11.7), Inches(1.5))
    ctf = card.text_frame
    ctf.word_wrap = True
    
    cp1 = ctf.paragraphs[0]
    cp1.text = f"{filename}  [{size}]"
    cp1.font.size = Pt(18)
    cp1.font.bold = True
    cp1.font.color.rgb = RED_ACCENT
    
    cp2 = ctf.add_paragraph()
    cp2.text = desc
    cp2.font.size = Pt(12)
    cp2.font.color.rgb = TEXT_WHITE
    cp2.space_before = Pt(6)

# Save Presentation
out_pptx = os.path.join(os.getcwd(), "data", "Gamegata_Catalog_Analysis_Report.pptx")
prs.save(out_pptx)
print(f"[SUCCESS] Generated PPTX Presentation: {out_pptx}")

