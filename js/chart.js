(async function () {
  const res = await fetch("data/day-data.json");
  const data = await res.json();
  const hourly = data.hourly;

  // --- Dimensions ---
  const containerEl = document.getElementById("chart");
  const fullWidth = containerEl.clientWidth || 900;
  const margin = { top: 30, right: 60, left: 60, bottom: 10 };
  const scheduleHeight = 70;
  const keyDataHeight = 0;
  const chartHeight = 340;
  const totalHeight = margin.top + chartHeight + scheduleHeight + 20 + margin.bottom;
  const width = fullWidth - margin.left - margin.right;

  // --- SVG ---
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${fullWidth} ${totalHeight + 20}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // --- Scales ---
  const x = d3.scaleLinear().domain([0, 23]).range([0, width]);
  const yLeft = d3.scaleLinear().domain([0, 30]).range([chartHeight, 0]);
  const yRight = d3.scaleLinear().domain([0, 100]).range([chartHeight, 0]);

  // --- Axes ---
  const xAxis = d3
    .axisBottom(x)
    .ticks(24)
    .tickFormat((d) => `${d}:00`);

  g.append("g")
    .attr("class", "axis axis-x")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(xAxis)
    .selectAll("text")
    .style("font-size", "9px")
    .attr("transform", "rotate(-45)")
    .attr("text-anchor", "end");

  g.append("g").attr("class", "axis axis-y-left").call(d3.axisLeft(yLeft).ticks(6));
  g.append("g")
    .attr("class", "axis axis-y-right")
    .attr("transform", `translate(${width},0)`)
    .call(d3.axisRight(yRight).ticks(10));

  // Axis labels
  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -chartHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Temperature (°C) / Solar Rad. (100×W/m²)");

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(90)")
    .attr("x", chartHeight / 2)
    .attr("y", -width - 42)
    .attr("text-anchor", "middle")
    .text("RH (%) / CO₂ (10×ppm)");

  // --- Comfort Band ---
  g.append("rect")
    .attr("class", "comfort-band")
    .attr("x", 0)
    .attr("y", yLeft(25))
    .attr("width", width)
    .attr("height", yLeft(19) - yLeft(25))
    .attr("fill", "rgba(255,180,200,0.18)")
    .attr("stroke", "none");

  g.append("text")
    .attr("x", 6)
    .attr("y", yLeft(25) + 13)
    .attr("class", "comfort-label")
    .text("EN16798 Comfort Band");

  // --- Series config (editorial/muted palette) ---
  const seriesConfig = [
    { key: "outdoorTemp", label: "Outdoor Temp (°C)", color: "#999", axis: "left", dash: "", type: "line", visible: true },
    { key: "officeTemp", label: "Office Temp (°C)", color: "#c45a3c", axis: "left", dash: "", type: "line", visible: true },
    { key: "meetingTemp", label: "Meeting Room Temp (°C)", color: "#d4956a", axis: "left", dash: "", type: "line", visible: true },
    { key: "solarRadiation", label: "Solar Radiation (100×W/m²)", color: "#c9a84c", axis: "left", dash: "", type: "area", visible: false },
    { key: "officeCO2", label: "Office CO₂ (10×ppm)", color: "#aaa", axis: "right", dash: "", type: "line", visible: false },
    { key: "outdoorRH", label: "Outdoor RH (%)", color: "#6a9a7a", axis: "right", dash: "5,4", type: "line", visible: false },
    { key: "officeRH", label: "Office RH (%)", color: "#5a8a9a", axis: "right", dash: "5,4", type: "line", visible: false },
    { key: "meetingRH", label: "Meeting Room RH (%)", color: "#8a6a9a", axis: "right", dash: "5,4", type: "line", visible: false },
  ];

  // --- Draw series ---
  const seriesGroup = g.append("g").attr("class", "series");

  seriesConfig.forEach((s) => {
    const yScale = s.axis === "left" ? yLeft : yRight;
    const lineGen = d3
      .line()
      .x((d) => x(d.hour))
      .y((d) => yScale(d[s.key]))
      .curve(d3.curveMonotoneX);

    if (s.type === "area") {
      const areaGen = d3
        .area()
        .x((d) => x(d.hour))
        .y0(yLeft(0))
        .y1((d) => yLeft(d[s.key]))
        .curve(d3.curveMonotoneX);

      s.areaEl = seriesGroup
        .append("path")
        .datum(hourly)
        .attr("class", `series-area series-${s.key}`)
        .attr("d", areaGen)
        .attr("fill", s.color)
        .attr("fill-opacity", 0.2)
        .attr("stroke", "none")
        .style("opacity", s.visible ? 1 : 0)
        .style("pointer-events", s.visible ? "auto" : "none");
    }

    const path = seriesGroup
      .append("path")
      .datum(hourly)
      .attr("class", `series-line series-${s.key}`)
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", s.color)
      .attr("stroke-width", s.type === "area" ? 1.5 : 2.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("stroke-dasharray", s.dash || "none")
      .style("opacity", s.visible ? 1 : 0)
      .style("pointer-events", s.visible ? "auto" : "none");

    // Prepare entry animation (deferred until visible)
    if (s.visible) {
      const totalLength = path.node().getTotalLength();
      path
        .attr("stroke-dasharray", s.dash || `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", s.dash ? 0 : totalLength);
      s._totalLength = totalLength;
    }

    s.pathEl = path;
  });

  // --- Legend ---
  const legend = d3.select("#chart").append("div").attr("class", "chart-legend");
  const legendItems = [];

  seriesConfig.forEach((s, i) => {
    const item = legend.append("div").attr("class", "legend-item").classed("legend-off", !s.visible);

    item
      .append("span")
      .attr("class", "legend-swatch")
      .style("background", s.color)
      .style("opacity", s.visible ? 1 : 0.3);

    item.append("span").attr("class", "legend-label").text(s.label);

    legendItems.push(item);

    item.on("click", () => {
      // Pause auto-cycle on manual click
      pauseAutoCycle();

      s.visible = !s.visible;
      item.classed("legend-off", !s.visible);
      item.select(".legend-swatch").style("opacity", s.visible ? 1 : 0.3);

      s.pathEl
        .transition()
        .duration(800)
        .style("opacity", s.visible ? 1 : 0)
        .style("pointer-events", s.visible ? "auto" : "none");

      if (s.areaEl) {
        s.areaEl
          .transition()
          .duration(800)
          .style("opacity", s.visible ? 1 : 0)
          .style("pointer-events", s.visible ? "auto" : "none");
      }
    });
  });

  // --- Auto-cycle hidden series ---
  const cycleKeys = ["solarRadiation", "officeCO2", "outdoorRH", "officeRH", "meetingRH"];
  let cycleIndex = 0;
  let autoCycleTimer = null;
  let pauseTimer = null;

  function toggleSeries(key, show) {
    const s = seriesConfig.find(sc => sc.key === key);
    if (!s) return;
    const idx = seriesConfig.indexOf(s);
    s.visible = show;

    const item = legendItems[idx];
    item.classed("legend-off", !show);
    item.classed("legend-active", show);
    item.select(".legend-swatch").style("opacity", show ? 1 : 0.3);

    s.pathEl
      .transition()
      .duration(800)
      .style("opacity", show ? 1 : 0)
      .style("pointer-events", show ? "auto" : "none");

    if (s.areaEl) {
      s.areaEl
        .transition()
        .duration(800)
        .style("opacity", show ? 1 : 0)
        .style("pointer-events", show ? "auto" : "none");
    }
  }

  function autoCycleStep() {
    // Turn off previous
    if (cycleIndex > 0) {
      toggleSeries(cycleKeys[cycleIndex - 1], false);
    } else {
      // On first step or reset, turn off last
      toggleSeries(cycleKeys[cycleKeys.length - 1], false);
    }

    // Turn on current
    toggleSeries(cycleKeys[cycleIndex], true);

    cycleIndex = (cycleIndex + 1) % cycleKeys.length;
  }

  function startAutoCycle() {
    if (autoCycleTimer) return;
    autoCycleTimer = setInterval(autoCycleStep, 4000);
  }

  function pauseAutoCycle() {
    if (autoCycleTimer) {
      clearInterval(autoCycleTimer);
      autoCycleTimer = null;
    }
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      startAutoCycle();
    }, 12000);
  }

  // Start animations when chart scrolls into view
  const chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        chartObserver.disconnect();
        // Animate line drawing
        seriesConfig.forEach(s => {
          if (s.visible && s._totalLength) {
            s.pathEl
              .transition()
              .duration(1500)
              .ease(d3.easeCubicOut)
              .attr("stroke-dashoffset", 0)
              .on("end", function () {
                if (!s.dash) d3.select(this).attr("stroke-dasharray", "none");
              });
          }
        });
        // Start auto-cycle after line animation
        setTimeout(startAutoCycle, 2000);
      }
    });
  }, { threshold: 0.25 });
  chartObserver.observe(containerEl);

  // --- Tooltip (fixed below chart) ---
  const tooltipLine = g
    .append("line")
    .attr("class", "tooltip-line")
    .attr("y1", 0)
    .attr("y2", chartHeight)
    .style("opacity", 0);

  const infoBar = d3.select("#chart").append("div").attr("class", "chart-info-bar");

  const hoverDot = g.append("circle")
    .attr("r", 6)
    .attr("fill", "#999")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("opacity", 0)
    .style("pointer-events", "none");

  const overlay = g
    .append("rect")
    .attr("class", "overlay")
    .attr("width", width)
    .attr("height", chartHeight)
    .attr("fill", "none")
    .attr("pointer-events", "all");

  overlay
    .on("mousemove", function (event) {
      pauseAutoCycle();
      const [mx, my] = d3.pointer(event, this);
      const hourVal = x.invert(mx);
      const idx = Math.round(hourVal);
      const clamped = Math.max(0, Math.min(23, idx));
      const d = hourly[clamped];

      tooltipLine.attr("x1", x(clamped)).attr("x2", x(clamped)).style("opacity", 0.5);

      // Find the closest visible series to the mouse Y position
      let closest = null;
      let minDist = Infinity;
      seriesConfig.forEach((s) => {
        if (!s.visible) return;
        const yScale = s.axis === "left" ? yLeft : yRight;
        const lineY = yScale(d[s.key]);
        const dist = Math.abs(my - lineY);
        if (dist < minDist) {
          minDist = dist;
          closest = s;
        }
      });

      if (closest && minDist < 30) {
        overlay.classed("near-data", true);
        const yScale = closest.axis === "left" ? yLeft : yRight;
        const dotY = yScale(d[closest.key]);
        hoverDot
          .attr("cx", x(clamped))
          .attr("cy", dotY)
          .attr("fill", closest.color)
          .style("opacity", 1);

        const val = d[closest.key];
        const unit = closest.key.includes("Temp") || closest.key === "outdoorTemp" ? "°C" : closest.key.includes("RH") ? "%" : closest.key === "officeCO2" ? " (×10 ppm)" : "";
        const html = `<strong>${clamped}:00</strong> <span class="info-item"><span class="tt-swatch" style="background:${closest.color}"></span>${closest.label}: <strong>${val}</strong>${unit}</span>`;
        infoBar.html(html).style("opacity", 1);
      } else {
        overlay.classed("near-data", false);
        hoverDot.style("opacity", 0);
        tooltipLine.style("opacity", 0);
        infoBar.html("").style("opacity", 0);
      }
    })
    .on("mouseleave", function () {
      overlay.classed("near-data", false);
      tooltipLine.style("opacity", 0);
      hoverDot.style("opacity", 0);
      infoBar.html("").style("opacity", 0);
    });

  // --- Schedule bars ---
  const scheduleY = chartHeight + 20;
  const barH = 16;
  const barGap = 4;
  const scheduleLabels = ["Occupancy", "Computers", "Lights"];
  const scheduleKeys = ["occupancy", "computers", "lights"];
  const barColors = ["#5a8a9a", "#c9a84c", "#9aaa6a"];

  scheduleKeys.forEach((key, i) => {
    const yPos = scheduleY + i * (barH + barGap);
    // Label
    g.append("text")
      .attr("x", -8)
      .attr("y", yPos + barH / 2 + 4)
      .attr("text-anchor", "end")
      .attr("class", "schedule-label")
      .text(scheduleLabels[i]);

    data.schedules[key].forEach((seg) => {
      g.append("rect")
        .attr("x", x(seg.start))
        .attr("y", yPos)
        .attr("width", x(seg.end) - x(seg.start))
        .attr("height", barH)
        .attr("rx", 3)
        .attr("fill", barColors[i])
        .attr("fill-opacity", 0.55);

      g.append("text")
        .attr("x", (x(seg.start) + x(seg.end)) / 2)
        .attr("y", yPos + barH / 2 + 4)
        .attr("text-anchor", "middle")
        .attr("class", "schedule-value")
        .text(seg.value);
    });
  });

  // --- Title ---
  svg
    .append("text")
    .attr("x", fullWidth / 2)
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .text(data.title);
})();
