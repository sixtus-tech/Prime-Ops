const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const LETTERS_DIR = path.join(__dirname, "..", "uploads", "appointment-letters");

function ensureDir() {
  if (!fs.existsSync(LETTERS_DIR)) {
    fs.mkdirSync(LETTERS_DIR, { recursive: true });
  }
}

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
          Author: "Prime Ops",
          Subject: `Committee Appointment: ${committeeName}`,
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ── Brand Header Bar ──────────────────────────────────────────────
      doc.save();
      doc.rect(0, 0, doc.page.width, 8).fill("#1e40af");
      doc.restore();

      // ── Logo / Org Name ───────────────────────────────────────────────
      doc.moveDown(2);
      doc.font("Helvetica-Bold").fontSize(22).fillColor("#1e1b4b").text("PRIME OPS", { align: "left" });
      doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text("Operations & Project Management", { align: "left" });

      // ── Divider ───────────────────────────────────────────────────────
      doc.moveDown(1);
      const divY = doc.y;
      doc.moveTo(doc.page.margins.left, divY).lineTo(doc.page.width - doc.page.margins.right, divY).strokeColor("#e5e7eb").lineWidth(1).stroke();

      // ── Date ──────────────────────────────────────────────────────────
      doc.moveDown(1.2);
      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(today);

      // ── Subject Line ──────────────────────────────────────────────────
      doc.moveDown(1.5);
      const roleLabel = formatRole(role);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1e1b4b")
        .text(`Appointment as ${roleLabel} of the ${committeeName} for ${eventTitle}`);

      // ── Accent Bar ────────────────────────────────────────────────────
      doc.moveDown(0.3);
      const barY = doc.y;
      doc.rect(doc.page.margins.left, barY, 60, 3).fill("#1e40af");
      doc.moveDown(1);

      // ── Body ──────────────────────────────────────────────────────────
      doc.font("Helvetica").fontSize(10.5).fillColor("#374151");

      doc.text(`Dear Esteemed ${memberName},`);
      doc.moveDown(0.8);

      doc.text("Warm greetings in Jesus' name.", { lineGap: 3 });
      doc.moveDown(0.6);

      doc.text(
        `This is to kindly inform you that you have been appointed as ${roleLabel} of the ${committeeName} for ${eventTitle}. Congratulations!`,
        { lineGap: 3 }
      );

      // ── Project Details Box ───────────────────────────────────────────
      doc.moveDown(0.8);
      const boxX = doc.page.margins.left;
      const boxY = doc.y;
      const boxW = pageWidth;
      const boxPadding = 14;

      const detailLines = [`Project: ${eventTitle}`];
      if (eventDate) detailLines.push(`Date: ${eventDate}`);
      if (eventVenue) detailLines.push(`Venue: ${eventVenue}`);
      detailLines.push(`Committee: ${committeeName}`);
      detailLines.push(`Your Role: ${roleLabel}`);

      const boxH = detailLines.length * 18 + boxPadding * 2;

      doc.save();
      doc.roundedRect(boxX, boxY, boxW, boxH, 4).fill("#eff6ff");
      doc.restore();

      doc.save();
      doc.rect(boxX, boxY, 4, boxH).fill("#1e40af");
      doc.restore();

      let textY = boxY + boxPadding;
      for (const line of detailLines) {
        const [label, ...valueParts] = line.split(": ");
        const value = valueParts.join(": ");
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e40af");
        doc.text(`${label}:`, boxX + boxPadding + 4, textY, { continued: true });
        doc.font("Helvetica").fillColor("#374151");
        doc.text(` ${value}`);
        textY += 18;
      }

      doc.y = boxY + boxH + 10;
      doc.moveDown(0.8);

      // ── Responsibilities ──────────────────────────────────────────────
      doc.font("Helvetica").fontSize(10.5).fillColor("#374151");

      if (role === "chair" || role === "head") {
        doc.text(
          "As the Committee Chair, you will lead the committee's efforts, coordinate with other committee chairs, and ensure all responsibilities are fulfilled on time. You are the primary point of contact for this committee.",
          { lineGap: 3 }
        );
      } else if (role === "co-chair") {
        doc.text(
          "As Co-Chair, you will work closely with the Chair to oversee the committee's activities, step in when needed, and help ensure all responsibilities are completed effectively and on time.",
          { lineGap: 3 }
        );
      } else {
        doc.text(
          "As a committee member, your contributions will be vital to the success of this project. We trust your expertise and look forward to your active participation in all committee activities.",
          { lineGap: 3 }
        );
      }

      doc.moveDown(0.8);
      doc.text(
        "Kindly log in to the Committee Portal to view your responsibilities, tasks, and collaborate with your team.",
        { lineGap: 3 }
      );

      // ── Portal Link Box ───────────────────────────────────────────────
      doc.moveDown(0.8);
      const linkBoxY = doc.y;
      const linkBoxH = 52;
      doc.save();
      doc.roundedRect(boxX, linkBoxY, boxW, linkBoxH, 4).fill("#eff6ff");
      doc.restore();

      doc.font("Helvetica-Bold").fontSize(9).fillColor("#1e40af")
        .text("ACCESS YOUR COMMITTEE PORTAL", boxX + boxPadding, linkBoxY + 12);

      doc.font("Helvetica").fontSize(9.5).fillColor("#1e40af")
        .text(portalLink, boxX + boxPadding, linkBoxY + 28, { link: portalLink, underline: true });

      doc.y = linkBoxY + linkBoxH + 10;
      doc.moveDown(0.8);

      // ── Closing ───────────────────────────────────────────────────────
      doc.font("Helvetica").fontSize(10.5).fillColor("#374151");
      doc.text("Thank you and congratulations once again.");
      doc.moveDown(1.5);
      doc.text("Warm regards,");
      doc.moveDown(1.5);

      doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#111827");
      doc.text("Office of the CEO");
      doc.font("Helvetica").fontSize(9.5).fillColor("#6b7280");
      doc.text("Prime Ops");

      // ── Footer ────────────────────────────────────────────────────────
      const footerY = doc.page.height - 45;
      doc.moveTo(doc.page.margins.left, footerY - 10).lineTo(doc.page.width - doc.page.margins.right, footerY - 10).strokeColor("#e5e7eb").lineWidth(0.5).stroke();

      doc.font("Helvetica").fontSize(8).fillColor("#9ca3af")
        .text(
          "This is an official appointment letter generated by Prime Ops. Please log in to the committee portal to get started.",
          doc.page.margins.left, footerY, { align: "center", width: pageWidth }
        );

      // ── Bottom Brand Bar ──────────────────────────────────────────────
      doc.rect(0, doc.page.height - 8, doc.page.width, 8).fill("#1e40af");

      doc.end();

      stream.on("finish", () => resolve({ filePath, fileName }));
      stream.on("error", (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

function formatRole(role) {
  switch (role) {
    case "chair":
    case "head":
      return "Committee Chair";
    case "co-chair":
      return "Committee Co-Chair";
    default:
      return "Committee Member";
  }
}

function getLetterDownloadPath(fileName) {
  return `/api/committees/appointment-letters/${fileName}`;
}

module.exports = {
  generateAppointmentLetter,
  getLetterDownloadPath,
  LETTERS_DIR,
};
