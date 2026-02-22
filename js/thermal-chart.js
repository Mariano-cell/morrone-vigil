(async function () {
  const res = await fetch("data/thermal-data.json");
  const data = await res.json();
  const scenarios = data.scenarios;

  /* --- Dimensions --- */
  const containerEl = document.getElementById("thermal-chart");
  const fullWidth = containerEl.clientWidth || 900;
  const margin = { top: 40, right: 30, left: 55, bottom: 100 };
  const chartHeight = 340;
  const width = fullWidth - margin.left - margin.right;
  const height = chartHeight;
  const totalHeight = margin.top + height + margin.bottom;

  /* --- SVG --- */
  const svg = d3.select("#thermal-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${fullWidth} ${totalHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  /* --- Scales --- */
  const x0 = d3.scaleBand()
    .domain(scenarios.map(d => d.label))
    .range([0, width])
    .paddingInner(0.25)
    .paddingOuter(0.15);

  const x1 = d3.scaleBand()
    .domain(["summer", "winter"])
    .range([0, x0.bandwidth()])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([15, 35])
    .range([height, 0]);

  const colors = { summer: "#d4715e", winter: "#a8c8d8" };

  /* --- Axes --- */
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .selectAll("text")
    .style("text-anchor", "middle")
    .style("font-size", "9px")
    .attr("dy", "1em")
    .call(wrap, x0.bandwidth());

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5))
    .selectAll(".domain").remove();

  /* Y-axis label */
  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -42)
    .attr("text-anchor", "middle")
    .text("Predicted Mean Indoor Temperature (°C)");

  /* --- Title --- */
  svg.append("text")
    .attr("class", "chart-title")
    .attr("x", fullWidth / 2)
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text(data.title);

  /* --- Comfort bands --- */
  const bands = data.comfortBands;
  [bands.summer, bands.winter].forEach(band => {
    g.append("rect")
      .attr("x", 0)
      .attr("width", width)
      .attr("y", y(band.max))
      .attr("height", y(band.min) - y(band.max))
      .attr("fill", band.color);

    g.append("text")
      .attr("class", "comfort-label")
      .attr("x", width - 4)
      .attr("y", y(band.max) + 10)
      .attr("text-anchor", "end")
      .text(band.label);
  });

  /* --- Grid lines --- */
  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
    .selectAll("line")
    .style("stroke", "rgba(240,235,227,0.12)");

  /* --- Info bar (fixed below chart) --- */
  const infoBar = d3.select("#thermal-chart")
    .append("div")
    .attr("class", "chart-info-bar");

  /* --- Bars --- */
  const baseScenario = scenarios[0];

  const groups = g.selectAll(".bar-group")
    .data(scenarios)
    .join("g")
    .attr("class", "bar-group")
    .attr("transform", d => `translate(${x0(d.label)},0)`);

  // Store bar references for auto-highlight
  const allBars = [];
  const deltaLabels = [];
  const valLabels = [];
  let barCounter = 0;

  ["summer", "winter"].forEach(season => {
    groups.each(function (d, i) {
      const group = d3.select(this);
      const finalY = y(d[season]);
      const finalH = height - y(d[season]);

      const bar = group.append("rect")
        .attr("x", x1(season))
        .attr("width", x1.bandwidth())
        .attr("y", height)
        .attr("height", 0)
        .attr("fill", colors[season])
        .attr("rx", 3)
        .attr("class", `bar-${season}`)
        .style("cursor", "pointer")
        .on("mouseenter", function (event) {
          infoBar.html(`<strong>${d.label}</strong> <span class="info-item"><span class="tt-swatch" style="background:${colors[season]}"></span>${season === "summer" ? "Summer" : "Winter"}: <strong>${d[season]} °C</strong></span>`)
            .style("opacity", 1);
        })
        .on("mouseleave", function () {
          infoBar.html("").style("opacity", 0);
        });

      // Store final values for deferred animation
      bar._finalY = finalY;
      bar._finalH = finalH;
      bar._delay = barCounter * 100;

      allBars.push({ bar, scenarioIndex: i, season });

      /* --- Delta annotations (initially hidden) --- */
      if (d.id !== "base") {
        const delta = +(d[season] - baseScenario[season]).toFixed(1);
        if (delta !== 0) {
          const sign = delta > 0 ? "▲" : "▼";
          const color = delta > 0 ? "#ff8a75" : "#7dcea0";

          const deltaLabel = group.append("text")
            .attr("x", x1(season) + x1.bandwidth() / 2)
            .attr("y", y(d[season]) - 6)
            .attr("text-anchor", "middle")
            .attr("font-size", "8px")
            .attr("fill", color)
            .attr("font-weight", "600")
            .style("opacity", 0)
            .text(`${sign}${Math.abs(delta)}`);

          deltaLabels.push({ el: deltaLabel, scenarioIndex: i });
        }
      }

      /* --- Value labels on bars (deferred) --- */
      const valLabel = group.append("text")
        .attr("x", x1(season) + x1.bandwidth() / 2)
        .attr("y", y(d[season]) + 14)
        .attr("text-anchor", "middle")
        .attr("font-size", "9px")
        .attr("fill", "#fff")
        .attr("font-weight", "600")
        .style("opacity", 0)
        .text(d[season]);
      valLabel._delay = barCounter * 100 + 500;
      valLabels.push(valLabel);

      barCounter++;
    });
  });

  /* --- Auto-highlight: cycle through scenarios --- */
  let highlightIndex = 0;

  function highlightScenario() {
    const activeIdx = highlightIndex % scenarios.length;

    // Dim all bars, highlight active scenario
    allBars.forEach(({ bar, scenarioIndex }) => {
      const isActive = scenarioIndex === activeIdx;
      bar.transition()
        .duration(600)
        .style("opacity", isActive ? 1 : 0.3);
    });

    // Show delta labels for active scenario
    deltaLabels.forEach(({ el, scenarioIndex }) => {
      el.transition()
        .duration(400)
        .style("opacity", scenarioIndex === activeIdx ? 1 : 0);
    });

    highlightIndex++;
  }

  function resetHighlight() {
    allBars.forEach(({ bar }) => {
      bar.transition().duration(600).style("opacity", 1);
    });
    deltaLabels.forEach(({ el }) => {
      el.transition().duration(400).style("opacity", 0);
    });
  }

  // Start animations when chart scrolls into view
  const thermalObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        thermalObserver.disconnect();
        // Animate bars growing — slow and gentle
        allBars.forEach(({ bar }) => {
          bar.transition()
            .delay(bar._delay * 2.5)
            .duration(1800)
            .ease(d3.easeCubicOut)
            .attr("y", bar._finalY)
            .attr("height", bar._finalH);
        });
        // Animate value labels
        valLabels.forEach(vl => {
          vl.transition()
            .delay(vl._delay * 2.5 + 600)
            .duration(700)
            .ease(d3.easeCubicOut)
            .style("opacity", 1);
        });
        // Start auto-highlight after entry animation
        setTimeout(() => {
          setInterval(() => {
            highlightScenario();
            if (highlightIndex % scenarios.length === 0) {
              setTimeout(resetHighlight, 2500);
            }
          }, 3500);
        }, barCounter * 250 + 2500);
      }
    });
  }, { threshold: 0.25 });
  thermalObserver.observe(containerEl);

  /* --- Legend --- */
  const legendDiv = d3.select("#thermal-chart")
    .append("div")
    .attr("class", "chart-legend");

  [{ key: "summer", label: "Summer" }, { key: "winter", label: "Winter" }].forEach(item => {
    const el = legendDiv.append("div").attr("class", "legend-item");
    el.append("span").attr("class", "legend-swatch").style("background", colors[item.key]);
    el.append("span").attr("class", "legend-label").text(item.label);
  });

  /* --- Word wrap for x-axis labels --- */
  function wrap(text, wrapWidth) {
    text.each(function () {
      const textEl = d3.select(this);
      const words = textEl.text().split(/\s+/).reverse();
      let word;
      let line = [];
      let lineNumber = 0;
      const lineHeight = 1.1;
      const yPos = textEl.attr("y");
      const dy = parseFloat(textEl.attr("dy"));
      let tspan = textEl.text(null)
        .append("tspan")
        .attr("x", 0)
        .attr("y", yPos)
        .attr("dy", dy + "em");

      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > wrapWidth) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = textEl.append("tspan")
            .attr("x", 0)
            .attr("y", yPos)
            .attr("dy", ++lineNumber * lineHeight + dy + "em")
            .text(word);
        }
      }
    });
  }
})();
