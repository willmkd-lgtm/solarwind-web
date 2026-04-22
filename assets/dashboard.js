// Renewables - 대시보드 차트 & 표 스크립트
document.addEventListener('renewablesDataLoaded', function(e) {
  const data = e.detail;

  // ========== 30일 SMP 차트 ==========
  const ctx = document.getElementById('smpChart');
  if (ctx && data.chart) {
    
    // ⭐ 추가: 기존 차트가 있으면 파괴 (Canvas 재사용 에러 방지)
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    
    const labels = data.chart.map(d => d.date.slice(5));
    const avgData = data.chart.map(d => d.smp_avg);
    const maxData = data.chart.map(d => d.smp_max);
    const minData = data.chart.map(d => d.smp_min);

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '평균 SMP',
            data: avgData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: '#3b82f6',
            pointHoverRadius: 6
          },
          {
            label: '최대 SMP',
            data: maxData,
            borderColor: '#ef4444',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
          },
          {
            label: '최소 SMP',
            data: minData,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#f1f5f9', font: { size: 13 }, padding: 16, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1',
            borderColor: '#3b82f6',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + '원/kWh';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#94a3b8',
              callback: function(v) { return v + '원'; }
            }
          }
        }
      }
    });
  }

  // ========== 일별 상세 표 (기존 그대로) ==========
  const tbody = document.getElementById('tableBody');
  if (tbody && data.chart) {
    tbody.innerHTML = '';
    const rows = data.chart.slice().reverse();
    rows.forEach(d => {
      const range = (d.smp_max - d.smp_min).toFixed(2);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.date}</td>
        <td style="text-align:right; font-weight:600">${d.smp_avg.toFixed(2)}</td>
        <td style="text-align:right; color:#ef4444">${d.smp_max.toFixed(2)}</td>
        <td style="text-align:right; color:#10b981">${d.smp_min.toFixed(2)}</td>
        <td style="text-align:right; color:#94a3b8">${range}</td>
      `;
      tbody.appendChild(tr);
    });
  }
});
