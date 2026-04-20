// ================================================
// Renewables 사업성 분석 계산기 (태양광 전용)
// Excel 재무모델 100% 재현
// ================================================

let ASSUMPTIONS = null;
let currentResult = null;

// 가정값 로드
async function loadAssumptions() {
  const res = await fetch('data/assumptions.json?t=' + Date.now());
  ASSUMPTIONS = await res.json();
  applyDefaults();
  recalculate();
}

// 기본값 적용
function applyDefaults() {
  const A = ASSUMPTIONS;
  document.getElementById('capacity_kw').value = 100;
  document.getElementById('capex_total').value = 230;  // 백만원
  document.getElementById('fit_price').value = A.fit_integrated.under_100kw.toFixed(2);
  document.getElementById('utilization').value = (A.operation.default_utilization * 100).toFixed(2);
  document.getElementById('module_decay').value = (A.operation.module_decay_per_year * 100).toFixed(1);
  document.getElementById('opex_annual').value = 1.0;  // 백만원 (100kW × 1만원)
  document.getElementById('rent').value = 0;
  
  document.getElementById('loan_amount').value = 161;  // 230 × 70%
  document.getElementById('interest_rate').value = (A.loan.default_interest_rate * 100).toFixed(1);
  document.getElementById('grace_years').value = A.loan.default_grace_years;
  document.getElementById('repay_years').value = A.loan.default_repay_years;
  
  document.getElementById('fee_ratio').value = (A.fees.default_ratio * 100).toFixed(1);
  document.getElementById('inflation').value = (A.financial.inflation * 100).toFixed(1);
  document.getElementById('tax_rate').value = (A.financial.tax_rate * 100).toFixed(1);
  document.getElementById('wacc').value = (A.financial.wacc * 100).toFixed(1);
  
  updateDefaultButtons();
}

// 용량 변경 시 "일반 CAPEX" 버튼 활성화 제어
function updateDefaultButtons() {
  const cap = parseFloat(document.getElementById('capacity_kw').value);
  const btn = document.getElementById('btn_default_capex');
  if (cap > 200) {
    btn.disabled = true;
    btn.textContent = '200kW 초과시 개별 산정';
    btn.title = '200kW 초과는 프로젝트별 편차가 크므로 직접 입력하세요';
  } else {
    btn.disabled = false;
    btn.textContent = '일반 (2.3억/100kW)';
    btn.title = '';
  }
  
  // 1MW 이상 경고
  const warning = document.getElementById('large_project_warning');
  if (cap >= 1000) {
    warning.style.display = 'block';
  } else {
    warning.style.display = 'none';
  }
  
  // 용량에 따른 REC 가중치 반영 FIT 자동 업데이트 (FIT 미수정 시)
  const fitField = document.getElementById('fit_price');
  if (!fitField.dataset.userModified) {
    const fit = cap < 100 
      ? ASSUMPTIONS.fit_integrated.under_100kw 
      : ASSUMPTIONS.fit_integrated['100kw_to_3mw'];
    fitField.value = fit.toFixed(2);
  }
}

// 일반 CAPEX 버튼
function setDefaultCapex() {
  const cap = parseFloat(document.getElementById('capacity_kw').value);
  if (cap > 200) return;
  const capex = (cap / 100) * 230;  // 백만원
  document.getElementById('capex_total').value = capex.toFixed(2);
  recalculate();
}

// 일반 수수료 버튼
function setDefaultFee() {
  document.getElementById('fee_ratio').value = (ASSUMPTIONS.fees.default_ratio * 100).toFixed(1);
  recalculate();
}

// 입력값 수집
function getInputs() {
  return {
    capacity_kw: parseFloat(document.getElementById('capacity_kw').value) || 0,
    capex_total: parseFloat(document.getElementById('capex_total').value) || 0,
    fit_price: parseFloat(document.getElementById('fit_price').value) || 0,
    utilization: (parseFloat(document.getElementById('utilization').value) || 0) / 100,
    module_decay: (parseFloat(document.getElementById('module_decay').value) || 0) / 100,
    opex_annual: parseFloat(document.getElementById('opex_annual').value) || 0,
    rent: parseFloat(document.getElementById('rent').value) || 0,
    loan_amount: parseFloat(document.getElementById('loan_amount').value) || 0,
    interest_rate: (parseFloat(document.getElementById('interest_rate').value) || 0) / 100,
    grace_years: parseInt(document.getElementById('grace_years').value) || 0,
    repay_years: parseInt(document.getElementById('repay_years').value) || 0,
    fee_ratio: (parseFloat(document.getElementById('fee_ratio').value) || 0) / 100,
    inflation: (parseFloat(document.getElementById('inflation').value) || 0) / 100,
    tax_rate: (parseFloat(document.getElementById('tax_rate').value) || 0) / 100,
    wacc: (parseFloat(document.getElementById('wacc').value) || 0) / 100
  };
}

// 핵심 계산 엔진
function calculate(inp) {
  const years = 20;
  const capex = inp.capex_total;
  const debt = Math.min(inp.loan_amount, capex);
  const equity = capex - debt;
  const loan_ratio = debt / capex;
  const annual_principal = inp.repay_years > 0 ? debt / inp.repay_years : 0;
  const fee_amount = capex * inp.fee_ratio;
  const total_cash_need = capex + fee_amount;
  const equity_with_fee = equity + fee_amount;  // 수수료 포함 실자기자본
  
  const results = [];
  let loan_balance = debt;
  let cumulative_fcff = -capex;
  let payback_year = null;
  
  for (let y = 1; y <= years; y++) {
    const module_eff = Math.pow(1 - inp.module_decay, y - 1);
    const generation_mwh = inp.capacity_kw / 1000 * inp.utilization * 8760 * module_eff;
    const generation_kwh = generation_mwh * 1000;
    
    // 매출 (백만원)
    const revenue = generation_kwh * inp.fit_price / 1_000_000;
    
    // 비용 (백만원)
    const opex = inp.opex_annual * Math.pow(1 + inp.inflation, y - 1);
    const depreciation = capex / 20;
    const rent = inp.rent * Math.pow(1 + inp.inflation, y - 1);
    const cogs = depreciation + opex + rent;
    
    const ebit = revenue - cogs;
    const interest = loan_balance * inp.interest_rate;
    const principal = y > inp.grace_years ? Math.min(annual_principal, loan_balance) : 0;
    
    const ebt = ebit - interest;
    const tax = Math.max(0, ebt * inp.tax_rate);
    const net_income = ebt - tax;
    
    const noplat = ebit * (1 - inp.tax_rate);
    const fcff = noplat + depreciation;
    const fcfe = fcff - interest * (1 - inp.tax_rate) - principal;
    
    results.push({
      year: y, generation_mwh, revenue, opex, depreciation, cogs, ebit,
      interest, principal, loan_balance,
      ebt, tax, net_income, fcff, fcfe
    });
    
    loan_balance = Math.max(0, loan_balance - principal);
    cumulative_fcff += fcff;
    if (payback_year === null && cumulative_fcff >= 0) {
      const prev = cumulative_fcff - fcff;
      payback_year = y - 1 + Math.abs(prev) / fcff;
    }
  }
  
  const fcff_flow = [-capex, ...results.map(r => r.fcff)];
  const fcfe_flow = [-equity, ...results.map(r => r.fcfe)];
  
  return {
    total_capex: capex,
    fee_amount,
    total_cash_need,
    debt,
    equity,
    equity_with_fee,
    loan_ratio,
    annual_principal,
    project_irr: calculateIRR(fcff_flow),
    equity_irr: calculateIRR(fcfe_flow),
    npv: calculateNPV(fcff_flow, inp.wacc),
    payback: payback_year,
    yearly: results,
    inputs: inp
  };
}

function calculateIRR(cf, guess = 0.1) {
  let rate = guess;
  for (let i = 0; i < 200; i++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cf.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cf[t] / denom;
      dnpv -= t * cf[t] / (denom * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-10) return null;
    const newRate = rate - npv / dnpv;
    if (!isFinite(newRate)) return null;
    if (Math.abs(newRate - rate) < 1e-8) return newRate;
    rate = newRate;
    if (rate < -0.99) rate = -0.5;
  }
  return rate;
}

function calculateNPV(cf, r) {
  return cf.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
}

// 결과 표시
function recalculate() {
  if (!ASSUMPTIONS) return;
  const inp = getInputs();
  const r = calculate(inp);
  currentResult = r;
  
  // 요약 카드
  document.getElementById('r_project_irr').textContent = r.project_irr ? (r.project_irr * 100).toFixed(2) + '%' : 'N/A';
  document.getElementById('r_equity_irr').textContent = r.equity_irr ? (r.equity_irr * 100).toFixed(2) + '%' : 'N/A';
  document.getElementById('r_npv').textContent = r.npv.toFixed(1) + ' 백만원';
  document.getElementById('r_payback').textContent = r.payback ? r.payback.toFixed(1) + '년' : '회수 불가';
  document.getElementById('r_equity').textContent = r.equity.toFixed(1) + ' 백만원';
  document.getElementById('r_equity_with_fee').textContent = r.equity_with_fee.toFixed(1) + ' 백만원';
  document.getElementById('r_fee').textContent = r.fee_amount.toFixed(1) + ' 백만원';
  document.getElementById('r_total_need').textContent = r.total_cash_need.toFixed(1) + ' 백만원';
  
  // 차트 업데이트
  updateChart(r);
  updateTable(r);
}

let chartInstance = null;
function updateChart(r) {
  const ctx = document.getElementById('cashflowChart');
  if (!ctx) return;
  
  const labels = r.yearly.map(y => y.year + '년');
  const revenueData = r.yearly.map(y => y.revenue);
  const fcfeData = r.yearly.map(y => y.fcfe);
  const netIncomeData = r.yearly.map(y => y.net_income);
  
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '매출',
          data: revenueData,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          type: 'bar'
        },
        {
          label: '순이익',
          data: netIncomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: '#10b981',
          borderWidth: 1,
          type: 'bar'
        },
        {
          label: 'FCFE (주주현금흐름)',
          data: fcfeData,
          type: 'line',
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#f1f5f9' } },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.95)',
          callbacks: {
            label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(1) + ' 백만원'
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', callback: v => v + '백만' } }
      }
    }
  });
}

function updateTable(r) {
  const tbody = document.getElementById('yearlyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  r.yearly.forEach(y => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${y.year}</td>
      <td style="text-align:right">${y.generation_mwh.toFixed(1)}</td>
      <td style="text-align:right">${y.revenue.toFixed(2)}</td>
      <td style="text-align:right">${y.cogs.toFixed(2)}</td>
      <td style="text-align:right">${y.ebit.toFixed(2)}</td>
      <td style="text-align:right">${y.interest.toFixed(2)}</td>
      <td style="text-align:right">${y.net_income.toFixed(2)}</td>
      <td style="text-align:right; color:#10b981; font-weight:600">${y.fcfe.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// PDF 다운로드 (간이)
function downloadPDF() {
  if (!currentResult) return;
  alert('PDF 다운로드는 로그인 기능 구축 후 활성화됩니다. 지금은 브라우저 인쇄(Ctrl+P)로 저장하세요.');
  window.print();
}

// 이벤트 등록
document.addEventListener('DOMContentLoaded', () => {
  loadAssumptions();
  
  // 모든 input 변경 시 재계산
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => {
      if (el.id === 'capacity_kw') updateDefaultButtons();
      if (el.id === 'fit_price') el.dataset.userModified = 'true';
      recalculate();
    });
  });
  
  // 버튼
  document.getElementById('btn_default_capex').addEventListener('click', setDefaultCapex);
  document.getElementById('btn_default_fee').addEventListener('click', setDefaultFee);
  document.getElementById('btn_default_loan').addEventListener('click', () => {
    const capex = parseFloat(document.getElementById('capex_total').value) || 0;
    document.getElementById('loan_amount').value = (capex * 0.7).toFixed(2);
    document.getElementById('grace_years').value = 2;
    document.getElementById('repay_years').value = 18;
    document.getElementById('interest_rate').value = 5.0;
    recalculate();
  });
  document.getElementById('btn_pdf').addEventListener('click', downloadPDF);
});
