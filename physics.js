(function (globalScope) {
  'use strict';

  const TARGETS = {
    billiard: [
      { id: 1, min: 40, max: 50, label: '40–50 cm' },
      { id: 2, min: 50, max: 60, label: '50–60 cm' },
      { id: 3, min: 60, max: 70, label: '60–70 cm' }
    ],
    tennis: [
      { id: 1, min: 10, max: 20, label: '10–20 cm' },
      { id: 2, min: 20, max: 30, label: '20–30 cm' },
      { id: 3, min: 30, max: 40, label: '30–40 cm' }
    ]
  };

  const BALL_LABELS = {
    billiard: 'ลูกบิลเลียด',
    tennis: 'ลูกเทนนิส'
  };

  const PRESETS = {
    tuned: {
      id: 'tuned',
      name: 'ค่าเริ่มต้น (ปล่อยจากแท่น 30 cm)',
      M_board: 0.08,
      e_billiard: 0.35,
      e_tennis: 0.65,
      impactInset: 1.0,
      golfInset: 2.2,
      eta: 1.0
    },
    standard: {
      id: 'standard',
      name: 'กระดานหนัก / สะท้อนน้อย (120 g)',
      M_board: 0.12,
      e_billiard: 0.30,
      e_tennis: 0.50,
      impactInset: 1.0,
      golfInset: 2.2,
      eta: 1.0
    }
  };

  function defaultParams() {
    return {
      // Masses (kg) and radii (cm)
      m_billiard: 0.170,
      r_billiard: 2.86,
      e_billiard: PRESETS.tuned.e_billiard,

      m_tennis: 0.058,
      r_tennis: 3.35,
      e_tennis: PRESETS.tuned.e_tennis,

      m_golf: 0.0459,
      r_golf: 2.135,

      // Board & setup geometry (cm, kg)
      M_board: PRESETS.tuned.M_board,
      L_board: 48,
      boardStart: 1.0,
      t_board: 1.0,
      impactInset: PRESETS.tuned.impactInset,
      golfInset: PRESETS.tuned.golfInset,

      // Fixed competition field dimensions (cm)
      h_yellow: 80,
      h_grey: 30,
      gap: 50,
      h_tri: 3,

      // Physics constants & empirical tuning
      g: 9.81,
      eta: PRESETS.tuned.eta
    };
  }

  function applyPreset(params, presetId) {
    const preset = PRESETS[presetId];
    if (!preset) return Object.assign({}, params);
    return Object.assign({}, params, {
      M_board: preset.M_board,
      e_billiard: preset.e_billiard,
      e_tennis: preset.e_tennis,
      impactInset: preset.impactInset,
      golfInset: preset.golfInset,
      eta: preset.eta
    });
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getBallSpec(params, ballType) {
    if (ballType === 'tennis') {
      return {
        type: 'tennis',
        label: BALL_LABELS.tennis,
        m1: params.m_tennis,
        r1_ball: params.r_tennis,
        e: params.e_tennis
      };
    }
    return {
      type: 'billiard',
      label: BALL_LABELS.billiard,
      m1: params.m_billiard,
      r1_ball: params.r_billiard,
      e: params.e_billiard
    };
  }

  /**
   * Simulate full 3-stage mechanics for a given ball type, fulcrum offset d (cm), and options.
   */
  function simulate(rawParams, ballType, dRaw, rawOpts) {
    const params = Object.assign(defaultParams(), rawParams || {});
    const opts = Object.assign(
      { ideal: false, guided: true, measure: 'bottom', skipTimeline: false },
      rawOpts || {}
    );

    const d = clamp(Number(dRaw) || 0, -20, 20);
    const ball = getBallSpec(params, ballType);
    const m1 = Math.max(1e-4, Number(ball.m1));
    const r_ball = Math.max(0.1, Number(ball.r1_ball));
    const e = clamp(Number(ball.e), 0, 1);
    const m2 = Math.max(1e-4, Number(params.m_golf));
    const r_golf = Math.max(0.1, Number(params.r_golf));

    const L_cm = Number(params.L_board) || 48;
    const boardStart = Number(params.boardStart);
    const t_cm = Math.max(0.1, Number(params.t_board));
    const h_tri = Number(params.h_tri) || 3;
    const h_grey = Number(params.h_grey) || 30;
    const g = Math.max(0.1, Number(params.g) || 9.81);
    const etaInput = Math.max(0, Number(params.eta));

    const x_p = 25 + d;
    const R1end = boardStart + L_cm - x_p;
    const R2end = x_p - boardStart;
    const r1_cm = R1end - Number(params.impactInset);
    const r2_cm = R2end - Number(params.golfInset);

    if (R1end <= 0.1 || R2end <= 0.1 || r1_cm <= 0.1 || r2_cm <= 0.1) {
      return {
        valid: false,
        ballType: ball.type,
        ballLabel: ball.label,
        d: d,
        x_p: x_p,
        r1_cm: r1_cm,
        r2_cm: r2_cm,
        H_max: 0,
        drift: 0,
        flags: { invalidGeometry: true, stalled: true, earlySep: false, ideal: opts.ideal, guided: opts.guided }
      };
    }

    const r1 = r1_cm / 100;
    const r2 = r2_cm / 100;
    const L_m = L_cm / 100;
    const x_cm_cm = boardStart + L_cm / 2;
    const s_cm_cm = x_cm_cm - x_p;
    const s_cm = s_cm_cm / 100;

    const theta0 = -Math.asin(clamp(h_tri / R2end, -1, 1));
    const thetaf = Math.asin(clamp(h_tri / R1end, -1, 1));

    // Stage 1: Falling ball directly from 30 cm grey platform
    const y_impact_top = h_tri - r1_cm * Math.sin(theta0) + t_cm;
    const boardAbovePlatform = y_impact_top >= h_grey;
    const y_drop_start_center = h_grey + r_ball;
    const y_impact_center = y_impact_top + r_ball;
    const dh1_cm = boardAbovePlatform ? 0 : Math.max(0, y_drop_start_center - y_impact_center);
    const dh1 = dh1_cm / 100;
    const v1 = Math.sqrt(2 * g * dh1);
    const t_fall = dh1 > 0 ? Math.sqrt((2 * dh1) / g) : 0;

    // Stage 2: Impact & rotation (angular momentum transfer L_in -> L_out)
    const M = opts.ideal ? 0 : Math.max(0, Number(params.M_board));
    const I_board = opts.ideal ? 0 : (M * L_m * L_m) / 12 + M * s_cm * s_cm;
    const I_sys = I_board + m2 * r2 * r2;
    const omega0 = I_sys > 0 ? ((1 + e) * m1 * v1 * r1) / I_sys : 0;

    // Post-impact vertical velocity of falling ball for animation rebound
    const v1_after_down = Math.min(omega0 * r1, omega0 * r1 - e * v1);
    const v1_rebound_up = Math.max(-v1 * 0.25, -v1_after_down);

    let theta = theta0;
    let omega = omega0;
    let t_rot = 0;
    let rotReason = 'hit_stop';
    let maxThetaReached = theta0;

    const rotSamples = opts.skipTimeline ? null : [{ t: 0, theta: theta0, omega: omega0 }];
    const sampleStep = 0.0005;
    let nextSampleT = sampleStep;

    if (opts.ideal) {
      theta = thetaf;
      omega = omega0;
      t_rot = omega0 > 0 ? (thetaf - theta0) / omega0 : 0;
      rotReason = omega0 > 0 ? 'hit_stop' : 'stalled';
      maxThetaReached = thetaf;
      if (rotSamples && t_rot > 0) {
        const nSamples = 36;
        for (let i = 1; i <= nSamples; i++) {
          const frac = i / nSamples;
          rotSamples.push({
            t: frac * t_rot,
            theta: theta0 + frac * (thetaf - theta0),
            omega: omega0
          });
        }
      }
    } else if (omega0 <= 0) {
      omega = 0;
      rotReason = 'stalled';
    } else {
      const dt = 1e-5;
      const maxSteps = 500000;
      for (let step = 0; step < maxSteps; step++) {
        const c = Math.cos(theta);
        if (I_board > 0) {
          const alpha_board = (M * g * s_cm * c) / I_board;
          if (r2 * alpha_board < -g * c) {
            rotReason = 'early_sep';
            break;
          }
        }
        const tau = g * c * (M * s_cm - m2 * r2);
        const alpha = I_sys > 0 ? tau / I_sys : 0;
        omega += alpha * dt;
        theta += omega * dt;
        t_rot += dt;
        if (theta > maxThetaReached) maxThetaReached = theta;

        if (omega <= 0) {
          omega = 0;
          rotReason = 'stalled';
          break;
        }
        if (theta >= thetaf) {
          theta = thetaf;
          maxThetaReached = thetaf;
          rotReason = 'hit_stop';
          break;
        }
        if (rotSamples && t_rot >= nextSampleT) {
          rotSamples.push({ t: t_rot, theta: theta, omega: omega });
          nextSampleT += sampleStep;
        }
      }
      if (rotSamples) {
        const last = rotSamples[rotSamples.length - 1];
        if (!last || Math.abs(last.t - t_rot) > 1e-7) {
          rotSamples.push({ t: t_rot, theta: theta, omega: omega });
        }
      }
    }

    const theta_launch = theta;
    const omega_launch = omega;
    const etaUsed = opts.ideal ? 1.0 : etaInput;
    const stalled = rotReason === 'stalled';
    const earlySep = rotReason === 'early_sep';

    // Stage 3: Golf ball flight
    const measureOffset =
      opts.measure === 'center' ? r_golf : opts.measure === 'top' ? 2 * r_golf : 0;

    const x_golf_launch_cm = x_p - r2_cm * Math.cos(theta_launch);
    const y_board_golf_top = h_tri + r2_cm * Math.sin(theta_launch) + t_cm;
    const y_launch_bottom = y_board_golf_top;
    const y_launch_measured = y_board_golf_top + measureOffset;

    const v2 = stalled ? 0 : etaUsed * omega_launch * r2;
    const v2x = opts.guided ? 0 : v2 * Math.sin(theta_launch);
    const v2y = v2 * Math.cos(theta_launch);

    const t_apex = v2y > 0 ? v2y / g : 0;
    const dh2_m = v2y > 0 ? (v2y * v2y) / (2 * g) : 0;
    const dh2_cm = dh2_m * 100;
    const H_max = y_launch_measured + dh2_cm;

    const x_apex_cm = opts.guided ? x_golf_launch_cm : x_golf_launch_cm + v2x * t_apex * 100;
    const drift = opts.guided ? 0 : Math.max(0, x_apex_cm);

    let timeline = null;
    let trajectory = null;
    if (!opts.skipTimeline) {
      timeline = buildTimeline({
        params,
        ball,
        x_p,
        r1_cm,
        r2_cm,
        R1end,
        R2end,
        theta0,
        thetaf,
        theta_launch,
        omega_launch,
        M,
        s_cm,
        I_board,
        t_cm,
        h_tri,
        h_grey,
        r_ball,
        r_golf,
        g,
        v1,
        v1_rebound_up,
        t_fall,
        t_rot,
        rotSamples,
        rotReason,
        x_golf_launch_cm,
        y_board_golf_top,
        v2x,
        v2y,
        t_apex,
        guided: opts.guided
      });
      trajectory = timeline.trajectory;
    }

    return {
      valid: true,
      ballType: ball.type,
      ballLabel: ball.label,
      d: d,
      x_p: x_p,
      R1end: R1end,
      R2end: R2end,
      r1_cm: r1_cm,
      r2_cm: r2_cm,
      r1: r1,
      r2: r2,
      m1: m1,
      m2: m2,
      e: e,
      M: M,
      s_cm: s_cm,
      theta0: theta0,
      thetaf: thetaf,
      theta_launch: theta_launch,
      y_impact_top: y_impact_top,
      dh1_cm: dh1_cm,
      dh1: dh1,
      v1: v1,
      t_fall: t_fall,
      I_board: I_board,
      I_sys: I_sys,
      omega0: omega0,
      omega_launch: omega_launch,
      v1_rebound_up: v1_rebound_up,
      t_rot: t_rot,
      rotReason: rotReason,
      etaUsed: etaUsed,
      v2: v2,
      v2x: v2x,
      v2y: v2y,
      x_golf_launch_cm: x_golf_launch_cm,
      y_launch_bottom: y_launch_bottom,
      y_launch_measured: y_launch_measured,
      measureOffset: measureOffset,
      t_apex: t_apex,
      dh2_cm: dh2_cm,
      H_max: H_max,
      x_apex_cm: x_apex_cm,
      drift: drift,
      flags: {
        ideal: !!opts.ideal,
        guided: !!opts.guided,
        measure: opts.measure,
        stalled: stalled,
        earlySep: earlySep,
        hitStop: rotReason === 'hit_stop',
        boardAbovePlatform: boardAbovePlatform,
        invalidGeometry: false
      },
      trajectory: trajectory,
      timeline: timeline
    };
  }

  function buildTimeline(ctx) {
    const tPush = 0.35;
    const tImpact = tPush + ctx.t_fall;
    const tLaunch = tImpact + ctx.t_rot;
    const x_impact = ctx.x_p + ctx.r1_cm;
    const y_platform_center = ctx.h_grey + ctx.r_ball;
    const x_push_start = 50.0 + ctx.r_ball;
    const x_drop_edge = 49.5;

    // Flight duration until ball falls back near ground or board
    const y_launch_center = ctx.y_board_golf_top + ctx.r_golf;
    const v2y_cm = ctx.v2y * 100;
    const v2x_cm = ctx.v2x * 100;
    const g_cm = ctx.g * 100;

    let tFlightTotal = 0.45;
    if (ctx.v2y > 0) {
      const disc = v2y_cm * v2y_cm + 2 * g_cm * Math.max(0, y_launch_center - ctx.r_golf);
      const tToFloor = (v2y_cm + Math.sqrt(Math.max(0, disc))) / g_cm;
      tFlightTotal = Math.min(Math.max(tToFloor, ctx.t_apex + 0.15), ctx.t_apex * 2.2 + 0.35);
    }

    const tEnd = tLaunch + tFlightTotal;

    // Build trajectory polyline for flight phase
    const trajectory = [];
    const trajSteps = 60;
    for (let i = 0; i <= trajSteps; i++) {
      const tau = (i / trajSteps) * tFlightTotal;
      let px = ctx.x_golf_launch_cm + v2x_cm * tau;
      if (!ctx.guided && px < ctx.r_golf) {
        px = ctx.r_golf; // collides / slides along yellow pillar inner wall
      }
      const pyCenter = Math.max(
        ctx.r_golf,
        y_launch_center + v2y_cm * tau - 0.5 * g_cm * tau * tau
      );
      trajectory.push({ t: tau, x: px, yCenter: pyCenter, yBottom: pyCenter - ctx.r_golf });
    }

    // Also compute board angle during post-launch if early_sep or stalled
    const boardPostSamples = [];
    if (ctx.rotReason === 'early_sep' && ctx.I_board > 0) {
      let th = ctx.theta_launch;
      let w = ctx.omega_launch;
      const dt = 0.001;
      for (let t = 0; t <= tFlightTotal; t += dt) {
        boardPostSamples.push({ t: t, theta: th });
        const alphaB = (ctx.M * ctx.g * ctx.s_cm * Math.cos(th)) / ctx.I_board;
        w += alphaB * dt;
        th += w * dt;
        if (th >= ctx.thetaf) {
          th = ctx.thetaf;
          w = 0;
        } else if (th <= ctx.theta0) {
          th = ctx.theta0;
          w = 0;
        }
      }
    } else if (ctx.rotReason === 'stalled') {
      let th = ctx.theta_launch;
      let w = 0;
      const dt = 0.001;
      for (let t = 0; t <= tFlightTotal; t += dt) {
        boardPostSamples.push({ t: t, theta: th });
        if (th > ctx.theta0) {
          w -= 4.0 * dt;
          th = Math.max(ctx.theta0, th + w * dt);
        }
      }
    }

    return {
      tPush: tPush,
      tImpact: tImpact,
      tLaunch: tLaunch,
      tApexAbs: tLaunch + ctx.t_apex,
      tEnd: tEnd,
      x_push_start: x_push_start,
      x_drop_edge: x_drop_edge,
      x_impact: x_impact,
      y_platform_center: y_platform_center,
      y_launch_center: y_launch_center,
      v2x_cm: v2x_cm,
      v2y_cm: v2y_cm,
      g_cm: g_cm,
      rotSamples: ctx.rotSamples,
      boardPostSamples: boardPostSamples,
      trajectory: trajectory,
      theta0: ctx.theta0,
      thetaf: ctx.thetaf,
      theta_launch: ctx.theta_launch,
      rotReason: ctx.rotReason,
      x_p: ctx.x_p,
      r1_cm: ctx.r1_cm,
      r2_cm: ctx.r2_cm,
      t_cm: ctx.t_cm,
      L_cm: ctx.params.L_board || 48,
      boardStart: ctx.params.boardStart,
      h_tri: ctx.h_tri,
      r_ball: ctx.r_ball,
      r_golf: ctx.r_golf,
      v1: ctx.v1,
      v1_rebound_up: ctx.v1_rebound_up,
      guided: ctx.guided
    };
  }

  function interpSamples(samples, t, fallbackTheta) {
    if (!samples || samples.length === 0) return fallbackTheta;
    if (t <= samples[0].t) return samples[0].theta;
    const last = samples[samples.length - 1];
    if (t >= last.t) return last.theta;
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = samples[lo];
    const b = samples[hi];
    const span = b.t - a.t;
    const frac = span > 0 ? (t - a.t) / span : 0;
    return a.theta + frac * (b.theta - a.theta);
  }

  /**
   * Sample canvas animation state at elapsed simulation time tSec.
   */
  function sampleState(sim, tSec) {
    if (!sim || !sim.valid || !sim.timeline) return null;
    const tl = sim.timeline;
    const t = clamp(tSec, 0, tl.tEnd);

    let phase = 'idle';
    let cardIndex = 1;
    let theta = tl.theta0;
    let dropX = tl.x_push_start;
    let dropY = tl.y_platform_center;
    let pusherX = tl.x_push_start + tl.r_ball;
    let golfX = tl.x_p - tl.r2_cm * Math.cos(tl.theta0);
    let golfY = tl.h_tri + tl.r2_cm * Math.sin(tl.theta0) + tl.t_cm + tl.r_golf;
    let showV1 = false;
    let showV2 = false;

    if (t < tl.tPush) {
      phase = 'push';
      cardIndex = 1;
      const frac = tl.tPush > 0 ? t / tl.tPush : 1;
      const ease = 0.5 - 0.5 * Math.cos(Math.PI * frac);
      dropX = tl.x_push_start + (tl.x_drop_edge - tl.x_push_start) * ease;
      dropY = tl.y_platform_center;
      pusherX = dropX + tl.r_ball;
    } else if (t < tl.tImpact) {
      phase = 'fall';
      cardIndex = 1;
      const tau = t - tl.tPush;
      const fallDur = Math.max(1e-6, tl.tImpact - tl.tPush);
      const frac = tau / fallDur;
      dropX = tl.x_drop_edge + (tl.x_impact - tl.x_drop_edge) * frac;
      dropY = tl.y_platform_center - 0.5 * tl.g_cm * tau * tau;
      pusherX = tl.x_drop_edge + tl.r_ball;
      showV1 = true;
    } else if (t < tl.tLaunch) {
      phase = 'rotate';
      cardIndex = 2;
      const tau = t - tl.tImpact;
      theta = interpSamples(tl.rotSamples, tau, tl.theta_launch);
      pusherX = tl.x_drop_edge + tl.r_ball;

      // Falling ball rebound above rotating board
      const boardImpactY = tl.h_tri - tl.r1_cm * Math.sin(theta) + tl.t_cm + tl.r_ball;
      const boardImpactY0 = tl.h_tri - tl.r1_cm * Math.sin(tl.theta0) + tl.t_cm + tl.r_ball;
      const reboundY = boardImpactY0 + tl.v1_rebound_up * 100 * tau - 0.5 * tl.g_cm * tau * tau;
      dropX = tl.x_impact;
      dropY = Math.max(boardImpactY, reboundY);

      // Golf ball rides board
      golfX = tl.x_p - tl.r2_cm * Math.cos(theta);
      golfY = tl.h_tri + tl.r2_cm * Math.sin(theta) + tl.t_cm + tl.r_golf;
      showV1 = tau < 0.03;
      showV2 = tau > (tl.tLaunch - tl.tImpact) * 0.5;
    } else {
      phase = 'flight';
      cardIndex = 3;
      const tau = t - tl.tLaunch;
      pusherX = tl.x_drop_edge + tl.r_ball;

      if (tl.boardPostSamples && tl.boardPostSamples.length > 0) {
        theta = interpSamples(tl.boardPostSamples, tau, tl.theta_launch);
      } else {
        theta = tl.theta_launch;
      }

      // Falling ball settles onto board at theta
      const boardImpactY = tl.h_tri - tl.r1_cm * Math.sin(theta) + tl.t_cm + tl.r_ball;
      const tauSinceImpact = t - tl.tImpact;
      const boardImpactY0 = tl.h_tri - tl.r1_cm * Math.sin(tl.theta0) + tl.t_cm + tl.r_ball;
      const reboundY =
        boardImpactY0 +
        tl.v1_rebound_up * 100 * tauSinceImpact -
        0.5 * tl.g_cm * tauSinceImpact * tauSinceImpact;
      dropX = tl.x_impact;
      dropY = Math.max(boardImpactY, reboundY);

      // Golf ball free/guided projectile
      if (tl.rotReason === 'stalled') {
        golfX = tl.x_p - tl.r2_cm * Math.cos(theta);
        golfY = tl.h_tri + tl.r2_cm * Math.sin(theta) + tl.t_cm + tl.r_golf;
      } else {
        let px = sim.x_golf_launch_cm + tl.v2x_cm * tau;
        if (!tl.guided && px < tl.r_golf) px = tl.r_golf;
        const onBoardX = px >= tl.boardStart && px <= tl.boardStart + tl.L_cm;
        const pyBoardAtX = onBoardX
          ? tl.h_tri - (px - tl.x_p) * Math.sin(theta) + tl.t_cm + tl.r_golf
          : tl.r_golf;
        const pyFly = tl.y_launch_center + tl.v2y_cm * tau - 0.5 * tl.g_cm * tau * tau;
        const floorMin = Math.max(tl.r_golf, pyBoardAtX);
        golfX = px;
        golfY = Math.max(floorMin, pyFly);
        showV2 = tau < Math.max(0.05, sim.t_apex);
      }
    }

    return {
      t: t,
      phase: phase,
      cardIndex: cardIndex,
      theta: theta,
      dropX: dropX,
      dropY: dropY,
      pusherX: pusherX,
      golfX: golfX,
      golfY: golfY,
      showV1: showV1,
      showV2: showV2,
      reachedApex: t >= tl.tApexAbs
    };
  }

  function heightCurve(params, ballType, opts, step, minD, maxD) {
    const s = step || 0.1;
    const dMin = typeof minD === 'number' ? minD : -20;
    const dMax = typeof maxD === 'number' ? maxD : 20;
    const count = Math.round((dMax - dMin) / s);
    const curve = [];
    const simOpts = Object.assign({}, opts || {}, { skipTimeline: true });
    for (let i = 0; i <= count; i++) {
      const d = Math.round((dMin + i * s) * 100) / 100;
      const res = simulate(params, ballType, d, simOpts);
      curve.push({
        d: d,
        H: res.valid ? res.H_max : 0,
        rotReason: res.rotReason,
        drift: res.drift || 0
      });
    }
    return curve;
  }

  function solveD(params, ballType, range, opts) {
    const lo = range[0];
    const hi = range[1];
    const mid = (lo + hi) / 2;
    const curve = heightCurve(params, ballType, opts, 0.1, 0, 20);

    let bestInRange = null;
    let bestInErr = Infinity;
    let bestAny = null;
    let bestAnyErr = Infinity;

    for (let i = 0; i < curve.length; i++) {
      const pt = curve[i];
      const errMid = Math.abs(pt.H - mid);

      if (pt.H >= lo && pt.H <= hi) {
        if (errMid < bestInErr - 1e-9 || (Math.abs(errMid - bestInErr) <= 1e-9 && pt.d < bestInRange.d)) {
          bestInErr = errMid;
          bestInRange = pt;
        }
      }

      const distRange = pt.H < lo ? lo - pt.H : pt.H > hi ? pt.H - hi : 0;
      const score = distRange * 1000 + errMid;
      if (score < bestAnyErr - 1e-9 || (Math.abs(score - bestAnyErr) <= 1e-9 && pt.d < bestAny.d)) {
        bestAnyErr = score;
        bestAny = pt;
      }
    }

    if (bestInRange) {
      return { d: bestInRange.d, H: bestInRange.H, reachable: true };
    }
    return {
      d: bestAny ? bestAny.d : 0,
      H: bestAny ? bestAny.H : 0,
      reachable: false
    };
  }

  function calibrateEta(params, ballType, dMeasured, Hmeasured, opts) {
    const baseOpts = Object.assign({}, opts || {}, { ideal: false, skipTimeline: true });
    const sim0 = simulate(Object.assign({}, params, { eta: 1.0 }), ballType, dMeasured, baseOpts);
    if (!sim0.valid || sim0.flags.stalled || sim0.v2y <= 0) {
      return null;
    }
    if (Hmeasured <= sim0.y_launch_measured) {
      return 0;
    }

    let lo = 0.0;
    let hi = 3.0;
    // Expand upper bound if needed
    while (hi < 10.0) {
      const checkHi = simulate(Object.assign({}, params, { eta: hi }), ballType, dMeasured, baseOpts);
      if (checkHi.H_max >= Hmeasured) break;
      hi *= 1.5;
    }

    for (let iter = 0; iter < 50; iter++) {
      const mid = 0.5 * (lo + hi);
      const sim = simulate(Object.assign({}, params, { eta: mid }), ballType, dMeasured, baseOpts);
      if (sim.H_max < Hmeasured) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  const Physics = {
    TARGETS: TARGETS,
    BALL_LABELS: BALL_LABELS,
    PRESETS: PRESETS,
    defaultParams: defaultParams,
    applyPreset: applyPreset,
    getBallSpec: getBallSpec,
    simulate: simulate,
    sampleState: sampleState,
    heightCurve: heightCurve,
    solveD: solveD,
    calibrateEta: calibrateEta
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Physics;
  }
  if (typeof window !== 'undefined') {
    window.Physics = Physics;
  } else if (globalScope) {
    globalScope.Physics = Physics;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
