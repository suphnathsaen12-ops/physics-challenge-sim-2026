(function () {
  'use strict';

  const STORAGE_KEY = 'ap_challenge_2026_results_v1';
  let records = [];
  let initialized = false;

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      // Ignore storage restrictions
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatTime(ts) {
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return '—';
    return pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds());
  }

  function formatDateTimeFull(ts) {
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return '';
    return (
      dt.getFullYear() +
      '-' +
      pad2(dt.getMonth() + 1) +
      '-' +
      pad2(dt.getDate()) +
      ' ' +
      pad2(dt.getHours()) +
      ':' +
      pad2(dt.getMinutes())
    );
  }

  function formatFilenameStamp() {
    const dt = new Date();
    return (
      dt.getFullYear() +
      pad2(dt.getMonth() + 1) +
      pad2(dt.getDate()) +
      '-' +
      pad2(dt.getHours()) +
      pad2(dt.getMinutes())
    );
  }

  function computeStats(list) {
    const total = list.length;
    if (total === 0) {
      return {
        total: 0,
        passCount: 0,
        passPct: '0.0',
        meanAbsErr: '0.00',
        latestH: '—'
      };
    }
    let passCount = 0;
    let absErrSum = 0;
    for (let i = 0; i < total; i += 1) {
      const r = list[i];
      if (r.pass) passCount += 1;
      const mid = (Number(r.min) + Number(r.max)) * 0.5;
      absErrSum += Math.abs(Number(r.H) - mid);
    }
    const last = list[total - 1];
    return {
      total: total,
      passCount: passCount,
      passPct: ((passCount / total) * 100).toFixed(1),
      meanAbsErr: (absErrSum / total).toFixed(2),
      latestH: Number(last.H).toFixed(2) + ' cm'
    };
  }

  function render() {
    const summaryEl = document.getElementById('resultsSummary');
    const tbodyEl = document.getElementById('resultsTableBody');
    const stats = computeStats(records);

    if (summaryEl) {
      summaryEl.innerHTML =
        '<span class="summary-pill">ทดลอง <strong>' + stats.total + '</strong> ครั้ง</span>' +
        '<span class="summary-pill ok">ผ่าน <strong>' + stats.passPct + '%</strong> (' + stats.passCount + '/' + stats.total + ')</span>' +
        '<span class="summary-pill">คลาดจากกึ่งกลางเป้าเฉลี่ย <strong>±' + stats.meanAbsErr + ' cm</strong></span>' +
        '<span class="summary-pill accent">ล่าสุด <strong>' + escapeHtml(stats.latestH) + '</strong></span>';
    }

    if (!tbodyEl) return;

    if (records.length === 0) {
      tbodyEl.innerHTML =
        '<tr><td colspan="9" class="results-empty">ยังไม่มีผล — กด START เพื่อบันทึก</td></tr>';
      return;
    }

    // Show newest on top while keeping #1 as earliest run
    const htmlRows = [];
    for (let i = records.length - 1; i >= 0; i -= 1) {
      const r = records[i];
      const num = i + 1;
      const mid = (Number(r.min) + Number(r.max)) * 0.5;
      const err = Number(r.H) - mid;
      const errStr = (err >= 0 ? '+' : '') + err.toFixed(2);
      const dStr = (Number(r.d) > 0.05 ? '+' : '') + Number(r.d).toFixed(1);
      const statusHtml = r.pass
        ? '<span class="badge-ok">✅ ผ่าน</span>'
        : '<span class="badge-no">❌ ไม่ผ่าน</span>';

      htmlRows.push(
        '<tr data-id="' + escapeHtml(r.id) + '">' +
        '<td class="mono">' + num + '</td>' +
        '<td class="mono">' + escapeHtml(formatTime(r.ts)) + '</td>' +
        '<td>' + escapeHtml(r.ballLabel) + '</td>' +
        '<td>' + escapeHtml(r.rangeLabel) + '</td>' +
        '<td class="mono">' + escapeHtml(dStr) + '</td>' +
        '<td class="mono">' + Number(r.H).toFixed(2) + '</td>' +
        '<td class="mono">' + escapeHtml(errStr) + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td><button type="button" class="btn-del-row" data-id="' + escapeHtml(r.id) + '" title="ลบรายการนี้">🗑</button></td>' +
        '</tr>'
      );
    }
    tbodyEl.innerHTML = htmlRows.join('');
  }

  function add(rec) {
    if (!rec) return null;
    const item = {
      id: rec.id || (Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)),
      ts: rec.ts || Date.now(),
      ball: rec.ball || 'billiard',
      ballLabel: rec.ballLabel || 'ลูกบิลเลียด',
      rangeLabel: rec.rangeLabel || '',
      min: Number(rec.min) || 0,
      max: Number(rec.max) || 0,
      d: Number(rec.d) || 0,
      H: Number(rec.H) || 0,
      pass: Boolean(rec.pass),
      model: rec.model === 'อุดมคติ' ? 'อุดมคติ' : 'สมจริง',
      path: rec.path === 'อิสระ' ? 'อิสระ' : 'ราง'
    };
    records.push(item);
    saveRecords();
    render();
    return item;
  }

  function remove(id) {
    const targetId = String(id);
    records = records.filter(function (r) {
      return String(r.id) !== targetId;
    });
    saveRecords();
    render();
  }

  function clear() {
    records = [];
    saveRecords();
    render();
  }

  function all() {
    return records.slice();
  }

  function triggerDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function csvCell(val) {
    const s = String(val == null ? '' : val);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCSV() {
    if (records.length === 0) {
      alert('ยังไม่มีข้อมูลผลการทดลองให้ส่งออก กรุณากด START เพื่อบันทึกผลก่อนครับ');
      return;
    }
    const header = [
      'ครั้งที่',
      'วันเวลา',
      'ชนิดลูก',
      'ระยะเป้าหมาย',
      'd (cm)',
      'H ที่ได้ (cm)',
      'คลาดจากกึ่งกลาง (cm)',
      'ผลลัพธ์',
      'โหมด',
      'วิถี'
    ];
    const lines = [header.map(csvCell).join(',')];

    for (let i = 0; i < records.length; i += 1) {
      const r = records[i];
      const mid = (Number(r.min) + Number(r.max)) * 0.5;
      const err = Number(r.H) - mid;
      const dStr = (Number(r.d) > 0.05 ? '+' : '') + Number(r.d).toFixed(1);
      const errStr = (err >= 0 ? '+' : '') + err.toFixed(2);
      lines.push(
        [
          i + 1,
          formatDateTimeFull(r.ts),
          r.ballLabel,
          r.rangeLabel,
          dStr,
          Number(r.H).toFixed(2),
          errStr,
          r.pass ? 'ผ่าน' : 'ไม่ผ่าน',
          r.model,
          r.path
        ]
          .map(csvCell)
          .join(',')
      );
    }

    const csvText = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    triggerDownloadBlob(blob, 'Aiia_results_' + formatFilenameStamp() + '.csv');
  }

  function renderExportCanvasAndSave(logoImg) {
    const rows = records.slice();
    const stats = computeStats(rows);
    const width = 1200;
    const headerH = 140;
    const colHeaderH = 44;
    const rowH = 38;
    const footerH = 44;
    const tableRowsCount = Math.max(1, rows.length);
    const height = headerH + colHeaderH + tableRowsCount * rowH + footerH + 36;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Clean light report sheet
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Top Aiia gradient accent stripe
    const stripeGrad = ctx.createLinearGradient(0, 0, width, 0);
    stripeGrad.addColorStop(0, '#00AEEF');
    stripeGrad.addColorStop(1, '#EC008C');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, 0, width, 10);

    // Subtle header wash
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 10, width, headerH - 10);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, headerH);
    ctx.lineTo(width, headerH);
    ctx.stroke();

    // Logo top-left if loaded
    let textStartX = 40;
    if (logoImg) {
      ctx.drawImage(logoImg, 36, 28, 86, 86);
      textStartX = 142;
    }

    // Header text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Segoe UI", "Leelawadee UI", Tahoma, sans-serif';
    ctx.fillText('Team Aiia — Applied Physics Challenge 2026', textStartX, 62);

    ctx.fillStyle = '#475569';
    ctx.font = '17px "Segoe UI", "Leelawadee UI", Tahoma, sans-serif';
    ctx.fillText(
      'วันที่บันทึก: ' + formatDateTimeFull(Date.now()) +
      '   |   ทดลอง ' + stats.total + ' ครั้ง' +
      '   |   ผ่าน ' + stats.passPct + '% (' + stats.passCount + '/' + stats.total + ')' +
      '   |   คลาดจากกึ่งกลางเฉลี่ย ±' + stats.meanAbsErr + ' cm',
      textStartX,
      98
    );

    // Table geometry
    const tableX = 36;
    const tableW = width - 72;
    const cols = [
      { label: '#', w: 58, align: 'center' },
      { label: 'เวลา', w: 112, align: 'center' },
      { label: 'ชนิดลูก', w: 170, align: 'left' },
      { label: 'ระยะเป้าหมาย', w: 156, align: 'center' },
      { label: 'd (cm)', w: 118, align: 'right' },
      { label: 'H ที่ได้ (cm)', w: 146, align: 'right' },
      { label: 'คลาดกึ่งกลาง', w: 148, align: 'right' },
      { label: 'ผลลัพธ์', w: 120, align: 'center' },
      { label: 'โหมด', w: 100, align: 'center' }
    ];

    const yHead = headerH + 18;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tableX, yHead, tableW, colHeaderH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Segoe UI", "Leelawadee UI", Tahoma, sans-serif';
    let cx = tableX;
    for (let c = 0; c < cols.length; c += 1) {
      const col = cols[c];
      ctx.textAlign = col.align;
      const tx = col.align === 'center' ? cx + col.w * 0.5 : col.align === 'right' ? cx + col.w - 14 : cx + 14;
      ctx.fillText(col.label, tx, yHead + 28);
      cx += col.w;
    }

    if (rows.length === 0) {
      const ry = yHead + colHeaderH;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tableX, ry, tableW, rowH);
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.font = '16px "Segoe UI", "Leelawadee UI", Tahoma, sans-serif';
      ctx.fillText('ยังไม่มีข้อมูลผลการทดลอง', tableX + tableW * 0.5, ry + 25);
    } else {
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i];
        const ry = yHead + colHeaderH + i * rowH;
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(tableX, ry, tableW, rowH);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX, ry + rowH);
        ctx.lineTo(tableX + tableW, ry + rowH);
        ctx.stroke();

        const mid = (Number(r.min) + Number(r.max)) * 0.5;
        const err = Number(r.H) - mid;
        const dStr = (Number(r.d) > 0.05 ? '+' : '') + Number(r.d).toFixed(1);
        const errStr = (err >= 0 ? '+' : '') + err.toFixed(2);
        const vals = [
          String(i + 1),
          formatTime(r.ts),
          r.ballLabel,
          r.rangeLabel,
          dStr,
          Number(r.H).toFixed(2),
          errStr,
          r.pass ? '✅ ผ่าน' : '❌ ไม่ผ่าน',
          r.model
        ];

        cx = tableX;
        for (let c = 0; c < cols.length; c += 1) {
          const col = cols[c];
          if (c === 7) {
            ctx.fillStyle = r.pass ? '#dcfce7' : '#fee2e2';
            ctx.fillRect(cx + 8, ry + 6, col.w - 16, rowH - 12);
            ctx.fillStyle = r.pass ? '#15803d' : '#b91c1c';
            ctx.font = 'bold 15px "Segoe UI", "Leelawadee UI", Tahoma, sans-serif';
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.font = (c === 0 || c === 4 || c === 5 || c === 6)
              ? '15px Consolas, "Courier New", monospace'
              : '15px "Segoe UI", "Leelawadee UI", Tahoma, sans-serif';
          }
          ctx.textAlign = col.align;
          const tx = col.align === 'center' ? cx + col.w * 0.5 : col.align === 'right' ? cx + col.w - 14 : cx + 14;
          ctx.fillText(vals[c], tx, ry + 24);
          cx += col.w;
        }
      }
    }

    // Outer table border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tableX, yHead, tableW, colHeaderH + tableRowsCount * rowH);

    // Footer
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '13px "Segoe UI", "Leelawadee UI", Tahoma, sans-serif';
    ctx.fillText('Generated by Team Aiia Simulator — Applied Physics Challenge 2026', tableX, height - 16);

    const filename = 'Aiia_results_' + formatFilenameStamp() + '.png';
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (blob) {
          triggerDownloadBlob(blob, filename);
        } else {
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = filename;
          a.click();
        }
      }, 'image/png');
    } else {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename;
      a.click();
    }
  }

  function exportPNG() {
    if (records.length === 0) {
      alert('ยังไม่มีข้อมูลผลการทดลองให้ส่งออก กรุณากด START เพื่อบันทึกผลก่อนครับ');
      return;
    }
    const logoUri = window.AIIA_LOGO;
    if (logoUri) {
      const img = new Image();
      img.onload = function () { renderExportCanvasAndSave(img); };
      img.onerror = function () { renderExportCanvasAndSave(null); };
      img.src = logoUri;
    } else {
      renderExportCanvasAndSave(null);
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    records = loadRecords();
    render();

    const tbody = document.getElementById('resultsTableBody');
    if (tbody) {
      tbody.addEventListener('click', function (ev) {
        const btn = ev.target.closest('.btn-del-row');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (id) remove(id);
      });
    }

    const btnCsv = document.getElementById('btnExportCsv');
    if (btnCsv) btnCsv.addEventListener('click', exportCSV);

    const btnPng = document.getElementById('btnExportPng');
    if (btnPng) btnPng.addEventListener('click', exportPNG);

    const btnClear = document.getElementById('btnClearResults');
    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (records.length === 0) return;
        if (window.confirm('ลบผลทั้งหมด?')) {
          clear();
        }
      });
    }
  }

  window.ResultsLog = {
    add: add,
    remove: remove,
    clear: clear,
    all: all,
    render: render,
    exportCSV: exportCSV,
    exportPNG: exportPNG,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
