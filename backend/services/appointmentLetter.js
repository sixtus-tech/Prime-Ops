const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Appointment Letter PDF Generator
// Generates a professional appointment letter when a member is added to a
// committee. The PDF is saved to disk and the path returned.
// ---------------------------------------------------------------------------

const LETTERS_DIR = path.join(__dirname, "..", "uploads", "appointment-letters");

// Ensure output directory exists
function ensureDir() {
  if (!fs.existsSync(LETTERS_DIR)) {
    fs.mkdirSync(LETTERS_DIR, { recursive: true });
  }
}

/**
 * Generate an appointment letter PDF for a committee member.
 *
 * @param {object} params
 * @param {string} params.memberName       - Name of the appointed member
 * @param {string} params.role             - "chair" | "co-chair" | "member"
 * @param {string} params.committeeName    - Name of the committee
 * @param {string} params.eventTitle       - Name of the event
 * @param {string} [params.eventDate]      - Event start date (formatted string)
 * @param {string} [params.eventVenue]     - Event venue
 * @param {string} params.portalLink       - Full URL to committee portal
 * @param {string} params.memberId         - Used for the filename
 * @returns {Promise<{ filePath: string, fileName: string }>}
 */
async function generateAppointmentLetter({
  memberName,
  role,
  committeeName,
  eventTitle,
  eventDate,
  eventVenue,
  portalLink,
  memberId,
}) {
  ensureDir();

  const fileName = `appointment-${memberId}.pdf`;
  const filePath = path.join(LETTERS_DIR, fileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 65, right: 65 },
        info: {
          Title: `Appointment Letter – ${memberName}`,
          Author: "Prime Ops Event Management",
          Subject: `Committee Appointment: ${committeeName}`,
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ── Brand Header Bar ──────────────────────────────────────────────
      doc.save();
      doc.rect(0, 0, doc.page.width, 8).fill("#6366f1");
      doc.restore();

      // ── Logo / Org Name ───────────────────────────────────────────────
      doc.moveDown(2);
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#1e1b4b")
        .text("PRIME OPS", { align: "left" });

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#6b7280")
        .text("Event Management & Operations", { align: "left" });

      // ── Divider ───────────────────────────────────────────────────────
      doc.moveDown(1);
      const divY = doc.y;
      doc
        .moveTo(doc.page.margins.left, divY)
        .lineTo(doc.page.width - doc.page.margins.right, divY)
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .stroke();

      // ── Date ──────────────────────────────────────────────────────────
      doc.moveDown(1.2);
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(today);

      // ── Recipient ─────────────────────────────────────────────────────
      doc.moveDown(1.5);
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text(memberName);
      doc.moveDown(0.3);

      // ── Subject Line ──────────────────────────────────────────────────
      doc.moveDown(1);
      const roleLabel = formatRole(role);
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1e1b4b")
        .text(`RE: Appointment as ${roleLabel} – ${committeeName}`, {
          underline: false,
        });

      // ── Accent Bar Under Subject ──────────────────────────────────────
      doc.moveDown(0.3);
      const barY = doc.y;
      doc.rect(doc.page.margins.left, barY, 60, 3).fill("#6366f1");
      doc.moveDown(0.8);

      // ── Body ──────────────────────────────────────────────────────────
      doc.font("Helvetica").fontSize(10.5).fillColor("#374151");

      doc.text(`Dear ${memberName},`);
      doc.moveDown(0.8);

      doc.text(
        `We are pleased to inform you that you have been appointed as ${roleLabel.toUpperCase()} of the ${committeeName} for the upcoming event:`,
        { lineGap: 3 }
      );

      // ── Event Details Box ─────────────────────────────────────────────
      doc.moveDown(0.8);
      const boxX = doc.page.margins.left;
      const boxY = doc.y;
      const boxW = pageWidth;
      const boxPadding = 14;

      // Calculate box content
      const eventLines = [`Event: ${eventTitle}`];
      if (eventDate) eventLines.push(`Date: ${eventDate}`);
      if (eventVenue) eventLines.push(`Venue: ${eventVenue}`);
      eventLines.push(`Committee: ${committeeName}`);
      eventLines.push(`Your Role: ${roleLabel}`);

      const boxH = eventLines.length * 18 + boxPadding * 2;

      // Draw background
      doc.save();
      doc.roundedRect(boxX, boxY, boxW, boxH, 4).fill("#f5f3ff");
      doc.restore();

      // Draw left accent
      doc.save();
      doc.rect(boxX, boxY, 4, boxH).fill("#6366f1");
      doc.restore();

      // Draw text
      let textY = boxY + boxPadding;
      for (const line of eventLines) {
        const [label, ...valueParts] = line.split(": ");
        const value = valueParts.join(": ");
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#4338ca");
        doc.text(`${label}:`, boxX + boxPadding + 4, textY, { continued: true });
        doc.font("Helvetica").fillColor("#374151");
        doc.text(` ${value}`);
        textY += 18;
      }

      doc.y = boxY + boxH + 10;
      doc.moveDown(0.5);

      // ── Body Continued ────────────────────────────────────────────────
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor("#374151");

      if (role === "chair") {
        doc.text(
          "As the Chair, you will lead the committee's efforts, coordinate with other committee chairs, and ensure all responsibilities are fulfilled on time. You are the primary point of contact for this committee.",
          { lineGap: 3 }
        );
      } else if (role === "co-chair") {
        doc.text(
          "As Co-Chair, you will work closely with the Chair to oversee the committee's activities, step in when needed, and help ensure all responsibilities are completed effectively and on time.",
          { lineGap: 3 }
        );
      } else {
        doc.text(
          "As a committee member, your contributions will be vital to the success of this event. We trust your expertise and look forward to your active participation in all committee activities.",
          { lineGap: 3 }
        );
      }

      doc.moveDown(0.8);
      doc.text(
        "You now have access to the Committee Portal where you can view your responsibilities, track tasks, communicate with your team, and submit updates.",
        { lineGap: 3 }
      );

      // ── Portal Link Box ───────────────────────────────────────────────
      doc.moveDown(0.8);
      const linkBoxY = doc.y;
      const linkBoxH = 52;
      doc.save();
      doc.roundedRect(boxX, linkBoxY, boxW, linkBoxH, 4).fill("#eef2ff");
      doc.restore();

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#6366f1")
        .text("ACCESS YOUR COMMITTEE PORTAL", boxX + boxPadding, linkBoxY + 12);

      doc
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor("#4338ca")
        .text(portalLink, boxX + boxPadding, linkBoxY + 28, {
          link: portalLink,
          underline: true,
        });

      doc.y = linkBoxY + linkBoxH + 10;
      doc.moveDown(0.8);

      // ── Closing ───────────────────────────────────────────────────────
      doc.font("Helvetica").fontSize(10.5).fillColor("#374151");
      doc.text(
        "We look forward to working with you and are confident that your contribution will be invaluable to the success of this event."
      );
      doc.moveDown(0.8);
      doc.text("Best regards,");
      doc.moveDown(1.5);

      doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#111827");
      doc.text("Event Director");
      doc.font("Helvetica").fontSize(9.5).fillColor("#6b7280");
      doc.text("Prime Ops Event Management");

      // ── Footer ────────────────────────────────────────────────────────
      const footerY = doc.page.height - 45;
      doc
        .moveTo(doc.page.margins.left, footerY - 10)
        .lineTo(doc.page.width - doc.page.margins.right, footerY - 10)
        .strokeColor("#e5e7eb")
        .lineWidth(0.5)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#9ca3af")
        .text(
          "This is an automated appointment letter generated by Prime Ops. Please log in to the committee portal to get started.",
          doc.page.margins.left,
          footerY,
          { align: "center", width: pageWidth }
        );

      // ── Bottom Brand Bar ──────────────────────────────────────────────
      doc.rect(0, doc.page.height - 8, doc.page.width, 8).fill("#6366f1");

      // ── Finalize ──────────────────────────────────────────────────────
      doc.end();

      stream.on("finish", () => {
        resolve({ filePath, fileName });
      });

      stream.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Format role for display
 */
function formatRole(role) {
  switch (role) {
    case "chair":
      return "Committee Chair";
    case "co-chair":
      return "Committee Co-Chair";
    default:
      return "Committee Member";
  }
}

/**
 * Get the download URL path for an appointment letter.
 * @param {string} fileName
 * @returns {string} - API path like /api/committees/appointment-letters/filename.pdf
 */
function getLetterDownloadPath(fileName) {
  return `/api/committees/appointment-letters/${fileName}`;
}

module.exports = {
  generateAppointmentLetter,
  getLetterDownloadPath,
  LETTERS_DIR,
};
