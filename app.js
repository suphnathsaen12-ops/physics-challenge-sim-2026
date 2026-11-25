(function () {
  'use strict';

  const STORAGE_KEY = 'ap_challenge_2026_sim_v2';

  function logError(err) {
    const pre = document.getElementById('errlog');
    if (!pre) return;
    pre.hidden = false;
    const msg = err && err.stack ? err.stack : String(err);
    pre.textContent += (pre.textContent ? '\n' : '') + msg;
  }

  window.onerror = function (message, source, lineno, colno, error) {
    logError(error || (message + ' (' + source + ':' + lineno + ':' + colno + ')'));
  };

  window.addEventListener('unhandledrejection', function (ev) {
    logError(ev && ev.reason ? ev.reason : 'Unhandled promise rejection');
  });

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function loadStoredState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveStoredState(params, presetId) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: params, presetId: presetId }));
    } catch (e) {
      // Ignore storage quota or private mode restrictions
    }
  }

  function initApp() {
    const stored = loadStoredState();
    const state = {
      params: Object.assign(Physics.defaultParams(), stored && stored.params ? stored.params : {}),
      presetId: stored && stored.presetId ? stored.presetId : 'tuned',
      ballType: 'billiard',
      rangeIndex: 0,
      d: 10.2,
      opts: {
        ideal: false,
        guided: true,
        measure: 'bottom'
      },
      showVectors: true,
      slowMo: 0.5,
      sensorAutoText: 'ตรวจจับอัตโนมัติ: ลูกบิลเลียด',

      // Simulation & animation state
      animMode: 'idle', // 'idle' | 'sliding' | 'running' | 'done'
      simTime: 0,
      lastFrameTs: null,
      slideFromD: 10.2,
      slideToD: 10.2,
      slideProgress: 1,
      activeSim: null,
      lockedResult: null,
      solveResult: null,
      curvesCache: { billiard: [], tennis: [] },
      draggingFulcrum: false,
      hoveringFulcrum: false
    };

    // DOM References
    const el = {
      btnGuided: document.getElementById('btnGuided'),
      lblGuided: document.getElementById('lblGuided'),
      btnIdeal: document.getElementById('btnIdeal'),
      lblIdeal: document.getElementById('lblIdeal'),
      btnVectors: document.getElementById('btnVectors'),
      lblVectors: document.getElementById('lblVectors'),
      selMeasure: document.getElementById('selMeasure'),
      rngSlowMo: document.getElementById('rngSlowMo'),
      lblSlowMo: document.getElementById('lblSlowMo'),

      simCanvas: document.getElementById('simCanvas'),
      graphCanvas: document.getElementById('graphCanvas'),
      rngD: document.getElementById('rngD'),
      lblDVal: document.getElementById('lblDVal'),

      sensorBadge: document.getElementById('sensorBadge'),
      btnBallBilliard: document.getElementById('btnBallBilliard'),
      btnBallTennis: document.getElementById('btnBallTennis'),
      btnRandomBall: document.getElementById('btnRandomBall'),
      btnRange1: document.getElementById('btnRange1'),
      btnRange2: document.getElementById('btnRange2'),
      btnRange3: document.getElementById('btnRange3'),
      lblRange1: document.getElementById('lblRange1'),
      lblRange2: document.getElementById('lblRange2'),
      lblRange3: document.getElementById('lblRange3'),
      btnStart: document.getElementById('btnStart'),
      btnReset: document.getElementById('btnReset'),

      dashStatusTag: document.getElementById('dashStatusTag'),
      dashBall: document.getElementById('dashBall'),
      dashTarget: document.getElementById('dashTarget'),
      dashD: document.getElementById('dashD'),
      dashH: document.getElementById('dashH'),
      dashSuccess: document.getElementById('dashSuccess'),
      dashSuccessText: document.getElementById('dashSuccessText'),
      dashWarnings: document.getElementById('dashWarnings'),

      modePill: document.getElementById('modePill'),
      pCard1: document.getElementById('pCard1'),
      pCard2: document.getElementById('pCard2'),
      pCard3: document.getElementById('pCard3'),
      calcCard1: document.getElementById('calcCard1'),
      calcCard2: document.getElementById('calcCard2'),
      explainCard2: document.getElementById('explainCard2'),
      calcCard3: document.getElementById('calcCard3'),

      graphSub: document.getElementById('graphSub'),
      arduinoTableBody: document.getElementById('arduinoTableBody'),
      arduinoCodePreview: document.getElementById('arduinoCodePreview'),
      btnCopyArduino: document.getElementById('btnCopyArduino'),
      copyStatus: document.getElementById('copyStatus'),

      selPreset: document.getElementById('selPreset'),
      btnResetParams: document.getElementById('btnResetParams'),
      inExtraDrop: document.getElementById('inExtraDrop'),
      inMBoard: document.getElementById('inMBoard'),
      inTBoard: document.getElementById('inTBoard'),
      inBoardStart: document.getElementById('inBoardStart'),
      inImpactInset: document.getElementById('inImpactInset'),
      inGolfInset: document.getElementById('inGolfInset'),
      inEta: document.getElementById('inEta'),
      inMBilliard: document.getElementById('inMBilliard'),
      inRBilliard: document.getElementById('inRBilliard'),
      inEBilliard: document.getElementById('inEBilliard'),
      inMTennis: document.getElementById('inMTennis'),
      inRTennis: document.getElementById('inRTennis'),
      inETennis: document.getElementById('inETennis'),
      inMGolf: document.getElementById('inMGolf'),
      inRGolf: document.getElementById('inRGolf'),
      inG: document.getElementById('inG'),

      selExpBall: document.getElementById('selExpBall'),
      inExpD: document.getElementById('inExpD'),
      inExpH: document.getElementById('inExpH'),
      btnCalibEta: document.getElementById('btnCalibEta'),
      calibMsg: document.getElementById('calibMsg')
    };

    const paramInputMap = [
      ['inExtraDrop', 'extraDropHeight', 0, 40],
      ['inMBoard', 'M_board', 0, 5],
      ['inTBoard', 't_board', 0.1, 10],
      ['inBoardStart', 'boardStart', 0, 5],
      ['inImpactInset', 'impactInset', 0, 15],
      ['inGolfInset', 'golfInset', 0, 15],
      ['inEta', 'eta', 0.05, 5],
      ['inMBilliard', 'm_billiard', 0.005, 2],
      ['inRBilliard', 'r_billiard', 0.5, 8],
      ['inEBilliard', 'e_billiard', 0, 1],
      ['inMTennis', 'm_tennis', 0.005, 2],
      ['inRTennis', 'r_tennis', 0.5, 8],
      ['inETennis', 'e_tennis', 0, 1],
      ['inMGolf', 'm_golf', 0.005, 2],
      ['inRGolf', 'r_golf', 0.5, 8],
      ['inG', 'g', 0.5, 30]
    ];

    function syncInputsFromParams() {
      paramInputMap.forEach(function (entry) {
        const input = el[entry[0]];
        if (input) input.value = state.params[entry[1]];
      });
      el.selPreset.value = state.presetId;
    }

    function getCurrentTarget() {
      return Physics.TARGETS[state.ballType][state.rangeIndex];
    }

    function recomputeCurvesAndTable() {
      state.curvesCache.billiard = Physics.heightCurve(state.params, 'billiard', state.opts, 0.1);
      state.curvesCache.tennis = Physics.heightCurve(state.params, 'tennis', state.opts, 0.1);

      const rows = [];
      const arrB = [];
      const arrT = [];

      ['billiard', 'tennis'].forEach(function (ball) {
        Physics.TARGETS[ball].forEach(function (t) {
          const sol = Physics.solveD(state.params, ball, [t.min, t.max], state.opts);
          if (ball === 'billiard') arrB.push(sol.d.toFixed(1));
          else arrT.push(sol.d.toFixed(1));
          rows.push({
            ballLabel: Physics.BALL_LABELS[ball],
            rangeLabel: t.label,
            d: sol.d,
            H: sol.H,
            reachable: sol.reachable
          });
        });
      });

      el.arduinoTableBody.innerHTML = rows
        .map(function (r) {
          const statusHtml = r.reachable
            ? '<span class="badge-ok">ถึงเป้า ✓</span>'
            : '<span class="badge-no">ไม่ถึง ✗</span>';
          return (
            '<tr>' +
            '<td>' + r.ballLabel + '</td>' +
            '<td>' + r.rangeLabel + '</td>' +
            '<td class="mono">' + r.d.toFixed(1) + '</td>' +
            '<td class="mono">' + r.H.toFixed(2) + '</td>' +
            '<td>' + statusHtml + '</td>' +
            '</tr>'
          );
        })
        .join('');

      const codeText =
        'const float D_BILLIARD[3] = {' + arrB.join(', ') + '};\n' +
        'const float D_TENNIS[3] = {' + arrT.join(', ') + '};';
      el.arduinoCodePreview.textContent = codeText;
    }

    function recomputeActiveSim(keepLocked) {
      if (!keepLocked) {
        state.lockedResult = null;
        if (state.animMode === 'done' || state.animMode === 'running') {
          state.animMode = 'idle';
          state.simTime = 0;
        }
      }
      state.activeSim = Physics.simulate(state.params, state.ballType, state.d, state.opts);
      const target = getCurrentTarget();
      state.solveResult = Physics.solveD(state.params, state.ballType, [target.min, target.max], state.opts);
      updateControlsLabels();
      updateDashboard();
      updatePhysicsCards();
      drawGraph();
      drawStage();
    }

    function updateControlsLabels() {
      const targets = Physics.TARGETS[state.ballType];
      el.lblRange1.textContent = targets[0].label;
      el.lblRange2.textContent = targets[1].label;
      el.lblRange3.textContent = targets[2].label;

      el.btnBallBilliard.classList.toggle('active', state.ballType === 'billiard');
      el.btnBallTennis.classList.toggle('active', state.ballType === 'tennis');

      el.btnRange1.classList.toggle('active', state.rangeIndex === 0);
      el.btnRange2.classList.toggle('active', state.rangeIndex === 1);
      el.btnRange3.classList.toggle('active', state.rangeIndex === 2);

      el.sensorBadge.textContent = state.sensorAutoText;

      el.rngD.value = state.d.toFixed(1);
      el.lblDVal.textContent = state.d.toFixed(1) + ' cm';

      el.lblGuided.textContent = state.opts.guided ? 'รางบังคับแนวดิ่ง' : 'ลอยอิสระตามมุมกระดก';
      el.btnGuided.classList.toggle('active', state.opts.guided);
      el.btnGuided.classList.toggle('alt-active', !state.opts.guided);

      el.lblIdeal.textContent = state.opts.ideal ? 'อุดมคติ (M=0)' : 'สมจริง';
      el.btnIdeal.classList.toggle('active', !state.opts.ideal);
      el.btnIdeal.classList.toggle('alt-active', state.opts.ideal);

      el.lblVectors.textContent = state.showVectors ? 'เปิด' : 'ปิด';
      el.btnVectors.classList.toggle('active', state.showVectors);

      el.modePill.textContent =
        (state.opts.ideal ? 'โหมดอุดมคติ' : 'โหมดสมจริง') +
        ' • ' +
        (state.opts.guided ? 'รางแนวดิ่ง' : 'ลอยอิสระ');

      el.graphSub.textContent =
        'เส้นทึบ: ' +
        Physics.BALL_LABELS[state.ballType] +
        ' | เส้นประ: ' +
        Physics.BALL_LABELS[state.ballType === 'billiard' ? 'tennis' : 'billiard'];
    }

    function updateDashboard() {
      const target = getCurrentTarget();
      const sim = state.lockedResult || state.activeSim;
      const H = sim && sim.valid ? sim.H_max : 0;
      const inRange = H >= target.min && H <= target.max;

      el.dashBall.textContent = Physics.BALL_LABELS[state.ballType] + ' (' + (sim.m1 * 1000).toFixed(1) + ' g)';
      el.dashTarget.textContent = target.label;
      el.dashD.textContent = state.d.toFixed(1) + ' cm';

      if (state.animMode === 'running') {
        const sample = Physics.sampleState(state.activeSim, state.simTime);
        const measOffset = state.activeSim.measureOffset;
        const curMeasured = sample ? sample.golfY - state.params.r_golf + measOffset : 0;
        el.dashH.textContent = curMeasured.toFixed(1) + ' cm (กำลังวัด...)';
        el.dashStatusTag.className = 'dash-tag running';
        el.dashStatusTag.textContent = 'กำลังทำงาน...';
        el.dashSuccess.className = 'dash-success pending';
        el.dashSuccess.querySelector('.sym').textContent = '▶';
        el.dashSuccessText.textContent = 'กำลังปล่อยลูกและวัดความสูงลูกกอล์ฟ...';
      } else if (state.lockedResult) {
        el.dashH.textContent = H.toFixed(2) + ' cm';
        if (inRange) {
          el.dashStatusTag.className = 'dash-tag ok';
          el.dashStatusTag.textContent = 'สำเร็จ';
          el.dashSuccess.className = 'dash-success ok';
          el.dashSuccess.querySelector('.sym').textContent = '✓';
          el.dashSuccessText.textContent =
            'สำเร็จ! ลูกกอล์ฟสูง ' + H.toFixed(2) + ' cm อยู่ในช่วง ' + target.label;
        } else {
          el.dashStatusTag.className = 'dash-tag fail';
          el.dashStatusTag.textContent = 'ไม่เข้าเป้า';
          el.dashSuccess.className = 'dash-success fail';
          el.dashSuccess.querySelector('.sym').textContent = '✗';
          el.dashSuccessText.textContent =
            'ไม่ผ่านเกณฑ์: วัดได้ ' + H.toFixed(2) + ' cm (อยู่นอกช่วง ' + target.label + ')';
        }
      } else {
        el.dashH.textContent = '— (คาดการณ์ ' + H.toFixed(1) + ' cm)';
        el.dashStatusTag.className = 'dash-tag pending';
        el.dashStatusTag.textContent = 'รอกด START';
        el.dashSuccess.className = 'dash-success pending';
        el.dashSuccess.querySelector('.sym').textContent = '⏳';
        el.dashSuccessText.textContent = 'ตั้งค่าพร้อมแล้ว กดปุ่ม START เพื่อเริ่มทดสอบ';
      }

      // Warnings
      const warnings = [];
      if (state.solveResult && !state.solveResult.reachable) {
        warnings.push(
          '⚠ ไม่สามารถทำระยะ ' +
            target.label +
            ' ของ' +
            Physics.BALL_LABELS[state.ballType] +
            ' ได้ด้วยค่าปัจจุบัน (สูงสุดที่เป็นไปได้ ~' +
            state.solveResult.H.toFixed(1) +
            ' cm) — แนะนำ: เพิ่มความสูงจุดปล่อย / ใช้กระดานที่เบาลง / ใช้ผิวกระดานที่สะท้อนดีขึ้น (e สูงขึ้น)'
        );
      }
      if (!state.opts.guided && sim && sim.valid && sim.drift > 5) {
        warnings.push(
          '⚠ ลูกลอยห่างเสาเหลือง ' +
            sim.drift.toFixed(1) +
            ' cm (เกิน 5 cm — ในสนามจริงควรใส่รางบังคับแนวดิ่งเพื่อเทียบแถบวัด 1 mm ได้แม่นยำ)'
        );
      }
      if (sim && sim.valid && sim.flags.stalled) {
        warnings.push('⚠ แรงกระดกไม่เพียงพอ (กระดานหยุดก่อนถึงจุดปล่อย ลูกกอล์ฟไม่หลุดพ้นกระดาน)');
      }

      if (warnings.length > 0) {
        el.dashWarnings.hidden = false;
        el.dashWarnings.innerHTML = warnings.map(function (w) { return '<p>' + w + '</p>'; }).join('');
      } else {
        el.dashWarnings.hidden = true;
        el.dashWarnings.innerHTML = '';
      }
    }

    function updatePhysicsCards() {
      const s = state.activeSim;
      if (!s || !s.valid) {
        el.calcCard1.textContent = 'รูปทรงกระดานไม่ถูกต้อง กรุณาตรวจสอบค่า inset และ boardStart';
        el.calcCard2.textContent = '';
        el.calcCard3.textContent = '';
        return;
      }

      const deg0 = (s.theta0 * 180) / Math.PI;
      const degL = (s.theta_launch * 180) / Math.PI;

      el.calcCard1.innerHTML =
        '<div>x<sub>p</sub> = 25 + ' + s.d.toFixed(1) + ' = ' + s.x_p.toFixed(1) + ' cm, &nbsp; θ₀ = ' + deg0.toFixed(2) + '°</div>' +
        '<div>r₁ = ' + s.r1_cm.toFixed(2) + ' cm, &nbsp; y<sub>top</sub> = 3 − ' + s.r1_cm.toFixed(2) + '·sin(' + deg0.toFixed(2) + '°) + ' + state.params.t_board.toFixed(1) + ' = ' + s.y_impact_top.toFixed(2) + ' cm</div>' +
        '<div>จุดปล่อยลูก: 30' + (s.extraDropHeight > 0 ? ' + ' + s.extraDropHeight.toFixed(1) + ' = ' + (30 + s.extraDropHeight).toFixed(1) : '') + ' cm (บนแท่นสีเทา)</div>' +
        '<div>Δh₁ = ' + (30 + s.extraDropHeight).toFixed(1) + ' − ' + s.y_impact_top.toFixed(2) + ' = ' + s.dh1_cm.toFixed(2) + ' cm (' + s.dh1.toFixed(4) + ' m)</div>' +
        '<div class="res-line">v₁ = √(2 × ' + state.params.g.toFixed(2) + ' × ' + s.dh1.toFixed(4) + ') = ' + s.v1.toFixed(3) + ' m/s</div>';

      const reasonThai =
        s.rotReason === 'hit_stop'
          ? (s.flags.ideal ? 'ชนจุดหยุดทันที (อุดมคติ)' : 'กระดกจนปลายขวาแตะพื้น (θ_f)')
          : s.rotReason === 'early_sep'
            ? 'ลูกกอล์ฟลอยแยกตัวก่อนถึงพื้น (|a_กระดาน| > g cosθ)'
            : 'กระดานหมดแรงหมุนก่อนถึงจุดหยุด (ω → 0)';

      el.calcCard2.innerHTML =
        '<div>r₁ = ' + s.r1_cm.toFixed(2) + ' cm, &nbsp; r₂ = ' + s.r2_cm.toFixed(2) + ' cm, &nbsp; s<sub>cm</sub> = ' + (s.s_cm * 100).toFixed(1) + ' cm</div>' +
        '<div>I<sub>board</sub> = ' + s.I_board.toExponential(3) + ' kg·m², &nbsp; I<sub>sys</sub> = ' + s.I_sys.toExponential(3) + ' kg·m²</div>' +
        '<div>ω₀ = (1 + ' + s.e.toFixed(2) + ')·' + s.m1.toFixed(3) + '·' + s.v1.toFixed(3) + '·' + s.r1.toFixed(3) + ' / I<sub>sys</sub> = ' + s.omega0.toFixed(2) + ' rad/s</div>' +
        '<div>หลังหมุน (' + reasonThai + '): ω<sub>launch</sub> = ' + s.omega_launch.toFixed(2) + ' rad/s</div>' +
        '<div class="res-line">v₂ = ' + s.etaUsed.toFixed(2) + ' × ' + s.omega_launch.toFixed(2) + ' × ' + s.r2.toFixed(3) + ' = ' + s.v2.toFixed(3) + ' m/s</div>';

      el.explainCard2.innerHTML =
        '<strong>ทำไมกราฟ H(d) จึงขึ้นแล้วลง (ไม่เพิ่มขึ้นตลอด)?</strong><br />' +
        'เมื่อเลื่อนสามเหลี่ยมไปทางแท่นเทา (เพิ่ม d) แขนฝั่งตก r₁ จะสั้นลง และแขนฝั่งกอล์ฟ r₂ จะยาวขึ้น: ช่วง d น้อย อัตราทด r₂/r₁ ช่วยเร่งความเร็วลูกกอล์ฟให้สูงขึ้น แต่ถ้า d มากเกินไป โมเมนตัมเชิงมุมที่เข้าสู่คาน (m₁·v₁·r₁) จะลดลงมาก ขณะที่ความเฉื่อยของลูกกอล์ฟ (m₂·r₂²) และแรงโน้มถ่วงต้านเพิ่มขึ้นมาก (' +
        (s.flags.ideal
          ? 'ในโหมดอุดมคติไม่คิด M และแรงโน้มถ่วงระหว่างหมุน ค่า H จึงสูงกว่าโหมดสมจริงและยกปลายสูงขึ้นตามมุม θ_f'
          : 'ในโหมดสมจริง กระดานที่มวลถ่วงฝั่งซ้ายยังดึงคานลงจนเกิดการแยกตัวเร็วเมื่อ d สูง') +
        ')';

      const measLabel =
        state.opts.measure === 'center' ? 'จุดศูนย์กลาง' : state.opts.measure === 'top' ? 'ขอบบน' : 'ขอบล่างลูก';

      el.calcCard3.innerHTML =
        '<div>θ<sub>launch</sub> = ' + degL.toFixed(2) + '°, &nbsp; จุดวัด: ' + measLabel + ' (y<sub>launch</sub> = ' + s.y_launch_measured.toFixed(2) + ' cm)</div>' +
        '<div>v₂y = ' + s.v2.toFixed(3) + ' · cos(' + degL.toFixed(2) + '°) = ' + s.v2y.toFixed(3) + ' m/s' +
        (!s.flags.guided ? ', &nbsp; v₂x = ' + s.v2x.toFixed(3) + ' m/s' : ' (รางบังคับ v₂x = 0)') + '</div>' +
        '<div>ระยะพุ่ง Δh₂ = v₂y² / (2g) = ' + s.dh2_cm.toFixed(2) + ' cm</div>' +
        (!s.flags.guided ? '<div>ระยะห่างเสาเหลืองที่จุดสูงสุด (drift) = ' + s.drift.toFixed(2) + ' cm</div>' : '') +
        '<div class="res-line">H<sub>max</sub> = ' + s.y_launch_measured.toFixed(2) + ' + ' + s.dh2_cm.toFixed(2) + ' = ' + s.H_max.toFixed(2) + ' cm</div>';

      // Highlight active phase card during playback
      let activeCard = 0;
      if (state.animMode === 'running') {
        const sample = Physics.sampleState(s, state.simTime);
        if (sample) activeCard = sample.cardIndex;
      }
      el.pCard1.classList.toggle('active-phase', activeCard === 1);
      el.pCard2.classList.toggle('active-phase', activeCard === 2);
      el.pCard3.classList.toggle('active-phase', activeCard === 3);
    }

    /* ===========================
     *  Canvas Stage Drawing
     * =========================== */
    function getStageTransform(canvas) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(320, Math.round(rect.width * dpr));
      const targetH = Math.max(220, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const w = canvas.width;
      const h = canvas.height;
      const worldXMin = -13;
      const worldXMax = 67;
      const worldYMin = -7.5;
      const worldYMax = 96;
      const scale = Math.min(w / (worldXMax - worldXMin), h / (worldYMax - worldYMin));
      const padX = (w - (worldXMax - worldXMin) * scale) * 0.5;
      const padY = (h - (worldYMax - worldYMin) * scale) * 0.5;

      function toPxX(wx) {
        return padX + (wx - worldXMin) * scale;
      }
      function toPxY(wy) {
        return h - padY - (wy - worldYMin) * scale;
      }
      function toWorldX(pxCss) {
        const px = pxCss * dpr;
        return worldXMin + (px - padX) / scale;
      }
      function toWorldY(pyCss) {
        const py = pyCss * dpr;
        return worldYMin + (h - padY - py) / scale;
      }
      return { w, h, dpr, scale, toPxX, toPxY, toWorldX, toWorldY };
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, label, dpr, labelLeft) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 6 * dpr) return;
      const angle = Math.atan2(dy, dx);
      const headLen = Math.min(11 * dpr, len * 0.35);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      if (label) {
        ctx.font = 'bold ' + Math.round(12 * dpr) + 'px Consolas, "Segoe UI", sans-serif';
        ctx.fillStyle = color;
        if (labelLeft) {
          ctx.textAlign = 'right';
          ctx.fillText(label, x2 - 8 * dpr, y2 + 4 * dpr);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(label, x2 + 6 * dpr, y2 + 4 * dpr);
        }
      }
      ctx.restore();
    }

    function drawStage() {
      const canvas = el.simCanvas;
      const ctx = canvas.getContext('2d');
      const tf = getStageTransform(canvas);
      const { w, h, dpr, scale, toPxX, toPxY } = tf;
      const sim = state.activeSim;
      if (!sim || !sim.valid) return;

      const sample =
        state.animMode === 'running' || state.animMode === 'done'
          ? Physics.sampleState(sim, state.simTime)
          : Physics.sampleState(sim, 0);

      ctx.clearRect(0, 0, w, h);

      // Subtle background grid (10 cm)
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1 * dpr;
      for (let gx = -10; gx <= 60; gx += 10) {
        const px = toPxX(gx);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
        ctx.stroke();
      }
      for (let gy = 0; gy <= 90; gy += 10) {
        const py = toPxY(gy);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
      ctx.restore();

      // Target zone band
      const target = getCurrentTarget();
      const yBandTop = toPxY(target.max);
      const yBandBot = toPxY(target.min);
      ctx.save();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.10)';
      ctx.fillRect(toPxX(-8), yBandTop, 16 * scale, yBandBot - yBandTop);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.moveTo(toPxX(-8), yBandTop);
      ctx.lineTo(toPxX(16), yBandTop);
      ctx.moveTo(toPxX(-8), yBandBot);
      ctx.lineTo(toPxX(16), yBandBot);
      ctx.stroke();
      ctx.restore();

      // Ground floor
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, toPxY(0), w, h - toPxY(0));
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, toPxY(0));
      ctx.lineTo(w, toPxY(0));
      ctx.stroke();

      // Horizontal 0..50 cm ruler & midpoint 25 cm
      ctx.strokeStyle = '#94a3b8';
      ctx.fillStyle = '#94a3b8';
      ctx.font = Math.round(10 * dpr) + 'px Consolas, sans-serif';
      ctx.textAlign = 'center';
      for (let rx = 0; rx <= 50; rx += 5) {
        const px = toPxX(rx);
        const tickH = rx % 10 === 0 ? 5 * dpr : 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(px, toPxY(0));
        ctx.lineTo(px, toPxY(0) + tickH);
        ctx.stroke();
        if (rx === 0 || rx === 25 || rx === 50) {
          ctx.fillText(rx + ' cm', px, toPxY(0) + 14 * dpr);
        }
      }
      // Midpoint 25 cm marker & d displacement bracket
      const pxMid = toPxX(25);
      const pxPivot = toPxX(sim.x_p);
      const bracketY = toPxY(-4.0);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(pxMid, bracketY - 3 * dpr);
      ctx.lineTo(pxMid, bracketY);
      ctx.lineTo(pxPivot, bracketY);
      ctx.lineTo(pxPivot, bracketY - 3 * dpr);
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold ' + Math.round(11 * dpr) + 'px "Segoe UI", sans-serif';
      ctx.fillText('d = ' + state.d.toFixed(1) + ' cm', (pxMid + pxPivot) * 0.5, bracketY + 12 * dpr);
      ctx.restore();

      // Yellow Pillar (-8..0, 0..80)
      ctx.save();
      const gradY = ctx.createLinearGradient(toPxX(-8), 0, toPxX(0), 0);
      gradY.addColorStop(0, '#ca8a04');
      gradY.addColorStop(1, '#facc15');
      ctx.fillStyle = gradY;
      ctx.fillRect(toPxX(-8), toPxY(80), 8 * scale, 80 * scale);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeRect(toPxX(-8), toPxY(80), 8 * scale, 80 * scale);

      // Highlight target band on yellow pillar
      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.fillRect(toPxX(-2.2), yBandTop, 2.2 * scale, yBandBot - yBandTop);

      // Ruler ticks 0..80 cm on yellow pillar
      ctx.strokeStyle = '#0f172a';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold ' + Math.round(10 * dpr) + 'px Consolas, sans-serif';
      ctx.textAlign = 'right';
      for (let cy = 0; cy <= 80; cy += 1) {
        const py = toPxY(cy);
        const tLen = cy % 10 === 0 ? 3.2 * scale : cy % 5 === 0 ? 2.1 * scale : 1.0 * scale;
        ctx.lineWidth = cy % 10 === 0 ? 1.5 * dpr : 0.9 * dpr;
        ctx.beginPath();
        ctx.moveTo(toPxX(0), py);
        ctx.lineTo(toPxX(0) - tLen, py);
        ctx.stroke();
        if (cy > 0 && cy % 10 === 0) {
          ctx.fillText(String(cy), toPxX(0) - 3.6 * scale, py + 3.5 * dpr);
        }
      }
      // Dashed extension above 80 cm up to 92 cm if needed
      if (sim.H_max > 78) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.strokeRect(toPxX(-8), toPxY(92), 8 * scale, 12 * scale);
        ctx.setLineDash([]);
        ctx.fillStyle = '#fde047';
        ctx.fillText('90', toPxX(0) - 2.5 * scale, toPxY(90) + 3.5 * dpr);
      }
      ctx.restore();

      // Grey Pillar (50..64, 0..30)
      ctx.save();
      const greyW = 14;
      const gradG = ctx.createLinearGradient(toPxX(50), 0, toPxX(50 + greyW), 0);
      gradG.addColorStop(0, '#94a3b8');
      gradG.addColorStop(1, '#64748b');
      ctx.fillStyle = gradG;
      ctx.fillRect(toPxX(50), toPxY(30), greyW * scale, 30 * scale);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeRect(toPxX(50), toPxY(30), greyW * scale, 30 * scale);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold ' + Math.round(11 * dpr) + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('แท่นสีเทา 30 cm', toPxX(50 + greyW * 0.5), toPxY(11));

      // Optional extra drop height stand only if > 0 in calibration
      const extraH = Math.max(0, Number(state.params.extraDropHeight) || 0);
      if (extraH > 0) {
        const yExtraTop = 30 + extraH;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5 * dpr;
        ctx.fillRect(toPxX(50.5), toPxY(yExtraTop), (greyW - 1) * scale, extraH * scale);
        ctx.strokeRect(toPxX(50.5), toPxY(yExtraTop), (greyW - 1) * scale, extraH * scale);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold ' + Math.round(10.5 * dpr) + 'px "Segoe UI", sans-serif';
        ctx.fillText('+' + extraH.toFixed(0) + ' cm', toPxX(50 + greyW * 0.5), toPxY(30 + extraH * 0.5));
      }
      ctx.restore();

      // Guided transparent vertical tube
      if (state.opts.guided) {
        ctx.save();
        const tubeCenter = sim.x_golf_launch_cm;
        const tubeHalfW = state.params.r_golf + 0.7;
        const txL = toPxX(tubeCenter - tubeHalfW);
        const txR = toPxX(tubeCenter + tubeHalfW);
        const tyTop = toPxY(86);
        const tyBot = toPxY(9);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(txL, tyTop, txR - txL, tyBot - tyTop);
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(txL, tyTop);
        ctx.lineTo(txL, tyBot);
        ctx.moveTo(txR, tyTop);
        ctx.lineTo(txR, tyBot);
        ctx.stroke();

        ctx.fillStyle = 'rgba(125, 211, 252, 0.8)';
        ctx.font = Math.round(10 * dpr) + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('รางบังคับแนวดิ่ง', txR + 4 * dpr, tyTop + 12 * dpr);
        ctx.restore();
      }

      // Free trajectory dashed curve
      if (!state.opts.guided && sim.trajectory && sim.trajectory.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.lineWidth = 1.8 * dpr;
        ctx.beginPath();
        sim.trajectory.forEach(function (pt, idx) {
          const px = toPxX(pt.x);
          const py = toPxY(pt.yCenter);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Triangle Fulcrum (height 3 cm, apex at (x_p, 3))
      ctx.save();
      const triHalfBase = 3.0;
      ctx.beginPath();
      ctx.moveTo(toPxX(sim.x_p), toPxY(3));
      ctx.lineTo(toPxX(sim.x_p - triHalfBase), toPxY(0));
      ctx.lineTo(toPxX(sim.x_p + triHalfBase), toPxY(0));
      ctx.closePath();
      ctx.fillStyle = state.draggingFulcrum || state.hoveringFulcrum ? '#38bdf8' : '#0ea5e9';
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = (state.draggingFulcrum || state.hoveringFulcrum ? 2.4 : 1.4) * dpr;
      ctx.stroke();
      ctx.restore();

      // Board (48 cm rotating around (x_p, 3) at angle sample.theta)
      ctx.save();
      const theta = sample ? sample.theta : sim.theta0;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const tcm = state.params.t_board;
      // u_s = (cosT, -sinT), u_n = (sinT, cosT)
      function boardPt(sCm, nCm) {
        return {
          x: sim.x_p + sCm * cosT + nCm * sinT,
          y: 3 - sCm * sinT + nCm * cosT
        };
      }
      const b0 = boardPt(-sim.R2end, 0);
      const b1 = boardPt(sim.R1end, 0);
      const b2 = boardPt(sim.R1end, tcm);
      const b3 = boardPt(-sim.R2end, tcm);

      ctx.beginPath();
      ctx.moveTo(toPxX(b0.x), toPxY(b0.y));
      ctx.lineTo(toPxX(b1.x), toPxY(b1.y));
      ctx.lineTo(toPxX(b2.x), toPxY(b2.y));
      ctx.lineTo(toPxX(b3.x), toPxY(b3.y));
      ctx.closePath();
      ctx.fillStyle = '#d97706';
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.4 * dpr;
      ctx.stroke();

      // Pivot pin dot
      ctx.beginPath();
      ctx.arc(toPxX(sim.x_p), toPxY(3), 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.restore();

      // Horizontal Blue Pusher Device (อุปกรณ์ผลักลูกกลม) sitting on top of 30 cm grey platform
      if (sample) {
        ctx.save();
        const baseY = 30 + extraH;
        const boxH = 5.2;
        const boxRightX = 63.8;
        const pusherFrontX = sample.pusherX;
        const boxLeftX = Math.min(56.8, Math.max(50.2, pusherFrontX));
        const boxW = Math.max(5.5, boxRightX - boxLeftX);

        // Blue pusher box resting directly on the 30 cm platform
        const gradPush = ctx.createLinearGradient(0, toPxY(baseY + boxH), 0, toPxY(baseY));
        gradPush.addColorStop(0, sample.phase === 'push' ? '#38bdf8' : '#0ea5e9');
        gradPush.addColorStop(1, '#0284c7');
        ctx.fillStyle = gradPush;
        ctx.fillRect(toPxX(boxLeftX), toPxY(baseY + boxH), boxW * scale, boxH * scale);
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.4 * dpr;
        ctx.strokeRect(toPxX(boxLeftX), toPxY(baseY + boxH), boxW * scale, boxH * scale);

        // Push plate on the left face when pushing
        if (pusherFrontX < boxLeftX) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(toPxX(pusherFrontX), toPxY(baseY + 2.8), (boxLeftX - pusherFrontX) * scale, 1.2 * scale);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(toPxX(pusherFrontX), toPxY(baseY + boxH - 0.6), 0.7 * scale, (boxH - 1.2) * scale);
        }

        // Label above blue pusher box
        ctx.fillStyle = '#7dd3fc';
        ctx.font = 'bold ' + Math.round(10.5 * dpr) + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('อุปกรณ์ผลักลูกกลม', toPxX(58.5), toPxY(baseY + boxH + 1.8));
        ctx.restore();
      }

      // Falling ball (Billiard or Tennis)
      if (sample) {
        const bx = toPxX(sample.dropX);
        const by = toPxY(sample.dropY);
        const br = sim.timeline.r_ball * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        if (state.ballType === 'billiard') {
          const gBall = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
          gBall.addColorStop(0, '#f87171');
          gBall.addColorStop(0.55, '#b91c1c');
          gBall.addColorStop(1, '#450a0a');
          ctx.fillStyle = gBall;
          ctx.fill();
          ctx.strokeStyle = '#fecaca';
          ctx.lineWidth = 1 * dpr;
          ctx.stroke();
          // Number circle
          ctx.beginPath();
          ctx.arc(bx, by, br * 0.42, 0, Math.PI * 2);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold ' + Math.max(8, Math.round(br * 0.65)) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('3', bx, by + 0.5 * dpr);
        } else {
          const gBall = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
          gBall.addColorStop(0, '#ecfccb');
          gBall.addColorStop(0.5, '#a3e635');
          gBall.addColorStop(1, '#4d7c0f');
          ctx.fillStyle = gBall;
          ctx.fill();
          ctx.strokeStyle = '#fef9c3';
          ctx.lineWidth = 1.4 * dpr;
          ctx.beginPath();
          ctx.arc(bx - br * 0.45, by, br * 0.6, -Math.PI * 0.38, Math.PI * 0.38);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(bx + br * 0.45, by, br * 0.6, Math.PI * 0.62, Math.PI * 1.38);
          ctx.stroke();
        }
        ctx.restore();

        // Golf ball
        const gx = toPxX(sample.golfX);
        const gy = toPxY(sample.golfY);
        const gr = sim.timeline.r_golf * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        const gGolf = ctx.createRadialGradient(gx - gr * 0.3, gy - gr * 0.3, gr * 0.1, gx, gy, gr);
        gGolf.addColorStop(0, '#ffffff');
        gGolf.addColorStop(0.75, '#e2e8f0');
        gGolf.addColorStop(1, '#94a3b8');
        ctx.fillStyle = gGolf;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
        ctx.restore();

        // Velocity vectors
        if (state.showVectors) {
          const vScale = 4.5 * scale; // 1 m/s -> 4.5 cm arrow length
          if (sample.showV1 || state.animMode === 'idle') {
            const v1Len = Math.max(18 * dpr, sim.v1 * vScale);
            drawArrow(ctx, bx, by + br, bx, by + br + v1Len, '#fb7185', 'v₁=' + sim.v1.toFixed(2) + ' m/s', dpr, true);
          }
          if ((sample.showV2 || state.animMode === 'idle') && sim.v2 > 0.05) {
            const vxPx = sim.v2x * vScale;
            const vyPx = -sim.v2y * vScale;
            drawArrow(ctx, gx, gy - gr, gx + vxPx, gy - gr + vyPx, '#38bdf8', 'v₂=' + sim.v2.toFixed(2) + ' m/s', dpr);
          }
        }
      }

      // Max height marker line
      const showApexBright =
        state.animMode === 'done' || (state.animMode === 'running' && sample && sample.reachedApex);
      if (sim.H_max > 0) {
        ctx.save();
        const pyH = toPxY(sim.H_max);
        const targetX = state.opts.guided ? sim.x_golf_launch_cm : sim.x_apex_cm;
        ctx.strokeStyle = showApexBright ? '#22c55e' : 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = (showApexBright ? 2.0 : 1.2) * dpr;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(toPxX(0), pyH);
        ctx.lineTo(toPxX(Math.max(8, targetX + 4)), pyH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = showApexBright ? '#86efac' : '#cbd5e1';
        ctx.font = 'bold ' + Math.round(11.5 * dpr) + 'px Consolas, "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        const tag = showApexBright ? 'H_max = ' : 'คาดการณ์ H ≈ ';
        ctx.fillText(tag + sim.H_max.toFixed(1) + ' cm', toPxX(Math.max(8, targetX + 4.5)), pyH + 4 * dpr);
        ctx.restore();
      }
    }

    /* ===========================
     *  Graph Canvas Drawing
     * =========================== */
    function drawGraph() {
      const canvas = el.graphCanvas;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(320, Math.round(rect.width * dpr));
      const targetH = Math.max(180, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const curCurve = state.curvesCache[state.ballType] || [];
      const altBall = state.ballType === 'billiard' ? 'tennis' : 'billiard';
      const altCurve = state.curvesCache[altBall] || [];

      const yMax = 90;

      const padL = 52 * dpr;
      const padR = 20 * dpr;
      const padT = 18 * dpr;
      const padB = 38 * dpr;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      function gx(d) {
        return padL + (d / 20) * plotW;
      }
      function gy(H) {
        return padT + plotH - (clamp(H, 0, yMax) / yMax) * plotH;
      }
      function gyRaw(H) {
        return padT + plotH - (H / yMax) * plotH;
      }

      // Target zone bands for current ball
      const targets = Physics.TARGETS[state.ballType];
      targets.forEach(function (t, idx) {
        const y1 = gy(t.max);
        const y2 = gy(t.min);
        const isSel = idx === state.rangeIndex;
        ctx.fillStyle = isSel ? 'rgba(34, 197, 94, 0.22)' : 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(padL, y1, plotW, y2 - y1);
        ctx.strokeStyle = isSel ? 'rgba(34, 197, 94, 0.55)' : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1 * dpr;
        ctx.strokeRect(padL, y1, plotW, y2 - y1);

        ctx.fillStyle = isSel ? '#86efac' : '#94a3b8';
        ctx.font = Math.round(10 * dpr) + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('ระยะ ' + (idx + 1) + ' (' + t.min + '–' + t.max + ')', w - padR - 4 * dpr, (y1 + y2) * 0.5 + 3 * dpr);
      });

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.fillStyle = '#94a3b8';
      ctx.font = Math.round(10.5 * dpr) + 'px Consolas, sans-serif';
      ctx.lineWidth = 1 * dpr;

      for (let d = 0; d <= 20; d += 2) {
        const px = gx(d);
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(String(d), px, padT + plotH + 15 * dpr);
      }

      const yStep = yMax > 80 ? 20 : 10;
      for (let v = 0; v <= yMax; v += yStep) {
        const py = gy(v);
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.fillText(String(v), padL - 6 * dpr, py + 3.5 * dpr);
      }

      // Axes & labels
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold ' + Math.round(11 * dpr) + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ระยะเลื่อนแท่นสามเหลี่ยม d (cm)', padL + plotW * 0.5, h - 6 * dpr);

      ctx.save();
      ctx.translate(14 * dpr, padT + plotH * 0.5);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('ความสูง H (cm)', 0, 0);
      ctx.restore();

      // Alternate curve (faint dashed, clipped inside plot area)
      if (altCurve.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padL, padT, plotW, plotH);
        ctx.clip();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        altCurve.forEach(function (pt, idx) {
          const px = gx(pt.d);
          const py = gyRaw(pt.H);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Current ball curve (clipped inside plot area)
      if (curCurve.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(padL, padT, plotW, plotH);
        ctx.clip();
        ctx.strokeStyle = state.ballType === 'billiard' ? '#38bdf8' : '#a3e635';
        ctx.lineWidth = 2.8 * dpr;
        ctx.beginPath();
        curCurve.forEach(function (pt, idx) {
          const px = gx(pt.d);
          const py = gyRaw(pt.H);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Current d marker
      if (state.activeSim && state.activeSim.valid) {
        const px = gx(state.d);
        const py = gy(state.activeSim.H_max);
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(px, py, 5.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8 * dpr;
        ctx.stroke();

        const label = 'd=' + state.d.toFixed(1) + ', H=' + state.activeSim.H_max.toFixed(1);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold ' + Math.round(11 * dpr) + 'px Consolas, sans-serif';
        ctx.textAlign = px > padL + plotW * 0.65 ? 'right' : 'left';
        ctx.fillText(label, px + (px > padL + plotW * 0.65 ? -8 * dpr : 8 * dpr), Math.max(padT + 14 * dpr, py - 8 * dpr));
        ctx.restore();
      }
    }

    /* ===========================
     *  Simulation Loop & Actions
     * =========================== */
    function startSimulation(instantMode) {
      state.activeSim = Physics.simulate(state.params, state.ballType, state.d, state.opts);
      if (!state.activeSim || !state.activeSim.valid) return;
      state.lockedResult = null;
      if (instantMode) {
        state.simTime = state.activeSim.timeline.tEnd;
        state.animMode = 'done';
        state.lockedResult = state.activeSim;
        updateDashboard();
        updatePhysicsCards();
        drawStage();
        return;
      }
      state.simTime = 0;
      state.animMode = 'running';
      state.lastFrameTs = null;
      updateDashboard();
      updatePhysicsCards();
      requestAnimationFrame(stepAnimation);
    }

    function resetSimulation() {
      state.animMode = 'idle';
      state.simTime = 0;
      state.lockedResult = null;
      state.lastFrameTs = null;
      recomputeActiveSim(false);
    }

    function slideFulcrumTo(targetD) {
      const clamped = Math.round(clamp(targetD, 0, 20) * 10) / 10;
      state.lockedResult = null;
      state.slideFromD = state.d;
      state.slideToD = clamped;
      if (Math.abs(state.slideToD - state.slideFromD) < 0.05) {
        state.d = clamped;
        state.animMode = 'idle';
        recomputeActiveSim(false);
        return;
      }
      state.slideProgress = 0;
      state.animMode = 'sliding';
      state.lastFrameTs = null;
      requestAnimationFrame(stepAnimation);
    }

    function stepAnimation(ts) {
      if (state.lastFrameTs === null) state.lastFrameTs = ts;
      const dtReal = Math.min(0.05, Math.max(0, (ts - state.lastFrameTs) / 1000));
      state.lastFrameTs = ts;

      if (state.animMode === 'sliding') {
        state.slideProgress = Math.min(1, state.slideProgress + dtReal / 0.32);
        const ease = 0.5 - 0.5 * Math.cos(Math.PI * state.slideProgress);
        state.d = Math.round((state.slideFromD + (state.slideToD - state.slideFromD) * ease) * 10) / 10;
        recomputeActiveSim(false);
        if (state.slideProgress < 1) {
          state.animMode = 'sliding';
          requestAnimationFrame(stepAnimation);
        } else {
          state.d = state.slideToD;
          state.animMode = 'idle';
          recomputeActiveSim(false);
        }
        return;
      }

      if (state.animMode === 'running') {
        const sim = state.activeSim;
        if (!sim || !sim.timeline) {
          state.animMode = 'idle';
          return;
        }
        state.simTime += dtReal * state.slowMo;
        if (state.simTime >= sim.timeline.tEnd) {
          state.simTime = sim.timeline.tEnd;
          state.animMode = 'done';
          state.lockedResult = sim;
        }
        updateDashboard();
        updatePhysicsCards();
        drawStage();
        if (state.animMode === 'running') {
          requestAnimationFrame(stepAnimation);
        }
      }
    }

    /* ===========================
     *  Event Handlers
     * =========================== */
    function selectBall(ballType, isRandom) {
      state.ballType = ballType;
      state.sensorAutoText = isRandom
        ? 'สุ่มแล้ว • ตรวจจับอัตโนมัติ: ' + Physics.BALL_LABELS[ballType]
        : 'ตรวจจับอัตโนมัติ: ' + Physics.BALL_LABELS[ballType];
      const target = getCurrentTarget();
      const sol = Physics.solveD(state.params, state.ballType, [target.min, target.max], state.opts);
      slideFulcrumTo(sol.d);
      updateControlsLabels();
      drawGraph();
    }

    function selectRange(idx) {
      state.rangeIndex = idx;
      const target = getCurrentTarget();
      const sol = Physics.solveD(state.params, state.ballType, [target.min, target.max], state.opts);
      slideFulcrumTo(sol.d);
      updateControlsLabels();
      drawGraph();
    }

    el.btnGuided.addEventListener('click', function () {
      state.opts.guided = !state.opts.guided;
      recomputeCurvesAndTable();
      recomputeActiveSim(false);
    });

    el.btnIdeal.addEventListener('click', function () {
      state.opts.ideal = !state.opts.ideal;
      recomputeCurvesAndTable();
      recomputeActiveSim(false);
    });

    el.btnVectors.addEventListener('click', function () {
      state.showVectors = !state.showVectors;
      updateControlsLabels();
      drawStage();
    });

    el.selMeasure.addEventListener('change', function () {
      state.opts.measure = el.selMeasure.value;
      recomputeCurvesAndTable();
      recomputeActiveSim(false);
    });

    el.rngSlowMo.addEventListener('input', function () {
      state.slowMo = parseFloat(el.rngSlowMo.value) || 0.5;
      el.lblSlowMo.textContent = state.slowMo.toFixed(2) + 'x';
    });

    el.rngD.addEventListener('input', function () {
      state.d = parseFloat(el.rngD.value) || 0;
      state.animMode = 'idle';
      recomputeActiveSim(false);
    });

    el.btnBallBilliard.addEventListener('click', function () { selectBall('billiard', false); });
    el.btnBallTennis.addEventListener('click', function () { selectBall('tennis', false); });
    el.btnRandomBall.addEventListener('click', function () {
      const next = Math.random() < 0.5 ? 'billiard' : 'tennis';
      selectBall(next, true);
    });

    el.btnRange1.addEventListener('click', function () { selectRange(0); });
    el.btnRange2.addEventListener('click', function () { selectRange(1); });
    el.btnRange3.addEventListener('click', function () { selectRange(2); });

    el.btnStart.addEventListener('click', function () { startSimulation(false); });
    el.btnReset.addEventListener('click', resetSimulation);

    // Canvas pointer drag for triangle fulcrum
    function getPointerCanvasCssPos(ev) {
      const rect = el.simCanvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    el.simCanvas.addEventListener('pointerdown', function (ev) {
      const tf = getStageTransform(el.simCanvas);
      const pos = getPointerCanvasCssPos(ev);
      const wx = tf.toWorldX(pos.x);
      const wy = tf.toWorldY(pos.y);
      const xp = 25 + state.d;
      if (Math.abs(wx - xp) <= 4.5 && wy >= -4 && wy <= 8) {
        state.draggingFulcrum = true;
        el.simCanvas.setPointerCapture(ev.pointerId);
        el.simCanvas.style.cursor = 'grabbing';
      }
    });

    el.simCanvas.addEventListener('pointermove', function (ev) {
      const tf = getStageTransform(el.simCanvas);
      const pos = getPointerCanvasCssPos(ev);
      const wx = tf.toWorldX(pos.x);
      const wy = tf.toWorldY(pos.y);
      if (state.draggingFulcrum) {
        state.d = Math.round(clamp(wx - 25, 0, 20) * 10) / 10;
        state.animMode = 'idle';
        recomputeActiveSim(false);
      } else {
        const xp = 25 + state.d;
        const near = Math.abs(wx - xp) <= 4.5 && wy >= -4 && wy <= 8;
        if (near !== state.hoveringFulcrum) {
          state.hoveringFulcrum = near;
          el.simCanvas.style.cursor = near ? 'grab' : 'default';
          drawStage();
        }
      }
    });

    function stopDrag(ev) {
      if (state.draggingFulcrum) {
        state.draggingFulcrum = false;
        el.simCanvas.style.cursor = 'grab';
        try { el.simCanvas.releasePointerCapture(ev.pointerId); } catch (e) {}
      }
    }
    el.simCanvas.addEventListener('pointerup', stopDrag);
    el.simCanvas.addEventListener('pointercancel', stopDrag);

    // Arduino copy button
    el.btnCopyArduino.addEventListener('click', function () {
      const text = el.arduinoCodePreview.textContent;
      function doneOk() {
        el.copyStatus.textContent = '✓ คัดลอกโค้ด Arduino ลง Clipboard เรียบร้อยแล้ว';
        setTimeout(function () { el.copyStatus.textContent = ''; }, 3000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(doneOk).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          doneOk();
        } catch (e) {
          el.copyStatus.textContent = 'ไม่สามารถคัดลอกอัตโนมัติได้ กรุณาคัดลอกข้อความในกล่องด้านบนโดยตรง';
        }
        document.body.removeChild(ta);
      }
    });

    // Calibration inputs & presets
    el.selPreset.addEventListener('change', function () {
      const id = el.selPreset.value;
      if (id === 'tuned' || id === 'standard') {
        state.presetId = id;
        state.params = Physics.applyPreset(state.params, id);
        syncInputsFromParams();
        saveStoredState(state.params, state.presetId);
        recomputeCurvesAndTable();
        const target = getCurrentTarget();
        const sol = Physics.solveD(state.params, state.ballType, [target.min, target.max], state.opts);
        state.d = sol.d;
        recomputeActiveSim(false);
      }
    });

    el.btnResetParams.addEventListener('click', function () {
      state.presetId = 'tuned';
      state.params = Physics.defaultParams();
      syncInputsFromParams();
      saveStoredState(state.params, state.presetId);
      recomputeCurvesAndTable();
      const target = getCurrentTarget();
      const sol = Physics.solveD(state.params, state.ballType, [target.min, target.max], state.opts);
      state.d = sol.d;
      recomputeActiveSim(false);
      el.calibMsg.textContent = 'คืนค่าเริ่มต้นชุด "จูนให้ถึงทุกเป้า" เรียบร้อยแล้ว';
    });

    paramInputMap.forEach(function (entry) {
      const input = el[entry[0]];
      const key = entry[1];
      const lo = entry[2];
      const hi = entry[3];
      input.addEventListener('input', function () {
        const val = parseFloat(input.value);
        if (!Number.isFinite(val)) return;
        state.params[key] = clamp(val, lo, hi);
        state.presetId = 'custom';
        el.selPreset.value = 'custom';
        saveStoredState(state.params, state.presetId);
        recomputeCurvesAndTable();
        recomputeActiveSim(false);
      });
    });

    el.btnCalibEta.addEventListener('click', function () {
      const ball = el.selExpBall.value;
      const dMeas = clamp(parseFloat(el.inExpD.value) || 0, 0, 20);
      const hMeas = parseFloat(el.inExpH.value);
      if (!Number.isFinite(hMeas) || hMeas <= 0) {
        el.calibMsg.textContent = 'กรุณากรอกค่าความสูง H ที่วัดได้จริงให้ถูกต้อง';
        return;
      }
      const etaNew = Physics.calibrateEta(state.params, ball, dMeas, hMeas, state.opts);
      if (etaNew === null) {
        el.calibMsg.textContent = 'ไม่สามารถจูนได้: กระดานไม่สามารถส่งลูกหลุดได้ในตำแหน่ง d นี้';
        return;
      }
      const clampedEta = clamp(Math.round(etaNew * 1000) / 1000, 0.05, 5.0);
      state.params.eta = clampedEta;
      state.presetId = 'custom';
      syncInputsFromParams();
      saveStoredState(state.params, state.presetId);
      recomputeCurvesAndTable();
      recomputeActiveSim(false);
      el.calibMsg.textContent =
        'คำนวณสำเร็จ: ปรับค่า η = ' + clampedEta.toFixed(3) + ' เพื่อให้ d = ' + dMeas.toFixed(1) + ' cm ได้ H = ' + hMeas.toFixed(1) + ' cm';
    });

    window.addEventListener('resize', function () {
      drawStage();
      drawGraph();
    });

    // Initial bootstrap
    syncInputsFromParams();
    recomputeCurvesAndTable();
    const initTarget = getCurrentTarget();
    const initSol = Physics.solveD(state.params, state.ballType, [initTarget.min, initTarget.max], state.opts);
    state.d = initSol.d;
    recomputeActiveSim(false);

    // Support #autorun for automated visual/runtime verification
    if (window.location.hash === '#autorun') {
      state.slowMo = 1.0;
      el.rngSlowMo.value = '1.0';
      el.lblSlowMo.textContent = '1.00x';
      startSimulation(false);
    }
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        try { initApp(); } catch (err) { logError(err); }
      });
    } else {
      initApp();
    }
  } catch (err) {
    logError(err);
  }
})();
