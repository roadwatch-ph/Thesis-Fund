/**
 * GCash Contribution Tracking System - Google Apps Script backend
 *
 * Copy this entire file into Google Sheets > Extensions > Apps Script.
 * Then run setupContributionTracker() once and deploy as a Web App if you
 * want Google Sheets/Drive handled directly by Apps Script.
 */

const CONFIG = {
  rootFolderId: '1JU78o8NGnt-YrBp_7iR7d3WIEbx2AceL',
  rootFolderName: 'Payment Receipts',
  sheets: {
    members: 'Members',
    schedule: 'Schedule',
    payments: 'Payments',
  },
  members: [
    ['M001', 'Jhon Lenard Dimaano', 100],
    ['M002', 'Prince Johnel Abe', 100],
    ['M003', 'Michael Orilla', 100],
    ['M004', 'Carmela Elaine Agrao', 100],
    ['M005', 'Darlene Grace Villanueva', 100],
  ],
  paymentHeaders: ['Timestamp', 'Member', 'Due Date', 'Payment Method', 'Amount Paid', 'Reference Number', 'Notes', 'Receipt File Name', 'Receipt Link', 'Drive File ID', 'Status'],
  dueDates: [
    '2026-06-07', '2026-06-14', '2026-06-21', '2026-06-28', '2026-07-05', '2026-07-12',
    '2026-07-19', '2026-07-26', '2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23',
    '2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04',
    '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15',
    '2026-11-22', '2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27',
  ],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GCash Tracker')
    .addItem('Setup sheets and folders', 'setupContributionTracker')
    .addItem('Open dashboard JSON', 'showDashboardJson')
    .addToUi();
}

function setupContributionTracker() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ensureSheet_(spreadsheet, CONFIG.sheets.members);
  const scheduleSheet = ensureSheet_(spreadsheet, CONFIG.sheets.schedule);
  const paymentsSheet = ensureSheet_(spreadsheet, CONFIG.sheets.payments);

  membersSheet.clear();
  membersSheet.getRange(1, 1, 1, 3).setValues([['MemberID', 'MemberName', 'WeeklyContribution']]);
  membersSheet.getRange(2, 1, CONFIG.members.length, 3).setValues(CONFIG.members);
  membersSheet.autoResizeColumns(1, 3);

  scheduleSheet.clear();
  scheduleSheet.getRange(1, 1).setValue('DueDate');
  scheduleSheet.getRange(2, 1, CONFIG.dueDates.length, 1).setValues(CONFIG.dueDates.map(function (date) { return [date]; }));
  scheduleSheet.autoResizeColumn(1);

  const existingPaymentRows = getExistingPaymentRows_(paymentsSheet);
  paymentsSheet.clear();
  paymentsSheet.getRange(1, 1, 1, CONFIG.paymentHeaders.length).setValues([CONFIG.paymentHeaders]);
  if (existingPaymentRows.length > 0) {
    paymentsSheet.getRange(2, 1, existingPaymentRows.length, CONFIG.paymentHeaders.length).setValues(existingPaymentRows);
  }
  paymentsSheet.autoResizeColumns(1, CONFIG.paymentHeaders.length);

  const rootFolder = getReceiptsRootFolder_();
  CONFIG.members.forEach(function (member) {
    ensureFolder_(member[1], rootFolder);
  });

  return {
    message: 'GCash tracker setup completed.',
    spreadsheetId: spreadsheet.getId(),
    rootFolderUrl: rootFolder.getUrl(),
  };
}

function getExistingPaymentRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return normalizeHeader_(header); });

  return values.slice(1).map(function (row) {
    const payment = paymentFromRow_(row, headers);
    return paymentToRow_(payment);
  }).filter(function (row) {
    return row[1] && row[2] && row[5];
  });
}

function normalizeHeader_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function doGet(event) {
  const action = event && event.parameter && event.parameter.action ? event.parameter.action : 'dashboard';
  const callback = getJsonpCallback_(event);

  if (action === 'setup') {
    return json_(setupContributionTracker(), null, callback);
  }

  if (action === 'receipts') {
    return json_({ receipts: getPayments_().filter(function (payment) { return payment.receiptLink; }) }, null, callback);
  }

  if (action === 'verifyPayment') {
    const params = event && event.parameter ? event.parameter : {};
    try {
      return json_(verifyPayment_(params.referenceNumber, params.dueDate, params.memberName), null, callback);
    } catch (error) {
      return json_({ verified: false, message: error.message }, null, callback);
    }
  }

  return json_(getDashboardData_(), null, callback);
}

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    const action = payload.action || 'submitPayment';

    if (action === 'setup') {
      return json_(setupContributionTracker());
    }

    if (action === 'verifyPayment') {
      return json_(verifyPayment_(payload.referenceNumber, payload.dueDate, payload.memberName));
    }

    if (action === 'submitPayment') {
      return json_(submitPayment_(payload));
    }

    return json_({ error: 'Unknown action: ' + action }, 400);
  } catch (error) {
    return json_({ error: error.message || 'Unable to process request.' }, 500);
  }
}

function submitPayment_(payload) {
  validatePaymentPayload_(payload);

  const referenceNumber = normalizeReferenceNumber_(payload.referenceNumber);
  const receipt = payload.receiptLink ? {
    id: String(payload.receiptFileId || ''),
    name: String(payload.receiptFileName || payload.fileName || ''),
    link: String(payload.receiptLink),
  } : saveReceipt_(payload);
  const payment = {
    timestamp: new Date().toISOString(),
    memberName: payload.memberName,
    dueDate: payload.dueDate,
    paymentMethod: payload.paymentMethod,
    amountPaid: Number(payload.amountPaid),
    referenceNumber: referenceNumber,
    notes: String(payload.notes || ''),
    receiptFileName: receipt.name,
    receiptFileId: receipt.id,
    receiptLink: receipt.link,
    status: 'Paid',
  };
  const sheet = ensurePaymentSheet_();
  sheet.appendRow(paymentToRow_(payment));

  return {
    message: 'Payment saved successfully.',
    payment: payment,
    dashboard: getDashboardData_(),
  };
}

function saveReceipt_(payload) {
  if (!payload.fileBase64 || !payload.mimeType) {
    throw new Error('Receipt upload requires fileBase64 and mimeType, or provide receiptLink.');
  }

  const rootFolder = getReceiptsRootFolder_();
  const memberFolder = ensureFolder_(payload.memberName, rootFolder);
  const extension = getExtension_(payload.fileName, payload.mimeType);
  const safeFileName = buildReceiptFileName_(payload.memberName, payload.dueDate, extension);
  const bytes = Utilities.base64Decode(stripBase64Prefix_(payload.fileBase64));
  const blob = Utilities.newBlob(bytes, payload.mimeType, safeFileName);
  const file = memberFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId(), name: safeFileName, link: file.getUrl() };
}

function verifyPayment_(referenceNumber, dueDate, memberName) {
  const sheet = ensurePaymentSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return normalizeHeader_(header); });
  const normalizedReference = normalizeReferenceNumber_(referenceNumber);
  const shouldMatchReference = normalizedReference !== 'Not provided';

  for (var row = 1; row < values.length; row += 1) {
    const payment = paymentFromRow_(values[row], headers);
    const matchesReference = !shouldMatchReference || String(payment.referenceNumber) === normalizedReference;
    const matchesDate = !dueDate || payment.dueDate === String(dueDate);
    const matchesMember = !memberName || payment.memberName === String(memberName);

    if (matchesReference && matchesDate && matchesMember) {
      return { message: 'Payment verified.', row: row + 1 };
    }
  }

  throw new Error('Payment not found for verification.');
}

function getDashboardData_() {
  const members = getMembers_();
  const dueDates = getDueDates_();
  const payments = getPayments_();
  const currentDueDate = getCurrentDueDate_(dueDates);
  const paymentKeys = payments.reduce(function (map, payment) {
    if (payment.status === 'Paid') {
      map[payment.memberName + ':' + payment.dueDate] = true;
    }
    return map;
  }, {});

  const weeklyStatuses = {};
  members.forEach(function (member) {
    weeklyStatuses[member.name] = {};
    dueDates.forEach(function (dueDate) {
      const key = member.name + ':' + dueDate;
      weeklyStatuses[member.name][dueDate] = paymentKeys[key] ? 'Paid' : dueDate < currentDueDate ? 'Missing' : 'Pending';
    });
  });

  const summaries = members.map(function (member) {
    const memberPayments = payments.filter(function (payment) {
      return payment.memberName === member.name && payment.status === 'Paid';
    });
    const paidDateMap = memberPayments.reduce(function (map, payment) {
      map[payment.dueDate] = true;
      return map;
    }, {});
    const paidWeeks = Object.keys(paidDateMap).length;
    const totalContribution = memberPayments.reduce(function (sum, payment) { return sum + Number(payment.amountPaid || 0); }, 0);
    const lastPaymentDate = Object.keys(paidDateMap).sort().pop() || null;
    const nextDueDate = dueDates.filter(function (dueDate) { return !paidDateMap[dueDate]; })[0] || null;
    const expectedForMember = dueDates.length * Number(member.weeklyContribution);

    return {
      member: member,
      totalContribution: totalContribution,
      paidWeeks: paidWeeks,
      remainingBalance: Math.max(expectedForMember - totalContribution, 0),
      lastPaymentDate: lastPaymentDate,
      nextDueDate: nextDueDate,
      progress: Math.round((paidWeeks / dueDates.length) * 1000) / 10,
    };
  });

  const expectedCollection = members.reduce(function (sum, member) {
    return sum + Number(member.weeklyContribution) * dueDates.length;
  }, 0);
  const collectedAmount = payments.reduce(function (sum, payment) {
    return payment.status === 'Paid' ? sum + Number(payment.amountPaid || 0) : sum;
  }, 0);
  const paidThisWeek = members.filter(function (member) {
    return weeklyStatuses[member.name][currentDueDate] === 'Paid';
  }).length;
  const missingPayments = members.reduce(function (sum, member) {
    return sum + Object.keys(weeklyStatuses[member.name]).filter(function (dueDate) {
      return weeklyStatuses[member.name][dueDate] === 'Missing';
    }).length;
  }, 0);

  return {
    members: members,
    dueDates: dueDates,
    payments: payments,
    summaries: summaries,
    weeklyStatuses: weeklyStatuses,
    totals: {
      totalMembers: members.length,
      paidThisWeek: paidThisWeek,
      pendingThisWeek: members.length - paidThisWeek,
      missingPayments: missingPayments,
      expectedCollection: expectedCollection,
      collectedAmount: collectedAmount,
      remainingAmount: expectedCollection - collectedAmount,
      collectionPercentage: expectedCollection ? Math.round((collectedAmount / expectedCollection) * 1000) / 10 : 0,
      currentDueDate: currentDueDate,
    },
  };
}

function getMembers_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheets.members);
  const values = sheet.getDataRange().getValues().slice(1);
  return values.filter(function (row) { return row[0] && row[1]; }).map(function (row) {
    return { id: String(row[0]), name: String(row[1]), weeklyContribution: Number(row[2]) };
  });
}

function getDueDates_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheets.schedule);
  return sheet.getDataRange().getValues().slice(1).filter(function (row) { return row[0]; }).map(function (row) {
    return formatDate_(row[0]);
  });
}

function getPayments_() {
  const sheet = ensurePaymentSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return normalizeHeader_(header); });
  return values.slice(1).map(function (row) {
    return paymentFromRow_(row, headers);
  }).filter(function (payment) {
    return payment.memberName && payment.dueDate && payment.referenceNumber;
  });
}

function paymentFromRow_(row, headers) {
  const hasDetailedHeaders = headers.indexOf('timestamp') !== -1 && (headers.indexOf('receiptlink') !== -1 || headers.indexOf('receipt') !== -1);
  if (hasDetailedHeaders) {
    return {
      timestamp: String(getCell_(row, headers, 'timestamp', 0) || new Date().toISOString()),
      memberName: String(getCell_(row, headers, 'member', 1) || getCell_(row, headers, 'membername', 1) || ''),
      dueDate: formatDate_(getCell_(row, headers, 'duedate', 2) || ''),
      paymentMethod: String(getCell_(row, headers, 'paymentmethod', 3) || ''),
      amountPaid: Number(getCell_(row, headers, 'amountpaid', 4) || 0),
      referenceNumber: String(getCell_(row, headers, 'referencenumber', 5) || ''),
      notes: String(getCell_(row, headers, 'notes', 6) || ''),
      receiptFileName: String(getCell_(row, headers, 'receiptfilename', 7) || ''),
      receiptLink: String(getCell_(row, headers, 'receiptlink', 8) || getCell_(row, headers, 'receipt', 8) || ''),
      receiptFileId: String(getCell_(row, headers, 'drivefileid', 9) || getCell_(row, headers, 'receiptfileid', 9) || ''),
      status: normalizePaymentStatus_(getCell_(row, headers, 'status', 10)),
    };
  }

  return {
    timestamp: formatDate_(row[1]),
    memberName: String(row[0] || ''),
    dueDate: formatDate_(row[1]),
    paymentMethod: String(row[2] || ''),
    amountPaid: Number(row[3] || 0),
    referenceNumber: String(row[4] || ''),
    notes: '',
    receiptFileName: '',
    receiptLink: String(row[5] || ''),
    receiptFileId: '',
    status: 'Paid',
  };
}

function paymentToRow_(payment) {
  return [
    payment.timestamp,
    payment.memberName,
    payment.dueDate,
    payment.paymentMethod,
    Number(payment.amountPaid || 0),
    String(payment.referenceNumber || ''),
    String(payment.notes || ''),
    String(payment.receiptFileName || ''),
    String(payment.receiptLink || ''),
    String(payment.receiptFileId || ''),
    normalizePaymentStatus_(payment.status),
  ];
}

function getCell_(row, headers, headerName, fallbackIndex) {
  const index = headers.indexOf(headerName);
  return row[index >= 0 ? index : fallbackIndex];
}

function normalizePaymentStatus_(status) {
  const value = String(status || 'Paid');
  return ['Paid', 'Pending', 'Missing'].indexOf(value) !== -1 ? value : 'Paid';
}

function validatePaymentPayload_(payload) {
  const required = ['memberName', 'dueDate', 'paymentMethod', 'amountPaid'];
  required.forEach(function (field) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      throw new Error('Missing required field: ' + field);
    }
  });

  const memberNames = CONFIG.members.map(function (member) { return member[1]; });
  if (memberNames.indexOf(payload.memberName) === -1) {
    throw new Error('Unknown memberName: ' + payload.memberName);
  }

  if (CONFIG.dueDates.indexOf(payload.dueDate) === -1) {
    throw new Error('Invalid dueDate: ' + payload.dueDate);
  }
}

function ensurePaymentSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureSheet_(spreadsheet, CONFIG.sheets.payments);
  const existingPaymentRows = getExistingPaymentRows_(sheet);
  const firstRow = sheet.getLastRow() >= 1 ? sheet.getRange(1, 1, 1, CONFIG.paymentHeaders.length).getValues()[0] : [];
  const currentHeaders = firstRow.map(function (header) { return normalizeHeader_(header); });
  const desiredHeaders = CONFIG.paymentHeaders.map(function (header) { return normalizeHeader_(header); });
  const headersAreCurrent = desiredHeaders.every(function (header, index) { return currentHeaders[index] === header; });

  if (!headersAreCurrent) {
    sheet.clear();
    sheet.getRange(1, 1, 1, CONFIG.paymentHeaders.length).setValues([CONFIG.paymentHeaders]);
    if (existingPaymentRows.length > 0) {
      sheet.getRange(2, 1, existingPaymentRows.length, CONFIG.paymentHeaders.length).setValues(existingPaymentRows);
    }
    sheet.autoResizeColumns(1, CONFIG.paymentHeaders.length);
  }

  return sheet;
}

function normalizeReferenceNumber_(referenceNumber) {
  const value = String(referenceNumber || '').trim();
  return value || 'Not provided';
}

function parsePayload_(event) {
  if (!event || !event.postData || !event.postData.contents) return {};
  return JSON.parse(event.postData.contents);
}

function ensureSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureFolder_(folderName, parentFolder) {
  const folders = parentFolder ? parentFolder.getFoldersByName(folderName) : DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parentFolder ? parentFolder.createFolder(folderName) : DriveApp.createFolder(folderName);
}

function getReceiptsRootFolder_() {
  if (CONFIG.rootFolderId) {
    return DriveApp.getFolderById(CONFIG.rootFolderId);
  }
  return ensureFolder_(CONFIG.rootFolderName);
}

function getCurrentDueDate_(dueDates) {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const upcoming = dueDates.filter(function (dueDate) { return dueDate >= today; });
  return upcoming.length ? upcoming[0] : dueDates[dueDates.length - 1];
}

function getExtension_(fileName, mimeType) {
  if (fileName && fileName.indexOf('.') !== -1) {
    return fileName.split('.').pop().toLowerCase();
  }
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'application/pdf': 'pdf',
  };
  return mimeMap[mimeType] || 'jpg';
}

function stripBase64Prefix_(value) {
  return String(value).replace(/^data:[^;]+;base64,/, '');
}

function buildReceiptFileName_(memberName, dueDate, extension) {
  return sanitizeDriveFileName_(memberName) + '_' + String(dueDate) + '.' + extension;
}

function sanitizeDriveFileName_(value) {
  return String(value).trim().replace(/[\\/]/g, '-').replace(/\s+/g, ' ');
}

function formatDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

function getJsonpCallback_(event) {
  const callback = event && event.parameter && event.parameter.callback ? String(event.parameter.callback) : '';
  return /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback) ? callback : '';
}

function json_(payload, statusCode, callback) {
  const body = callback ? callback + '(' + JSON.stringify(payload) + ');' : JSON.stringify(payload);
  const output = ContentService.createTextOutput(body);
  output.setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  if (statusCode && output.setStatusCode) output.setStatusCode(statusCode);
  return output;
}

function showDashboardJson() {
  SpreadsheetApp.getUi().alert(JSON.stringify(getDashboardData_(), null, 2).slice(0, 8000));
}
