// Browser-only PDF text extraction used for room study materials.
export async function extractPdfText(file: File, maxChars = 60000): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages && out.length < maxChars; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n\n";
  }
  return out.slice(0, maxChars).trim();
}
