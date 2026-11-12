/**
 * Shrinks photos in the browser before upload so file storage lasts far longer.
 * Phone photos (3–8 MB) typically become 300–600 KB at 2000 px, which is still
 * sharp enough to read labels and see bean defects. Non-images are untouched.
 */
const MAX_SIDE = 2000;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // flatten transparency for JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // unsupported format in this browser: upload as-is
  }
}
