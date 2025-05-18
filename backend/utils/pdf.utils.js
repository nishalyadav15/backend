// utils/pdf.utils.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generatePrescriptionPDF = async (prescription, patient, hospital, visit) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a temp directory if it doesn't exist
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create a PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Prescription for ${patient.name}`,
          Author: hospital.doctorName || hospital.name,
        },
      });
      
      // Create a write stream for temporary storage
      const filePath = path.join(
        tempDir,
        `prescription_${patient._id}_${Date.now()}.pdf`
      );
      const writeStream = fs.createWriteStream(filePath);
      
      doc.pipe(writeStream);
      
      // Add hospital logo
      if (hospital.branding?.logo) {
        try {
          // If logo is a URL, fetch it
          if (hospital.branding.logo.startsWith('http')) {
            // For simplicity, we'll skip fetching remote logos for now
            // You would need to implement the axios fetch here
          } else if (hospital.branding.logo.includes('base64')) {
            // If logo is stored as base64
            const logoData = hospital.branding.logo.split(';base64,').pop();
            const logoBuffer = Buffer.from(logoData, 'base64');
            doc.image(logoBuffer, 50, 50, { width: 100 });
          }
        } catch (error) {
          console.error('Error adding logo:', error);
          // Continue without logo
        }
      }
      
      // Add hospital information
      doc
        .fontSize(20)
        .fillColor(hospital.branding?.primaryColor || '#1a56db')
        .text(hospital.name, 160, 50);
      
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(hospital.address || '', 160, 75)
        .text(
          `Phone: ${hospital.phoneNumber || ''}`,
          160,
          90
        );
      
      if (hospital.email) {
        doc.text(`Email: ${hospital.email}`, 160, 105);
      }
      
      // Add letterhead text if available
      if (hospital.branding?.letterheadText) {
        doc
          .fontSize(9)
          .fillColor('#888888')
          .text(hospital.branding.letterheadText, 160, 120);
      }
      
      // Add divider
      doc
        .strokeColor('#e0e0e0')
        .lineWidth(1)
        .moveTo(50, 140)
        .lineTo(550, 140)
        .stroke();
      
      // Add prescription details
      doc
        .fontSize(14)
        .fillColor('#000000')
        .text('PRESCRIPTION', 50, 160);
      
      // Patient information
      doc
        .fontSize(10)
        .text(`Patient Name: ${patient.name}`, 50, 190)
        .text(`Age/Gender: ${patient.age} years, ${patient.gender}`, 50, 205)
        .text(`Date: ${new Date().toLocaleDateString()}`, 350, 190);
      
      // Diagnosis
      if (visit.diagnosis) {
        doc
          .fontSize(11)
          .fillColor('#444444')
          .text('Diagnosis:', 50, 240)
          .fontSize(10)
          .fillColor('#000000')
          .text(visit.diagnosis, 120, 240, { width: 400 });
      }
      
      // Main prescription
      doc
        .fontSize(11)
        .fillColor('#444444')
        .text('Rx:', 50, 270);
      
      // Format prescription text with proper spacing and formatting
      const prescriptionLines = visit.prescription.split('\n');
      let yPosition = 270;
      
      prescriptionLines.forEach((line, index) => {
        if (line.trim()) {
          doc
            .fontSize(10)
            .fillColor('#000000')
            .text(line.trim(), 70, yPosition, { width: 450 });
          
          yPosition += 20;
        }
      });
      
      // Add doctor's signature
      yPosition += 50;
      doc
        .fontSize(11)
        .fillColor('#444444')
        .text('Doctor\'s Signature:', 350, yPosition);
      
      if (hospital.doctorSignature) {
        try {
          // If signature is stored as base64
          if (hospital.doctorSignature.includes('base64')) {
            const signatureData = hospital.doctorSignature.split(';base64,').pop();
            const signatureBuffer = Buffer.from(signatureData, 'base64');
            doc.image(signatureBuffer, 350, yPosition + 15, { width: 100 });
          }
        } catch (error) {
          console.error('Error adding signature:', error);
          // Continue without signature
        }
      }
      
      // Add doctor details
      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(hospital.doctorName || hospital.name, 350, yPosition + 60)
        .fontSize(9)
        .fillColor('#666666');
      
      if (hospital.doctorDesignation) {
        doc.text(hospital.doctorDesignation, 350, yPosition + 75);
      }
      
      if (hospital.doctorRegistrationNumber) {
        doc.text(`Reg No: ${hospital.doctorRegistrationNumber}`, 350, yPosition + 90);
      }
      
      // Add footer
      const footerY = doc.page.height - 50;
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(
          'This is a digital prescription generated by Doctertia Health Platform.',
          50,
          footerY,
          { align: 'center' }
        );
      
      // Finalize the PDF
      doc.end();
      
      writeStream.on('finish', () => {
        resolve({
          filePath,
          fileName: path.basename(filePath),
        });
      });
      
    } catch (error) {
      console.error('PDF generation error:', error);
      reject(error);
    }
  });
};

module.exports = { generatePrescriptionPDF };