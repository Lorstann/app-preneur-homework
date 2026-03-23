import csv
import json
import os
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from werkzeug.utils import secure_filename


BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
OUTPUT_FOLDER = BASE_DIR / "outputs"

# Ensure temporary folders exist on startup
UPLOAD_FOLDER.mkdir(exist_ok=True)
OUTPUT_FOLDER.mkdir(exist_ok=True)

app = Flask(__name__)
CORS(app)
app.config["UPLOAD_FOLDER"] = str(UPLOAD_FOLDER)
app.config["OUTPUT_FOLDER"] = str(OUTPUT_FOLDER)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB limit


CONVERSION_OPTIONS = {
    "jpg_to_png": {"input": {".jpg", ".jpeg"}, "output": ".png"},
    "png_to_jpg": {"input": {".png"}, "output": ".jpg"},
    "webp_to_png": {"input": {".webp"}, "output": ".png"},
    "webp_to_jpg": {"input": {".webp"}, "output": ".jpg"},
    "txt_to_pdf": {"input": {".txt"}, "output": ".pdf"},
    "csv_to_json": {"input": {".csv"}, "output": ".json"},
    "json_to_csv": {"input": {".json"}, "output": ".csv"},
}


def file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def build_output_name(input_filename: str, new_extension: str) -> str:
    stem = Path(input_filename).stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{stem}_{timestamp}{new_extension}"


def convert_image(input_path: Path, output_path: Path, output_format: str) -> None:
    """Convert image between supported formats using Pillow."""
    with Image.open(input_path) as image:
        if output_format.upper() == "JPEG":
            # JPEG does not support alpha channel; convert if needed.
            if image.mode in ("RGBA", "LA", "P"):
                image = image.convert("RGB")
            image.save(output_path, "JPEG", quality=95)
        else:
            image.save(output_path, output_format.upper())


def convert_txt_to_pdf(input_path: Path, output_path: Path) -> None:
    """Convert plain text file to a simple multi-line PDF page."""
    text_content = input_path.read_text(encoding="utf-8", errors="ignore").strip()
    if not text_content:
        raise ValueError("Text file is empty.")

    pdf = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    x_margin = 50
    y_position = height - 50
    line_height = 16

    for line in text_content.splitlines():
        if y_position < 50:
            pdf.showPage()
            y_position = height - 50
        pdf.drawString(x_margin, y_position, line[:120])
        y_position -= line_height

    pdf.save()


def convert_csv_to_json(input_path: Path, output_path: Path) -> None:
    """Convert CSV rows into a JSON array of objects."""
    with input_path.open("r", newline="", encoding="utf-8", errors="ignore") as csv_file:
        reader = csv.DictReader(csv_file)
        rows = list(reader)

    if not rows:
        raise ValueError("CSV file is empty or missing headers.")

    with output_path.open("w", encoding="utf-8") as json_file:
        json.dump(rows, json_file, indent=2, ensure_ascii=False)


def convert_json_to_csv(input_path: Path, output_path: Path) -> None:
    """Convert JSON array of objects into a CSV file."""
    with input_path.open("r", encoding="utf-8", errors="ignore") as json_file:
        data = json.load(json_file)

    if not data:
        raise ValueError("JSON file is empty.")
    if not isinstance(data, list):
        raise ValueError("JSON must be an array of objects.")
    if not all(isinstance(item, dict) for item in data):
        raise ValueError("JSON array must only contain objects.")

    fieldnames = set()
    for item in data:
        fieldnames.update(item.keys())
    ordered_fieldnames = sorted(fieldnames)
    if not ordered_fieldnames:
        raise ValueError("JSON objects contain no keys.")

    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=ordered_fieldnames)
        writer.writeheader()
        for row in data:
            writer.writerow(row)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/convert", methods=["POST"])
def convert():
    file = request.files.get("file")
    conversion_type = request.form.get("conversion_type", "")

    if not file or not file.filename:
        return jsonify({"success": False, "message": "Please upload a file first."}), 400
    if conversion_type not in CONVERSION_OPTIONS:
        return jsonify({"success": False, "message": "Please choose a valid conversion type."}), 400

    safe_name = secure_filename(file.filename)
    if not safe_name:
        return jsonify({"success": False, "message": "Invalid filename."}), 400

    ext = file_extension(safe_name)
    config = CONVERSION_OPTIONS[conversion_type]
    if ext not in config["input"]:
        return (
            jsonify(
                {
                    "success": False,
                    "message": f"Selected conversion expects {', '.join(sorted(config['input']))} file(s).",
                }
            ),
            400,
        )

    input_path = UPLOAD_FOLDER / safe_name
    output_name = build_output_name(safe_name, config["output"])
    output_path = OUTPUT_FOLDER / output_name

    try:
        file.save(input_path)

        if conversion_type == "jpg_to_png":
            convert_image(input_path, output_path, "PNG")
        elif conversion_type == "png_to_jpg":
            convert_image(input_path, output_path, "JPEG")
        elif conversion_type == "webp_to_png":
            convert_image(input_path, output_path, "PNG")
        elif conversion_type == "webp_to_jpg":
            convert_image(input_path, output_path, "JPEG")
        elif conversion_type == "txt_to_pdf":
            convert_txt_to_pdf(input_path, output_path)
        elif conversion_type == "csv_to_json":
            convert_csv_to_json(input_path, output_path)
        elif conversion_type == "json_to_csv":
            convert_json_to_csv(input_path, output_path)
        else:
            return jsonify({"success": False, "message": "Unsupported conversion selected."}), 400

        return jsonify(
            {
                "success": True,
                "message": "File converted successfully.",
                "download_url": f"/download/{output_name}",
                "output_filename": output_name,
            }
        )
    except (UnidentifiedImageError, OSError):
        return jsonify({"success": False, "message": "Invalid or corrupted image file."}), 400
    except (ValueError, json.JSONDecodeError) as error:
        return jsonify({"success": False, "message": str(error)}), 400
    except Exception:
        return jsonify({"success": False, "message": "Unexpected error during conversion."}), 500
    finally:
        # Keep uploads temporary; conversion outputs are kept for download.
        if input_path.exists():
            input_path.unlink()


@app.route("/download/<filename>")
def download(filename: str):
    safe_name = secure_filename(filename)
    target = OUTPUT_FOLDER / safe_name
    if not target.exists():
        return jsonify({"success": False, "message": "File not found."}), 404
    return send_file(target, as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True)
