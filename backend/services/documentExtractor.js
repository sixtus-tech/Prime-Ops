const fs = require("fs");
const path = require("path");

/**
 * Extract text from an uploaded document.
 * Supports: .pdf, .txt, .md, .rtf
 */
async function extractDocumentText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".pdf":
      return extractFromPDF(filePath);
    case ".txt":
    case ".md":
    case ".rtf":
      return fs.readFileSync(filePath, "utf-8");
    default:
      // Try reading as plain text
      try {
        return fs.readFileSync(filePath, "utf-8");
      } catch {
        throw new Error(`Cannot extract text from ${ext} files.`);
      }
  }
}

/**
 * Extract text from a PDF file using pdf-parse.
 */
async function extractFromPDF(filePath) {
  const pdfParse = require("pdf-parse");
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || "";
}

module.exports = { extractDocumentText };
