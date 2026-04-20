// ================================================
// Renewables 사업성 분석 계산기 v4
// - 체크박스 제거 → 버튼 방식
// - 빈칸 시작 + 권장값 버튼
// - REC 가중치 수기 입력
// - 수수료 금액 직접 입력
// ================================================

let ASSUMPTIONS = null;
let currentResult = null;

async function loadAssumptions() {
  const res = await fetch('data/assumptions.json?t=' + Date.now());
  ASSUMPTIONS = await res.json();
  setupEventHandlers();
  recalculate();
}

// ========== 권장값 버튼들 ==========

const PRESETS = {
  capex_total: () => {
    const cap = num('capacity_kw');
    if (cap <= 0) return alert('먼저 발전용량을 입력하세요');
    if (cap > 200) return alert('200kW 초과는 프로젝트별 편차가 커서 직접 입력하세요');
    setVal('capex_total', (cap / 100 * 230).toFixed(1));
  },
  loan_amount: () => {
    const capex = num('capex_total');
    if (capex <= 0) return alert('먼저 총 투자비를 입력하세요');
    setVal('loan_amount', (capex * 0.7).toFixed(1));
  },
  interest_rate: () => setVal('interest_rate', (ASSUMPTIONS.loan.default_interest_rate * 100).toFixed(1)),
  loan_all: () => {
    const capex = num('capex_total');
    if (capex <= 0) return alert('먼저 총 투자비를 입력하세요');
    setVal('loan_amount', (capex * 0.7).toFixed(1));
    setVal('interest_rate', 5.0);
    setVal('grace_years', 2);
    setVal('repay_years', 18);
  },
  smp_price: () => setVal('smp_price', ASSUMPTIONS.smp.annual_avg_krw_per_kwh.toFixed(2)),
  rec_price: () => setVal('rec_price', ASSUMPTIONS.rec.spot_avg_krw),
  rec_weight: () => setVal('rec_weight', '1.0'),
  utilization_pct: () => {
    setVal('utilization_pct', (ASSUMPTIONS.operation.default_utilization * 100).toFixed(2));
    syncUtil('pct');
  },
  utilization_hr: () => {
    setVal('utilization_hr', ASSUMPTIONS.operation.default_hours_per_day.toFixed(2));
    syncUtil('hr');
  },
  module_decay: () => setVal('module_decay', (ASSUMPTIONS.operation.module_decay_per_year * 100).toFixed(2)),
  opex_annual: () => {
    const cap = num('capacity_kw');
    if (cap <= 0) return alert('먼저 발전용량을 입력하세요');
    setVal('opex_annual', (cap / 100 * ASSUMPTIONS.operation.opex_default_m_krw_per_100kw).toFixed(2));
  },
  fee_amount: () => {
    const capex = num('capex_total');
    if (capex <= 0) return alert('먼저 총 투자비를 입력하세요');
    setVal('fee_amount', (capex * 0.10).toFixed(1));
  },
  inflation: () => setVal('inflation', (ASSUMPTIONS.financial.inflation * 100).toFixed(1)),
  wacc: () => setVal('wacc', (ASSUMPTIONS.financial.wacc * 100).toFixed(1))
};

// 전체 기본값 한 번에 채우기
function fillAllDefaults() {
  const A = ASSUMPTIONS;
  if (num('capacity_kw') <= 0) setVal('capacity_kw', 100);
  const cap = num('capacity_kw');
  
  if (cap <= 200) setVal('capex_total', (cap / 100 * 230).toFixed(1));
  const capex = num('capex_total') || 230;
  
  setVal('loan_amount', (capex * 0.7).toFixed(1));
  setVal('interest_rate', 5.0);
  setVal('grace_years', 2);
  setVal('repay_years', 18);
  setVal('smp_price', A.smp.annual_avg_krw_per_kwh.toFixed(2));
  setVal('rec_price', A.rec.spot_avg_krw);
  setVal('rec_weight', '1.0');
  setVal('utilization_pct', (A.operation.default_utilization * 100).toFixed(2));
  setVal('utilization_hr', A.operation.default_hours_per_day.toFixed(2));
  setVal('module_decay', (A.operation.module_decay_per_year * 100).toFixed(2));
  setVal('opex_annual', (cap / 100 * A.operation.opex_default_m_krw_per_100kw).toFixed(2));
  setVal('rent', 0);
  setVal('fee_amount', (capex * 0.10).toFixed(1));
  setVal('inflation', (A.financial.inflation * 100).toFixed(1));
  setVal('wacc', (A.financial.wacc * 100).toFixed(1));
  
  recalculate();
}

// ========== 유틸 ==========

function num(id) { return parseFloat(document.getElementById(id).value) || 0; }
function setVal(id, v) { document.getElementById(id).value = v; recalculate(); }

// 이용률 ↔ 시간/일 양방향 연동
let isUpdatingUtil = false;
function syncUtil(source) {
  if (isUpdatingUtil) return;
  isUpdatingUtil = true;
  if (source === 'pct') {
    const pct = num('utilization_pct');
    document.getElementById('utilization_hr').value = (pct / 100 * 24).toFixed(2);
  } else {
    const hr = num('utilization_hr');
    document.getElementById('utilization_pct').value = (hr / 24 * 100).toFixed(2);
  }
  isUpdatingUtil = false;
}

// ========== 이벤트 핸들러 ==========

function setupEventHandlers() {
  // 모든 input 변경 시 재계산
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => {
      if (el.id === 'utilization_pct') syncUtil('pct');
      if (el.id === 'utilization_hr') syncUtil('hr');
      if (el.id === 'capacity_kw') checkLargeProject();
      recalculate();
    });
  });
  
  // 프리셋 버튼들
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-preset');
      if (PRESETS[key]) PRESETS[key]();
    });
  });
  
  // 전체 채우기
  document.getElementById('btn_fill_all').addEventListener('click', fillAllDefaults);
  
  // 사업자 유형
  document.querySelectorAll('[name="biz_type"]').forEach(r => {
    r.addEventListener('change', () => {
      updateTaxUI();
      recalculate();
    });
  });
  
  document.getElementById('btn_pdf').addEventListener('click', () => {
    window.print();
  });
  
  updateTaxUI();
}

function updateTaxUI() {
  const type = document.querySelector('[name="biz_type"]:checked').value;
  document.getElementById('tax_corp_box').style.display = type === 'corporate' ? 'block' : 'none';
  document.getElementById('tax_personal_box').style.display = type === 'personal' ? 'block' : 'none';
}

function checkLargeProject() {
  const cap = num('capacity_kw');
  document.getElementById('large_project_warning').style.display = cap >= 1000 ? 'block' : 'none';
}

// ========== 입력값 수집 ==========

function getInputs() {
  const smp = num('smp_price');
  const rec = num('rec_price');
  const weight = num('rec_weight');
  const salesPrice = smp + (rec * weight / 1000);
  
  return {
    capacity_kw: num('capacity_kw'),
    capex_total: num('capex_total'),
    smp_price: smp,
    rec_price: rec,
    rec_weight: weight,
    sales_price: salesPrice,
    utilization: num('utilization_pct') / 100,
    module_decay: num('module_decay') / 100,
    opex_annual: num('opex_annual'),
    rent: num('rent'),
    loan_amount: num('loan_amount'),
    interest_rate: num('interest_rate') / 100,
    grace_years: parseInt(document.getElementById('grace_years').value) || 0,
    repay_years: parseInt(document.getElementById('repay_years').value) || 0,
    fee_amount: num('fee_amount'),
    inflation: num('inflation') / 100,
    inflation_to_sales: document.getElementById('inflation_to_sales').checked,
    wacc: num('wacc') / 100,
    biz_type: document.querySelector('[name="biz_type"]:checked').value
  };
}

// ========== 세금 계산 ==========

function getSimpleExpenseRate(revenue_won) {
  const bands = ASSUMPTIONS.financial.personal_simple_rate_bands;
  for (const b of bands) {
    if (revenue_won < b.max_revenue) return { rate: b.rate, desc: b.desc };
  }
  return { 
    rate: 1 - ASSUMPTIONS.financial.personal_standard_expense_rate, 
    desc: '3.85억 초과 (복식부기 의무)',
    is_bookkeeping: true
  };
}

function calcIncomeTax(taxable_income_won) {
  if (taxable_income_won <= 0) return 0;
  const brackets = ASSUMPTIONS.financial.income_tax_brackets;
  for (const b of brackets) {
    if (b.max === null || taxable_income_won <= b.max) {
      const base_tax = taxable_income_won * b.rate - b.deduction;
      return Math.max(0, base_tax) * (1 + ASSUMPTIONS.financial.local_income_tax_addon);
    }
  }
  return 0;
}

// ========== 핵심 계산 ==========

function calculate(inp) {
  const years = 20;
  const capex = inp.capex_total;
  const debt = Math.min(inp.loan_amount, capex);
  const equity = Math.max(0, capex - debt);
  const annual_principal = inp.repay_years > 0 ? debt / inp.repay_years : 0;
  const fee_amount = inp.fee_amount;
  const equity_with_fee = equity + fee_amount;
  const total_cash_need = capex + fee_amount;
  
  const results = [];
  let loan_balance = debt;
  let cumulative_fcff = -capex;
  let payback_year = null;
  let total_tax_20y = 0;
  
  for (let y = 1; y <= years; y++) {
    const module_eff = Math.pow(1 - inp.module_decay, y - 1);
    const generation_mwh = inp.capacity_kw / 1000 * inp.utilization * 8760 * module_eff;
    const generation_kwh = generation_mwh * 1000;
    const price_y = inp.inflation_to_sales 
      ? inp.sales_price * Math.pow(1 + inp.inflation, y - 1)
      : inp.sales_price;
    
    const revenue_mil = generation_kwh * price_y / 1_000_000;
    const revenue_won = revenue_mil * 1_000_000;
    const opex = inp.opex_annual * Math.pow(1 + inp.inflation, y - 1);
    const depreciation = capex / 20;
    const rent = inp.rent * Math.pow(1 + inp.inflation, y - 1);
    const cogs = depreciation + opex + rent;
    const ebit = revenue_mil - cogs;
    const interest = loan_balance * inp.interest_rate;
    const principal = y > inp.grace_years ? Math.min(annual_principal, loan_balance) : 0;
    const ebt = ebit - interest;
    
    let tax_won = 0;
    let tax_desc = '';
    if (inp.biz_type === 'corporate') {
      tax_won = Math.max(0, ebt * 1_000_000 * ASSUMPTIONS.financial.corporate_tax_rate);
      tax_desc = '법인세 11%';
    } else {
      const expenseInfo = getSimpleExpenseRate(revenue_won);
      if (expenseInfo.is_bookkeeping) {
        tax_won = calcIncomeTax(ebt * 1_000_000);
        tax_desc = `복식부기 (3.85억+)`;
      } else {
        const deemed_income = revenue_won * (1 - expenseInfo.rate);
        tax_won = calcIncomeTax(deemed_income);
        tax_desc = `단순경비율 ${(expenseInfo.rate * 100).toFixed(1)}%`;
      }
    }
    const tax_mil = tax_won / 1_000_000;
    const net_income = ebt - tax_mil;
    total_tax_20y += tax_mil;
    
    const effective_tax_rate = ebt > 0 ? tax_mil / ebt : 0;
    const noplat = ebit * (1 - effective_tax_rate);
    const fcff = noplat + depreciation;
    const fcfe = fcff - interest * (1 - effective_tax_rate) - principal;
    
    results.push({
      year: y, generation_mwh, revenue: revenue_mil, cogs, ebit,
      interest, principal, ebt, tax: tax_mil, net_income, fcff, fcfe, tax_desc
    });
    
    loan_balance = Math.max(0, loan_balance - principal);
    const prev_cum = cumulative_fcff;
    cumulative_fcff += fcff;
    if (payback_year === null && cumulative_fcff >= 0 && fcff > 0) {
      payback_year = y - 1 + Math.abs(prev_cum) / fcff;
    }
  }
  
  const fcff_flow = [-capex, ...results.map(r => r.fcff)];
  const fcfe_flow = [-equity, ...results.map(r => r.fcfe)];
  
  return {
    total_capex: capex, fee_amount, total_cash_need,
    debt, equity, equity_with_fee, annual_principal,
    project_irr: calculateIRR(fcff_flow),
    equity_irr: calculateIRR(fcfe_flow),
    npv: calculateNPV(fcff_flow, inp.wacc),
    payback: payback_year,
    total_tax_20y,
    avg_annual_tax: total_tax_20y / 20,
    year1_tax: results[0].tax,
    year2_tax: results[1].tax,
    yearly: results, inputs: inp
  };
}

function calculateIRR(cf, guess = 0.1) {
  let rate = guess;
  for (let i = 0; i < 200; i++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cf.length; t++) {
      const d = Math.pow(1 + rate, t);
      npv += cf[t] / d;
      dnpv -= t * cf[t] / (d * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-10) return null;
    const newRate = rate - npv / dnpv;
    if (!isFinite(newRate)) return null;
    if (Math.abs(newRate - rate) < 1e-8) return newRate;
    rate = Math.max(-0.99, newRate);
  }
  return rate;
}

function calculateNPV(cf, r) {
  return cf.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
}

// ========== 결과 표시 ==========

function recalculate() {
  if (!ASSUMPTIONS) return;
  
  // 전력판매가 표시
  const smp = num('smp_price'), rec = num('rec_price'), w = num('rec_weight');
  const sp = smp + (rec * w / 1000);
  document.getElementById('sales_price_display').textContent = sp > 0 ? sp.toFixed(2) + '원/kWh' : '-- 원/kWh';
  
  const inp = getInputs();
  
  // 입력 부족 시
  if (inp.capacity_kw <= 0 || inp.capex_total <= 0 || inp.sales_price <= 0) {
    setEmpty();
    return;
  }
  
  const r = calculate(inp);
  currentResult = r;
  
  document.getElementById('r_project_irr').textContent = r.project_irr !== null ? (r.project_irr * 100).toFixed(2) + '%' : 'N/A';
  document.getElementById('r_equity_irr').textContent = r.equity_irr !== null ? (r.equity_irr * 100).toFixed(2) + '%' : 'N/A';
  document.getElementById('r_npv').textContent = r.npv.toFixed(1) + ' 백만원';
  document.getElementById('r_payback').textContent = r.payback !== null ? r.payback.toFixed(1) + '년' : '회수 불가';
  document.getElementById('r_equity').textContent = r.equity.toFixed(1) + ' 백만원';
  document.getElementById('r_equity_with_fee').textContent = r.equity_with_fee.toFixed(1) + ' 백만원';
  document.getElementById('r_total_capex').textContent = r.total_capex.toFixed(1) + ' 백만원';
  document.getElementById('r_fee').textContent = r.fee_amount.toFixed(1) + ' 백만원';
  document.getElementById('r_total_need').textContent = r.total_cash_need.toFixed(1) + ' 백만원';
  
  document.getElementById('r_year1_tax').textContent = (r.year1_tax * 100).toFixed(0) + '만원';
  document.getElementById('r_year2_tax').textContent = (r.year2_tax * 100).toFixed(0) + '만원';
  document.getElementById('r_avg_tax').textContent = (r.avg_annual_tax * 100).toFixed(0) + '만원';
  document.getElementById('r_total_tax').textContent = r.total_tax_20y.toFixed(1) + ' 백만원';
  document.getElementById('r_tax_desc').textContent = r.yearly[0].tax_desc;
  
  updateChart(r);
  updateTable(r);
}

function setEmpty() {
  ['r_project_irr','r_equity_irr','r_npv','r_payback','r_equity','r_equity_with_fee',
   'r_total_capex','r_fee','r_total_need','r_year1_tax','r_year2_tax','r_avg_tax','r_total_tax','r_tax_desc'].forEach(id => {
    document.getElementById(id).textContent = '--';
  });
  document.getElementById('yearlyTableBody').innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:20px">필수 값(용량·투자비·판매가)을 입력하면 결과가 나타납니다</td></tr>';
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
}

let chartInstance = null;
function updateChart(r) {
  const ctx = document.getElementById('cashflowChart');
  if (!ctx) return;
  const labels = r.yearly.map(y => y.year + '년');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '매출', data: r.yearly.map(y => y.revenue), backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#3b82f6', borderWidth: 1 },
        { label: '순이익', data: r.yearly.map(y => y.net_income), backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 1 },
        { label: 'FCFE', data: r.yearly.map(y => y.fcfe), type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 3, tension: 0.3, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#f1f5f9' } },
        tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(1) + ' 백만원' } }
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
      <td style="text-align:right; color:#f59e0b">${y.tax.toFixed(2)}</td>
      <td style="text-align:right">${y.net_income.toFixed(2)}</td>
      <td style="text-align:right; color:#10b981; font-weight:600">${y.fcfe.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', loadAssumptions);
