(() => {
  const TOTAL_ITEMS = 15;
  const VISIBLE_ITEMS = 8;
  const ANGLE_START_DEG = -68;
  const ANGLE_END_DEG = 68;
  const RADIUS_FACTOR = 0.9;
  const TEXT_OFFSET = 0.1;

  const CENTER_X_FACTOR = 0.06;
  const CENTER_Y_FACTOR = 0.5;
  const INNER_RADIUS_FACTOR = 0.8;

  const WHEEL_SENSITIVITY = 0.0018;
  const SMOOTHING = 0.16;
  const TAC_STEP = 0.24;

  const PROJECT_ITEMS = [
    'ROSARIO / 2011',
    'MONTEVIDEO / 2012',
    'CORDOBA / 2013',
    'MENDOZA / 2014',
    'ASUNCION / 2015',
    'SALTA / 2016',
    'USHUAIA / 2017',
    'SANTIAGO / 2018',
    'BOGOTA / 2019',
    'LIMA / 2020',
    'VALPARAISO / 2021',
    'QUITO / 2022',
    'SAN PABLO / 2023',
    'BUENOS AIRES / 2024',
    'PUNTA DEL ESTE / 2025',
  ];

  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function pointFromAngle(cx, cy, radius, angleRad) {
    return {
      x: cx + Math.cos(angleRad) * radius,
      y: cy + Math.sin(angleRad) * radius,
    };
  }

  function arcPath(cx, cy, radius, startRad, endRad) {
    const start = pointFromAngle(cx, cy, radius, startRad);
    const end = pointFromAngle(cx, cy, radius, endRad);
    const delta = Math.abs(endRad - startRad);
    const largeArc = delta > Math.PI ? 1 : 0;
    const sweep = 1;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
  }

  function createSlots(listEl) {
    const slots = [];
    for (let i = 0; i < VISIBLE_ITEMS; i += 1) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#';
      li.appendChild(a);
      listEl.appendChild(li);
      slots.push(li);
    }
    return slots;
  }

  function initRadialMenu(nav) {
    const svg = nav.querySelector('.projects-nav-arcs');
    const outerArc = nav.querySelector('.projects-arc-outer');
    const innerArc = nav.querySelector('.projects-arc-inner');
    const list = nav.querySelector('[data-radial-items]');
    if (!svg || !outerArc || !innerArc || !list) return;

    const slots = createSlots(list);
    const angleStart = degToRad(ANGLE_START_DEG);
    const angleEnd = degToRad(ANGLE_END_DEG);
    const midAngle = (angleStart + angleEnd) * 0.5;
    const halfRange = Math.max(0.0001, (angleEnd - angleStart) * 0.5);
    const angleStep = (angleEnd - angleStart) / (VISIBLE_ITEMS - 1);
    let currentOffset = 0;
    let targetOffset = 0;
    let audioCursor = 0;
    let rafId = null;
    let audioCtx = null;

    function ensureAudioContext() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function playTac(atTime) {
      const ctx = ensureAudioContext();
      if (!ctx) return;

      const now = atTime || ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1700, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.028);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(650, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    }

    function emitTacForMovement(previousPos, nextPos) {
      const delta = nextPos - previousPos;
      if (Math.abs(delta) < 0.000001) return;

      const ctx = ensureAudioContext();
      if (!ctx) return;

      const prevStep = Math.floor(previousPos / TAC_STEP);
      const nextStep = Math.floor(nextPos / TAC_STEP);
      const crossings = Math.abs(nextStep - prevStep);
      if (!crossings) return;

      const startTime = ctx.currentTime;
      for (let i = 0; i < crossings; i += 1) {
        playTac(startTime + i * 0.012);
      }
    }

    function layout(offsetValue) {
      const rect = nav.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (!width || !height) return;

      const centerX = width * CENTER_X_FACTOR;
      const centerY = height * CENTER_Y_FACTOR;

      const fitRadius = Math.min(width - centerX, centerY, height - centerY);
      const outerRadius = Math.max(0, fitRadius * RADIUS_FACTOR);
      const innerRadius = Math.max(0, outerRadius * INNER_RADIUS_FACTOR);
      const textOffset = fitRadius * TEXT_OFFSET;
      const textRadius = outerRadius + textOffset;

      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      outerArc.setAttribute('d', arcPath(centerX, centerY, outerRadius, -Math.PI / 2, Math.PI / 2));
      innerArc.setAttribute('d', arcPath(centerX, centerY, innerRadius, -Math.PI / 2, Math.PI / 2));

      const activeSlot = Math.floor(VISIBLE_ITEMS / 2);
      const baseIndex = Math.floor(offsetValue);
      const fractional = offsetValue - baseIndex;

      for (let i = 0; i < VISIBLE_ITEMS; i += 1) {
        const itemIndex = mod(baseIndex + i, TOTAL_ITEMS);
        const slot = slots[i];
        const link = slot.firstElementChild;
        const angle = angleStart + (i - fractional) * angleStep;

        const x = centerX + Math.cos(angle) * textRadius;
        const y = centerY + Math.sin(angle) * textRadius;
        const edgeRatio = Math.min(1, Math.abs(angle - midAngle) / halfRange);
        const edgeEase = Math.pow(edgeRatio, 1.35);
        const opacity = Math.max(0, 1 - edgeEase * 1.08);
        const scale = 1 - edgeEase * 0.22;

        slot.style.left = `${x}px`;
        slot.style.top = `${y}px`;
        slot.style.opacity = String(opacity);
        slot.style.transform = `translateY(-50%) scale(${scale})`;
        slot.classList.toggle('active', i === activeSlot);

        link.textContent = `_${PROJECT_ITEMS[itemIndex]}`;
        link.setAttribute('data-item-index', String(itemIndex));
      }
    }

    function shortestDelta(current, target, total) {
      let delta = target - current;
      if (delta > total / 2) delta -= total;
      if (delta < -total / 2) delta += total;
      return delta;
    }

    function scheduleLayout() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        layout(currentOffset);
      });
    }

    function animateToTarget() {
      if (rafId !== null) return;

      const tick = () => {
        const delta = shortestDelta(currentOffset, targetOffset, TOTAL_ITEMS);
        const prevAudioCursor = audioCursor;
        const move = delta * SMOOTHING;

        audioCursor += move;
        emitTacForMovement(prevAudioCursor, audioCursor);
        currentOffset = mod(currentOffset + move, TOTAL_ITEMS);
        layout(currentOffset);

        if (Math.abs(delta) > 0.0006) {
          rafId = requestAnimationFrame(tick);
        } else {
          const settleDelta = shortestDelta(currentOffset, targetOffset, TOTAL_ITEMS);
          if (Math.abs(settleDelta) > 0.000001) {
            const prevSettleCursor = audioCursor;
            audioCursor += settleDelta;
            emitTacForMovement(prevSettleCursor, audioCursor);
          }
          currentOffset = targetOffset;
          layout(currentOffset);
          rafId = null;
        }
      };

      rafId = requestAnimationFrame(tick);
    }

    function onWheel(event) {
      event.preventDefault();
      ensureAudioContext();
      targetOffset = mod(targetOffset + event.deltaY * WHEEL_SENSITIVITY, TOTAL_ITEMS);
      animateToTarget();
    }

    nav.addEventListener('wheel', onWheel, { passive: false });

    const resizeObserver = new ResizeObserver(scheduleLayout);
    resizeObserver.observe(nav);

    window.addEventListener('resize', scheduleLayout, { passive: true });

    layout(currentOffset);
  }

  document.querySelectorAll('[data-radial-menu]').forEach(initRadialMenu);
})();
