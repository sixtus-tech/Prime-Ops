// backend/services/storage.js
// ═══════════════════════════════════════════════════════════════════════
// File Storage Service — Supabase Storage (S3-compatible)
// ═══════════════════════════════════════════════════════════════════════

const { supabase } = require("./supabase");
const prisma = require("./db");
const path = require("path");
const { v4: uuid } = require("uuid");

const BUCKET = "program-files";

/**
 * Upload a file to Supabase Storage
 * @param {Object} params
 * @param {Buffer} params.buffer - File content
 * @param {string} params.fileName - Original file name
 * @param {string} params.mimeType - MIME type
 * @param {string} params.programId - Program ID for path
 * @param {string} params.committeeId - Committee ID for path (optional)
 * @param {string} params.uploadedBy - User name
 * @returns {Object} { url, storagePath, fileUpload }
 */
async function uploadFile({ buffer, fileName, mimeType, programId, committeeId, uploadedBy }) {
  const ext = path.extname(fileName);
  const safeName = `${uuid()}${ext}`;
  const storagePath = committeeId
    ? `${programId}/${committeeId}/${safeName}`
    : `${programId}/${safeName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  // Save metadata to database
  const fileUpload = await prisma.fileUpload.create({
    data: {
      committeeId: committeeId || null,
      programId: programId || null,
      uploadedBy,
      fileName,
      storagePath,
      mimeType,
      sizeBytes: buffer.length,
    },
  });

  return {
    url: urlData.publicUrl,
    storagePath,
    fileUpload,
  };
}

/**
 * Get a signed download URL (for private files)
 * @param {string} storagePath - Path in storage bucket
 * @param {number} expiresIn - Seconds until URL expires (default 1 hour)
 */
async function getSignedUrl(storagePath, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * Delete a file from storage
 * @param {string} fileId - FileUpload record ID
 */
async function deleteFile(fileId) {
  const file = await prisma.fileUpload.findUnique({ where: { id: fileId } });
  if (!file) throw new Error("File not found");

  // Delete from Supabase Storage
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([file.storagePath]);

  if (error) console.warn(`Storage delete warning: ${error.message}`);

  // Delete metadata record
  await prisma.fileUpload.delete({ where: { id: fileId } });
}

module.exports = { uploadFile, getSignedUrl, deleteFile };
