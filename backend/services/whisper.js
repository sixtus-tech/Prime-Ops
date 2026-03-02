const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Map common audio extensions to MIME types
const MIME_MAP = {
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".mp4": "audio/mp4",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

/**
 * Transcribe an audio file using Google Gemini.
 * @param {string} filePath - Absolute path to the audio file on disk.
 * @returns {Promise<string>} The transcribed text.
 */
async function transcribeAudio(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] || "audio/webm";

  // Read file as base64
  const audioBuffer = fs.readFileSync(filePath);
  const base64Audio = audioBuffer.toString("base64");

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Audio,
      },
    },
    {
      text: "Transcribe this audio recording accurately. Return ONLY the transcribed text, nothing else — no timestamps, no labels, no commentary. This is a description of an event such as a church conference, corporate meeting, retreat, or community gathering.",
    },
  ]);

  const response = result.response;
  const text = response.text();

  return text.trim();
}

module.exports = { transcribeAudio };
