import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

export const runtime = "nodejs";

const CONVERSION_OPTIONS: Record<string, { input: string[]; output: string }> = {
  jpg_to_png: { input: ["jpg", "jpeg"], output: "png" },
  png_to_jpg: { input: ["png"], output: "jpg" },
  webp_to_png: { input: ["webp"], output: "png" },
  webp_to_jpg: { input: ["webp"], output: "jpg" },
  txt_to_pdf: { input: ["txt"], output: "pdf" },
  csv_to_json: { input: ["csv"], output: "json" },
  json_to_csv: { input: ["json"], output: "csv" },
};

function ext(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function outputName(name: string, outputExt: string) {
  const base = name.replace(/\.[^/.]+$/, "");
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `${base}_${stamp}.${outputExt}`;
}

async function txtToPdf(text: string) {
  if (!text.trim()) throw new Error("Text file is empty.");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (y < 40) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(line.slice(0, 110), {
      x: 40,
      y,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;
  }
  return Buffer.from(await pdf.save());
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const conversionType = String(formData.get("conversion_type") || "");

    if (!(file instanceof File)) {
      return Response.json({ success: false, message: "Please upload a file first." }, { status: 400 });
    }
    if (!CONVERSION_OPTIONS[conversionType]) {
      return Response.json({ success: false, message: "Please choose a valid conversion type." }, { status: 400 });
    }

    const config = CONVERSION_OPTIONS[conversionType];
    const inputExt = ext(file.name);
    if (!config.input.includes(inputExt)) {
      return Response.json(
        { success: false, message: `Selected conversion expects: ${config.input.join(", ")}` },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const outName = outputName(file.name, config.output);
    let outputBuffer: Buffer;

    switch (conversionType) {
      case "jpg_to_png":
      case "webp_to_png":
        outputBuffer = await sharp(inputBuffer).png().toBuffer();
        break;
      case "png_to_jpg":
      case "webp_to_jpg":
        outputBuffer = await sharp(inputBuffer).jpeg({ quality: 95 }).toBuffer();
        break;
      case "txt_to_pdf":
        outputBuffer = await txtToPdf(inputBuffer.toString("utf-8"));
        break;
      case "csv_to_json": {
        const rows = csvParse(inputBuffer.toString("utf-8"), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
        if (!rows.length) throw new Error("CSV file is empty.");
        outputBuffer = Buffer.from(JSON.stringify(rows, null, 2), "utf-8");
        break;
      }
      case "json_to_csv": {
        const data = JSON.parse(inputBuffer.toString("utf-8"));
        if (!Array.isArray(data) || !data.every((item) => typeof item === "object" && item !== null)) {
          throw new Error("JSON must be an array of objects.");
        }
        if (!data.length) throw new Error("JSON file is empty.");
        outputBuffer = Buffer.from(csvStringify(data, { header: true }), "utf-8");
        break;
      }
      default:
        return Response.json({ success: false, message: "Unsupported conversion selected." }, { status: 400 });
    }

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${outName}"`,
        "X-Output-Filename": outName,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected conversion error.";
    return Response.json({ success: false, message: msg }, { status: 400 });
  }
}
