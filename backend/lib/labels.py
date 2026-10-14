"""DEMO shipping label PDF (A6). Replace with a real carrier API (Sendcloud / Shippo) to issue live labels."""
from fpdf import FPDF

DEMO_CARRIER = "USwapped DEMO Post"


def _safe(text: str) -> str:
    # core PDF fonts are latin-1 only
    return (text or "").replace("\u20ac", "EUR").encode("latin-1", "replace").decode("latin-1")


def _address_block(pdf: FPDF, title: str, a: dict, x: float, y: float, w: float) -> None:
    pdf.set_xy(x, y)
    pdf.set_font("Helvetica", "B", 7)
    pdf.cell(w, 4, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(x)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(w, 5.5, _safe(a["name"]), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9.5)
    for line in [a["line1"], a.get("line2", ""), f"{a['city']} {a.get('postcode', '')}".strip(), a["country"]]:
        if line:
            pdf.set_x(x)
            pdf.cell(w, 4.6, _safe(line), new_x="LMARGIN", new_y="NEXT")


def render_label_pdf(label: dict, item_title: str) -> bytes:
    pdf = FPDF(unit="mm", format=(105, 148))  # A6
    pdf.set_auto_page_break(False)
    pdf.add_page()
    pdf.set_margins(6, 6, 6)

    # DEMO watermark
    pdf.set_text_color(235, 235, 235)
    pdf.set_font("Helvetica", "B", 54)
    with pdf.rotation(35, x=52, y=80):
        pdf.text(8, 95, "DEMO")
    pdf.set_text_color(15, 23, 42)

    pdf.set_draw_color(15, 23, 42)
    pdf.set_line_width(0.6)
    pdf.rect(4, 4, 97, 140)

    pdf.set_fill_color(52, 211, 153)
    pdf.rect(4, 4, 97, 13, style="DF")
    pdf.set_xy(7, 7)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(55, 7, "USwapped.com")
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(60, 7.5)
    pdf.cell(38, 6, _safe(f"{label['size'].upper()} PARCEL"), align="R")

    _address_block(pdf, "FROM", label["sender"], 7, 20, 90)
    pdf.line(4, 50, 101, 50)
    _address_block(pdf, "SHIP TO", label["recipient"], 7, 53, 90)
    pdf.line(4, 88, 101, 88)

    tracking = label["tracking_number"]
    pdf.set_fill_color(15, 23, 42)
    pdf.code39(f"*{tracking}*", x=9, y=92, w=0.32, h=16)
    pdf.set_xy(4, 110)
    pdf.set_font("Courier", "B", 11)
    pdf.cell(97, 6, tracking, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_x(4)
    pdf.cell(97, 4.5, _safe(f"{label['carrier']} · Contents: {item_title[:40]}"), align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_fill_color(252, 211, 77)
    pdf.rect(4, 128, 97, 16, style="DF")
    pdf.set_xy(6, 129.5)
    pdf.set_font("Helvetica", "B", 8)
    pdf.multi_cell(93, 4, "DEMO LABEL - NOT VALID FOR POSTAGE.\nA real carrier label will be issued once a shipping provider is connected.", align="C")
    return bytes(pdf.output())
