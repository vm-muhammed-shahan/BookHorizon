const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const path = require("path");
const http = require("../../helpers/const");
const formatIndianCurrency = (amount) => {
  if (!amount && amount !== 0 || isNaN(amount)) return '₹0';
  return `Rs ${parseFloat(amount).toLocaleString('en-IN', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0 
  })}`;
};
const drawTable = (doc, data, headers, startX, startY, colWidths, options = {}) => {
  const { 
    headerHeight = 40,
    rowHeight = 32,
    fontSize = 9,
    headerFontSize = 10,
    borderColor = '#d5d5d5',
    headerBg = '#f8f9fa',
    alternateRowBg = '#fdfdfd',
    pageHeight = 595.28,
    pageWidth = 841.89,
    marginBottom = 60
  } = options;

  let currentY = startY;
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  let pageNumber = 1;

  const drawPageHeader = (pageNum = 1) => {
    doc.rect(startX, 30, tableWidth, 90).fill('#2c3e50').stroke();
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('BookHorizon', startX + 25, 50);
    doc.fillColor('#ecf0f1').fontSize(14).font('Helvetica').text('Sales Report', startX + 25, 78);
    doc.fillColor('#bdc3c7').fontSize(10).text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, startX + 25, 100);
    doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(`Page ${pageNum}`, tableWidth - 60, 100);
    return 135;
  };

  const drawSummaryCards = (doc, yPosition, summary) => {
    if (!summary) return yPosition;
    const cardWidth = (tableWidth - 80) / 4;
    const cardHeight = 65;
    const cardSpacing = 20;
    const summaryCards = [
    { title: 'Total Orders', value: summary.totalSalesCount.toString(), color: '#3498db', icon: '📊' },
    { title: 'Total Amount', value: formatIndianCurrency(summary.totalOrderAmount), color: '#27ae60', icon: '💰' },
    { title: 'Total Discount', value: formatIndianCurrency(summary.totalDiscount), color: '#e74c3c', icon: '💸' },
    { title: 'Final Amount', value: formatIndianCurrency(summary.totalOrderAmount - summary.totalDiscount), color: '#f39c12', icon: '💳' }
    ];
    summaryCards.forEach((card, index) => {
      const x = startX + (index * (cardWidth + cardSpacing));
      doc.rect(x + 2, yPosition + 2, cardWidth, cardHeight).fill('#00000010');
      doc.rect(x, yPosition, cardWidth, cardHeight).fill('#ffffff').stroke('#e0e0e0').lineWidth(1);
      doc.rect(x, yPosition, cardWidth, 6).fill(card.color);
      doc.fillColor('#7f8c8d').fontSize(10).font('Helvetica').text(card.title, x + 15, yPosition + 18);
      doc.fillColor('#2c3e50').fontSize(14).font('Helvetica-Bold').text(card.value, x + 15, yPosition + 35, { width: cardWidth - 30, align: 'left' });
    });
    return yPosition + cardHeight + 25;
  };

  const drawTableHeaders = (yPos) => {
    doc.rect(startX, yPos, tableWidth, headerHeight).fill(headerBg).stroke(borderColor).lineWidth(1.5);
    doc.fillColor('#2c3e50').font('Helvetica-Bold').fontSize(headerFontSize);
    let currentX = startX;
    headers.forEach((header, index) => {
      if (index > 0) doc.moveTo(currentX, yPos).lineTo(currentX, yPos + headerHeight).stroke('#d0d0d0').lineWidth(1);
      let align = 'center';
      if (index === 0) align = 'left';
      else if (index === 2) align = 'left';
      else if (index === 3) align = 'left';
      doc.text(header, currentX + 8, yPos + 15, { width: colWidths[index] - 16, align: align, ellipsis: true });
      currentX += colWidths[index];
    });
    return yPos + headerHeight;
  };

  const startNewPage = () => {
    doc.addPage({ size: 'A4', layout: 'landscape' });
    pageNumber++;
    currentY = drawPageHeader(pageNumber);
    currentY = drawTableHeaders(currentY);
  };

  currentY = drawPageHeader(pageNumber);
  currentY = drawSummaryCards(doc, currentY, options.summary);
  currentY = drawTableHeaders(currentY);

  doc.font('Helvetica').fontSize(fontSize);
  data.forEach((row, rowIndex) => {
    if (currentY + rowHeight + marginBottom > pageHeight) startNewPage();
    if (rowIndex % 2 === 0) doc.rect(startX, currentY, tableWidth, rowHeight).fill(alternateRowBg);
    doc.rect(startX, currentY, tableWidth, rowHeight).stroke(borderColor).lineWidth(0.5);
    doc.fillColor('#2c3e50');
    let currentX = startX;
    row.forEach((cell, cellIndex) => {
      if (cellIndex > 0) doc.moveTo(currentX, currentY).lineTo(currentX, currentY + rowHeight).stroke('#f0f0f0').lineWidth(0.5);
      let align = 'center';
      if (cellIndex === 0) align = 'left';
      else if (cellIndex === 2) align = 'left';
      else if (cellIndex === 3) align = 'left';
      if (cellIndex >= 4 && cellIndex <= 7) {
        if (cell && cell !== 'N/A') {
          const numValue = parseFloat(cell.replace(/[₹,Rs\s]/g, '') || 0);

          cell = formatIndianCurrency(numValue);
        }
        doc.font('Helvetica-Bold');
      } else doc.font('Helvetica');
      if (cellIndex === 8) {
        if (cell === 'Delivered') doc.fillColor('#27ae60');
        else if (cell === 'Returned') doc.fillColor('#e74c3c');
        else doc.fillColor('#2c3e50');
      } else doc.fillColor('#2c3e50');
      doc.text(String(cell || ''), currentX + 8, currentY + 10, { width: colWidths[cellIndex] - 16, align: align, ellipsis: true });
      currentX += colWidths[cellIndex];
    });
    currentY += rowHeight;
  });

  const footerY = currentY + 30;
  doc.rect(startX, footerY - 10, tableWidth, 40).fill('#f8f9fa').stroke('#e0e0e0');
  doc.fillColor('#7f8c8d').fontSize(9).font('Helvetica').text('© BookHorizon Sales System - Confidential Report', startX + 20, footerY).text(`Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, startX + 20, footerY + 15);
  doc.fillColor('#2c3e50').fontSize(8).font('Helvetica-Bold').text(`Total Records: ${data.length}`, tableWidth - 120, footerY);

  return currentY;
};







const getSalesReportPage = async (req, res) => {
  try {
    const { filter, startDate, endDate, status, page = 1 } = req.query;
    let dateFilter = {};

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;

    if (filter === "daily") {
      const today = new Date(now.getTime() + istOffset);
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      dateFilter.createdOn = { $gte: new Date(startOfDay.getTime() - istOffset), $lte: new Date(endOfDay.getTime() - istOffset) };

    } else if (filter === "weekly") {
      const today = new Date(now.getTime() + istOffset);
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      dateFilter.createdOn = { $gte: new Date(startOfWeek.getTime() - istOffset), $lte: new Date(endOfWeek.getTime() - istOffset) };

    } else if (filter === "monthly") {
      const today = new Date(now.getTime() + istOffset);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      dateFilter.createdOn = { $gte: new Date(startOfMonth.getTime() - istOffset), $lte: new Date(endOfMonth.getTime() - istOffset) };

    } else if (filter === "yearly") {
      const today = new Date(now.getTime() + istOffset);
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
      dateFilter.createdOn = { $gte: new Date(startOfYear.getTime() - istOffset), $lte: new Date(endOfYear.getTime() - istOffset) };

    } else if (filter === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.createdOn = { $gte: start, $lte: end };
    }

    const statusFilter = status ? { status: { $in: status.split(",") } } : {};

    const limit = 10; 
    const currentPage = parseInt(page) || 1;

    const totalOrders = await Order.countDocuments({
      ...dateFilter,
      ...statusFilter,
    });

    const orders = await Order.find({
      ...dateFilter,
      ...statusFilter,
    })
      .populate("orderedItems.product")
      .populate("user")
      .sort({ createdOn: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit)
      .lean();

    const allOrders = await Order.find({ ...dateFilter, ...statusFilter }).lean();

    const totalSalesCount = totalOrders;
    const totalOrderAmount = allOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const totalDiscount = allOrders.reduce(
      (sum, order) => sum + ((order.discount || 0) + (order.couponDiscount || 0)),
      0
    );
    const totalCouponDiscount = allOrders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);

    const summary = {
      totalSalesCount,
      totalOrderAmount,
      totalDiscount,
      totalCouponDiscount,
    };

    res.render("salesReport", {
      orders,
      summary,
      filter: filter || "",
      startDate,
      endDate,
      formatIndianCurrency,
      status: status || "",
      currentPage,
      totalPages: Math.ceil(totalOrders / limit),
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res.render("salesReport", {
      orders: [],
      summary: { totalSalesCount: 0, totalOrderAmount: 0, totalDiscount: 0, totalCouponDiscount: 0 },
      filter: "",
      startDate: "",
      endDate: "",
      error: "Failed to generate sales report",
      formatIndianCurrency,
      status: "",
      currentPage: 1,
      totalPages: 1,
    });
  }
};
 

const downloadSalesReport = async (req, res) => {
  try {
    const { filter, startDate, endDate, format, status } = req.query;
    const now = new Date();
    let dateFilter = {};

    if (filter === "daily") {
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; 
      const istDate = new Date(today.getTime() + istOffset);
      
      const startOfDay = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate());
      const endOfDay = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate(), 23, 59, 59, 999);
      
      const startUTC = new Date(startOfDay.getTime() - istOffset);
      const endUTC = new Date(endOfDay.getTime() - istOffset);
      
      dateFilter.createdOn = { $gte: startUTC, $lte: endUTC };
    } else if (filter === "weekly") {
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(today.getTime() + istOffset);
      
      const startOfWeek = new Date(istDate);
      startOfWeek.setDate(istDate.getDate() - istDate.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      const startUTC = new Date(startOfWeek.getTime() - istOffset);
      const endUTC = new Date(endOfWeek.getTime() - istOffset);
      
      dateFilter.createdOn = { $gte: startUTC, $lte: endUTC };
    } else if (filter === "monthly") {
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(today.getTime() + istOffset);
      
      const startOfMonth = new Date(istDate.getFullYear(), istDate.getMonth(), 1);
      const endOfMonth = new Date(istDate.getFullYear(), istDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const startUTC = new Date(startOfMonth.getTime() - istOffset);
      const endUTC = new Date(endOfMonth.getTime() - istOffset);
      
      dateFilter.createdOn = { $gte: startUTC, $lte: endUTC };
    } else if (filter === "yearly") {
      const today = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(today.getTime() + istOffset);
      
      const startOfYear = new Date(istDate.getFullYear(), 0, 1);
      const endOfYear = new Date(istDate.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      const startUTC = new Date(startOfYear.getTime() - istOffset);
      const endUTC = new Date(endOfYear.getTime() - istOffset);
      
      dateFilter.createdOn = { $gte: startUTC, $lte: endUTC };
    } else if (filter === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      dateFilter.createdOn = { $gte: start, $lte: end };
    }

    const statusFilter = status ? { status: { $in: status.split(',') } } : {};
    const orders = await Order.find({ ...dateFilter, ...statusFilter })
      .populate("user")
      .populate("orderedItems.product")
      .sort({ createdOn: -1 }) 
      .lean()
      
      
    const allOrders = await Order.find({ ...dateFilter, ...statusFilter }).lean();
    const totalSalesCount = await Order.countDocuments({ ...dateFilter, ...statusFilter });
    const totalOrderAmount = allOrders.reduce((sum, order) => sum + (order.finalAmount || 0), 0);
    const totalDiscount = allOrders.reduce((sum, order) => sum + ((order.discount || 0) + (order.couponDiscount || 0)), 0);
    const totalCouponDiscount = allOrders.reduce((sum, order) => sum + (order.couponDiscount || 0), 0);
    const summary = { totalSalesCount, totalOrderAmount, totalDiscount, totalCouponDiscount };

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'portrait' });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=BookHorizon-Sales-Report-${new Date().toISOString().split('T')[0]}.pdf`);
      doc.pipe(res);

      const headers = ['Order ID', 'Date', 'Customer', 'Items', 'Amount'];
      const colWidths = [80, 75, 95, 135, 75];
      
      const tableData = orders.map(order => [
        order.orderId?.substring(0, 8) || 'N/A',
        new Date(order.createdOn).toLocaleDateString('en-IN'),
        order.user?.name || 'N/A',
        (order.orderedItems?.map(item => item.product?.productName || 'N/A').join(', ') || 'N/A').length > 25 ? 
          (order.orderedItems?.map(item => item.product?.productName || 'N/A').join(', ').substring(0, 25) + '...') : 
          (order.orderedItems?.map(item => item.product?.productName || 'N/A').join(', ') || 'N/A'),
        formatIndianCurrency(order.finalAmount || 0)
        
      ]);

      drawTable(doc, tableData, headers, 50, 150, colWidths, {
        summary: summary,
        pageHeight: 842,
        marginBottom: 80
      });

      doc.end();
    } else if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Report");

      worksheet.mergeCells('A1:E2');
      worksheet.getCell('A1').value = 'BookHorizon Sales Report';
      worksheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF2d3748' } };
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFedf2f7' } };

      worksheet.mergeCells('A3:E3');
      worksheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST`;
      worksheet.getCell('A3').font = { size: 11, italic: true, color: { argb: 'FF718096' } };
      worksheet.getCell('A3').alignment = { horizontal: 'center' };

      worksheet.addRow([]);
      if (filter) {
        let filterText = `Period: ${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
        if (filter === 'custom' && startDate && endDate) {
          filterText += ` (${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')})`;
        }
        if (status) filterText += ` | Status: ${status.split(',').join(', ')}`;
        worksheet.mergeCells(`A${worksheet.rowCount + 1}:E${worksheet.rowCount + 1}`);
        worksheet.getCell(`A${worksheet.rowCount}`).value = filterText;
        worksheet.getCell(`A${worksheet.rowCount}`).font = { size: 12, bold: true, color: { argb: 'FF2d3748' } };
        worksheet.getCell(`A${worksheet.rowCount}`).alignment = { horizontal: 'center' };
        worksheet.getCell(`A${worksheet.rowCount}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe6f0fa' } };
      }

      worksheet.addRow([]);
      worksheet.mergeCells(`A${worksheet.rowCount + 1}:E${worksheet.rowCount + 1}`);
      worksheet.getCell(`A${worksheet.rowCount}`).value = 'Summary';
      worksheet.getCell(`A${worksheet.rowCount}`).font = { size: 14, bold: true, color: { argb: 'FF2d3748' } };
      worksheet.getCell(`A${worksheet.rowCount}`).alignment = { horizontal: 'center' };
      worksheet.getCell(`A${worksheet.rowCount}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe2e8f0' } };
      
      worksheet.addRow(['Metric', 'Value']);
      worksheet.addRow(['Total Orders', summary.totalSalesCount]);
      worksheet.addRow(['Total Revenue', formatIndianCurrency(summary.totalOrderAmount)]);
      worksheet.addRow(['Total Discounts', formatIndianCurrency(summary.totalDiscount)]);
      worksheet.addRow(['Net Revenue', formatIndianCurrency(summary.totalOrderAmount - summary.totalDiscount)]);

      const summaryStartRow = worksheet.rowCount - 5;
      worksheet.getRows(summaryStartRow, 6).forEach((row, index) => {
        if (index === 0) {
          row.font = { bold: true, color: { argb: 'FFffffff' } };
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4a5568' } };
        } else {
          row.getCell(1).font = { bold: true, color: { argb: 'FF2d3748' } };
          row.getCell(2).font = { bold: true, color: { argb: 'FF2b6cb0' } };
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf7fafc' } };
        }
        row.alignment = { horizontal: 'center' };
      });

      worksheet.addRow([]);
      worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 18, alignment: { horizontal: 'left' } },
        { header: 'Date', key: 'date', width: 15, alignment: { horizontal: 'center' } },
        { header: 'Customer', key: 'customer', width: 22, alignment: { horizontal: 'left' } },
        { header: 'Items', key: 'items', width: 30, alignment: { horizontal: 'left' } },
        { header: 'Amount', key: 'amount', width: 15, alignment: { horizontal: 'right' } },
      ];

      const headerRow = worksheet.getRow(worksheet.rowCount);
      headerRow.font = { bold: true, color: { argb: 'FFffffff' }, size: 12 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4a5568' } };
      headerRow.alignment = { vertical: 'middle' };
      headerRow.height = 25;

      orders.forEach((order, index) => {
        const itemNames = order.orderedItems?.map(item => item.product?.productName || 'N/A').join(', ') || 'N/A';
        const row = worksheet.addRow({
          orderId: order.orderId || 'N/A',
          date: new Date(order.createdOn).toLocaleDateString('en-IN'),
          customer: order.user?.name || 'N/A',
          items: itemNames.length > 25 ? itemNames.substring(0, 25) + '...' : itemNames,
          amount: formatIndianCurrency(order.finalAmount || 0),
          
        });
        
        row.height = 20;
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        
        if (index % 2 === 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgContent: { argb: 'FFf7fafc' } };
        }
      });

      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = { 
            top: { style: 'thin', color: { argb: 'FFe2e8f0' } }, 
            left: { style: 'thin', color: { argb: 'FFe2e8f0' } }, 
            bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } }, 
            right: { style: 'thin', color: { argb: 'FFe2e8f0' } } 
          };
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=BookHorizon-Sales-Report.xlsx");
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(http.Bad_Request).json({ error: "Unsupported format. Use 'pdf' or 'excel'." });
    }
  } catch (err) {
    console.error("Sales Report Generation Error:", err.message);
    res.status(http.Internal_Server_Error).json({ error: "Failed to generate sales report due to server error. Please try again or contact support." });
  }
};



module.exports = {
  getSalesReportPage,
  downloadSalesReport
};