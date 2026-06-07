/**
 * GCash Contribution Tracking System - Google Apps Script backend
 *
 * Copy this entire file into Google Sheets > Extensions > Apps Script.
 * Then run setupContributionTracker() once and deploy as a Web App if you
 * want Google Sheets/Drive handled directly by Apps Script.
 */

const CONFIG = {
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

  if (paymentsSheet.getLastRow() === 0) {
    paymentsSheet.getRange(1, 1, 1, 8).setValues([[
      'Timestamp', 'MemberName', 'DueDate', 'AmountPaid', 'ReferenceNumber', 'ReceiptLink', 'Status', 'Verified',
    ]]);
  } else {
    paymentsSheet.getRange(1, 1, 1, 8).setValues([[
      'Timestamp', 'MemberName', 'DueDate', 'AmountPaid', 'ReferenceNumber', 'ReceiptLink', 'Status', 'Verified',
    ]]);
  }
  paymentsSheet.autoResizeColumns(1, 8);

  const rootFolder = ensureFolder_(CONFIG.rootFolderName);
  CONFIG.members.forEach(function (member) {
    ensureFolder_(member[1], rootFolder);
  });

  return {
    message: 'GCash tracker setup completed.',
    spreadsheetId: spreadsheet.getId(),
    rootFolderUrl: rootFolder.getUrl(),
  };
}

function doGet(event) {
  const action = event && event.parameter && event.parameter.action ? event.parameter.action : 'dashboard';

  if (action === 'setup') {
    return json_(setupContributionTracker());
  }

  if (action === 'receipts') {
    return json_({ receipts: getPayments_().filter(function (payment) { return payment.receiptLink; }) });
  }

  return json_(getDashboardData_());
}

function doPost(event) {
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
}

function submitPayment_(payload) {
  validatePaymentPayload_(payload);

  const receiptLink = payload.receiptLink || saveReceipt_(payload);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheets.payments);
  sheet.appendRow([
    new Date(),
    payload.memberName,
    payload.dueDate,
    Number(payload.amountPaid),
    String(payload.referenceNumber),
    receiptLink,
    'Paid',
    payload.verified === true ? 'Yes' : 'No',
  ]);

  return {
    message: 'Payment saved successfully.',
    payment: {
      timestamp: new Date().toISOString(),
      memberName: payload.memberName,
      dueDate: payload.dueDate,
      amountPaid: Number(payload.amountPaid),
      referenceNumber: String(payload.referenceNumber),
      receiptLink: receiptLink,
      status: 'Paid',
    },
    dashboard: getDashboardData_(),
  };
}

function saveReceipt_(payload) {
  if (!payload.fileBase64 || !payload.mimeType) {
    throw new Error('Receipt upload requires fileBase64 and mimeType, or provide receiptLink.');
  }

  const rootFolder = ensureFolder_(CONFIG.rootFolderName);
  const memberFolder = ensureFolder_(payload.memberName, rootFolder);
  const extension = getExtension_(payload.fileName, payload.mimeType);
  const safeFileName = compactName_(payload.memberName) + '_' + payload.dueDate + '.' + extension;
  const bytes = Utilities.base64Decode(stripBase64Prefix_(payload.fileBase64));
  const blob = Utilities.newBlob(bytes, payload.mimeType, safeFileName);
  const file = memberFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function verifyPayment_(referenceNumber, dueDate, memberName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheets.payments);
  const values = sheet.getDataRange().getValues();

  for (var row = 1; row < values.length; row += 1) {
    const matchesReference = String(values[row][4]) === String(referenceNumber);
    const matchesDate = !dueDate || formatDate_(values[row][2]) === String(dueDate);
    const matchesMember = !memberName || String(values[row][1]) === String(memberName);

    if (matchesReference && matchesDate && matchesMember) {
      sheet.getRange(row + 1, 7).setValue('Paid');
      sheet.getRange(row + 1, 8).setValue('Yes');
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheets.payments);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 8).getValues().filter(function (row) {
    return row[1] && row[2] && row[4];
  }).map(function (row) {
    return {
      timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
      memberName: String(row[1]),
      dueDate: formatDate_(row[2]),
      amountPaid: Number(row[3]),
      referenceNumber: String(row[4]),
      receiptLink: String(row[5] || ''),
      status: String(row[6] || 'Paid'),
      verified: String(row[7] || 'No'),
    };
  });
}

function validatePaymentPayload_(payload) {
  const required = ['memberName', 'dueDate', 'amountPaid', 'referenceNumber'];
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

function compactName_(value) {
  return String(value).replace(/[^a-zA-Z0-9]/g, '');
}

function formatDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

function json_(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode && output.setStatusCode) output.setStatusCode(statusCode);
  return output;
}

function showDashboardJson() {
  SpreadsheetApp.getUi().alert(JSON.stringify(getDashboardData_(), null, 2).slice(0, 8000));
}
