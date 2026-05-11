/**
 * Vita Modular — Quotation Tracker Apps Script
 * ============================================
 *
 * Deployed as a Google Apps Script Web App, this script:
 *
 *   POST  →  Appends a quote row to the master tracker sheet (called by the
 *            customer quotation form and the sales admin tool).
 *
 *   GET   →  Returns all rows as JSON (called by the Project Contract Hub
 *            so it can sync quotes into project records).
 *
 * SETUP
 * -----
 * 1. Open https://script.google.com → New project → paste this whole file.
 * 2. Set SHEET_ID below to your master tracker spreadsheet ID
 *    (the long string in the spreadsheet URL between /d/ and /edit).
 * 3. Set NOTIFICATION_EMAIL to the address that should receive a copy
 *    of every new quote (or set to '' to disable email notifications).
 * 4. Deploy → New deployment → Type: Web app
 *      • Execute as: Me
 *      • Who has access: Anyone
 *    Copy the deployed URL — paste it into TRACKER_URL in:
 *      • vita_modular_quotation_form.html
 *      • vita_modular_sales_admin.html
 *      • vita_modular_contract_hub.html  (HUB_TRACKER_URL constant)
 * 5. Whenever you change this script, click "Deploy → Manage deployments
 *    → edit (pencil) → Version: New version → Deploy" so the hub and forms
 *    pick up the change. Re-using the same deployment keeps the URL stable.
 */

// ─── CONFIGURE THESE ──────────────────────────────────────────────────────
var SHEET_ID            = 'YOUR_SHEET_ID_HERE';
var SHEET_NAME          = 'Quotations';                  // tab name within the spreadsheet
var NOTIFICATION_EMAIL  = 'sales@vita-modular.co.uk';    // set to '' to disable
var COMPANY_NAME        = 'Vita Modular';

// Column order in the sheet — must match HEADER_ROW exactly. If you add a
// column, add it here AND in HEADER_ROW below.
var HEADER_ROW = [
  'Timestamp',     // A
  'Reference',     // B
  'Quote Date',    // C
  'Source',        // D  (Web Form / Sales Admin Tool)
  'Client Name',   // E
  'Email',         // F
  'Phone',         // G
  'Address',       // H
  'Extension Type',// I
  'Finish',        // J
  'Area (m²)',     // K
  'Rate £/m²',     // L
  'Base £',        // M
  'Ancillary £',   // N
  'Grand Total £', // O
  'Ancillary Items (JSON)', // P
  'Notes',         // Q
];

// ═════════════════════════════════════════════════════════════════════════
// POST — append a quote row
// ═════════════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getOrCreateSheet_();

    var ancJson = '';
    try { ancJson = JSON.stringify(data.ancItems || []); } catch (er) { ancJson = ''; }

    var row = [
      new Date(),                       // Timestamp
      data.ref || '',                   // Reference
      data.date || '',                  // Quote Date (DD/MM/YYYY string from form)
      data.source || 'Web Form',        // Source
      data.name || '',                  // Client Name
      data.email || '',                 // Email
      data.phone || '',                 // Phone
      data.address || '',               // Address
      data.extType || '',               // Extension Type
      data.finish || '',                // Finish
      Number(data.area) || 0,           // Area
      Number(data.rate) || 0,           // Rate
      Number(data.base) || 0,           // Base
      Number(data.ancTotal) || 0,       // Ancillary Total
      Number(data.grandTotal) || 0,     // Grand Total
      ancJson,                          // Ancillary Items as JSON
      data.notes || '',                 // Notes
    ];
    sheet.appendRow(row);

    // Notify
    if (NOTIFICATION_EMAIL) {
      try { sendNotification_(data); } catch (er) { /* non-critical */ }
    }

    return jsonResponse_({ ok: true, ref: data.ref });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

// ═════════════════════════════════════════════════════════════════════════
// GET — return all rows as JSON for the Project Contract Hub
// ═════════════════════════════════════════════════════════════════════════
//   GET ?since=<ISO-timestamp>     only rows with Timestamp newer than this
//   GET ?ref=<reference>           only the row with this exact reference
//   GET                            all rows
function doGet(e) {
  try {
    var sheet = getOrCreateSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return jsonResponse_({ ok: true, quotes: [] });

    var headers = values[0];
    var rows = values.slice(1);

    var since = (e && e.parameter && e.parameter.since) ? new Date(e.parameter.since) : null;
    var refFilter = (e && e.parameter && e.parameter.ref) ? String(e.parameter.ref).trim() : '';

    var quotes = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
      if (since && ts < since) continue;

      var ref = String(r[1] || '').trim();
      if (refFilter && ref !== refFilter) continue;
      if (!ref) continue;  // skip rows without a reference

      var ancItems = [];
      var ancRaw = r[15];
      if (ancRaw) {
        try { ancItems = JSON.parse(ancRaw); }
        catch (er) { ancItems = []; }
      }

      quotes.push({
        timestamp:  ts.toISOString(),
        ref:        ref,
        date:       String(r[2] || ''),
        source:     String(r[3] || ''),
        name:       String(r[4] || ''),
        email:      String(r[5] || ''),
        phone:      String(r[6] || ''),
        address:    String(r[7] || ''),
        extType:    String(r[8] || ''),
        finish:     String(r[9] || ''),
        area:       Number(r[10]) || 0,
        rate:       Number(r[11]) || 0,
        base:       Number(r[12]) || 0,
        ancTotal:   Number(r[13]) || 0,
        grandTotal: Number(r[14]) || 0,
        ancItems:   ancItems,
        notes:      String(r[16] || ''),
      });
    }

    // Most recent first
    quotes.sort(function (a, b) { return (a.timestamp < b.timestamp) ? 1 : -1; });

    return jsonResponse_({ ok: true, count: quotes.length, quotes: quotes });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════
function getOrCreateSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Ensure header row is correct
  var firstRow = sheet.getRange(1, 1, 1, HEADER_ROW.length).getValues()[0];
  var headerMatches = firstRow.length === HEADER_ROW.length &&
                      firstRow.every(function (v, i) { return v === HEADER_ROW[i]; });
  if (!headerMatches) {
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.getRange(1, 1, 1, HEADER_ROW.length)
         .setFontWeight('bold')
         .setBackground('#1a7a6e')
         .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendNotification_(d) {
  var ancList = '';
  if (d.ancItems && d.ancItems.length) {
    ancList = d.ancItems.map(function (a) { return '  • ' + a.name + ' — £' + Number(a.price).toLocaleString('en-GB'); }).join('\n');
  }
  var body =
    'New quote logged on the master tracker.\n\n' +
    'Reference:    ' + (d.ref || '—') + '\n' +
    'Source:       ' + (d.source || 'Web Form') + '\n' +
    'Date:         ' + (d.date || '—') + '\n' +
    'Client:       ' + (d.name || '—') + '\n' +
    'Email:        ' + (d.email || '—') + '\n' +
    'Phone:        ' + (d.phone || '—') + '\n' +
    'Address:      ' + (d.address || '—') + '\n' +
    'Extension:    ' + (d.extType || '—') + (d.area ? ' · ' + d.area + 'm²' : '') + '\n' +
    'Grand total:  £' + (Number(d.grandTotal) || 0).toLocaleString('en-GB') + '\n' +
    (ancList ? '\nAncillary items:\n' + ancList + '\n' : '') +
    (d.notes ? '\nNotes:\n' + d.notes + '\n' : '');
  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: '[' + COMPANY_NAME + '] New quote: ' + (d.ref || '') + ' · ' + (d.name || ''),
    body: body,
  });
}
