const Anthropic = require("@anthropic-ai/sdk");
const { buildPrompt } = require("../prompts/proposalPrompt");
const { buildChatPrompt } = require("../prompts/chatPrompt");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Models in order of preference — falls back if primary is overloaded
const MODELS = [
  "claude-sonnet-4-20250514",
  "claude-haiku-4-5-20251001",
];

/**
 * Call Claude API with automatic retry + model fallback.
 * Retries 3 times with exponential backoff, then tries fallback model.
 */
async function callClaude({ system, messages, max_tokens = 4096 }) {
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Claude] Trying ${model} (attempt ${attempt})...`);
        const response = await anthropic.messages.create({
          model,
          max_tokens,
          system,
          messages,
        });
        return response;
      } catch (err) {
        const isOverloaded = err.status === 529 || err.status === 503 || err.status === 500;
        const isRateLimit = err.status === 429;

        if ((isOverloaded || isRateLimit) && attempt < 3) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000); // 2s, 4s, 8s
          console.log(`[Claude] ${model} ${err.status} — retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (isOverloaded && model !== MODELS[MODELS.length - 1]) {
          console.log(`[Claude] ${model} overloaded after ${attempt} attempts, trying next model...`);
          break; // try next model
        }

        throw err; // non-retryable error or last model exhausted
      }
    }
  }
  throw new Error("All Claude models are currently unavailable. Please try again in a moment.");
}

/**
 * Generate a structured event proposal using Claude.
 */
async function generateProposal({ description, eventType, additionalContext }) {
  const systemPrompt = buildPrompt(eventType);

  const userMessage = additionalContext
    ? `Event idea:\n${description}\n\nAdditional context:\n${additionalContext}`
    : `Event idea:\n${description}`;

  const response = await callClaude({
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 8192,
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJSON(text);
  if (parsed) return parsed;

  console.warn("Could not parse Claude response as JSON. Returning raw.");
  return {
    title: "Generated Proposal",
    raw: text,
    parseError: true,
  };
}

/**
 * Robustly extract JSON from Claude's response, handling fences, whitespace, truncation.
 */
function extractJSON(text) {
  // Method 1: Try to find JSON between ```json ... ``` fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Method 2: Strip all backtick fences and try parsing
  const stripped = text
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```[\s\S]*$/, "")
    .trim();
  try { return JSON.parse(stripped); } catch {}

  // Method 3: Find the first { and last } and try parsing that
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)); } catch {}
  }

  // Method 4: Try the whole text as-is
  try { return JSON.parse(text.trim()); } catch {}

  // Method 5: Handle TRUNCATED JSON — try to repair incomplete JSON
  if (firstBrace !== -1) {
    let jsonStr = text.slice(firstBrace);
    // Remove trailing fence if present
    jsonStr = jsonStr.replace(/\n?\s*```\s*$/, "");
    // Try to close unclosed brackets/braces
    jsonStr = repairJSON(jsonStr);
    try { return JSON.parse(jsonStr); } catch {}
  }

  return null;
}

/**
 * Attempt to repair truncated JSON by closing open brackets/braces/strings.
 */
function repairJSON(str) {
  let inString = false;
  let escape = false;
  const stack = [];

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }

    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') stack.pop();
  }

  // Close any open string
  if (inString) str += '"';

  // Trim any trailing comma or colon
  str = str.replace(/[,:\s]+$/, "");

  // Close remaining open brackets/braces in reverse order
  while (stack.length) {
    const open = stack.pop();
    str += (open === '{') ? '}' : ']';
  }

  return str;
}

/**
 * Conversational chat for guided proposal creation.
 * Takes the full message history, returns Claude's next response.
 * If Claude signals READY_TO_GENERATE, extracts the summary.
 *
 * @param {{ messages: Array<{role:string,content:string}>, eventType: string, committeeContext?: object }} input
 * @returns {Promise<{ reply: string, readyToGenerate: boolean, summary?: string }>}
 */
async function chatWithAI({ messages, eventType, committeeContext }) {
  const systemPrompt = buildChatPrompt(eventType, committeeContext || null);

  const response = await callClaude({
    system: systemPrompt,
    messages,
    max_tokens: 1024,
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Check if Claude signaled it has enough info
  const readyMatch = text.match(
    /---READY_TO_GENERATE---\s*([\s\S]*?)\s*---END_SUMMARY---/
  );

  if (readyMatch) {
    return {
      reply: "I've got everything I need! Let me build your proposal now...",
      readyToGenerate: true,
      summary: readyMatch[1].trim(),
    };
  }

  return {
    reply: text.trim(),
    readyToGenerate: false,
  };
}

/**
 * Generate a committee-specific work plan proposal.
 */
async function generateCommitteeProposal({ description, committeeContext }) {
  const { buildCommitteePrompt } = require("../prompts/committeePrompt");
  const systemPrompt = buildCommitteePrompt(committeeContext);

  const userMessage = description
    ? `The committee head has provided the following input about their plans:\n\n${description}`
    : `Generate a comprehensive committee work plan based on the committee's assigned responsibilities.`;

  const response = await callClaude({
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    max_tokens: 8192,
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJSON(text);
  if (parsed) return parsed;

  console.warn("Could not parse committee proposal as JSON. Returning raw.");
  return {
    title: `${committeeContext.committeeName || "Committee"} Work Plan`,
    raw: text,
    parseError: true,
  };
}

module.exports = { generateProposal, chatWithAI, generateStatusUpdate, generateCommitteeProposal, callClaude, extractJSON };

/**
 * Generate a professional, measurable status update from user inputs.
 * @param {{ rawText: string, mediaDescriptions?: string, committeeContext: object }} input
 * @returns {Promise<object>} Structured status update.
 */

async function generateStatusUpdate({ rawText, images, mediaDescriptions, committeeContext }) {
  const ctx = committeeContext || {};
  const systemPrompt = `You are Prime Ops AI, an expert at creating professional, measurable status updates for event planning committees.

You will receive input from a committee head — this may include:
- Rough notes or voice transcriptions
- PHOTOS of their work (venue setup, printed materials, equipment, team meetings, etc.) — analyze these carefully
- DOCUMENTS (budgets, vendor quotes, floor plans, spreadsheets, contracts) — extract key data
- Any combination of the above

Your job is to transform ALL of this into a polished, professional, and MEASURABLE status update.

## CONTEXT
Committee: ${ctx.committeeName || "Unknown"}
Event: ${ctx.eventTitle || "Unknown"}
Responsibilities: ${ctx.responsibilities?.join(", ") || "Not specified"}

## PHOTO ANALYSIS RULES
When you see photos, analyze them in the context of this committee's work:
- Identify what the photo shows (venue, equipment, materials, people working, etc.)
- Relate it to the committee's responsibilities
- Extract measurable observations (e.g., "Venue setup approximately 60% complete", "Approximately 200 chairs arranged")
- Note quality, progress, and any issues visible

## DOCUMENT ANALYSIS RULES
When you receive document content:
- Extract key numbers, dates, amounts, and percentages
- Identify budget figures, vendor confirmations, timelines
- Flag any concerning data (over-budget items, missing deliverables)
- Convert raw data into clear progress metrics

## OUTPUT FORMAT
Respond with ONLY valid JSON (no markdown, no backticks):
{
  "summary": "A 2-3 sentence professional executive summary incorporating ALL evidence",
  "progress": <number 0-100 based on ALL inputs>,
  "keyAccomplishments": ["accomplishment with specific measurable detail", ...],
  "challenges": ["challenge with specifics", ...],
  "nextSteps": ["next step with timeline if possible", ...],
  "metrics": [{ "label": "metric name", "value": "measurable value", "target": "target value" }],
  "statusLevel": "on_track | at_risk | behind | ahead",
  "evidenceSummary": ["What photo 1 shows and its significance", "Key findings from document X", ...]
}

## RULES
- Extract MEASURABLE data from EVERY source
- When analyzing photos: describe what you see and what it means for progress
- When analyzing documents: pull out key numbers and facts
- Be specific — "Secured 3 of 5 required vendors (60%)" not "Making progress"
- Always include at least 3 metrics, 2 accomplishments, and 2 next steps`;

  const userContent = [];
  if (images && images.length > 0) {
    for (const img of images) {
      userContent.push(img);
    }
    userContent.push({ type: "text", text: `I've uploaded ${images.length} photo(s) of our committee's work. Please analyze each photo in detail.` });
  }
  let textInput = "";
  if (rawText) textInput += rawText;
  if (mediaDescriptions) textInput += `\n\nAdditional media descriptions:\n${mediaDescriptions}`;
  if (textInput.trim()) {
    userContent.push({ type: "text", text: textInput.trim() });
  }
  if (userContent.length === 0) {
    userContent.push({ type: "text", text: "No input provided." });
  }

  const response = await callClaude({
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
    max_tokens: 3000,
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    const parsed = extractJSON(text);
    if (parsed) return parsed;
    throw new Error("No JSON found");
  } catch {
    return {
      summary: text.trim(),
      progress: 0,
      keyAccomplishments: [],
      challenges: [],
      nextSteps: [],
      metrics: [],
      evidenceSummary: [],
      statusLevel: "on_track",
      parseError: true,
    };
  }
}
