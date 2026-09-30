from pathlib import Path
import json

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


ROOT = Path(__file__).resolve().parent
SCREENSHOTS = ROOT / "screenshots"
OUTPUT = ROOT / "PharmaSync-Prototype-Demonstration.docx"
TEAL = "0F766E"
INK = "183238"
MUTED = "5B6B70"
PALE = "EAF4F2"

evidence = [
    ("System login", "01-login.png", "The sign-in screen is presented before authenticated access. Demo credentials are not shown in the image."),
    ("Main system functionality", "02-dashboard.png", "Admin dashboard loaded with live application state after successful authentication."),
    ("Data creation", "04-medicine-draft.png", "Medicine creation form populated as a draft. Save was not pressed, so no medicine record was written."),
    ("API communication", "05-database-health.png", "The browser requested the health endpoint and received HTTP 200 with PostgreSQL reported as the active database."),
    ("Data exchange between systems", "06-pos-provider-handoff.png", "POS shows the cashless provider handoff path. Checkout was not started; the exchange was not sent to PayMongo."),
    ("Database integration", "03-inventory.png", "Inventory records shown in the authenticated application. GET /api/state returned HTTP 200 from the PostgreSQL-backed API."),
    ("External service integration", "06-pos-provider-handoff.png", "Cashless payment methods are wired to the provider flow. Automated PayMongo tests use mocked HTTP; no live external payment was attempted."),
    ("Error handling", "08-api-error-handling.png", "A controlled browser-route simulation returned HTTP 503 from /api/session; the app displayed its Service unavailable state."),
    ("Security features", "10-admin-user-roles.png", "Admin user roster shows the ADMIN, PHARMACIST, and CASHIER accounts. Separate captures compare their navigation access."),
]


def shade(cell, fill):
    properties = cell._tc.get_or_add_tcPr()
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), fill)
    properties.append(shading)


def set_cell_text(cell, text, *, bold=False, color=INK, size=8.5):
    cell.text = ""
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run(text)
    run.bold = bold
    run.font.name = "Aptos"
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run("PHARMASYNC  ·  ")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(MUTED)
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    paragraph._p.append(field)


def add_evidence_block(document, number, title, image_name, note):
    heading = document.add_paragraph()
    heading.paragraph_format.space_before = Pt(2)
    heading.paragraph_format.space_after = Pt(2)
    run = heading.add_run(f"{number:02d}  {title}")
    run.bold = True
    run.font.name = "Aptos Display"
    run.font.size = Pt(12)
    run.font.color.rgb = RGBColor.from_string(TEAL)

    paragraph = document.add_paragraph(note)
    paragraph.paragraph_format.space_after = Pt(4)
    for run in paragraph.runs:
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor.from_string(MUTED)

    image_path = SCREENSHOTS / image_name
    if not image_path.exists():
        raise FileNotFoundError(image_path)
    picture_paragraph = document.add_paragraph()
    picture_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    picture_paragraph.paragraph_format.space_after = Pt(1)
    picture_paragraph.add_run().add_picture(str(image_path), width=Inches(5.45))

    caption = document.add_paragraph(image_name)
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption.paragraph_format.space_after = Pt(6)
    for run in caption.runs:
        run.italic = True
        run.font.size = Pt(7.5)
        run.font.color.rgb = RGBColor.from_string(MUTED)


document = Document()
section = document.sections[0]
section.top_margin = Inches(0.55)
section.bottom_margin = Inches(0.55)
section.left_margin = Inches(0.7)
section.right_margin = Inches(0.7)

normal = document.styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(9.5)
normal.font.color.rgb = RGBColor.from_string(INK)
normal.paragraph_format.space_after = Pt(5)
for style_name in ("Heading 1", "Heading 2", "Heading 3"):
    document.styles[style_name].font.name = "Aptos Display"
    document.styles[style_name].font.color.rgb = RGBColor.from_string(TEAL)

header = section.header.paragraphs[0]
header.text = "PHARMASYNC  /  PROTOTYPE EVIDENCE"
header.runs[0].font.name = "Aptos"
header.runs[0].font.size = Pt(8)
header.runs[0].font.bold = True
header.runs[0].font.color.rgb = RGBColor.from_string(TEAL)
add_page_number(section.footer.paragraphs[0])

title = document.add_paragraph()
title.paragraph_format.space_before = Pt(30)
title.paragraph_format.space_after = Pt(5)
run = title.add_run("PharmaSync")
run.font.name = "Aptos Display"
run.font.size = Pt(32)
run.font.bold = True
run.font.color.rgb = RGBColor.from_string(INK)

subtitle = document.add_paragraph()
subtitle.paragraph_format.space_after = Pt(15)
run = subtitle.add_run("Prototype Demonstration")
run.font.name = "Aptos Display"
run.font.size = Pt(21)
run.font.color.rgb = RGBColor.from_string(TEAL)

summary = document.add_paragraph("Demonstration evidence for the pharmacy management prototype, mapped to the nine requested system capabilities.")
summary.paragraph_format.space_after = Pt(12)

info = document.add_table(rows=3, cols=2)
info.alignment = WD_TABLE_ALIGNMENT.CENTER
info.autofit = False
info.columns[0].width = Inches(1.7)
info.columns[1].width = Inches(5.3)
for row, label, value in [
    (0, "Captured", "30 September 2026"),
    (1, "Environment", "Local Vite + Express API with PostgreSQL health check"),
    (2, "Safety scope", "No inventory record saved; no purchase, sale, or external payment submitted"),
]:
    shade(info.cell(row, 0), PALE)
    set_cell_text(info.cell(row, 0), label, bold=True, color=TEAL, size=8.5)
    set_cell_text(info.cell(row, 1), value, size=8.5)

document.add_heading("Requirement map", level=1)
map_table = document.add_table(rows=1, cols=3)
map_table.alignment = WD_TABLE_ALIGNMENT.CENTER
map_table.style = "Light Shading Accent 1"
for cell, text in zip(map_table.rows[0].cells, ("#", "Demonstration item", "Evidence")):
    set_cell_text(cell, text, bold=True, color="FFFFFF", size=8.5)
    shade(cell, TEAL)
for index, (name, image_name, note) in enumerate(evidence, start=1):
    cells = map_table.add_row().cells
    set_cell_text(cells[0], str(index), bold=True, color=TEAL)
    set_cell_text(cells[1], name, bold=True)
    set_cell_text(cells[2], image_name)

document.add_heading("Observed API traffic", level=1)
traffic_path = SCREENSHOTS / "api-traffic.json"
traffic = json.loads(traffic_path.read_text(encoding="utf-8"))
unique_traffic = []
seen = set()
for entry in traffic:
    key = (entry["method"], entry["path"], entry["status"])
    if key not in seen:
        seen.add(key)
        unique_traffic.append(entry)

traffic_table = document.add_table(rows=1, cols=3)
traffic_table.alignment = WD_TABLE_ALIGNMENT.CENTER
traffic_table.style = "Light Shading Accent 1"
for cell, text in zip(traffic_table.rows[0].cells, ("Method", "Endpoint", "HTTP")):
    set_cell_text(cell, text, bold=True, color="FFFFFF", size=8)
    shade(cell, TEAL)
for entry in unique_traffic:
    cells = traffic_table.add_row().cells
    set_cell_text(cells[0], entry["method"], size=8)
    set_cell_text(cells[1], entry["path"], size=8)
    set_cell_text(cells[2], str(entry["status"]), size=8)

note = document.add_paragraph("HTTP 401 on the initial unauthenticated session check is expected. The 503 error screen is a controlled browser simulation, not a production outage.")
note.paragraph_format.space_before = Pt(5)
for run in note.runs:
    run.italic = True
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor.from_string(MUTED)

document.add_heading("Role access matrix", level=1)
roles_table = document.add_table(rows=1, cols=2)
roles_table.alignment = WD_TABLE_ALIGNMENT.CENTER
roles_table.style = "Light Shading Accent 1"
for cell, text in zip(roles_table.rows[0].cells, ("Role", "Visible areas")):
    set_cell_text(cell, text, bold=True, color="FFFFFF", size=8)
    shade(cell, TEAL)
for role, areas in [
    ("ADMIN", "Dashboard, POS, inventory, suppliers, users, reports, audit, settings"),
    ("PHARMACIST", "Dashboard, inventory, suppliers, settings"),
    ("CASHIER", "Dashboard, POS"),
]:
    cells = roles_table.add_row().cells
    set_cell_text(cells[0], role, bold=True, color=TEAL, size=8)
    set_cell_text(cells[1], areas, size=8)

groups = [evidence[index:index + 2] for index in range(0, len(evidence), 2)]
number = 1
for group_index, group in enumerate(groups):
    document.add_page_break()
    for title_text, image_name, note_text in group:
        add_evidence_block(document, number, title_text, image_name, note_text)
        number += 1

document.add_page_break()
document.add_heading("Role-specific views", level=1)
document.add_paragraph("The captures below show the enforced navigation differences after separate authenticated sign-ins.")
add_evidence_block(document, 10, "Pharmacist access", "11-pharmacist-role-security.png", "Inventory and supplier access are visible; POS and user administration are not.")
add_evidence_block(document, 11, "Cashier access", "09-cashier-role-security.png", "POS access is visible; inventory and user administration are not.")

document.save(OUTPUT)
print(f"Created {OUTPUT}")