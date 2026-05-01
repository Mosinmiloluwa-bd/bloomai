from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import win32com.client  # type: ignore


def clean_text(text: str) -> str:
    text = text.replace("\r", "\n").replace("\x07", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def paragraph_markdown(paragraph) -> str:
    raw = paragraph.Range.Text.rstrip("\r\a")
    text = clean_text(raw)
    if not text:
        return ""

    style_name = ""
    try:
        style_name = str(paragraph.Range.Style.NameLocal)
    except Exception:
        style_name = ""

    level = None
    heading_match = re.search(r"Heading\s*(\d+)", style_name, re.IGNORECASE)
    if heading_match:
        level = max(1, min(6, int(heading_match.group(1))))

    if level is not None:
        return f'{"#" * level} {text}'

    if style_name.lower() in {"title", "subtitle"}:
        return f"# {text}" if style_name.lower() == "title" else f"## {text}"

    try:
        if paragraph.Range.ListFormat.ListType != 0:
            return f"- {text}"
    except Exception:
        pass

    return text


def table_markdown(table) -> str:
    rows = []
    for row in table.Rows:
        cells = []
        for cell in row.Cells:
            try:
                cell_text = cell.Range.Text
            except Exception:
                cell_text = ""
            cell_text = clean_text(cell_text.replace("\r", " ").replace("\x07", " "))
            cells.append(cell_text)
        if cells:
            rows.append(cells)

    if not rows:
        return ""

    header = rows[0]
    body = rows[1:]
    lines = []
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| " + " | ".join(["---"] * len(header)) + " |")
    for row in body:
        if len(row) < len(header):
            row = row + [""] * (len(header) - len(row))
        elif len(row) > len(header):
            row = row[: len(header)]
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def convert_doc_to_markdown(input_path: Path, output_path: Path) -> None:
    word = win32com.client.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0

    doc = None
    try:
        doc = word.Documents.Open(str(input_path), ReadOnly=True)

        items: list[tuple[int, str, str]] = []
        for paragraph in doc.Paragraphs:
            try:
                start = int(paragraph.Range.Start)
            except Exception:
                start = 0
            md = paragraph_markdown(paragraph)
            if md:
                items.append((start, "p", md))

        for table in doc.Tables:
            try:
                start = int(table.Range.Start)
            except Exception:
                start = 0
            md = table_markdown(table)
            if md:
                items.append((start, "t", md))

        items.sort(key=lambda item: item[0])

        output_lines: list[str] = []
        last_was_blank = True
        for _, kind, text in items:
            if kind == "t":
                if output_lines and output_lines[-1] != "":
                    output_lines.append("")
                output_lines.append(text)
                output_lines.append("")
                last_was_blank = True
                continue

            for line in text.splitlines():
                line = line.strip()
                if not line:
                    if not last_was_blank:
                        output_lines.append("")
                        last_was_blank = True
                    continue
                output_lines.append(line)
                last_was_blank = False

        markdown = "\n".join(output_lines).strip() + "\n"
        output_path.write_text(markdown, encoding="utf-8")
    finally:
        if doc is not None:
            doc.Close(False)
        word.Quit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a legacy .doc file to markdown.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    if not args.input.exists():
        raise FileNotFoundError(args.input)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    convert_doc_to_markdown(args.input, args.output)


if __name__ == "__main__":
    main()
