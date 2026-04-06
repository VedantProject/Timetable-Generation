import PDFDocument from "pdfkit";
import * as xlsx from "xlsx";

export const exportTimetablePDF = (res, timetableData, section) => {
  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
  
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=timetable_${section || "all"}.pdf`);
  
  doc.pipe(res);
  
  doc.fontSize(20).text(`Timetable - Section: ${section || "All"}`, { align: "center" });
  doc.moveDown();
  
  // Basic rendering text because complex tables in PDFKit require external libraries or custom plugins.
  // We'll write a simple list representation for now.
  
  timetableData.entries.forEach(entry => {
    if (section && entry.sectionId !== section) return;
    const courseCode = entry.courseId?.courseCode || "Unknown";
    const facultyName = entry.facultyId?.name || "Unknown";
    const roomName = entry.roomId?.roomId || "Unknown";
    const typeLabel = entry.isLab ? `LAB (Block ${entry.labBlock})` : 'THEORY';
    
    doc.fontSize(12).text(
      `${entry.day} | Period ${entry.period} | ${courseCode} (${typeLabel}) | Sec: ${entry.sectionId} | Room: ${roomName} | Fac: ${facultyName}`
    );
  });
  
  doc.end();
};

export const exportTimetableExcel = (res, timetableData, section) => {
  const rows = [];
  
  timetableData.entries.forEach(entry => {
    if (section && entry.sectionId !== section) return;
    
    rows.push({
      Day: entry.day,
      Period: entry.period,
      Course: entry.courseId?.courseCode || "Unknown",
      Section: entry.sectionId,
      Faculty: entry.facultyId?.name || "Unknown",
      Room: entry.roomId?.roomId || "Unknown",
      Type: entry.isLab ? "LAB" : "THEORY",
      Cancelled: entry.isCancelled ? "YES" : "NO",
      Makeup: entry.isMakeup ? "YES" : "NO"
    });
  });
  
  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Timetable");
  
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
  
  res.setHeader("Content-Disposition", `attachment; filename="timetable_${section || "all"}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};
