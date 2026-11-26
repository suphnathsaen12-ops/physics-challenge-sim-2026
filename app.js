(function () {
  'use strict';

  const STORAGE_KEY = 'ap_challenge_2026_sim_v5';

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

  function saveStoredState(params, presetId, theme, view, renderMode) {
    try {
      const prev = loadStoredState() || {};
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          params: params,
          presetId: presetId,
          theme: theme || prev.theme || 'aiia',
          view: view || prev.view || 'all',
          render: renderMode || prev.render || 'real'
        })
      );
    } catch (e) {
      // Ignore storage quota or private mode restrictions
    }
  }

  function initApp() {
    const stored = loadStoredState();
    const initialTheme = stored && stored.theme ? stored.theme : 'aiia';
    const initialRender = stored && stored.render === 'flat' ? 'flat' : 'real';
    const state = {
      params: Object.assign(Physics.defaultParams(), stored && stored.params ? stored.params : {}),
      presetId: stored && stored.presetId ? stored.presetId : 'tuned',
      theme: initialTheme,
      aiiaVariant: initialTheme === 'aiia-light' ? 'aiia-light' : 'aiia',
      view: stored && stored.view ? stored.view : 'all',
      ballType: 'billiard',
      rangeIndex: 0,
      d: 10.2,
      opts: {
        ideal: false,
        guided: true,
        measure: 'bottom',
        render: initialRender
      },
      showVectors: true,
      slowMo: 0.5,
      sensorAutoText: 'ตรวจจับอัตโนมัติ: ลูกบิลเลียด',
      rouletting: false,

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
      hoveringFulcrum: false,
      countAnim: null,
      flashTimer: null,
      impactTriggered: false,
      launchTriggered: false,
      shakeUntil: 0,
      splashOpen: false
    };

    // DOM References
    const el = {
      splash: document.getElementById('splash'),
      splashLogo: document.getElementById('splashLogo'),
      themeSwitcher: document.getElementById('themeSwitcher'),
      btnAiiaMode: document.getElementById('btnAiiaMode'),
      btnRender: document.getElementById('btnRender'),
      lblRender: document.getElementById('lblRender'),
      btnFullscreen: document.getElementById('btnFullscreen'),
      dashboardCard: document.getElementById('dashboardCard'),
      viewTabs: document.getElementById('viewTabs'),
      leftCol: document.getElementById('leftCol'),
      rightCol: document.getElementById('rightCol'),
      graphCard: document.getElementById('graphCard'),
      calibDetails: document.getElementById('calibDetails'),

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
      state.curvesCache.billiard = Physics.heightCurve(state.params, 'billiard', state.opts, 0.1, -20, 20);
      state.curvesCache.tennis = Physics.heightCurve(state.params, 'tennis', state.opts, 0.1, -20, 20);

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

    function clearFlashAndCount() {
      if (state.countAnim) state.countAnim.active = false;
      state.countAnim = null;
      if (state.flashTimer) {
        clearTimeout(state.flashTimer);
        state.flashTimer = null;
      }
      if (el.dashboardCard) {
        el.dashboardCard.classList.remove('flash-ok', 'flash-fail');
      }
    }

    function recomputeActiveSim(keepLocked) {
      if (!keepLocked) {
        clearFlashAndCount();
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
      const dSign = state.d > 0.05 ? '+' : '';
      el.lblDVal.textContent = dSign + state.d.toFixed(1) + ' cm';

      el.lblGuided.textContent = state.opts.guided ? 'รางบังคับแนวดิ่ง' : 'ลอยอิสระตามมุมกระดก';
      el.btnGuided.classList.toggle('active', state.opts.guided);
      el.btnGuided.classList.toggle('alt-active', !state.opts.guided);

      el.lblIdeal.textContent = state.opts.ideal ? 'อุดมคติ (M=0)' : 'สมจริง';
      el.btnIdeal.classList.toggle('active', !state.opts.ideal);
      el.btnIdeal.classList.toggle('alt-active', state.opts.ideal);

      el.lblVectors.textContent = state.showVectors ? 'เปิด' : 'ปิด';
      el.btnVectors.classList.toggle('active', state.showVectors);

      if (el.lblRender && el.btnRender) {
        const isReal = state.opts.render === 'real';
        el.lblRender.textContent = isReal ? 'สมจริง' : 'แผนภาพ';
        el.btnRender.classList.toggle('active', isReal);
        el.btnRender.classList.toggle('alt-active', !isReal);
      }

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
      const dDirText =
        state.d > 0.05
          ? ' (ไปทางแท่นเทา)'
          : state.d < -0.05
            ? ' (ไปทางเสาเหลือง)'
            : ' (จุดกึ่งกลาง)';
      el.dashD.textContent = (state.d > 0.05 ? '+' : '') + state.d.toFixed(1) + ' cm' + dDirText;

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
        if (!(state.countAnim && state.countAnim.active)) {
          el.dashH.textContent = H.toFixed(2) + ' cm';
        }
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
      if (sim && sim.valid && sim.flags.boardAbovePlatform) {
        warnings.push('⚠ ตำแหน่ง d นี้ทำให้ปลายกระดานฝั่งขวาเชิดสูงเกินระดับแท่น 30 cm ลูกจึงไม่ตกลงมากระทบกระดาน');
      } else if (sim && sim.valid && sim.flags.stalled) {
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
        '<div>x<sub>p</sub> = 25 + (' + s.d.toFixed(1) + ') = ' + s.x_p.toFixed(1) + ' cm, &nbsp; θ₀ = ' + deg0.toFixed(2) + '°</div>' +
        '<div>r₁ = ' + s.r1_cm.toFixed(2) + ' cm, &nbsp; y<sub>top</sub> = 3 − ' + s.r1_cm.toFixed(2) + '·sin(' + deg0.toFixed(2) + '°) + ' + state.params.t_board.toFixed(1) + ' = ' + s.y_impact_top.toFixed(2) + ' cm</div>' +
        '<div>จุดปล่อยลูก: 30.0 cm (ผลักแนวราบจากบนแท่นสีเทา)</div>' +
        (s.flags.boardAbovePlatform
          ? '<div class="res-line">ปลายกระดานเชิดสูงเกิน 30.0 cm → Δh₁ = 0, v₁ = 0 m/s</div>'
          : '<div>Δh₁ = 30.0 − ' + s.y_impact_top.toFixed(2) + ' = ' + s.dh1_cm.toFixed(2) + ' cm (' + s.dh1.toFixed(4) + ' m)</div>' +
            '<div class="res-line">v₁ = √(2 × ' + state.params.g.toFixed(2) + ' × ' + s.dh1.toFixed(4) + ') = ' + s.v1.toFixed(3) + ' m/s</div>');

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

    function getCanvasColors() {
      if (state.theme === 'light' || state.theme === 'aiia-light') {
        const isAiiaLight = state.theme === 'aiia-light';
        return {
          grid: isAiiaLight ? 'rgba(0, 149, 208, 0.08)' : 'rgba(15, 23, 42, 0.08)',
          groundBg: isAiiaLight ? '#ede7f3' : '#e2e8f0',
          groundLine: isAiiaLight ? '#6b21a8' : '#475569',
          labWallTop: isAiiaLight ? '#f4f8ff' : '#f1f5f9',
          labWallBot: isAiiaLight ? '#fceef7' : '#e2e8f0',
          labSpotlight: isAiiaLight ? 'rgba(0, 174, 239, 0.14)' : 'rgba(56, 189, 248, 0.14)',
          labTableTop: isAiiaLight ? '#e8e2f2' : '#cbd5e1',
          labTableBot: isAiiaLight ? '#d3c9e4' : '#94a3b8',
          labTileLine: 'rgba(15, 23, 42, 0.08)',
          labFloorEdge: 'rgba(255, 255, 255, 0.7)',
          rulerText: '#334155',
          previewLine: 'rgba(71, 85, 105, 0.55)',
          previewText: '#334155',
          apexLine: '#16a34a',
          apexText: '#15803d',
          axisLine: '#64748b',
          axisText: '#1e293b',
          curveBilliard: isAiiaLight ? '#0095d0' : '#0284c7',
          curveTennis: isAiiaLight ? '#d9007f' : '#65a30d',
          altCurve: 'rgba(100, 116, 139, 0.45)',
          dotFill: '#eab308',
          dotStroke: '#0f172a',
          dotText: '#b45309'
        };
      }
      if (state.theme === 'arcade') {
        return {
          grid: 'rgba(236, 72, 153, 0.12)',
          groundBg: '#170a2e',
          groundLine: '#ec4899',
          labWallTop: '#0b0419',
          labWallBot: '#180932',
          labSpotlight: 'rgba(236, 72, 153, 0.18)',
          labTableTop: '#1f0e3f',
          labTableBot: '#0d051c',
          labTileLine: 'rgba(34, 211, 238, 0.14)',
          labFloorEdge: 'rgba(236, 72, 153, 0.55)',
          rulerText: '#c4b5fd',
          previewLine: 'rgba(196, 181, 253, 0.5)',
          previewText: '#e9d5ff',
          apexLine: '#4ade80',
          apexText: '#86efac',
          axisLine: '#a855f7',
          axisText: '#f5d0fe',
          curveBilliard: '#22d3ee',
          curveTennis: '#a3e635',
          altCurve: 'rgba(196, 181, 253, 0.42)',
          dotFill: '#facc15',
          dotStroke: '#090314',
          dotText: '#fde047'
        };
      }
      if (state.theme === 'aiia') {
        return {
          grid: 'rgba(0, 174, 239, 0.10)',
          groundBg: '#15112c',
          groundLine: '#00AEEF',
          labWallTop: '#080615',
          labWallBot: '#141030',
          labSpotlight: 'rgba(0, 174, 239, 0.18)',
          labTableTop: '#1e1942',
          labTableBot: '#0b081b',
          labTileLine: 'rgba(0, 174, 239, 0.12)',
          labFloorEdge: 'rgba(0, 174, 239, 0.45)',
          rulerText: '#cbd5e1',
          previewLine: 'rgba(180, 186, 219, 0.48)',
          previewText: '#e2e8f0',
          apexLine: '#22c55e',
          apexText: '#86efac',
          axisLine: '#6366f1',
          axisText: '#e2e8f0',
          curveBilliard: '#00AEEF',
          curveTennis: '#EC008C',
          altCurve: 'rgba(180, 186, 219, 0.44)',
          dotFill: '#facc15',
          dotStroke: '#0b091c',
          dotText: '#fef08a'
        };
      }
      return {
        grid: 'rgba(148, 163, 184, 0.08)',
        groundBg: '#1e293b',
        groundLine: '#64748b',
        labWallTop: '#060b16',
        labWallBot: '#111c32',
        labSpotlight: 'rgba(56, 189, 248, 0.15)',
        labTableTop: '#243248',
        labTableBot: '#0f172a',
        labTileLine: 'rgba(148, 163, 184, 0.12)',
        labFloorEdge: 'rgba(148, 163, 184, 0.35)',
        rulerText: '#94a3b8',
        previewLine: 'rgba(148, 163, 184, 0.45)',
        previewText: '#cbd5e1',
        apexLine: '#22c55e',
        apexText: '#86efac',
        axisLine: '#64748b',
        axisText: '#cbd5e1',
        curveBilliard: '#38bdf8',
        curveTennis: '#a3e635',
        altCurve: 'rgba(148, 163, 184, 0.45)',
        dotFill: '#facc15',
        dotStroke: '#0f172a',
        dotText: '#fef08a'
      };
    }

    function applyTheme(theme) {
      const validThemes = ['aiia', 'aiia-light', 'neon', 'light', 'arcade'];
      state.theme = validThemes.indexOf(theme) >= 0 ? theme : 'aiia';
      if (state.theme === 'aiia' || state.theme === 'aiia-light') {
        state.aiiaVariant = state.theme;
      }
      document.body.setAttribute('data-theme', state.theme);
      const isAiia = state.theme === 'aiia' || state.theme === 'aiia-light';
      if (el.themeSwitcher) {
        const pills = el.themeSwitcher.querySelectorAll('.theme-pill');
        pills.forEach(function (btn) {
          const opt = btn.getAttribute('data-theme-opt');
          const active = opt === 'aiia' ? isAiia : opt === state.theme;
          btn.classList.toggle('active', active);
        });
      }
      if (el.btnAiiaMode) {
        el.btnAiiaMode.hidden = !isAiia;
        el.btnAiiaMode.disabled = !isAiia;
        el.btnAiiaMode.textContent = state.theme === 'aiia-light' ? '☀️' : '🌙';
      }
      saveStoredState(state.params, state.presetId, state.theme, state.view, state.opts.render);
      drawStage();
      drawGraph();
    }

    function applyViewTab(view) {
      const validViews = ['all', 'physics', 'graph', 'results', 'table', 'calib'];
      state.view = validViews.indexOf(view) >= 0 ? view : 'all';
      document.body.setAttribute('data-view', state.view);
      if (el.viewTabs) {
        const tabs = el.viewTabs.querySelectorAll('.view-tab');
        tabs.forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-view-opt') === state.view);
        });
      }
      if (el.graphCard && el.leftCol && el.rightCol) {
        if (state.view === 'graph') {
          el.rightCol.appendChild(el.graphCard);
        } else {
          el.leftCol.appendChild(el.graphCard);
        }
      }
      if (state.view === 'calib' && el.calibDetails) {
        el.calibDetails.open = true;
      }
      saveStoredState(state.params, state.presetId, state.theme, state.view, state.opts.render);
      drawStage();
      drawGraph();
    }

    function drawExtrudedBox(ctx, x1, y1, wPx, hPx, dx, dy, topFill, sideFill, edgeStroke, dpr) {
      ctx.save();
      // Top bevel/depth face
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + dx, y1 + dy);
      ctx.lineTo(x1 + wPx + dx, y1 + dy);
      ctx.lineTo(x1 + wPx, y1);
      ctx.closePath();
      ctx.fillStyle = topFill;
      ctx.fill();
      if (edgeStroke) {
        ctx.strokeStyle = edgeStroke;
        ctx.lineWidth = 0.9 * dpr;
        ctx.stroke();
      }
      // Right side depth face
      ctx.beginPath();
      ctx.moveTo(x1 + wPx, y1);
      ctx.lineTo(x1 + wPx + dx, y1 + dy);
      ctx.lineTo(x1 + wPx + dx, y1 + hPx + dy);
      ctx.lineTo(x1 + wPx, y1 + hPx);
      ctx.closePath();
      ctx.fillStyle = sideFill;
      ctx.fill();
      if (edgeStroke) {
        ctx.strokeStyle = edgeStroke;
        ctx.lineWidth = 0.9 * dpr;
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFloorShadow(ctx, cx, cy, rx, ry, alpha) {
      if (rx <= 0.5 || ry <= 0.5 || alpha <= 0.01) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const grad = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
      grad.addColorStop(0, 'rgba(2, 6, 23, ' + alpha.toFixed(2) + ')');
      grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawStage() {
      const canvas = el.simCanvas;
      const ctx = canvas.getContext('2d');
      const tf = getStageTransform(canvas);
      const { w, h, dpr, scale, toPxX, toPxY } = tf;
      const sim = state.activeSim;
      if (!sim || !sim.valid) return;
      const pal = getCanvasColors();
      const isReal = state.opts.render === 'real';
      const isLightTheme = state.theme === 'light' || state.theme === 'aiia-light';
      const depthCm = 6;
      const depX = 0.5 * depthCm * scale * Math.cos(Math.PI / 6);
      const depY = -0.5 * depthCm * scale * Math.sin(Math.PI / 6);

      const sample =
        state.animMode === 'running' || state.animMode === 'done'
          ? Physics.sampleState(sim, state.simTime)
          : Physics.sampleState(sim, 0);

      ctx.clearRect(0, 0, w, h);

      // Subtle 0.15s impact camera shake in realistic mode
      let didShake = false;
      const nowMs = performance.now();
      if (isReal && state.shakeUntil > nowMs) {
        const frac = (state.shakeUntil - nowMs) / 150;
        const sx = Math.sin(nowMs * 0.25) * 3.0 * dpr * frac;
        const sy = Math.cos(nowMs * 0.35) * 2.5 * dpr * frac;
        ctx.save();
        ctx.translate(sx, sy);
        didShake = true;
      }

      // Lab wall + spotlight in realistic mode
      if (isReal) {
        ctx.save();
        const yFloor = toPxY(0);
        const wallGrad = ctx.createLinearGradient(0, 0, 0, yFloor);
        wallGrad.addColorStop(0, pal.labWallTop);
        wallGrad.addColorStop(1, pal.labWallBot);
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, 0, w, yFloor);

        const spotX = toPxX(28);
        const spotY = toPxY(34);
        const spotR = Math.max(w, h) * 0.58;
        const spotGrad = ctx.createRadialGradient(spotX, spotY, scale * 4, spotX, spotY, spotR);
        spotGrad.addColorStop(0, pal.labSpotlight);
        spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = spotGrad;
        ctx.fillRect(0, 0, w, yFloor);
        ctx.restore();
      }

      // Subtle background grid (10 cm)
      ctx.save();
      ctx.strokeStyle = pal.grid;
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

      // Ground floor / Lab bench table
      ctx.save();
      const y0Px = toPxY(0);
      if (isReal) {
        const tableGrad = ctx.createLinearGradient(0, y0Px, 0, h);
        tableGrad.addColorStop(0, pal.labTableTop);
        tableGrad.addColorStop(1, pal.labTableBot);
        ctx.fillStyle = tableGrad;
        ctx.fillRect(0, y0Px, w, h - y0Px);

        // Faint lab bench tile joints
        ctx.strokeStyle = pal.labTileLine;
        ctx.lineWidth = 1 * dpr;
        for (let tx = -10; tx <= 65; tx += 12.5) {
          const tpx = toPxX(tx);
          ctx.beginPath();
          ctx.moveTo(tpx, y0Px);
          ctx.lineTo(tpx, h);
          ctx.stroke();
        }
        ctx.strokeStyle = pal.labFloorEdge;
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(0, y0Px + 1.5 * dpr);
        ctx.lineTo(w, y0Px + 1.5 * dpr);
        ctx.stroke();
      } else {
        ctx.fillStyle = pal.groundBg;
        ctx.fillRect(0, y0Px, w, h - y0Px);
      }
      ctx.strokeStyle = pal.groundLine;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, y0Px);
      ctx.lineTo(w, y0Px);
      ctx.stroke();

      // Ambient apparatus ground shadows & live ball floor shadows
      if (isReal) {
        drawFloorShadow(ctx, toPxX(-4), y0Px + 1.2 * dpr, 5.2 * scale, 1.3 * scale, 0.34);
        drawFloorShadow(ctx, toPxX(57), y0Px + 1.2 * dpr, 8.2 * scale, 1.5 * scale, 0.38);
        drawFloorShadow(ctx, toPxX(sim.x_p), y0Px + 1.0 * dpr, 4.0 * scale, 1.0 * scale, 0.30);
        if (sample) {
          const hDrop = Math.max(0, sample.dropY - sim.timeline.r_ball);
          const sDrop = 1 / (1 + hDrop / 26);
          drawFloorShadow(ctx, toPxX(sample.dropX), y0Px + 1.0 * dpr, sim.timeline.r_ball * scale * 1.15 * sDrop, 0.95 * scale * sDrop, 0.42 * sDrop);

          const hGolf = Math.max(0, sample.golfY - sim.timeline.r_golf);
          const sGolf = 1 / (1 + hGolf / 32);
          drawFloorShadow(ctx, toPxX(sample.golfX), y0Px + 1.0 * dpr, sim.timeline.r_golf * scale * 1.2 * sGolf, 0.9 * scale * sGolf, 0.40 * sGolf);
        }
      }

      // Horizontal 0..50 cm ruler & midpoint 25 cm
      ctx.strokeStyle = pal.rulerText;
      ctx.fillStyle = pal.rulerText;
      ctx.font = Math.round(10 * dpr) + 'px Consolas, sans-serif';
      ctx.textAlign = 'center';
      for (let rx = 0; rx <= 50; rx += 5) {
        const px = toPxX(rx);
        const tickH = rx % 10 === 0 ? 5 * dpr : 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(px, y0Px);
        ctx.lineTo(px, y0Px + tickH);
        ctx.stroke();
        if (rx === 0 || rx === 25 || rx === 50) {
          ctx.fillText(rx + ' cm', px, y0Px + 14 * dpr);
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
      ctx.fillStyle = state.d < -0.05 ? '#facc15' : '#38bdf8';
      ctx.font = 'bold ' + Math.round(11 * dpr) + 'px "Segoe UI", sans-serif';
      const dLabel = 'd = ' + (state.d > 0.05 ? '+' : '') + state.d.toFixed(1) + ' cm';
      ctx.fillText(dLabel, (pxMid + pxPivot) * 0.5, bracketY + 12 * dpr);
      ctx.restore();

      // Target zone band (behind/aligned with yellow ruler)
      const target = getCurrentTarget();
      const yBandTop = toPxY(target.max);
      const yBandBot = toPxY(target.min);
      ctx.save();
      ctx.fillStyle = 'rgba(34, 197, 94, 0.12)';
      ctx.fillRect(toPxX(-8), yBandTop, 16 * scale, yBandBot - yBandTop);
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.moveTo(toPxX(-8), yBandTop);
      ctx.lineTo(toPxX(16), yBandTop);
      ctx.moveTo(toPxX(-8), yBandBot);
      ctx.lineTo(toPxX(16), yBandBot);
      ctx.stroke();
      ctx.restore();

      // Yellow Pillar (-8..0, 0..80)
      ctx.save();
      const ypX = toPxX(-8);
      const ypY = toPxY(80);
      const ypW = 8 * scale;
      const ypH = 80 * scale;
      if (isReal) {
        drawExtrudedBox(ctx, ypX, ypY, ypW, ypH, depX, depY, '#fef08a', '#854d0e', 'rgba(254, 240, 138, 0.35)', dpr);
        const gradY = ctx.createLinearGradient(ypX, ypY, ypX + ypW, ypY + ypH);
        gradY.addColorStop(0, '#ca8a04');
        gradY.addColorStop(0.45, '#facc15');
        gradY.addColorStop(1, '#eab308');
        ctx.fillStyle = gradY;
      } else {
        const gradY = ctx.createLinearGradient(ypX, 0, toPxX(0), 0);
        gradY.addColorStop(0, '#ca8a04');
        gradY.addColorStop(1, '#facc15');
        ctx.fillStyle = gradY;
      }
      ctx.fillRect(ypX, ypY, ypW, ypH);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeRect(ypX, ypY, ypW, ypH);

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
        ctx.fillStyle = isLightTheme ? '#b45309' : '#fde047';
        ctx.fillText('90', toPxX(0) - 2.5 * scale, toPxY(90) + 3.5 * dpr);
      }
      ctx.restore();

      // Grey Pillar (50..64, 0..30)
      ctx.save();
      const greyW = 14;
      const gpX = toPxX(50);
      const gpY = toPxY(30);
      const gpW = greyW * scale;
      const gpH = 30 * scale;
      if (isReal) {
        drawExtrudedBox(ctx, gpX, gpY, gpW, gpH, depX, depY, '#cbd5e1', '#475569', 'rgba(226, 232, 240, 0.35)', dpr);
        const gradG = ctx.createLinearGradient(gpX, gpY, gpX + gpW, gpY + gpH);
        gradG.addColorStop(0, '#cbd5e1');
        gradG.addColorStop(0.35, '#94a3b8');
        gradG.addColorStop(1, '#64748b');
        ctx.fillStyle = gradG;
      } else {
        const gradG = ctx.createLinearGradient(gpX, 0, toPxX(50 + greyW), 0);
        gradG.addColorStop(0, '#94a3b8');
        gradG.addColorStop(1, '#64748b');
        ctx.fillStyle = gradG;
      }
      ctx.fillRect(gpX, gpY, gpW, gpH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeRect(gpX, gpY, gpW, gpH);

      if (isReal) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(gpX + 1 * dpr, gpY + 1.5 * dpr);
        ctx.lineTo(gpX + gpW - 1 * dpr, gpY + 1.5 * dpr);
        ctx.stroke();
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold ' + Math.round(11 * dpr) + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('แท่นสีเทา 30 cm', toPxX(50 + greyW * 0.5), toPxY(11));

      // Orange dashed drop guide line along the 30 cm drop path
      if (!sim.flags.boardAbovePlatform) {
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.75)';
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(toPxX(49.2), toPxY(30));
        ctx.lineTo(toPxX(49.2), toPxY(sim.y_impact_top));
        ctx.stroke();
        ctx.setLineDash([]);
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
        if (isReal) {
          const tubeGrad = ctx.createLinearGradient(txL, 0, txR, 0);
          tubeGrad.addColorStop(0, 'rgba(186, 230, 253, 0.18)');
          tubeGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.22)');
          tubeGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.06)');
          tubeGrad.addColorStop(1, 'rgba(14, 165, 233, 0.14)');
          ctx.fillStyle = tubeGrad;
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        }
        ctx.fillRect(txL, tyTop, txR - txL, tyBot - tyTop);
        ctx.strokeStyle = isLightTheme ? 'rgba(2, 132, 199, 0.65)' : 'rgba(125, 211, 252, 0.55)';
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(txL, tyTop);
        ctx.lineTo(txL, tyBot);
        ctx.moveTo(txR, tyTop);
        ctx.lineTo(txR, tyBot);
        ctx.stroke();

        ctx.fillStyle = isLightTheme ? '#0369a1' : 'rgba(125, 211, 252, 0.85)';
        ctx.font = 'bold ' + Math.round(10 * dpr) + 'px "Segoe UI", sans-serif';
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
      const apexPxX = toPxX(sim.x_p);
      const apexPxY = toPxY(3);
      const triLeftPxX = toPxX(sim.x_p - triHalfBase);
      const triRightPxX = toPxX(sim.x_p + triHalfBase);
      const triBasePxY = toPxY(0);
      if (isReal) {
        const triDx = depX * 0.82;
        const triDy = depY * 0.82;
        ctx.beginPath();
        ctx.moveTo(apexPxX, apexPxY);
        ctx.lineTo(apexPxX + triDx, apexPxY + triDy);
        ctx.lineTo(triRightPxX + triDx, triBasePxY + triDy);
        ctx.lineTo(triRightPxX, triBasePxY);
        ctx.closePath();
        ctx.fillStyle = '#0369a1';
        ctx.fill();
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(apexPxX, apexPxY);
      ctx.lineTo(triLeftPxX, triBasePxY);
      ctx.lineTo(triRightPxX, triBasePxY);
      ctx.closePath();
      if (isReal) {
        const triGrad = ctx.createLinearGradient(triLeftPxX, apexPxY, triRightPxX, triBasePxY);
        triGrad.addColorStop(0, state.draggingFulcrum || state.hoveringFulcrum ? '#7dd3fc' : '#38bdf8');
        triGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = triGrad;
      } else {
        ctx.fillStyle = state.draggingFulcrum || state.hoveringFulcrum ? '#38bdf8' : '#0ea5e9';
      }
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

      const p0x = toPxX(b0.x), p0y = toPxY(b0.y);
      const p1x = toPxX(b1.x), p1y = toPxY(b1.y);
      const p2x = toPxX(b2.x), p2y = toPxY(b2.y);
      const p3x = toPxX(b3.x), p3y = toPxY(b3.y);

      if (isReal) {
        const bDx = depX * 0.78;
        const bDy = depY * 0.78;
        // Upper board face behind front edge
        ctx.beginPath();
        ctx.moveTo(p3x, p3y);
        ctx.lineTo(p3x + bDx, p3y + bDy);
        ctx.lineTo(p2x + bDx, p2y + bDy);
        ctx.lineTo(p2x, p2y);
        ctx.closePath();
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = 'rgba(254, 243, 199, 0.4)';
        ctx.lineWidth = 0.9 * dpr;
        ctx.stroke();

        // Right board thickness end face
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p1x + bDx, p1y + bDy);
        ctx.lineTo(p2x + bDx, p2y + bDy);
        ctx.lineTo(p2x, p2y);
        ctx.closePath();
        ctx.fillStyle = '#78350f';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(p3x, p3y);
      ctx.closePath();
      if (isReal) {
        const boardGrad = ctx.createLinearGradient(p3x, p3y, p0x, p0y);
        boardGrad.addColorStop(0, '#ea8c1e');
        boardGrad.addColorStop(0.55, '#c2610c');
        boardGrad.addColorStop(1, '#92400e');
        ctx.fillStyle = boardGrad;
        ctx.fill();
        // Fine wood-grain lines clipped inside board
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(69, 26, 3, 0.35)';
        ctx.lineWidth = 0.8 * dpr;
        [0.32, 0.65].forEach(function (fracN) {
          const ga = boardPt(-sim.R2end, tcm * fracN);
          const gb = boardPt(sim.R1end, tcm * fracN);
          ctx.beginPath();
          ctx.moveTo(toPxX(ga.x), toPxY(ga.y));
          ctx.lineTo(toPxX(gb.x), toPxY(gb.y));
          ctx.stroke();
        });
        ctx.restore();
      } else {
        ctx.fillStyle = '#d97706';
        ctx.fill();
      }
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.4 * dpr;
      ctx.stroke();

      // Pivot pin dot
      ctx.beginPath();
      ctx.arc(apexPxX, apexPxY, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      if (isReal) {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      }
      ctx.restore();

      // Horizontal Blue Pusher Actuator & Piston Head (อุปกรณ์ผลักลูกกลม) directly on 30 cm grey platform
      if (sample) {
        ctx.save();
        const baseY = 30;
        const boxH = 5.0;
        const housingLeftX = 57.6;
        const housingRightX = 63.8;
        const housingW = housingRightX - housingLeftX;
        const hPxX = toPxX(housingLeftX);
        const hPxY = toPxY(baseY + boxH);
        const hPxW = housingW * scale;
        const hPxH = boxH * scale;

        if (isReal) {
          drawExtrudedBox(
            ctx,
            hPxX,
            hPxY,
            hPxW,
            hPxH,
            depX * 0.72,
            depY * 0.72,
            sample.phase === 'push' ? '#7dd3fc' : '#38bdf8',
            '#0369a1',
            'rgba(186, 230, 253, 0.45)',
            dpr
          );
        }

        // Blue pusher housing on the right of the ball
        const gradPush = ctx.createLinearGradient(0, hPxY, 0, toPxY(baseY));
        gradPush.addColorStop(0, sample.phase === 'push' ? '#38bdf8' : '#0ea5e9');
        gradPush.addColorStop(1, '#0284c7');
        ctx.fillStyle = gradPush;
        ctx.fillRect(hPxX, hPxY, hPxW, hPxH);
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1.4 * dpr;
        ctx.strokeRect(hPxX, hPxY, hPxW, hPxH);

        // Sliding piston rod + push head block from housing to ball
        const headLeftX = Math.max(50.0, sample.pusherX);
        const headW = 1.6;
        const rodLeftX = headLeftX + headW;
        if (rodLeftX < housingLeftX) {
          const rodPxX = toPxX(rodLeftX);
          const rodPxY = toPxY(baseY + 2.9);
          const rodPxW = (housingLeftX - rodLeftX) * scale;
          const rodPxH = 1.0 * scale;
          if (isReal) {
            const rodGrad = ctx.createLinearGradient(0, rodPxY, 0, rodPxY + rodPxH);
            rodGrad.addColorStop(0, '#f8fafc');
            rodGrad.addColorStop(0.5, '#cbd5e1');
            rodGrad.addColorStop(1, '#64748b');
            ctx.fillStyle = rodGrad;
          } else {
            ctx.fillStyle = '#cbd5e1';
          }
          ctx.fillRect(rodPxX, rodPxY, rodPxW, rodPxH);
        }

        const hdPxX = toPxX(headLeftX);
        const hdPxY = toPxY(baseY + 4.1);
        const hdPxW = headW * scale;
        const hdPxH = 3.4 * scale;
        if (isReal) {
          drawExtrudedBox(
            ctx,
            hdPxX,
            hdPxY,
            hdPxW,
            hdPxH,
            depX * 0.55,
            depY * 0.55,
            '#94a3b8',
            '#1e293b',
            null,
            dpr
          );
        }
        ctx.fillStyle = sample.phase === 'push' ? '#38bdf8' : '#334155';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.3 * dpr;
        ctx.fillRect(hdPxX, hdPxY, hdPxW, hdPxH);
        ctx.strokeRect(hdPxX, hdPxY, hdPxW, hdPxH);

        // Label above blue pusher device
        ctx.fillStyle = isLightTheme ? '#0369a1' : '#7dd3fc';
        ctx.font = 'bold ' + Math.round(10.5 * dpr) + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('อุปกรณ์ผลักลูกกลม', toPxX(59.0), toPxY(baseY + boxH + 1.8));
        ctx.restore();
      }

      // Motion Trail & Impact Shockwave during live animation
      if (state.animMode === 'running' && sample && sim.timeline) {
        ctx.save();
        const trailCount = 8;
        for (let k = trailCount; k >= 1; k--) {
          const pastT = state.simTime - k * 0.012;
          if (pastT < 0) continue;
          const past = Physics.sampleState(sim, pastT);
          if (!past) continue;
          const alpha = (1 - k / (trailCount + 1)) * 0.45;
          if (sample.phase === 'fall' && past.phase === 'fall') {
            ctx.beginPath();
            ctx.arc(toPxX(past.dropX), toPxY(past.dropY), sim.timeline.r_ball * scale * (1 - k * 0.06), 0, Math.PI * 2);
            ctx.fillStyle = state.ballType === 'billiard'
              ? 'rgba(248, 113, 113, ' + alpha.toFixed(2) + ')'
              : 'rgba(163, 230, 53, ' + alpha.toFixed(2) + ')';
            ctx.fill();
          }
          if (sample.phase === 'flight' && past.phase === 'flight' && state.simTime <= sim.timeline.tApexAbs + 0.06) {
            ctx.beginPath();
            ctx.arc(toPxX(past.golfX), toPxY(past.golfY), sim.timeline.r_golf * scale * (1 - k * 0.06), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(56, 189, 248, ' + alpha.toFixed(2) + ')';
            ctx.fill();
          }
        }

        // Expanding shockwave rings right after impact
        const dtImpact = state.simTime - sim.timeline.tImpact;
        if (dtImpact >= 0 && dtImpact <= 0.30) {
          const prog = dtImpact / 0.30;
          const ix = toPxX(sim.timeline.x_impact);
          const iy = toPxY(sim.y_impact_top);
          [0, 0.18].forEach(function (lag) {
            const p = prog - lag;
            if (p <= 0 || p >= 1) return;
            const ringR = (1.5 + p * 11.5) * scale;
            ctx.beginPath();
            ctx.arc(ix, iy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(251, 191, 36, ' + ((1 - p) * 0.8).toFixed(2) + ')';
            ctx.lineWidth = 2.2 * dpr;
            ctx.stroke();
          });
        }
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
          gBall.addColorStop(0, isReal ? '#fca5a5' : '#f87171');
          gBall.addColorStop(0.5, '#b91c1c');
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
          if (isReal) {
            ctx.beginPath();
            ctx.ellipse(bx - br * 0.32, by - br * 0.34, br * 0.24, br * 0.14, -Math.PI * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.fill();
          }
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
          if (isReal) {
            ctx.beginPath();
            ctx.ellipse(bx - br * 0.30, by - br * 0.32, br * 0.22, br * 0.12, -Math.PI * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
            ctx.fill();
          }
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
        gGolf.addColorStop(0.72, '#e2e8f0');
        gGolf.addColorStop(1, isReal ? '#64748b' : '#94a3b8');
        ctx.fillStyle = gGolf;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
        if (isReal) {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
          [
            [-0.25, -0.1], [0.15, -0.25], [0.22, 0.18], [-0.15, 0.28], [0.0, 0.04]
          ].forEach(function (pt) {
            ctx.beginPath();
            ctx.arc(gx + pt[0] * gr, gy + pt[1] * gr, gr * 0.08, 0, Math.PI * 2);
            ctx.fill();
          });
        }
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

      // Max height marker line & Apex celebration sparkles (always drawn crisp on top)
      const showApexBright =
        state.animMode === 'done' || (state.animMode === 'running' && sample && sample.reachedApex);
      const inTarget = sim.H_max >= target.min && sim.H_max <= target.max;
      if (sim.H_max > 0) {
        ctx.save();
        const pyH = toPxY(sim.H_max);
        const targetX = state.opts.guided ? sim.x_golf_launch_cm : sim.x_apex_cm;
        ctx.strokeStyle = showApexBright ? pal.apexLine : pal.previewLine;
        ctx.lineWidth = (showApexBright ? 2.2 : 1.2) * dpr;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(toPxX(0), pyH);
        ctx.lineTo(toPxX(Math.max(8, targetX + 4)), pyH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = showApexBright ? pal.apexText : pal.previewText;
        ctx.font = 'bold ' + Math.round(11.5 * dpr) + 'px Consolas, "Segoe UI", sans-serif';
        ctx.textAlign = 'left';
        const tag = showApexBright ? 'H_max = ' : 'คาดการณ์ H ≈ ';
        ctx.fillText(tag + sim.H_max.toFixed(1) + ' cm', toPxX(Math.max(8, targetX + 4.5)), pyH + 4 * dpr);

        // Celebration starburst sparkles when hitting target at apex
        if (showApexBright && inTarget) {
          const sx = toPxX(targetX);
          const sy = pyH;
          const sparkColors = ['#facc15', '#4ade80', '#38bdf8', '#f472b6'];
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2 + (state.animMode === 'running' ? state.simTime * 3 : 0.25);
            const dist = (i % 2 === 0 ? 3.2 : 5.0) * scale;
            const px = sx + Math.cos(ang) * dist;
            const py = sy + Math.sin(ang) * dist;
            ctx.beginPath();
            ctx.arc(px, py, (i % 2 === 0 ? 2.6 : 1.9) * dpr, 0, Math.PI * 2);
            ctx.fillStyle = sparkColors[i % sparkColors.length];
            ctx.fill();
          }
        }
        ctx.restore();
      }

      if (didShake) {
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
      const pal = getCanvasColors();

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
        return padL + ((d + 20) / 40) * plotW;
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

        ctx.fillStyle = isSel ? (state.theme === 'light' ? '#15803d' : '#86efac') : pal.rulerText;
        ctx.font = 'bold ' + Math.round(10 * dpr) + 'px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('ระยะ ' + (idx + 1) + ' (' + t.min + '–' + t.max + ')', w - padR - 4 * dpr, (y1 + y2) * 0.5 + 3 * dpr);
      });

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.fillStyle = pal.rulerText;
      ctx.font = Math.round(10.5 * dpr) + 'px Consolas, sans-serif';
      ctx.lineWidth = 1 * dpr;

      for (let d = -20; d <= 20; d += 5) {
        const px = gx(d);
        ctx.strokeStyle = d === 0 ? 'rgba(250, 204, 21, 0.45)' : 'rgba(148, 163, 184, 0.16)';
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText((d > 0 ? '+' : '') + String(d), px, padT + plotH + 15 * dpr);
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
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
      ctx.strokeStyle = pal.axisLine;
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT + plotH);
      ctx.lineTo(padL + plotW, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = pal.axisText;
      ctx.font = 'bold ' + Math.round(11 * dpr) + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ระยะเลื่อนแท่นสามเหลี่ยม d (cm)  [ ← เสาเหลือง | แท่นเทา → ]', padL + plotW * 0.5, h - 6 * dpr);

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
        ctx.strokeStyle = pal.altCurve;
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
        ctx.strokeStyle = state.ballType === 'billiard' ? pal.curveBilliard : pal.curveTennis;
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
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(px, py, 5.5 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = pal.dotFill;
        ctx.fill();
        ctx.strokeStyle = pal.dotStroke;
        ctx.lineWidth = 1.8 * dpr;
        ctx.stroke();

        const label = 'd=' + state.d.toFixed(1) + ', H=' + state.activeSim.H_max.toFixed(1);
        ctx.fillStyle = pal.dotText;
        ctx.font = 'bold ' + Math.round(11 * dpr) + 'px Consolas, sans-serif';
        ctx.textAlign = px > padL + plotW * 0.65 ? 'right' : 'left';
        ctx.fillText(label, px + (px > padL + plotW * 0.65 ? -8 * dpr : 8 * dpr), Math.max(padT + 14 * dpr, py - 8 * dpr));
        ctx.restore();
      }
    }

    /* ===========================
     *  Simulation Loop & Actions
     * =========================== */
    function recordResult(sim) {
      if (!window.ResultsLog || !sim || !sim.valid) return;
      const target = getCurrentTarget();
      const H = sim.H_max;
      const pass = H >= target.min && H <= target.max;
      window.ResultsLog.add({
        ball: state.ballType,
        ballLabel: Physics.BALL_LABELS[state.ballType],
        rangeLabel: target.label,
        min: target.min,
        max: target.max,
        d: state.d,
        H: H,
        pass: pass,
        model: state.opts.ideal ? 'อุดมคติ' : 'สมจริง',
        path: state.opts.guided ? 'ราง' : 'อิสระ'
      });
    }

    function triggerDashboardFlash(pass) {
      if (!el.dashboardCard) return;
      el.dashboardCard.classList.remove('flash-ok', 'flash-fail');
      void el.dashboardCard.offsetWidth;
      el.dashboardCard.classList.add(pass ? 'flash-ok' : 'flash-fail');
      if (state.flashTimer) clearTimeout(state.flashTimer);
      state.flashTimer = setTimeout(function () {
        if (el.dashboardCard) el.dashboardCard.classList.remove('flash-ok', 'flash-fail');
        state.flashTimer = null;
      }, 1250);
    }

    function startCountUpAndFlash(targetH, pass) {
      clearFlashAndCount();
      const anim = { active: true, to: targetH, startTs: null, dur: 800, pass: pass };
      state.countAnim = anim;
      el.dashH.textContent = '0.00 cm';

      function stepCount(now) {
        if (state.countAnim !== anim || !anim.active) return;
        if (anim.startTs === null) anim.startTs = now;
        const frac = clamp((now - anim.startTs) / anim.dur, 0, 1);
        const eased = 1 - Math.pow(1 - frac, 3);
        el.dashH.textContent = (anim.to * eased).toFixed(2) + ' cm';
        if (frac < 1) {
          requestAnimationFrame(stepCount);
        } else {
          anim.active = false;
          state.countAnim = null;
          el.dashH.textContent = anim.to.toFixed(2) + ' cm';
          el.dashH.classList.remove('digit-flash');
          void el.dashH.offsetWidth;
          el.dashH.classList.add('digit-flash');
          triggerDashboardFlash(anim.pass);
        }
      }
      requestAnimationFrame(stepCount);
    }

    function startSimulation(instantMode) {
      state.activeSim = Physics.simulate(state.params, state.ballType, state.d, state.opts);
      if (!state.activeSim || !state.activeSim.valid) return;
      clearFlashAndCount();
      state.lockedResult = null;
      state.impactTriggered = false;
      state.launchTriggered = false;
      state.shakeUntil = 0;

      if (instantMode) {
        state.simTime = state.activeSim.timeline.tEnd;
        state.animMode = 'done';
        state.lockedResult = state.activeSim;
        recordResult(state.activeSim);
        updateDashboard();
        updatePhysicsCards();
        drawStage();
        return;
      }

      if (window.Sfx) window.Sfx.push();
      state.simTime = 0;
      state.animMode = 'running';
      state.lastFrameTs = null;
      updateDashboard();
      updatePhysicsCards();
      requestAnimationFrame(stepAnimation);
    }

    function resetSimulation() {
      clearFlashAndCount();
      state.animMode = 'idle';
      state.simTime = 0;
      state.lockedResult = null;
      state.lastFrameTs = null;
      state.impactTriggered = false;
      state.launchTriggered = false;
      state.shakeUntil = 0;
      recomputeActiveSim(false);
    }

    function slideFulcrumTo(targetD) {
      const clamped = Math.round(clamp(targetD, -20, 20) * 10) / 10;
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
        const prevSimTime = state.simTime;
        state.simTime += dtReal * state.slowMo;

        if (!state.impactTriggered && prevSimTime < sim.timeline.tImpact && state.simTime >= sim.timeline.tImpact) {
          state.impactTriggered = true;
          state.shakeUntil = performance.now() + 150;
          if (window.Sfx) window.Sfx.impact();
        }
        if (!state.launchTriggered && prevSimTime < sim.timeline.tLaunch && state.simTime >= sim.timeline.tLaunch) {
          state.launchTriggered = true;
          if (window.Sfx) window.Sfx.launch();
        }

        if (state.simTime >= sim.timeline.tEnd) {
          state.simTime = sim.timeline.tEnd;
          state.animMode = 'done';
          state.lockedResult = sim;
          recordResult(sim);
          const target = getCurrentTarget();
          const pass = sim.H_max >= target.min && sim.H_max <= target.max;
          if (window.Sfx) {
            if (pass) window.Sfx.success();
            else window.Sfx.fail();
          }
          startCountUpAndFlash(sim.H_max, pass);
        }
        updateDashboard();
        updatePhysicsCards();
        drawStage();
        if (state.animMode === 'running' || performance.now() < state.shakeUntil) {
          requestAnimationFrame(stepAnimation);
        }
      } else if (performance.now() < state.shakeUntil) {
        drawStage();
        requestAnimationFrame(stepAnimation);
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

    function toggleFullscreen() {
      const doc = document;
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!isFs) {
        const elFs = doc.documentElement;
        const req = elFs.requestFullscreen || elFs.webkitRequestFullscreen;
        if (req) {
          try {
            const p = req.call(elFs);
            if (p && p.catch) p.catch(function () {});
          } catch (e) {}
        }
      } else {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (exit) {
          try {
            const p = exit.call(doc);
            if (p && p.catch) p.catch(function () {});
          } catch (e) {}
        }
      }
    }

    function updateFullscreenUI() {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      document.body.classList.toggle('is-fullscreen', isFs);
      if (el.btnFullscreen) {
        el.btnFullscreen.classList.toggle('active', isFs);
        el.btnFullscreen.textContent = isFs ? '✕ ออกเต็มจอ' : '⛶ เต็มจอ';
      }
      drawStage();
      drawGraph();
    }

    if (el.btnRender) {
      el.btnRender.addEventListener('click', function () {
        state.opts.render = state.opts.render === 'real' ? 'flat' : 'real';
        saveStoredState(state.params, state.presetId, state.theme, state.view, state.opts.render);
        updateControlsLabels();
        drawStage();
      });
    }

    function dismissSplash() {
      if (!state.splashOpen || !el.splash) return;
      state.splashOpen = false;
      el.splash.classList.add('fade-out');
      setTimeout(function () {
        if (el.splash) el.splash.style.display = 'none';
      }, 460);
    }

    function initSplash() {
      if (!el.splash) return;
      if (el.splashLogo && window.AIIA_LOGO) {
        el.splashLogo.src = window.AIIA_LOGO;
      }
      const shouldSkip =
        window.location.hash === '#autorun' || window.location.search.indexOf('nosplash') >= 0;
      if (shouldSkip) {
        state.splashOpen = false;
        el.splash.style.display = 'none';
        return;
      }
      state.splashOpen = true;
      el.splash.addEventListener('click', dismissSplash);
      setTimeout(dismissSplash, 2500);
    }

    if (el.btnFullscreen) {
      el.btnFullscreen.addEventListener('click', toggleFullscreen);
    }
    document.addEventListener('fullscreenchange', updateFullscreenUI);
    document.addEventListener('webkitfullscreenchange', updateFullscreenUI);

    document.addEventListener('keydown', function (ev) {
      if (state.splashOpen) {
        ev.preventDefault();
        dismissSplash();
        return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const tgt = ev.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'SELECT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) {
        return;
      }
      const key = ev.key;
      if (key === '1') { selectRange(0); }
      else if (key === '2') { selectRange(1); }
      else if (key === '3') { selectRange(2); }
      else if (key === 'b' || key === 'B') { selectBall('billiard', false); }
      else if (key === 't' || key === 'T') { selectBall('tennis', false); }
      else if (key === 'x' || key === 'X') { if (el.btnRandomBall) el.btnRandomBall.click(); }
      else if (key === ' ' || ev.code === 'Space') {
        ev.preventDefault();
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
          document.activeElement.blur();
        }
        if (el.btnStart) el.btnStart.click();
      } else if (key === 'r' || key === 'R') {
        if (el.btnReset) el.btnReset.click();
      } else if (key === 'f' || key === 'F') {
        toggleFullscreen();
      }
    });

    if (el.themeSwitcher) {
      el.themeSwitcher.addEventListener('click', function (ev) {
        const modeBtn = ev.target.closest('#btnAiiaMode');
        if (modeBtn) {
          const nextVariant = state.theme === 'aiia-light' ? 'aiia' : 'aiia-light';
          applyTheme(nextVariant);
          return;
        }
        const btn = ev.target.closest('.theme-pill');
        if (!btn) return;
        const opt = btn.getAttribute('data-theme-opt');
        if (opt === 'aiia') {
          applyTheme(state.aiiaVariant || 'aiia');
        } else {
          applyTheme(opt);
        }
      });
    }

    if (el.viewTabs) {
      el.viewTabs.addEventListener('click', function (ev) {
        const btn = ev.target.closest('.view-tab');
        if (!btn) return;
        applyViewTab(btn.getAttribute('data-view-opt'));
      });
    }

    el.btnBallBilliard.addEventListener('click', function () { selectBall('billiard', false); });
    el.btnBallTennis.addEventListener('click', function () { selectBall('tennis', false); });
    el.btnRandomBall.addEventListener('click', function () {
      if (state.rouletting) return;
      state.rouletting = true;
      const finalChoice = Math.random() < 0.5 ? 'billiard' : 'tennis';
      let step = 0;
      const totalSteps = 6;
      el.sensorBadge.classList.add('roulette-spin');
      el.sensorBadge.textContent = '🎲 กำลังสุ่มลูกกลม...';

      function tickRoulette() {
        const showBilliard = step % 2 === 0;
        el.btnBallBilliard.classList.toggle('roulette-active', showBilliard);
        el.btnBallTennis.classList.toggle('roulette-active', !showBilliard);
        step += 1;
        if (step < totalSteps) {
          setTimeout(tickRoulette, 70);
        } else {
          el.btnBallBilliard.classList.remove('roulette-spin', 'roulette-active');
          el.btnBallTennis.classList.remove('roulette-spin', 'roulette-active');
          el.sensorBadge.classList.remove('roulette-spin');
          state.rouletting = false;
          selectBall(finalChoice, true);
        }
      }
      tickRoulette();
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
        state.d = Math.round(clamp(wx - 25, -20, 20) * 10) / 10;
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
      const dMeas = clamp(parseFloat(el.inExpD.value) || 0, -20, 20);
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
    initSplash();
    applyTheme(state.theme);
    applyViewTab(state.view);
    syncInputsFromParams();
    recomputeCurvesAndTable();
    const initTarget = getCurrentTarget();
    const initSol = Physics.solveD(state.params, state.ballType, [initTarget.min, initTarget.max], state.opts);
    state.d = initSol.d;
    recomputeActiveSim(false);

    // Support #autorun / #autorun-instant for automated visual/runtime verification
    if (window.location.hash === '#autorun') {
      state.slowMo = 1.0;
      el.rngSlowMo.value = '1.0';
      el.lblSlowMo.textContent = '1.00x';
      const isInstant = window.location.search.indexOf('instant=1') >= 0;
      startSimulation(isInstant);
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
