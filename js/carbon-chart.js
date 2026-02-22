(async function () {
  const res = await fetch("data/carbon-data.json");
  const data = await res.json();
  const categories = data.categories;

  /* --- Dimensions --- */
  const containerEl = document.getElementById("carbon-chart");
  const fullWidth = containerEl.clientWidth || 900;
  const margin = { top: 40, right: 50, left: 120, bottom: 30 };
  const barHeight = 32;
  const barGap = 10;
  const chartHeight = categories.length * (barHeight + barGap);
  const width = fullWidth - margin.left - margin.right;
  const totalHeight = margin.top + chartHeight + margin.bottom;

  /* --- SVG --- */
  const svg = d3.select("#carbon-chart")
    .append("svg")
    .attr("viewBox", `0 0 ${fullWidth} ${totalHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  /* --- Scales --- */
  const x = d3.scaleLinear()
    .domain([0, 250])
    .range([0, width]);

  const y = d3.scaleBand()
    .domain(categories.map(d => d.label))
    .range([0, chartHeight])
    .paddingInner(0.25)
    .paddingOuter(0.1);

  /* --- Axes --- */
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => d))
    .selectAll(".domain").remove();

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll(".domain").remove();

  /* X-axis label */
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", chartHeight + 28)
    .attr("text-anchor", "middle")
    .text("kg CO₂e/m²");

  /* --- Title --- */
  svg.append("text")
    .attr("class", "chart-title")
    .attr("x", fullWidth / 2)
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .text(data.title);

  /* --- Grid lines --- */
  g.append("g")
    .attr("class", "axis")
    .call(d3.axisBottom(x).ticks(5).tickSize(chartHeight).tickFormat(""))
    .attr("transform", "translate(0,0)")
    .selectAll("line")
    .style("stroke", "rgba(240,235,227,0.12)");

  /* --- Info bar (fixed below chart) --- */
  const infoBar = d3.select("#carbon-chart")
    .append("div")
    .attr("class", "chart-info-bar");

  /* --- Bars (animated from width=0) --- */
  const bars = g.selectAll(".bar")
    .data(categories)
    .join("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => y(d.label))
    .attr("width", 0)
    .attr("height", y.bandwidth())
    .attr("fill", "#c9b896")
    .attr("rx", 3)
    .style("cursor", "pointer")
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("fill", "#b8a57e");
      infoBar.html(`<strong>${d.label}</strong> <span class="info-item">${d.value} kg CO₂e/m²</span>`)
        .style("opacity", 1);
    })
    .on("mouseleave", function () {
      d3.select(this).attr("fill", "#c9b896");
      infoBar.html("").style("opacity", 0);
    });

  /* --- Value labels (start at 0, animated later) --- */
  const valueLabels = g.selectAll(".bar-label")
    .data(categories)
    .join("text")
    .attr("class", "bar-label")
    .attr("x", 6)
    .attr("y", d => y(d.label) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("font-size", "11px")
    .attr("fill", "#f0ebe3")
    .attr("font-weight", "600")
    .text("0");

  /* --- Auto-highlight: cycle through categories --- */
  let highlightIndex = 0;

  function highlightCategory() {
    const activeIdx = highlightIndex % categories.length;

    bars.each(function (d, i) {
      const bar = d3.select(this);
      const isActive = i === activeIdx;
      bar.transition()
        .duration(500)
        .style("opacity", isActive ? 1 : 0.3)
        .attr("fill", isActive ? "#b8a57e" : "#c9b896");
    });

    valueLabels.each(function (d, i) {
      d3.select(this).transition()
        .duration(400)
        .style("opacity", i === activeIdx ? 1 : 0.3);
    });

    highlightIndex++;
  }

  function resetHighlight() {
    bars.transition().duration(500)
      .style("opacity", 1)
      .attr("fill", "#c9b896");
    valueLabels.transition().duration(400).style("opacity", 1);
  }

  // Start all animations when chart scrolls into view
  const carbonObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        carbonObserver.disconnect();
        // Animate bars
        bars.each(function (d, i) {
          d3.select(this)
            .transition()
            .delay(i * 120)
            .duration(1000)
            .ease(d3.easeCubicOut)
            .attr("width", x(d.value));
        });
        // Count-up animation
        valueLabels.each(function (d, i) {
          const label = d3.select(this);
          const finalVal = d.value;
          const delay = i * 120;
          const duration = 1000;
          label.transition()
            .delay(delay)
            .duration(duration)
            .ease(d3.easeCubicOut)
            .tween("text", function () {
              const interp = d3.interpolateNumber(0, finalVal);
              return function (t) {
                label.text(Math.round(interp(t)));
              };
            });
          label.transition()
            .delay(delay)
            .duration(duration)
            .ease(d3.easeCubicOut)
            .attr("x", x(finalVal) + 6);
        });
        // Start auto-highlight after entry animations
        setTimeout(() => {
          setInterval(() => {
            highlightCategory();
            if (highlightIndex % categories.length === 0) {
              setTimeout(resetHighlight, 2000);
            }
          }, 3000);
        }, categories.length * 120 + 1500);
      }
    });
  }, { threshold: 0.25 });
  carbonObserver.observe(containerEl);
})();
