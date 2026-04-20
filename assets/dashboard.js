// 대시보드 전용 차트 스크립트
document.addEventListener('renewablesDataLoaded', function(e) {
  const data = e.detail;

  // 30일 SMP 차트
  const ctx = document.getElementById('smpChart');
  if (ctx && data.chart) {
    const labels = data.chart.map(d => d.date.slice(5)); // MM-DD
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
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointBackgroundColor: '#3b82f6'
          },
          {
            label: '최대 SMP',
            data: maxData,
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 0
          },
          {
            label: '최소 SMP',
            data: minData,
            borderColor: '#10b981',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#f1f5f9', font: { size: 13 } } },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + '원/kWh'; }
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: v => v + '원' } }
        }
      }
    });
  }

  // 표 생성
  const tbody = document.getElementById('tableBody');
  if (tbody && data.chart) {
    tbody.innerHTML = '';
    const recent = data.chart.slice().reverse().slice(0, 15);
    recent.forEach(d => {
      const range = (d.smp_max - d.smp_min).toFixed(2);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.date}</td>
        <td style="text-align:right; font-weight:600">${d.smp_avg.toFixed(2)}</td>
        <td style="text-align:right; color:#ef4444">${d.smp_max.toFixed(2)}</td>
        <td style="text-align:right; color:#10b981">${d.smp_min.toFixed(2)}</td>
        <td style="text-align:right; color:var(--text-muted)">${range}</td>
      `;
      tbody.appendChild(tr);
    });
  }
});
