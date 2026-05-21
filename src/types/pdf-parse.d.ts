declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, string>;
    metadata: Record<string, unknown>;
    version: string;
  }
  function pdfParse(buffer: Buffer): Promise<PDFData>;
  export default pdfParse;
}
