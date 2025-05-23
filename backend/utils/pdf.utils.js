// utils/pdf.utils.js - FINAL EXECUTIVE BEAUTIFUL DESIGN
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generatePrescriptionPDF = async (prescription, patient, hospital, visit) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting executive PDF generation...');
      console.log('Hospital data:', {
        name: hospital.name,
        hasLogo: !!hospital.branding?.logo,
        hasSignature: !!hospital.doctorSignature,
        primaryColor: hospital.branding?.primaryColor
      });
      
      // Create temp directory
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('Created temp directory');
      }
      
      // Create PDF document with executive styling
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Medical Prescription - ${patient.name}`,
          Author: hospital.doctorName || hospital.name,
          Subject: 'Medical Prescription',
          Creator: 'Doctertia Health Platform'
        }
      });
      
      const fileName = `prescription_${patient._id.toString()}_${Date.now()}.pdf`;
      const filePath = path.join(tempDir, fileName);
      console.log('Creating executive PDF at:', filePath);
      
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);
      
      // Helper function to process base64 images safely
      const processBase64Image = (base64String) => {
        try {
          console.log('Processing base64 image...');
          console.log('Input type:', typeof base64String);
          console.log('Input length:', base64String?.length);
          
          if (!base64String || typeof base64String !== 'string') {
            console.log('Invalid base64 string: empty or not a string');
            return null;
          }
          
          let base64Data;
          if (base64String.includes('data:image/')) {
            console.log('Found data:image/ format');
            base64Data = base64String.split(',')[1];
          } else if (base64String.includes(';base64,')) {
            console.log('Found ;base64, format');
            base64Data = base64String.split(';base64,')[1];
          } else {
            console.log('Using pure base64 format');
            base64Data = base64String;
          }
          
          if (!base64Data || base64Data.trim() === '') {
            console.log('No valid base64 data found after processing');
            return null;
          }
          
          console.log('Processed base64 data length:', base64Data.length);
          
          const buffer = Buffer.from(base64Data, 'base64');
          console.log('Created buffer, size:', buffer.length);
          
          if (buffer.length < 50) {
            console.log('Buffer too small, likely not a valid image');
            return null;
          }
          
          // Check for common image headers
          const header = buffer.toString('hex', 0, 8);
          console.log('Image header (hex):', header);
          
          // Common image signatures
          const imageSignatures = {
            'png': '89504e47',
            'jpg': 'ffd8ffe0',
            'jpg2': 'ffd8ffe1',
            'gif': '47494638',
            'webp': '52494646'
          };
          
          let imageType = 'unknown';
          for (const [type, signature] of Object.entries(imageSignatures)) {
            if (header.startsWith(signature)) {
              imageType = type;
              break;
            }
          }
          
          console.log('Detected image type:', imageType);
          
          if (imageType === 'webp') {
            console.log('WebP format detected - this might not be supported by PDFKit');
          }
          
          return buffer;
        } catch (error) {
          console.error('Error processing base64 image:', error.message);
          return null;
        }
      };
      
      // Helper function to add decorative border
      const addDecorativeBorder = () => {
        const primaryColor = hospital.branding?.primaryColor || '#1a56db';
        
        // Top border with gradient effect
        doc.rect(0, 0, 595, 8).fill(primaryColor);
        
        // Side borders
        doc.rect(0, 0, 3, 842).fill(primaryColor);
        doc.rect(592, 0, 3, 842).fill(primaryColor);
        
        // Bottom border
        doc.rect(0, 834, 595, 8).fill(primaryColor);
      };
      
      // Helper function to convert hex to RGB with opacity
      const hexToRgbWithOpacity = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
          const r = parseInt(result[1], 16);
          const g = parseInt(result[2], 16);
          const b = parseInt(result[3], 16);
          return [r/255, g/255, b/255, opacity];
        }
        return [0.1, 0.34, 0.86, opacity]; // Default blue if parsing fails
      };
      
      console.log('Adding executive content to PDF...');
      
      // Get colors from hospital branding with proper transparency
      const primaryColor = hospital.branding?.primaryColor || '#1a56db';
      const primaryRgb = hexToRgbWithOpacity(primaryColor, 1);
      const secondaryRgb = hexToRgbWithOpacity(primaryColor, 0.1); // 10% opacity
      const accentRgb = hexToRgbWithOpacity(primaryColor, 0.4); // 40% opacity
      const darkGray = '#2c3e50';
      const mediumGray = '#5a6c7d';
      const lightGray = '#8b9dc3';
      const veryLightGray = '#f8f9fa';
      
      console.log('Using primary color:', primaryColor);
      console.log('Primary RGB:', primaryRgb);
      
      // Add decorative borders
      addDecorativeBorder();
      
      let currentY = 50;
      
      // EXECUTIVE HEADER SECTION
      // Background accent for header
      doc.rect(40, 40, 515, 120).fill(veryLightGray);
      doc.rect(40, 40, 515, 8).fill(primaryColor);
      
      currentY = 60;
      
      // Hospital logo and information in elegant layout
      let logoWidth = 0;
      if (hospital.branding?.logo) {
        try {
          console.log('Processing hospital logo...');
          const logoBuffer = processBase64Image(hospital.branding.logo);
          if (logoBuffer) {
            console.log('Adding executive logo to PDF');
            doc.image(logoBuffer, 60, currentY, { 
              width: 90, 
              height: 70,
              fit: [90, 70]
            });
            logoWidth = 100;
          } else {
            console.log('Logo processing failed, continuing without logo');
          }
        } catch (error) {
          console.error('Error adding logo:', error.message);
        }
      }
      
      // Hospital information with elegant typography
      const hospitalInfoX = logoWidth > 0 ? 170 : 60;
      
      doc.fontSize(24)
         .fillColor(darkGray)
         .font('Helvetica-Bold')
         .text(hospital.name || 'Hospital Name', hospitalInfoX, currentY);
      
      currentY += 30;
      
      doc.fontSize(11)
         .fillColor(mediumGray)
         .font('Helvetica')
         .text(hospital.address || 'Hospital Address', hospitalInfoX, currentY);
      
      currentY += 15;
      
      // Contact information in elegant format - Replace emoji with text
      const contactInfo = [];
      if (hospital.phoneNumber) contactInfo.push(`Phone: ${hospital.phoneNumber}`);
      if (hospital.email) contactInfo.push(`Email: ${hospital.email}`);
      
      if (contactInfo.length > 0) {
        doc.fontSize(10)
           .fillColor(mediumGray)
           .text(contactInfo.join('  •  '), hospitalInfoX, currentY);
        currentY += 15;
      }
      
      // Letterhead text with style
      if (hospital.branding?.letterheadText) {
        doc.fontSize(10)
           .fillColor(lightGray)
           .font('Helvetica-Oblique')
           .text(`"${hospital.branding.letterheadText}"`, hospitalInfoX, currentY, { width: 350 });
      }
      
      currentY = 180;
      
      // PRESCRIPTION TITLE WITH ELEGANT STYLING
      doc.rect(40, currentY, 515, 45).fillAndStroke(secondaryRgb, primaryColor);
      
      doc.fontSize(28)
         .fillColor(primaryColor)
         .font('Helvetica-Bold')
         .text('MEDICAL PRESCRIPTION', 0, currentY + 12, { align: 'center' });
      
      currentY += 65;
      
      // PATIENT INFORMATION CARD
      doc.rect(40, currentY, 515, 100).fill('#ffffff');
      doc.rect(40, currentY, 515, 100).stroke(lightGray);
      doc.rect(40, currentY, 515, 25).fillOpacity(0.6).fill(primaryColor).fillOpacity(1);
      
      doc.fontSize(14)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text('PATIENT INFORMATION', 60, currentY + 6);
      
      currentY += 35;
      
      // Patient details in elegant two-column layout
      doc.fontSize(11)
         .fillColor(darkGray)
         .font('Helvetica-Bold')
         .text('Patient Name:', 60, currentY)
         .font('Helvetica')
         .fillColor(mediumGray)
         .text(patient.name, 150, currentY);
      
      doc.font('Helvetica-Bold')
         .fillColor(darkGray)
         .text('Date:', 350, currentY)
         .font('Helvetica')
         .fillColor(mediumGray)
         .text(new Date().toLocaleDateString('en-US', { 
           year: 'numeric', 
           month: 'long', 
           day: 'numeric' 
         }), 390, currentY);
      
      currentY += 18;
      
      doc.font('Helvetica-Bold')
         .fillColor(darkGray)
         .text('Age:', 60, currentY)
         .font('Helvetica')
         .fillColor(mediumGray)
         .text(`${patient.age} years`, 150, currentY);
      
      doc.font('Helvetica-Bold')
         .fillColor(darkGray)
         .text('Gender:', 250, currentY)
         .font('Helvetica')
         .fillColor(mediumGray)
         .text(patient.gender, 300, currentY);
      
      if (patient.contactNumber) {
        doc.font('Helvetica-Bold')
           .fillColor(darkGray)
           .text('Contact:', 350, currentY)
           .font('Helvetica')
           .fillColor(mediumGray)
           .text(patient.contactNumber, 400, currentY);
      }
      
      currentY += 45;
      
      // SYMPTOMS SECTION (if available) - Replace emoji with text
      if (visit.symptoms && visit.symptoms.trim() !== '' && visit.symptoms.trim() !== 'NA') {
        doc.rect(40, currentY, 515, 20).fillOpacity(0.6).fill(primaryColor).fillOpacity(1);
        
        doc.fontSize(12)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text('CHIEF COMPLAINTS', 60, currentY + 5);
        
        currentY += 30;
        
        const symptomsHeight = Math.max(30, doc.heightOfString(visit.symptoms, { width: 475 }) + 20);
        doc.rect(40, currentY, 515, symptomsHeight).fill('#ffffff').stroke(lightGray);
        
        doc.fontSize(11)
           .fillColor(mediumGray)
           .font('Helvetica')
           .text(visit.symptoms, 60, currentY + 10, { width: 475 });
        
        currentY += symptomsHeight + 10;
      }
      
      // DIAGNOSIS SECTION - Replace emoji with text
      if (visit.diagnosis && visit.diagnosis.trim() !== '' && visit.diagnosis.trim() !== 'NA') {
        doc.rect(40, currentY, 515, 20).fillOpacity(0.6).fill(primaryColor).fillOpacity(1);
        
        doc.fontSize(12)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text('CLINICAL DIAGNOSIS', 60, currentY + 5);
        
        currentY += 30;
        
        const diagnosisHeight = Math.max(30, doc.heightOfString(visit.diagnosis, { width: 475 }) + 20);
        doc.rect(40, currentY, 515, diagnosisHeight).fill('#ffffff').stroke(lightGray);
        
        doc.fontSize(11)
           .fillColor(mediumGray)
           .font('Helvetica')
           .text(visit.diagnosis, 60, currentY + 10, { width: 475 });
        
        currentY += diagnosisHeight + 10;
      }
      
      // PRESCRIPTION SECTION WITH EXECUTIVE STYLING - Replace emoji with text
      doc.rect(40, currentY, 515, 20).fill(primaryColor);
      
      doc.fontSize(12)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text('PRESCRIPTION (Rx)', 60, currentY + 5);
      
      currentY += 35;
      
      // Prescription content with elegant formatting
      if (prescription && prescription.trim()) {
        const prescriptionLines = prescription.split('\n');
        let medicineNumber = 1;
        
        prescriptionLines.forEach((line) => {
          if (line.trim()) {
            // Medicine container
            doc.rect(40, currentY - 5, 515, 25).fill('#ffffff').stroke(lightGray);
            
            doc.fontSize(11)
               .fillColor(primaryColor)
               .font('Helvetica-Bold');
            
            const trimmedLine = line.trim();
            if (!trimmedLine.match(/^\d+\./)) {
              doc.text(`${medicineNumber}.`, 60, currentY + 5);
              doc.fillColor(darkGray)
                 .font('Helvetica')
                 .text(trimmedLine, 85, currentY + 5, { width: 450 });
              medicineNumber++;
            } else {
              doc.fillColor(darkGray)
                 .font('Helvetica')
                 .text(trimmedLine, 60, currentY + 5, { width: 475 });
            }
            
            currentY += 30;
          }
        });
      } else {
        doc.rect(40, currentY, 515, 30).fill('#ffffff').stroke(lightGray);
        doc.fontSize(11)
           .fillColor(lightGray)
           .font('Helvetica-Oblique')
           .text('No prescription provided', 60, currentY + 10);
        currentY += 40;
      }
      
      // DOCTOR NOTES SECTION (if available) - Replace emoji with text
      if (visit.doctorNotes && visit.doctorNotes.trim() !== '' && visit.doctorNotes.trim() !== 'NA') {
        currentY += 10;
        
        doc.rect(40, currentY, 515, 20).fillOpacity(0.6).fill(primaryColor).fillOpacity(1);
        
        doc.fontSize(12)
           .fillColor('#ffffff')
           .font('Helvetica-Bold')
           .text('DOCTOR\'S NOTES', 60, currentY + 5);
        
        currentY += 30;
        
        const notesHeight = Math.max(30, doc.heightOfString(visit.doctorNotes, { width: 475 }) + 20);
        doc.rect(40, currentY, 515, notesHeight).fill('#ffffff').stroke(lightGray);
        
        doc.fontSize(11)
           .fillColor(mediumGray)
           .font('Helvetica')
           .text(visit.doctorNotes, 60, currentY + 10, { width: 475 });
        
        currentY += notesHeight + 10;
      }
      
      // Ensure we don't go off the page for signature
      if (currentY > 650) {
        doc.addPage();
        addDecorativeBorder();
        currentY = 60;
      } else {
        currentY += 30;
      }
      
      // EXECUTIVE SIGNATURE SECTION
      doc.rect(350, currentY, 205, 100).fill(veryLightGray).stroke(lightGray);
      doc.rect(350, currentY, 205, 20).fill(primaryColor);
      
      doc.fontSize(10)
         .fillColor('#ffffff')
         .font('Helvetica-Bold')
         .text('AUTHORIZED SIGNATURE', 365, currentY + 6);
      
      currentY += 30;
      
      // Add doctor's signature with elegant presentation
      console.log('Checking for doctor signature...');
      console.log('Signature data available:', !!hospital.doctorSignature);
      
      if (hospital.doctorSignature) {
        try {
          console.log('Processing executive doctor signature...');
          console.log('Signature type:', typeof hospital.doctorSignature);
          console.log('Signature preview (first 100 chars):', hospital.doctorSignature.substring(0, 100));
          
          const signatureBuffer = processBase64Image(hospital.doctorSignature);
          if (signatureBuffer) {
            console.log('Successfully processed signature buffer, size:', signatureBuffer.length);
            console.log('Adding executive signature to PDF...');
            
            doc.image(signatureBuffer, 365, currentY, { 
              width: 140, 
              height: 35,
              fit: [140, 35]
            });
            
            console.log('Signature image added successfully');
            currentY += 45;
          } else {
            console.log('Failed to process signature buffer, adding elegant signature line');
            doc.strokeColor(lightGray)
               .lineWidth(1)
               .moveTo(365, currentY + 20)
               .lineTo(525, currentY + 20)
               .stroke();
            currentY += 35;
          }
        } catch (error) {
          console.error('Error adding signature:', error.message);
          console.error('Error stack:', error.stack);
          doc.strokeColor(lightGray)
             .lineWidth(1)
             .moveTo(365, currentY + 20)
             .lineTo(525, currentY + 20)
             .stroke();
          currentY += 35;
        }
      } else {
        console.log('No signature provided, adding elegant signature line');
        doc.strokeColor(lightGray)
           .lineWidth(1)
           .moveTo(365, currentY + 20)
           .lineTo(525, currentY + 20)
           .stroke();
        currentY += 35;
      }
      
      // Doctor details with executive styling
      doc.fontSize(12)
         .fillColor(darkGray)
         .font('Helvetica-Bold')
         .text(hospital.doctorName || 'Doctor Name', 365, currentY);
      
      if (hospital.doctorDesignation) {
        currentY += 15;
        doc.fontSize(10)
           .fillColor(mediumGray)
           .font('Helvetica')
           .text(hospital.doctorDesignation, 365, currentY);
      }
      
      if (hospital.doctorRegistrationNumber) {
        currentY += 12;
        doc.fontSize(9)
           .fillColor(lightGray)
           .font('Helvetica')
           .text(`Reg. No: ${hospital.doctorRegistrationNumber}`, 365, currentY);
      }
      
      // EXECUTIVE FOOTER - Replace emoji with text
      const footerY = doc.page.height - 60;
      
      // Footer background
      doc.rect(0, footerY - 10, 595, 30).fill(veryLightGray);
      
      doc.fontSize(8)
         .fillColor(mediumGray)
         .font('Helvetica')
         .text(
           'This is a digitally generated prescription from Doctertia Health Platform',
           0,
           footerY,
           { align: 'center', width: 595 }
         );
      
      doc.fontSize(7)
         .fillColor(lightGray)
         .text(
           `Generated on ${new Date().toLocaleString()} | Prescription ID: ${patient._id.toString().slice(-8)}`,
           0,
           footerY + 12,
           { align: 'center', width: 595 }
         );
      
      console.log('Executive content added to PDF, finalizing...');
      doc.end();
      
      writeStream.on('finish', () => {
        console.log('Executive PDF write stream finished');
        
        // Validate the generated PDF
        try {
          if (!fs.existsSync(filePath)) {
            console.error('PDF file does not exist after generation');
            return reject(new Error('PDF file not found'));
          }
          
          const stats = fs.statSync(filePath);
          console.log(`Executive PDF file size: ${stats.size} bytes`);
          
          if (stats.size === 0) {
            console.error('PDF file is empty');
            return reject(new Error('PDF file is empty'));
          }
          
          if (stats.size < 1000) {
            console.warn('PDF file seems very small, might be corrupted');
          }
          
          // Check PDF header
          const buffer = fs.readFileSync(filePath, { encoding: null });
          const header = buffer.toString('ascii', 0, 4);
          console.log(`Executive PDF header: "${header}"`);
          
          if (header !== '%PDF') {
            console.error('Invalid PDF header, file is corrupted');
            return reject(new Error('Invalid PDF format'));
          }
          
          console.log('Executive PDF validation successful');
          resolve({
            filePath,
            fileName: fileName,
          });
          
        } catch (validationError) {
          console.error('PDF validation error:', validationError);
          reject(validationError);
        }
      });
      
      writeStream.on('error', (error) => {
        console.error('PDF write stream error:', error);
        reject(error);
      });
      
      doc.on('error', (error) => {
        console.error('PDF document error:', error);
        reject(error);
      });
      
    } catch (error) {
      console.error('PDF generation setup error:', error);
      reject(error);
    }
  });
};

module.exports = { generatePrescriptionPDF };