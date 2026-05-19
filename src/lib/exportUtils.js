// ─────────────────────────────────────────────────────────────
// exportUtils.js
// Client-side Excel (.xlsx) and PDF (print) export
// Uses SheetJS (xlsx) — already available in the project
// ─────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx'

function formatRp(amount) {
  return Math.round(amount).toLocaleString('id-ID')
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
]

// ─────────────────────────────────────────────────────────────
// EXCEL EXPORT
// Generates a .xlsx with 3 sheets:
//   1. Transactions  — full order list
//   2. Daily Summary — revenue grouped by day
//   3. Products      — items sold ranked by revenue
// ─────────────────────────────────────────────────────────────
export function exportExcel({ orders, storeName, storeCode, month, year }) {
  const periodLabel = `${MONTHS[month]} ${year}`
  const completed   = orders.filter(o => o.status === 'completed')

  // ── Sheet 1: Transactions ────────────────────────────────
  const txRows = orders.map(o => ({
    'Receipt No.':    o.order_number,
    'Date':           formatDate(o.created_at),
    'Time':           new Date(o.created_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }),
    'Cashier':        o.users?.full_name || '—',
    'Items':          (o.order_items || []).length,
    'Total (Rp)':     Math.round(o.total),
    'Payment':        o.payment_method === 'qris' ? 'QRIS' : 'Cash',
    'Cash Received':  o.payment_method === 'cash' ? Math.round(o.cash_received || 0) : '',
    'Change':         o.payment_method === 'cash' ? Math.round(o.change_amount || 0) : '',
    'Status':         o.status,
  }))

  const txSheet = XLSX.utils.json_to_sheet(txRows)

  // Column widths
  txSheet['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 18 },
    { wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 10 }
  ]

  // ── Sheet 2: Daily Summary ────────────────────────────────
  const dailyMap = {}
  completed.forEach(o => {
    const d = formatDate(o.created_at)
    if (!dailyMap[d]) dailyMap[d] = { date: d, orders: 0, revenue: 0, cash: 0, qris: 0 }
    dailyMap[d].orders++
    dailyMap[d].revenue += o.total
    if (o.payment_method === 'cash') dailyMap[d].cash += o.total
    else dailyMap[d].qris += o.total
  })

  const dailyRows = Object.values(dailyMap).map(d => ({
    'Date':              d.date,
    'Transactions':      d.orders,
    'Total Revenue (Rp)': Math.round(d.revenue),
    'Cash (Rp)':         Math.round(d.cash),
    'QRIS (Rp)':         Math.round(d.qris),
  }))

  // Add totals row
  dailyRows.push({
    'Date':              'TOTAL',
    'Transactions':      dailyRows.reduce((s, r) => s + r['Transactions'], 0),
    'Total Revenue (Rp)': dailyRows.reduce((s, r) => s + r['Total Revenue (Rp)'], 0),
    'Cash (Rp)':          dailyRows.reduce((s, r) => s + r['Cash (Rp)'], 0),
    'QRIS (Rp)':          dailyRows.reduce((s, r) => s + r['QRIS (Rp)'], 0),
  })

  const dailySheet = XLSX.utils.json_to_sheet(dailyRows)
  dailySheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }]

  // ── Sheet 3: Products Sold ────────────────────────────────
  const prodMap = {}
  completed.forEach(o => {
    (o.order_items || []).forEach(item => {
      const key = item.product_name
      if (!prodMap[key]) prodMap[key] = { name: key, qty: 0, revenue: 0, price: item.product_price }
      prodMap[key].qty     += item.quantity
      prodMap[key].revenue += item.subtotal
    })
  })

  const prodRows = Object.values(prodMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map((p, i) => ({
      'Rank':           i + 1,
      'Product':        p.name,
      'Price (Rp)':     Math.round(p.price),
      'Qty Sold':       p.qty,
      'Revenue (Rp)':   Math.round(p.revenue),
    }))

  const prodSheet = XLSX.utils.json_to_sheet(prodRows)
  prodSheet['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 14 }]

  // ── Build workbook ────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, txSheet,    'Transactions')
  XLSX.utils.book_append_sheet(wb, dailySheet, 'Daily Summary')
  XLSX.utils.book_append_sheet(wb, prodSheet,  'Products Sold')

  // File name: StoreName_YYYY_MM.xlsx
  const fileName = `${storeCode}_${year}_${String(month + 1).padStart(2, '0')}.xlsx`
  XLSX.writeFile(wb, fileName)
}

// ─────────────────────────────────────────────────────────────
// PDF EXPORT
// Injects a print-ready HTML report into a hidden div,
// triggers window.print(), then removes the div.
// Uses the browser's built-in PDF export (Print → Save as PDF).
// ─────────────────────────────────────────────────────────────
export function exportPDF({ orders, storeName, storeCode, month, year }) {
  const periodLabel = `${MONTHS[month]} ${year}`
  const completed   = orders.filter(o => o.status === 'completed')
  const totalRev    = completed.reduce((s, o) => s + o.total, 0)
  const totalOrders = completed.length
  const avgOrder    = totalOrders > 0 ? totalRev / totalOrders : 0
  const cashRev     = completed.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0)
  const qrisRev     = completed.filter(o => o.payment_method === 'qris').reduce((s, o) => s + o.total, 0)

  // Daily summary for the table
  const dailyMap = {}
  completed.forEach(o => {
    const d = formatDate(o.created_at)
    if (!dailyMap[d]) dailyMap[d] = { date: d, orders: 0, revenue: 0 }
    dailyMap[d].orders++
    dailyMap[d].revenue += o.total
  })
  const dailyRows = Object.values(dailyMap)

  // Top 10 products
  const prodMap = {}
  completed.forEach(o => {
    (o.order_items || []).forEach(item => {
      const k = item.product_name
      if (!prodMap[k]) prodMap[k] = { name: k, qty: 0, revenue: 0 }
      prodMap[k].qty     += item.quantity
      prodMap[k].revenue += item.subtotal
    })
  })
  const topProds = Object.values(prodMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Laporan ${storeName} – ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #111;
      background: white;
      padding: 24px 32px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .store-name { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .store-meta { font-size: 11px; color: #555; margin-top: 2px; }
    .report-title { text-align: right; }
    .report-title h2 { font-size: 14px; font-weight: 700; }
    .report-title .period { font-size: 12px; color: #6d28d9; font-weight: 600; }
    .report-title .generated { font-size: 10px; color: #999; margin-top: 3px; }

    /* Summary boxes */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .summary-box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .summary-box .label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #888;
      margin-bottom: 4px;
    }
    .summary-box .value {
      font-size: 15px;
      font-weight: 800;
      color: #111;
    }
    .summary-box .value.accent { color: #6d28d9; }
    .summary-box .value.green  { color: #16a34a; }

    /* Section title */
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6d28d9;
      margin-bottom: 8px;
      margin-top: 18px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #f3f4f6; }
    th {
      text-align: left;
      padding: 6px 8px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #555;
      font-weight: 700;
      border-bottom: 1px solid #e5e7eb;
    }
    td {
      padding: 5px 8px;
      font-size: 10px;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: middle;
    }
    tr:last-child td { border-bottom: none; }
    .tr-total td {
      font-weight: 700;
      background: #faf5ff;
      border-top: 1px solid #e5e7eb;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mono { font-family: 'Courier New', monospace; font-size: 9px; }
    .badge-paid { color: #16a34a; font-weight: 700; }
    .badge-void { color: #dc2626; font-weight: 700; }
    .col-num { width: 30px; }
    .col-date { white-space: nowrap; }

    /* Payment split bar */
    .split-bar-wrap { margin: 10px 0 16px; }
    .split-labels { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px; }
    .split-bar { height: 10px; border-radius: 5px; background: #e5e7eb; overflow: hidden; }
    .split-bar-fill { height: 100%; background: #6d28d9; border-radius: 5px; }

    /* Footer */
    .footer {
      margin-top: 24px;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      font-size: 9px;
      color: #aaa;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      body { padding: 12px 16px; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="store-name">${storeName}</div>
      <div class="store-meta">Store Code: ${storeCode}</div>
    </div>
    <div class="report-title">
      <h2>Monthly Sales Report</h2>
      <div class="period">${periodLabel}</div>
      <div class="generated">Generated: ${new Date().toLocaleString('id-ID')}</div>
    </div>
  </div>

  <!-- Summary -->
  <div class="summary-grid">
    <div class="summary-box">
      <div class="label">Total Revenue</div>
      <div class="value accent">Rp ${formatRp(totalRev)}</div>
    </div>
    <div class="summary-box">
      <div class="label">Transactions</div>
      <div class="value">${totalOrders}</div>
    </div>
    <div class="summary-box">
      <div class="label">Avg. Order</div>
      <div class="value">Rp ${formatRp(avgOrder)}</div>
    </div>
    <div class="summary-box">
      <div class="label">Voided</div>
      <div class="value" style="color:#dc2626">${orders.filter(o => o.status === 'voided').length}</div>
    </div>
  </div>

  <!-- Payment split -->
  <div class="section-title">Payment Method Split</div>
  <div class="split-bar-wrap">
    <div class="split-labels">
      <span>💵 Cash — Rp ${formatRp(cashRev)} (${totalRev > 0 ? Math.round(cashRev / totalRev * 100) : 0}%)</span>
      <span>📱 QRIS — Rp ${formatRp(qrisRev)} (${totalRev > 0 ? Math.round(qrisRev / totalRev * 100) : 0}%)</span>
    </div>
    <div class="split-bar">
      <div class="split-bar-fill" style="width:${totalRev > 0 ? Math.round(cashRev / totalRev * 100) : 0}%"></div>
    </div>
  </div>

  <!-- Daily summary -->
  <div class="section-title">Daily Summary</div>
  <table>
    <thead>
      <tr>
        <th class="col-date">Date</th>
        <th class="text-right">Transactions</th>
        <th class="text-right">Revenue (Rp)</th>
      </tr>
    </thead>
    <tbody>
      ${dailyRows.map(d => `
        <tr>
          <td class="col-date">${d.date}</td>
          <td class="text-right">${d.orders}</td>
          <td class="text-right">Rp ${formatRp(d.revenue)}</td>
        </tr>`).join('')}
      <tr class="tr-total">
        <td>TOTAL</td>
        <td class="text-right">${totalOrders}</td>
        <td class="text-right">Rp ${formatRp(totalRev)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Top products -->
  <div class="section-title">Top Products</div>
  <table>
    <thead>
      <tr>
        <th class="col-num">#</th>
        <th>Product</th>
        <th class="text-right">Qty Sold</th>
        <th class="text-right">Revenue (Rp)</th>
      </tr>
    </thead>
    <tbody>
      ${topProds.map((p, i) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td>${p.name}</td>
          <td class="text-right">${p.qty}</td>
          <td class="text-right">Rp ${formatRp(p.revenue)}</td>
        </tr>`).join('')}
    </tbody>
  </table>

  <!-- Transaction list -->
  <div class="section-title">Transaction List (${orders.length} orders)</div>
  <table>
    <thead>
      <tr>
        <th>Receipt No.</th>
        <th class="col-date">Date & Time</th>
        <th>Cashier</th>
        <th class="text-right">Total (Rp)</th>
        <th class="text-center">Payment</th>
        <th class="text-center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${orders.map(o => `
        <tr>
          <td class="mono">${o.order_number}</td>
          <td class="col-date">${formatDateTime(o.created_at)}</td>
          <td>${o.users?.full_name || '—'}</td>
          <td class="text-right">Rp ${formatRp(o.total)}</td>
          <td class="text-center">${o.payment_method === 'qris' ? 'QRIS' : 'Cash'}</td>
          <td class="text-center ${o.status === 'completed' ? 'badge-paid' : 'badge-void'}">${o.status}</td>
        </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>${storeName} (${storeCode}) — ${periodLabel} Report</span>
    <span>QuickPOS — Confidential</span>
  </div>

</body>
</html>`

  // Open in new window and trigger print
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.focus()
    win.print()
    // Close after print dialog dismissed (slight delay for UX)
    setTimeout(() => win.close(), 1000)
  }
}
