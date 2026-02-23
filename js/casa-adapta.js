(() => {
  const root = document.querySelector('.casa-adapta-root');
  if (!root) return;

  const timeInput = root.querySelector('#casa-time');
  const tempInput = root.querySelector('#casa-temp');
  const windInput = root.querySelector('#casa-wind');
  const timeOutput = root.querySelector('#casa-time-out');
  const tempOutput = root.querySelector('#casa-temp-out');

  const sunGroup = document.getElementById('casa-sun-group');
  const lightbeam = document.getElementById('casa-lightbeam');
  const floorglow = document.getElementById('casa-floorglow');
  const skyStop0 = document.getElementById('casa-sky-stop0');
  const skyStop1 = document.getElementById('casa-sky-stop1');
  const briseGroup = document.getElementById('casa-brise');
  const windArrows = document.getElementById('casa-wind-arrows');

  const statLight = root.querySelector('#casa-stat-light');
  const statBrise = root.querySelector('#casa-stat-brise');
  const statVent = root.querySelector('#casa-stat-vent');

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerpColor(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16);
    const b = parseInt(hexB.slice(1), 16);
    const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
    const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
    const r = Math.round(rA + (rB - rA) * t);
    const g = Math.round(gA + (gB - gA) * t);
    const bl = Math.round(bA + (bB - bA) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  function updateSun(time) {
    if (time < 5 || time > 19) {
      sunGroup.setAttribute('opacity', '0');
      return;
    }
    var opacity = 1;
    if (time < 6) opacity = time - 5;
    else if (time > 18) opacity = 19 - time;
    sunGroup.setAttribute('opacity', clamp(opacity, 0, 1));

    var angle = ((time - 6) / 12) * Math.PI;
    var sx = 300 - 280 * Math.cos(angle);
    var sy = 340 - 280 * Math.sin(angle);
    sunGroup.setAttribute('transform', 'translate(' + sx + ',' + sy + ')');
  }

  function updateLight(time) {
    if (time < 6 || time > 18) {
      lightbeam.setAttribute('opacity', '0');
      floorglow.setAttribute('opacity', '0');
      return;
    }
    var angle = ((time - 6) / 12) * Math.PI;
    var sx = 300 - 280 * Math.cos(angle);
    var sy = 340 - 280 * Math.sin(angle);

    // Rays from sun through window edges (right wall window: x=500, top=170, bottom=290)
    var winTopX = 500, winTopY = 170;
    var winBotX = 500, winBotY = 290;

    var dx1 = winTopX - sx, dy1 = winTopY - sy;
    var dx2 = winBotX - sx, dy2 = winBotY - sy;

    // Project to floor y=330
    var floorY = 330;
    var floorX1 = 500, floorX2 = 500;
    if (dy1 !== 0) floorX1 = winTopX + ((floorY - winTopY) * dx1) / dy1;
    if (dy2 !== 0) floorX2 = winBotX + ((floorY - winBotY) * dx2) / dy2;

    floorX1 = clamp(floorX1, 100, 500);
    floorX2 = clamp(floorX2, 100, 500);

    var points = winTopX + ',' + winTopY + ' ' +
                 winBotX + ',' + winBotY + ' ' +
                 floorX2 + ',' + floorY + ' ' +
                 floorX1 + ',' + floorY;
    lightbeam.setAttribute('points', points);

    var altitude = Math.sin(angle);
    var beamOpacity = 0.04 + altitude * 0.08;
    lightbeam.setAttribute('opacity', clamp(beamOpacity, 0, 0.12));

    var glowLeft = Math.min(floorX1, floorX2);
    var glowWidth = Math.abs(floorX2 - floorX1);
    floorglow.setAttribute('x', glowLeft);
    floorglow.setAttribute('width', Math.max(glowWidth, 2));
    floorglow.setAttribute('opacity', clamp(altitude * 0.15, 0, 0.15));
  }

  function updateSky(time) {
    var navy = '#0f1b2d';
    var skyBlue = '#87CEEB';
    var top, bot;

    if (time < 5 || time > 19) {
      top = navy; bot = navy;
    } else if (time < 7) {
      var t = (time - 5) / 2;
      top = lerpColor(navy, skyBlue, t);
      bot = lerpColor(navy, '#c4a882', t);
    } else if (time <= 17) {
      top = skyBlue;
      bot = '#b0d4e8';
    } else {
      var t = (time - 17) / 2;
      top = lerpColor(skyBlue, navy, t);
      bot = lerpColor('#b0d4e8', navy, t);
    }
    skyStop0.setAttribute('stop-color', top);
    skyStop1.setAttribute('stop-color', bot);
  }

  function updateBrise(temp) {
    var opacity = clamp((temp - 20) / 8, 0, 1);
    root.style.setProperty('--brise-opacity', opacity);
  }

  function updateStats(time, temp, wind) {
    var angle = ((time - 6) / 12) * Math.PI;
    var lightPct = (time >= 6 && time <= 18) ? Math.round(Math.sin(angle) * 100) : 0;
    var brisePct = Math.round(clamp((temp - 20) / 8, 0, 1) * 100);

    statLight.textContent = lightPct + '%';
    statBrise.textContent = brisePct + '%';
    statVent.textContent = wind ? 'Activa' : 'Inactiva';
  }

  function update() {
    var time = parseFloat(timeInput.value);
    var temp = parseInt(tempInput.value, 10);
    var wind = windInput.checked;

    // Format time output
    var h = Math.floor(time);
    var m = Math.round((time - h) * 60);
    timeOutput.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    tempOutput.textContent = temp + ' °C';

    // Wind
    root.setAttribute('data-wind', wind ? 'on' : 'off');
    windArrows.style.opacity = wind ? '1' : '0';

    updateSun(time);
    updateLight(time);
    updateSky(time);
    updateBrise(temp);
    updateStats(time, temp, wind);
  }

  timeInput.addEventListener('input', update);
  tempInput.addEventListener('input', update);
  windInput.addEventListener('change', update);

  update();
})();
