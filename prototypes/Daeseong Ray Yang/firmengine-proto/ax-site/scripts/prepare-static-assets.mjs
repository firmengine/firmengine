import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This worker is reproduced from the locked pdfjs-dist dependency, not a client file.
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
await mkdir(resolve(root,"public"),{recursive:true});
await copyFile(resolve(root,"node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),resolve(root,"public/pdf.worker.min.mjs"));
