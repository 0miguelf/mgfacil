import { PDFDocument } from "@cantoo/pdf-lib";

import { PASSWORD_PROTECTED_MESSAGE } from "./errors";

/**
 * Load a PDF for editing with pdf-lib.
 *
 * Many PDFs (e.g. exported by hospital/clinic systems) are "encrypted" only with an
 * owner password that restricts permissions, but open without a password. The
 * original pdf-lib refuses those ("Input document to PDFDocument.load is encrypted").
 * We use the @cantoo/pdf-lib fork, which decrypts them when given an empty password,
 * so the output is a normal, readable PDF. Only PDFs that require a password to open
 * are rejected, with a clear message.
 */
export async function loadPdfDocument(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { password: "" });
  } catch (err) {
    if (err instanceof Error && /NEEDS PASSWORD|password/i.test(err.message)) {
      throw new Error(PASSWORD_PROTECTED_MESSAGE);
    }
    throw err;
  }
}
