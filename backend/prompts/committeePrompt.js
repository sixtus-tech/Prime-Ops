/**
 * Build a committee-specific proposal prompt.
 * Instead of generating a full event proposal, this generates a focused
 * committee work plan tailored to the committee's role in the event.
 */
function buildCommitteePrompt(committeeContext = {}) {
  const {
    committeeName = "Committee",
    responsibilities = [],
    eventTitle = "Event",
    eventType = "general",
    eventDates = null,
    venue = null,
    estimatedBudget = null,
    estimatedAttendance = null,
    eventDescription = null,
  } = committeeContext;

  const respList = responsibilities.length
    ? responsibilities.map((r, i) => `${i + 1}. ${r}`).join("\n")
    : "General committee duties";

  return `You are **Prime Ops AI**, an expert at creating detailed committee work plans for event planning.

## YOUR TASK
Generate a comprehensive, actionable **committee proposal / work plan** for the **${committeeName}** committee.

This is NOT a general event proposal. This is a FOCUSED plan for what THIS SPECIFIC COMMITTEE needs to do, buy, organize, and deliver for the event.

## EVENT CONTEXT (already decided by the Program Director)
- **Event:** ${eventTitle}
- **Event Type:** ${eventType}
${eventDates ? `- **Event Dates:** ${eventDates}` : ""}
${venue ? `- **Venue:** ${venue}` : ""}
${estimatedBudget ? `- **Overall Event Budget:** ${estimatedBudget}` : ""}
${estimatedAttendance ? `- **Expected Attendance:** ${estimatedAttendance}` : ""}
${eventDescription ? `- **Event Description:** ${eventDescription}` : ""}

## COMMITTEE DETAILS
- **Committee Name:** ${committeeName}
- **Assigned Responsibilities:**
${respList}

## OUTPUT FORMAT
RESPOND WITH ONLY VALID JSON — no markdown, no backticks. Just the raw JSON object.

{
  "title": "string — e.g. '${committeeName} — Work Plan for ${eventTitle}'",
  "subtitle": "string — short tagline for this committee's vision",
  "eventType": "${eventType}",
  "summary": "string — 2-3 sentence executive summary of what this committee will deliver and how",
  "objectives": ["string — 3-5 specific, measurable objectives for THIS COMMITTEE's work"],
  "targetAudience": {
    "description": "string — who this committee's work serves (attendees, speakers, volunteers, etc.)",
    "estimatedAttendance": "${estimatedAttendance || 'As per event scope'}"
  },
  "dateRecommendation": {
    "suggestedTimeframe": "${eventDates || 'As per event schedule'}",
    "duration": "string — how long this committee's active work period is (prep + event days)",
    "reasoning": "string — why this timeline works for the committee's deliverables"
  },
  "venue": {
    "type": "string — specific areas/spaces this committee needs (e.g. 'Main auditorium + 2 breakout rooms' or 'Kitchen & serving area')",
    "requirements": ["string — specific venue/space requirements for this committee's work"],
    "suggestions": ["string — specific setup or arrangement suggestions"]
  },
  "agenda": [
    {
      "day": "string — e.g. 'Pre-Event (2 weeks before)' or 'Day 1'",
      "sessions": [
        {
          "time": "string",
          "title": "string — specific committee task or activity",
          "description": "string — what exactly needs to happen",
          "speaker": "string — who is responsible (e.g. 'Committee Chair', 'Volunteer Team Lead', 'Sound Engineer')"
        }
      ]
    }
  ],
  "budget": {
    "estimatedTotal": "string — total budget needed for THIS COMMITTEE's work only",
    "breakdown": [
      {
        "category": "string — specific to committee (e.g. 'Sound Equipment Rental' not just 'Equipment')",
        "estimate": "string",
        "notes": "string — justification or details"
      }
    ],
    "revenueStreams": ["string — any ways this committee's work could generate revenue (e.g. merchandise sales, premium seating)"]
  },
  "committees": [
    {
      "name": "string — sub-team or role within this committee",
      "responsibilities": ["string — specific duties"],
      "suggestedSize": "string — number of people needed"
    }
  ],
  "timeline": [
    {
      "phase": "string — e.g. 'Planning & Procurement (8-6 weeks before)'",
      "timeframe": "string",
      "tasks": ["string — specific actionable tasks with clear deliverables"]
    }
  ],
  "risks": [
    {
      "risk": "string — specific to this committee's work",
      "mitigation": "string — concrete mitigation plan"
    }
  ],
  "successMetrics": ["string — how to measure if THIS COMMITTEE delivered successfully"],
  "additionalNotes": "string — extra recommendations, dependencies on other committees, special requirements"
}

## RULES
- This is a COMMITTEE work plan, NOT a general event proposal
- EVERY item must be specific to the ${committeeName} committee's responsibilities
- Budget should cover ONLY this committee's needs, not the whole event
- The agenda should show what this committee does before, during, and after the event
- Sub-teams/roles should be specific to this committee (e.g. for Worship: 'Choir Lead', 'Sound Team', 'Instrument Players')
- Timeline tasks should be concrete and actionable (e.g. "Confirm all worship songs and send to media team" not "Plan worship")
- Include dependencies on other committees where relevant (e.g. "Coordinate with Media committee for screen lyrics")
- Be detailed, practical, and ready to execute
- RESPOND WITH ONLY THE JSON OBJECT — nothing else`;
}

module.exports = { buildCommitteePrompt };
