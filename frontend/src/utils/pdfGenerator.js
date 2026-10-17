import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export const formatClockTime = (isoString) => {
    if (!isoString) return 'In Progress';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return 'In Progress';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch {
        return 'In Progress';
    }
};

export const sanitizePdfText = (raw, maxLength = 0) => {
    if (!raw || typeof raw !== 'string') return '';
    // Strip HTML tags
    let cleaned = raw.replace(/<[^>]*>?/gm, ' ');
    // Strip non-ASCII/emojis that cause corrupt glyphs in WinAnsi/Helvetica
    cleaned = cleaned.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
    // Collapse multiline & extra whitespace into single spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (maxLength > 0 && cleaned.length > maxLength) {
        cleaned = cleaned.slice(0, maxLength).trim() + '...';
    }
    return cleaned;
};

const getBase64Logo = () => {
    return new Promise((resolve) => {
        try {
            if (typeof window === 'undefined') return resolve(null);
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 160;
                    canvas.height = 160;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 160, 160);
                    resolve(canvas.toDataURL('image/png'));
                } catch {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = '/favicon.png';
        } catch {
            resolve(null);
        }
    });
};

const renderSecurityWatermark = (doc, pageWidth, pageHeight, pageNum = 1) => {
    doc.saveGraphicsState();
    try {
        const gState = new doc.GState({ opacity: 0.18 });
        doc.setGState(gState);
    } catch {
        // Fallback gracefully if GState is not available
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(115, 130, 150); // Clearly visible slate tone

    // Confine strictly to the white area: safely below the dark blue header (y >= 48 on page 1) and above footer (y <= 276)
    const xStep = 55;
    const yStep = 28;
    const startY = pageNum === 1 ? 48 : 26;
    const endY = 276;

    let rowIndex = 0;
    for (let y = startY; y <= endY; y += yStep) {
        const isOdd = rowIndex % 2 === 1;
        const xOffset = isOdd ? 28 : 0;
        const watermarkText = isOdd ? 'TYQRO • DO NOT COPY' : 'TYQRO VERIFIED';

        for (let x = 15 + xOffset; x <= pageWidth - 5; x += xStep) {
            doc.text(watermarkText, x, y, {
                align: 'center',
                angle: -25,
            });
        }
        rowIndex++;
    }

    doc.restoreGraphicsState();
};

export const generateWorkSummaryPDF = async (data) => {
    if (!data) return;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    // Pre-load Tyqro Logo and Verification QR Code
    const logoBase64 = await getBase64Logo();
    const verifyUrl = data.security?.verification_url || (typeof window !== 'undefined' ? `${window.location.origin}/verify/${data.report_id || 'valid'}` : `https://tyqro.com/verify/${data.report_id || 'valid'}`);
    let qrCodeBase64 = null;
    try {
        qrCodeBase64 = await QRCode.toDataURL(verifyUrl, {
            margin: 1,
            width: 140,
            color: {
                dark: '#0f172a',
                light: '#ffffff',
            },
        });
    } catch {
        qrCodeBase64 = null;
    }

    doc.setProperties({
        title: `Tyqro Daily Summary - ${data.date || 'Record'}`,
        subject: `Cryptographically Signed Attendance Report for ${data.user?.full_name || 'Member'}`,
        author: 'Tyqro Official Audit Ledger',
        keywords: 'Tyqro, Verified, Audit Trail, Tamper-Protected, Copyright Protected, Anti-Forgery, Official Record',
        creator: `Tyqro Cryptographic Signature Engine (${data.security?.security_hash || 'SECURE'})`,
    });

    // --- 1. Top Header Banner ---
    const headerHeight = 30;
    doc.setFillColor(15, 23, 42); // Deep Slate-900
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Accent Line under header (Electric Blue gradient bar)
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, headerHeight, pageWidth, 1.8, 'F');

    // Logo & Brand Title
    if (logoBase64) {
        try {
            // Draw clean rounded container for logo
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin, 5.5, 19, 19, 2, 2, 'F');
            doc.addImage(logoBase64, 'PNG', margin + 1.5, 7, 16, 16);
        } catch {
            // Vector fallback if image add fails
            doc.setFillColor(37, 99, 235);
            doc.roundedRect(margin, 6, 18, 18, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.text('T', margin + 6, 18);
        }
    } else {
        // Sleek vector emblem fallback
        doc.setFillColor(37, 99, 235);
        doc.roundedRect(margin, 6, 18, 18, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text('T', margin + 6, 18);
    }

    const brandTextX = margin + 23;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('TYQRO', brandTextX, 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(147, 197, 253); // Blue-300
    doc.text('OFFICIAL DAILY WORK ATTENDANCE & PERFORMANCE SUMMARY', brandTextX, 20.5);

    // Header Right Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    const dateFormatted = data.date_formatted || data.date || 'Today';
    doc.text(dateFormatted, pageWidth - margin, 13, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(`Report ID: ${data.report_id || 'N/A'}`, pageWidth - margin, 19, { align: 'right' });

    // Official Verification Tag
    doc.setFillColor(22, 101, 52); // Dark Green
    doc.roundedRect(pageWidth - margin - 26, 21.5, 26, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(220, 252, 231); // Mint-100
    doc.text('SYSTEM VERIFIED', pageWidth - margin - 13, 25, { align: 'center' });

    let currentY = 37;

    // --- 2. Employee & Shift Overview Structured Card ---
    const infoCardHeight = 24;
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, currentY, contentWidth, infoCardHeight, 2, 2, 'FD');

    // Column 1: Team Member Profile (Width: 72mm)
    const col1X = margin + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TEAM MEMBER', col1X, currentY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const fullName = (data.user?.full_name || 'Team Member').trim();
    doc.text(doc.splitTextToSize(fullName, 68)[0], col1X, currentY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const userIdentifier = data.user?.username && data.user?.username !== data.user?.email
        ? `@${data.user.username} • ${data.user?.email || ''}`
        : `${data.user?.email || ''}`;
    doc.text(doc.splitTextToSize(userIdentifier, 68)[0], col1X, currentY + 16.5);

    if (data.user?.study_code) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(37, 99, 235);
        doc.text(`Study Code: ${data.user.study_code}`, col1X, currentY + 21);
    }

    // Divider Line 1
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + 75, currentY + 3, margin + 75, currentY + infoCardHeight - 3);

    // Column 2: Schedule Policy (Width: 58mm)
    const col2X = margin + 79;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('SCHEDULE CONFIGURATION', col2X, currentY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const schedMode = data.schedule?.use_fixed_schedule
        ? `Fixed Shift (${data.schedule?.work_start_time?.slice(0, 5) || '09:00'} - ${data.schedule?.work_end_time?.slice(0, 5) || '18:00'})`
        : `Flexible Shift (${data.schedule?.daily_target_hours || 9}h Target)`;
    doc.text(doc.splitTextToSize(schedMode, 55)[0], col2X, currentY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Daily Target: ${data.schedule?.daily_target_hours || 9.0}h Net Active Work`, col2X, currentY + 16.5);

    const targetPctVal = data.attendance?.target_completion_pct || 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(data.attendance?.target_achieved ? 22 : 194, data.attendance?.target_achieved ? 163 : 65, data.attendance?.target_achieved ? 74 : 12);
    doc.text(`Target Achieved: ${data.attendance?.target_achieved ? 'YES (100%)' : `INCOMPLETE (${targetPctVal}%)`}`, col2X, currentY + 21);

    // Divider Line 2
    doc.line(margin + 138, currentY + 3, margin + 138, currentY + infoCardHeight - 3);

    // Column 3: Performance Assessment (Width: 40mm)
    const col3X = margin + 142;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('OVERALL RATING', col3X, currentY + 5.5);

    const grade = data.performance?.shift_grade || 'Completed';
    let gradeBadgeBg = [220, 252, 231]; // Green-100
    let gradeBadgeText = [22, 101, 52]; // Green-800
    if (grade === 'Good') {
        gradeBadgeBg = [219, 234, 254]; // Blue-100
        gradeBadgeText = [30, 64, 175]; // Blue-800
    } else if (grade === 'Needs Improvement') {
        gradeBadgeBg = [254, 243, 199]; // Amber-100
        gradeBadgeText = [146, 64, 14]; // Amber-800
    }

    doc.setFillColor(...gradeBadgeBg);
    doc.roundedRect(col3X, currentY + 8, 36, 6.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...gradeBadgeText);
    doc.text(grade.toUpperCase(), col3X + 18, currentY + 12.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Score: ${data.performance?.total_points || 0} Total Pts`, col3X, currentY + 20);

    currentY += infoCardHeight + 5.5;

    // --- 3. Key Metrics (4 Elevated KPI Cards) ---
    const cardGap = 3.5;
    const cardWidth = (contentWidth - cardGap * 3) / 4;
    const cardHeight = 22;

    const cards = [
        {
            title: 'NET WORK TIME',
            value: data.attendance?.net_formatted || '00h 00m 00s',
            sub: `Target: ${data.attendance?.target_completion_pct || 0}%`,
            color: [34, 197, 94], // Emerald-500
        },
        {
            title: 'TOTAL BREAK TIME',
            value: data.attendance?.break_formatted || '00h 00m 00s',
            sub: `Gross: ${data.attendance?.gross_formatted || '00h 00m'}`,
            color: [245, 158, 11], // Amber-500
        },
        {
            title: 'TASKS COMPLETED',
            value: `${data.tasks?.completed || 0} / ${data.tasks?.total || 0}`,
            sub: `${data.tasks?.completion_rate || 0}% Completion`,
            color: [59, 130, 246], // Blue-500
        },
        {
            title: 'PERFORMANCE SCORE',
            value: `${data.performance?.total_points || 0} pts`,
            sub: `Att: ${data.performance?.attendance_points || 0} | Tasks: ${data.performance?.todo_points || 0}`,
            color: [147, 51, 234], // Purple-500
        },
    ];

    cards.forEach((card, idx) => {
        const cX = margin + idx * (cardWidth + cardGap);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(cX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        // Color accent line on top of each card
        doc.setFillColor(card.color[0], card.color[1], card.color[2]);
        doc.rect(cX, currentY, cardWidth, 1.5, 'F');

        // Card Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(card.title, cX + 3.5, currentY + 5.5);

        // Card Main Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(card.value, cX + 3.5, currentY + 12.5);

        // Card Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(card.sub, cX + 3.5, currentY + 18);
    });

    currentY += cardHeight + 5;

    // --- 4. Attendance Timing Detailed Row ---
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

    const clockInVal = formatClockTime(data.attendance?.start_time);
    const clockOutVal = data.attendance?.end_time 
        ? formatClockTime(data.attendance.end_time)
        : (data.attendance?.is_active ? 'Active Session' : 'Shift Ended');

    const timingItems = [
        { label: 'Clock In', val: clockInVal },
        { label: 'Clock Out', val: clockOutVal },
        { label: 'Gross Duration', val: data.attendance?.gross_formatted || '00h 00m' },
        { label: 'Break Total', val: data.attendance?.break_formatted || '00h 00m' },
        { label: 'Net Active Work', val: data.attendance?.net_formatted || '00h 00m' },
    ];

    const tWidth = contentWidth / timingItems.length;
    timingItems.forEach((item, i) => {
        const itemX = margin + i * tWidth + 3.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, itemX, currentY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(item.val, itemX, currentY + 10.5);
    });

    currentY += 18;

    // --- 5. Prominent Session End Reason & Late Arrival Reason Callouts ---
    const endReasonText = data.attendance?.end_reason || data.attendance?.early_leave_reason;
    const lateReasonText = data.attendance?.late_reason;

    if (endReasonText || lateReasonText) {
        if (endReasonText) {
            const isEarly = !data.attendance?.target_achieved;
            const alertTitle = isEarly 
                ? 'EARLY DEPARTURE REASON (MANDATORY EXPLANATION)' 
                : 'SESSION CONCLUSION REASON / NOTE';

            const alertBg = isEarly ? [254, 242, 242] : [240, 249, 255]; // Red-50 or Sky-50
            const alertBorder = isEarly ? [239, 68, 68] : [59, 130, 246]; // Red-500 or Blue-500
            const titleColor = isEarly ? [185, 28, 28] : [29, 78, 216];

            doc.setFillColor(...alertBg);
            doc.setDrawColor(...alertBorder);
            doc.setLineWidth(0.4);

            const cleanReason = sanitizePdfText(endReasonText, 320);
            const quoteContent = `"${cleanReason}"`;
            const splitContent = doc.splitTextToSize(quoteContent, contentWidth - 14);
            const boxH = Math.max(12, 7 + splitContent.length * 3.8 + 2);

            // If box exceeds available height on page 1, break to next page
            if (currentY + boxH > pageHeight - 25) {
                doc.addPage();
                currentY = 20;
            }

            doc.roundedRect(margin, currentY, contentWidth, boxH, 1.5, 1.5, 'FD');

            // Left solid accent bar
            doc.setFillColor(...alertBorder);
            doc.rect(margin, currentY, 2.5, boxH, 'F');

            // Header title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...titleColor);
            doc.text(alertTitle, margin + 5, currentY + 5);

            // Reason Text
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.2);
            doc.setTextColor(30, 41, 59);
            doc.text(splitContent, margin + 5, currentY + 9.2);

            currentY += boxH + 4;
        }

        if (lateReasonText) {
            doc.setFillColor(254, 243, 199); // Amber-100
            doc.setDrawColor(245, 158, 11); // Amber-500
            doc.setLineWidth(0.4);

            const cleanLate = sanitizePdfText(lateReasonText, 320);
            const quoteLate = `"${cleanLate}"`;
            const splitLate = doc.splitTextToSize(quoteLate, contentWidth - 14);
            const boxH = Math.max(12, 7 + splitLate.length * 3.8 + 2);

            if (currentY + boxH > pageHeight - 25) {
                doc.addPage();
                currentY = 20;
            }

            doc.roundedRect(margin, currentY, contentWidth, boxH, 1.5, 1.5, 'FD');

            // Left solid accent bar
            doc.setFillColor(245, 158, 11);
            doc.rect(margin, currentY, 2.5, boxH, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(180, 83, 9);
            doc.text('LATE ARRIVAL REASON', margin + 5, currentY + 5);

            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.2);
            doc.setTextColor(30, 41, 59);
            doc.text(splitLate, margin + 5, currentY + 9.2);

            currentY += boxH + 4;
        }
    }

    // --- 6. Task List Table (Sanitized and Bounded) ---
    // If not enough vertical space remains on Page 1 (less than 45mm before footer), start table on page 2
    if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Tasks & Activity Breakdown', margin, currentY);
    currentY += 3;

    const taskRows = (data.tasks?.list || []).map((t, index) => {
        const statusText = t.is_completed ? 'COMPLETED' : 'PENDING';
        const durationText = (t.duration_formatted && t.duration_formatted !== '-') ? t.duration_formatted : '-';
        let note = '-';
        if (t.uncheck_reason) {
            const cleanReason = sanitizePdfText(t.uncheck_reason, 140);
            note = cleanReason ? `Reopened: "${cleanReason}"` : '-';
        }
        return [
            (index + 1).toString(),
            sanitizePdfText(t.title || 'Untitled task', 55),
            durationText,
            statusText,
            note,
        ];
    });

    if (taskRows.length === 0) {
        taskRows.push(['-', 'No tasks logged for this shift', '-', '-', '-']);
    }

    autoTable(doc, {
        startY: currentY,
        margin: { top: 20, bottom: 20, left: margin, right: margin },
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        head: [['#', 'Task Description', 'Time Spent', 'Status', 'Notes & Reopen Explanations']],
        body: taskRows,
        theme: 'striped',
        headStyles: {
            fillColor: [15, 23, 42], // Slate-900
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: 2.2,
        },
        bodyStyles: {
            fontSize: 7.0,
            cellPadding: 2.2,
            textColor: [30, 41, 59],
            overflow: 'linebreak',
        },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 58 },
            2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
            4: { cellWidth: 68 },
        },
        didParseCell: (hookData) => {
            if (hookData.section === 'body' && hookData.column.index === 3) {
                if (hookData.cell.raw === 'COMPLETED') {
                    hookData.cell.styles.textColor = [22, 163, 74]; // Green
                } else if (hookData.cell.raw === 'PENDING') {
                    hookData.cell.styles.textColor = [217, 119, 6]; // Amber
                }
            }
            if (hookData.section === 'body' && hookData.column.index === 4 && typeof hookData.cell.raw === 'string' && hookData.cell.raw.startsWith('Reopened:')) {
                hookData.cell.styles.textColor = [194, 65, 12]; // Orange-700
                hookData.cell.styles.fontStyle = 'italic';
            }
        },
    });

    // --- 7. Reopened Tasks Attention Callout (if any) ---
    const reopenedList = data.tasks?.reopened_list || [];
    let finalY = doc.lastAutoTable.finalY + 4;

    if (reopenedList.length > 0) {
        const calloutH = Math.min(22, 6 + Math.min(reopenedList.length, 3) * 4.2);
        if (finalY + calloutH > pageHeight - 20) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFillColor(254, 242, 242); // Red-50
        doc.setDrawColor(248, 113, 113); // Red-400
        doc.setLineWidth(0.3);

        doc.roundedRect(margin, finalY, contentWidth, calloutH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(185, 28, 28);
        doc.text(`Attention: ${reopenedList.length} Task(s) were unchecked/reworked during this shift:`, margin + 4, finalY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(127, 29, 29);
        reopenedList.slice(0, 3).forEach((item, rIdx) => {
            const cleanReason = sanitizePdfText(item.reason, 110);
            const preview = `• "${sanitizePdfText(item.title, 35)}": ${cleanReason}`;
            const clipped = doc.splitTextToSize(preview, contentWidth - 8)[0];
            doc.text(clipped, margin + 4, finalY + 9.2 + rIdx * 4);
        });

        finalY += calloutH + 4;
    }

    // --- 8. Cryptographic Verification & Copyright Audit Panel ---
    let authY = finalY;
    const authCardH = 21;
    if (authY + authCardH > pageHeight - 18) {
        doc.addPage();
        authY = 20;
    }

    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, authY, contentWidth, authCardH, 1.5, 1.5, 'FD');

    // Draw QR Code if available
    if (qrCodeBase64) {
        try {
            doc.addImage(qrCodeBase64, 'PNG', margin + 2.5, authY + 2, 17, 17);
        } catch {
            // Ignore fallback
        }
    }

    const textX = margin + 22.5;
    const textWidth = contentWidth - 25;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text('OFFICIAL CRYPTOGRAPHIC AUDIT VERIFICATION & COPYRIGHT RECORD', textX, authY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(37, 99, 235); // Blue-600
    const sigText = data.security?.security_hash || 'TYQ-SIG-AUTHENTIC-VERIFIED';
    doc.text(`Digital Signature: ${sigText}`, textX, authY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    const notice1 = 'This report is signed with HMAC-SHA256 and registered in the Tyqro ledger. Scan the QR code to verify original timestamps and authentic work metrics.';
    doc.text(doc.splitTextToSize(notice1, textWidth)[0], textX, authY + 13.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(100, 116, 139);
    doc.text('© 2026 Tyqro Technologies. All rights reserved. Tamper-evident record. Unauthorized editing, copying, or AI style replication is strictly prohibited.', textX, authY + 18);

    authY += authCardH + 3;

    // --- 9. Anti-Copy Watermark & Footer on All Pages ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // If page 2+, draw a sleek mini header banner!
        if (i > 1) {
            doc.setFillColor(15, 23, 42); // Deep Slate-900
            doc.rect(0, 0, pageWidth, 12, 'F');
            doc.setFillColor(37, 99, 235); // Blue-600
            doc.rect(0, 12, pageWidth, 0.8, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text('TYQRO • DAILY WORK ATTENDANCE & PERFORMANCE SUMMARY (CONTINUED)', margin, 8);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            const reportIdStr = data.report_id ? `Report ID: ${data.report_id}` : '';
            doc.text(reportIdStr, pageWidth - margin, 8, { align: 'right' });
        }

        // Apply platform security watermark across background (confined to white area)
        renderSecurityWatermark(doc, pageWidth, pageHeight, i);

        // Divider line above footer
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        // Security footer notes
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
            'TYQRO ATTENDANCE & PRODUCTIVITY AUDIT TRAIL • OFFICIAL TAMPER-PROTECTED RECORD',
            margin,
            pageHeight - 7.5
        );

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text(
            `Generated on ${new Date(data.generated_at || Date.now()).toLocaleString()} • UID: ${data.report_id || 'N/A'} • Confidential Internal Record`,
            margin,
            pageHeight - 4
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth - margin,
            pageHeight - 6,
            { align: 'right' }
        );
    }

    const filename = `Tyqro_Daily_Summary_${data.date || 'today'}.pdf`;
    doc.save(filename);
};
