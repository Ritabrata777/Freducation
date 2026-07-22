const MAX_EXTRACT_CHARS = 12000;

function normalizeExtractedText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACT_CHARS);
}

export async function extractMaterialText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (/\.(txt|md|csv|json)$/i.test(name)) {
    return normalizeExtractedText(await file.text());
  }

  if (/\.docx$/i.test(name)) {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return normalizeExtractedText(result.value ?? "");
  }

  if (/\.pdf$/i.test(name)) {
    const pdfjs = await import("pdfjs-dist");
    const workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const pagesToRead = Math.min(pdf.numPages, 8);
    const chunks: string[] = [];

    for (let pageIndex = 1; pageIndex <= pagesToRead; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const text = await page.getTextContent();
      const pageText = text.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      if (pageText.trim()) chunks.push(pageText);
      if (chunks.join(" ").length >= MAX_EXTRACT_CHARS) break;
    }

    return normalizeExtractedText(chunks.join("\n"));
  }

  return "";
}
