// ================================================
// Renewables 사업성 분석 계산기 v5 (버그 수정)
// - 이벤트 핸들러 즉시 연결 (JSON 독립)
// - 기본값 하드코딩 (fallback)
// - 명시적 "계산하기" 버튼 추가
// ================================================

// 🔵 하드코딩 기본값 (JSON 실패해도 동작)
const FALLBACK = {
  smp: { annual_avg_krw_per_kwh: 111.96 },
  rec: { spot_avg_krw: 70000 },
  capex: { default_per_kw_krw: 2300000 },
  loan: { default_ratio: 0.7, default_interest_rate: 0.05, default_grace_years: 2, default_repay_years: 18 },
  operation: {
    default_utilization: 0.1458,
    default_hours_per_day: 3.5,
    module_decay_per_year: 0.002,
    opex_default_m_krw_per_100kw: 1.2
  },
  fees: { default_ratio: 0.10 },
  financial: {
    inflation: 0.022,
    corporate_tax_rate: 0.11,
    personal_simple_rate_bands: [
      { max_revenue: 36000000, rate: 0.951, desc: "수입 3,600만원 미만" },
      { max_revenue: 150000000, rate: 0.8726, desc: "3,600만~1.5억" },
      { max_revenue: 385000000, rate: 0.8432, desc: "1.5억~3.85억" }
    ],
    personal_standard_expense_rate: 0.238,
    income_tax_brackets: [
      { max: 14000000, rate: 0.06, deduction: 0 },
      { max: 50000000, rate: 0.15, deduction: 1260000 },
      { max: 88000000, rate: 0.24, deduction: 5760000 },
      { max: 150000000, rate: 0.35, deduction: 15440000 },
      { max: 300000000, rate: 0.38, deduction: 19940000 },
      { max: 500000000, rate: 0.40, deduction: 25940000 },
      { max: 1000000000, rate: 0.42, deduction: 35940000 },
      { max: null, rate: 0.45, deduction: 65940000 }
    ],
    local_income_tax_addon: 0.10,
    wacc: 0.05
  }
};

let ASSUMPTIONS = FALLBACK;  // 🔵 즉시 기본값 할당 (null 방지)
let currentResult = null;
let isUpdatingUtil = false;

// ========== 유틸 ==========

function num(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(el.value) || 0;
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = v;
  recalculate();
}

// ========== 프리셋 (버튼 클릭 시 실행) ==========

const PRESETS = {
  capex_total: () => {
    const cap = num('capacity_kw');
    if (cap <= 0) { alert('먼저 발전용량을 입력하세요'); return; }
    if (cap > 200) { alert('200kW 초과는 프로젝트별 편차가 커서 직접 입력하세요'); return; }
    setVal('capex_total', (cap / 100 * 230).toFixed(1));
  },
  loan_amount: () => {
    const capex = num('capex_total');
    if (capex <= 0) { alert('먼저 총 투자비를 입력하세요'); return; }
    // 100kW(230) 기준 160, 그 외는 70% 계산
    const result = Math.abs(capex - 230) < 0.1 ? 160 : capex * 0.7;
    setVal('loan_amount', result.toFixed(1));
  },

  interest_rate: () => setVal('interest_rate', (ASSUMPTIONS.loan.default_interest_rate * 100).toFixed(1)),
  loan_all: () => {
    const capex = num('capex_total');
    if (capex <= 0) { alert('먼저 총 투자비를 입력하세요'); return; }
    const loanAmt = Math.abs(capex - 230) < 0.1 ? 160 : capex * 0.7;
    document.getElementById('loan_amount').value = loanAmt.toFixed(1);
    document.getElementById('interest_rate').value = 5.0;
    document.getElementById('grace_years').value = 2;
    document.getElementById('repay_years').value = 18;
    recalculate();
  },

  smp_price: () => setVal('smp_price', ASSUMPTIONS.smp.annual_avg_krw_per_kwh.toFixed(2)),
  rec_price: () => setVal('rec_price', ASSUMPTIONS.rec.spot_avg_krw),
  rec_weight: () => setVal('rec_weight', '1.2'),
  utilization_pct: () => {
    const pct = (ASSUMPTIONS.operation.default_utilization * 100).toFixed(2);
    document.getElementById('utilization_pct').value = pct;
    document.getElementById('utilization_hr').value = (pct / 100 * 24).toFixed(2);
    recalculate();
  },
  utilization_hr: () => {
    const hr = ASSUMPTIONS.operation.default_hours_per_day.toFixed(2);
    document.getElementById('utilization_hr').value = hr;
    document.getElementById('utilization_pct').value = (hr / 24 * 100).toFixed(2);
    recalculate();
  },
  module_decay: () => setVal('module_decay', (ASSUMPTIONS.operation.module_decay_per_year * 100).toFixed(2)),
  opex_annual: () => {
    const cap = num('capacity_kw');
    if (cap <= 0) { alert('먼저 발전용량을 입력하세요'); return; }
    setVal('opex_annual', (cap / 100 * ASSUMPTIONS.operation.opex_default_m_krw_per_100kw).toFixed(2));
  },
  fee_amount: () => {
    const capex = num('capex_total');
    if (capex <= 0) { alert('먼저 총 투자비를 입력하세요'); return; }
    setVal('fee_amount', (capex * 0.10).toFixed(1));
  },
  inflation: () => setVal('inflation', (ASSUMPTIONS.financial.inflation * 100).toFixed(1)),
  wacc: () => setVal('wacc', (ASSUMPTIONS.financial.wacc * 100).toFixed(1))
};

// 전체 기본값 한 번에 채우기
function fillAllDefaults() {
  const A = ASSUMPTIONS;
  document.getElementById('capacity_kw').value = 100;
  document.getElementById('capex_total').value = 230;
  document.getElementById('loan_amount').value = 160;
  document.getElementById('interest_rate').value = (A.loan.default_interest_rate * 100).toFixed(1);
  document.getElementById('grace_years').value = A.loan.default_grace_years;
  document.getElementById('repay_years').value = A.loan.default_repay_years;
  document.getElementById('smp_price').value = A.smp.annual_avg_krw_per_kwh.toFixed(2);
  document.getElementById('rec_price').value = A.rec.spot_avg_krw;
  document.getElementById('rec_weight').value = 1.2;
  document.getElementById('utilization_pct').value = (A.operation.default_utilization * 100).toFixed(2);
  document.getElementById('utilization_hr').value = A.operation.default_hours_per_day.toFixed(2);
  document.getElementById('module_decay').value = (A.operation.module_decay_per_year * 100).toFixed(2);
  document.getElementById('opex_annual').value = A.operation.opex_default_m_krw_per_100kw;
  document.getElementById('rent').value = 0;
  document.getElementById('fee_amount').value = 23;
  document.getElementById('inflation').value = (A.financial.inflation * 100).toFixed(1);
  document.getElementById('wacc').value = (A.financial.wacc * 100).toFixed(1);
  console.log('[Renewables] 전체 기본값 입력 완료');
  recalculate();
}

// ========== 이용률 ↔ 시간 연동 ==========

function syncUtil(source) {
  if (isUpdatingUtil) return;
  isUpdatingUtil = true;
  try {
    if (source === 'pct') {
      const pct = num('utilization_pct');
      document.getElementById('utilization_hr').value = (pct / 100 * 24).toFixed(2);
    } else if (source === 'hr') {
      const hr = num('utilization_hr');
      document.getElementById('utilization_pct').value = (hr / 24 * 100).toFixed(2);
    }
  } finally {
    isUpdatingUtil = false;
  }
}

// ========== 사업자 유형 UI ==========

function updateTaxUI() {
  const sel = document.querySelector('[name="biz_type"]:checked');
  if (!sel) return;
  const type = sel.value;
  const corpBox = document.getElementById('tax_corp_box');
  const personalBox = document.getElementById('tax_personal_box');
  if (corpBox) corpBox.style.display = type === 'corporate' ? 'block' : 'none';
  if (personalBox) personalBox.style.display = type === 'personal' ? 'block' : 'none';
}

function checkLargeProject() {
  const cap = num('capacity_kw');
  const el = document.getElementById('large_project_warning');
  if (el) el.style.display = cap >= 1000 ? 'block' : 'none';
}

// ========== 입력값 수집 ==========

function getInputs() {
  const smp = num('smp_price');
  const rec = num('rec_price');
  const weight = num('rec_weight');
  const salesPrice = smp + (rec * weight / 1000);
  const bizSel = document.querySelector('[name="biz_type"]:checked');
  const infSel = document.getElementById('inflation_to_sales');

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
    inflation_to_sales: infSel ? infSel.checked : false,
    wacc: num('wacc') / 100,
    biz_type: bizSel ? bizSel.value : 'corporate'
  };
}

// ========== 세금 ==========

function getSimpleExpenseRate(revenue_won) {
  const bands = ASSUMPTIONS.financial.personal_simple_rate_bands;
  for (const b of bands) {
    if (revenue_won < b.max_revenue) return { rate: b.rate, desc: b.desc };
  }
  return {
    rate: 1 - ASSUMPTIONS.financial.personal_standard_expense_rate,
    desc: '3.85억 초과 (복식부기)',
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

    let tax_won = 0, tax_desc = '';
    if (inp.biz_type === 'corporate') {
      tax_won = Math.max(0, ebt * 1_000_000 * ASSUMPTIONS.financial.corporate_tax_rate);
      tax_desc = '법인세 11%';
    } else {
      const expenseInfo = getSimpleExpenseRate(revenue_won);
      if (expenseInfo.is_bookkeeping) {
        tax_won = calcIncomeTax(ebt * 1_000_000);
        tax_desc = '복식부기';
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
  try {
    const smp = num('smp_price'), rec = num('rec_price'), w = num('rec_weight');
    const sp = smp + (rec * w / 1000);
    const dispEl = document.getElementById('sales_price_display');
    if (dispEl) dispEl.textContent = sp > 0 ? sp.toFixed(2) + '원/kWh' : '-- 원/kWh';

    const inp = getInputs();

    if (inp.capacity_kw <= 0 || inp.capex_total <= 0 || inp.sales_price <= 0) {
      setEmpty();
      return;
    }

    const r = calculate(inp);
    currentResult = r;

    setText('r_project_irr', r.project_irr !== null ? (r.project_irr * 100).toFixed(2) + '%' : 'N/A');
    setText('r_equity_irr', r.equity_irr !== null ? (r.equity_irr * 100).toFixed(2) + '%' : 'N/A');
    setText('r_npv', r.npv.toFixed(1) + ' 백만원');
    setText('r_payback', r.payback !== null ? r.payback.toFixed(1) + '년' : '회수 불가');
    setText('r_equity', r.equity.toFixed(1) + ' 백만원');
    setText('r_equity_with_fee', r.equity_with_fee.toFixed(1) + ' 백만원');
    setText('r_total_capex', r.total_capex.toFixed(1) + ' 백만원');
    setText('r_fee', r.fee_amount.toFixed(1) + ' 백만원');
    setText('r_total_need', r.total_cash_need.toFixed(1) + ' 백만원');
    setText('r_year1_tax', (r.year1_tax * 100).toFixed(0) + '만원');
    setText('r_year2_tax', (r.year2_tax * 100).toFixed(0) + '만원');
    setText('r_avg_tax', (r.avg_annual_tax * 100).toFixed(0) + '만원');
    setText('r_total_tax', r.total_tax_20y.toFixed(1) + ' 백만원');
    setText('r_tax_desc', r.yearly[0].tax_desc);

    updateChart(r);
    updateTable(r);
  } catch (err) {
    console.error('[Renewables] 계산 오류:', err);
  }
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function setEmpty() {
  ['r_project_irr','r_equity_irr','r_npv','r_payback','r_equity','r_equity_with_fee',
   'r_total_capex','r_fee','r_total_need','r_year1_tax','r_year2_tax','r_avg_tax','r_total_tax','r_tax_desc'
  ].forEach(id => setText(id, '--'));
  const tbody = document.getElementById('yearlyTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:20px">필수 값(용량·투자비·판매가)을 입력하면 결과가 나타납니다</td></tr>';
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
}

let chartInstance = null;
function updateChart(r) {
  const ctx = document.getElementById('cashflowChart');
  if (!ctx || typeof Chart === 'undefined') return;
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

// ========== 초기화 (DOMContentLoaded 즉시 실행) ==========

function initialize() {
  console.log('[Renewables] 계산기 초기화 시작');

  // 🎯 모든 input 변경 → 실시간 재계산
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', (e) => {
      try {
        if (e.target.id === 'utilization_pct') syncUtil('pct');
        if (e.target.id === 'utilization_hr') syncUtil('hr');
        if (e.target.id === 'capacity_kw') checkLargeProject();
        recalculate();
      } catch (err) { console.error('input handler error:', err); }
    });
    el.addEventListener('change', () => { try { recalculate(); } catch(e){} });
  });

  // 🎯 프리셋 버튼들
  const presetButtons = document.querySelectorAll('[data-preset]');
  console.log(`[Renewables] 프리셋 버튼 ${presetButtons.length}개 발견`);
  presetButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-preset');
      console.log('[Renewables] 프리셋 클릭:', key);
      if (PRESETS[key]) {
        PRESETS[key]();
      } else {
        console.warn('[Renewables] 알 수 없는 프리셋:', key);
      }
    });
  });

  // 🎯 전체 채우기 버튼
  const fillBtn = document.getElementById('btn_fill_all');
  if (fillBtn) {
    fillBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[Renewables] 전체 기본값 버튼 클릭');
      fillAllDefaults();
    });
  } else {
    console.warn('[Renewables] btn_fill_all 버튼 못 찾음');
  }

  // 🎯 계산하기 버튼
  const calcBtn = document.getElementById('btn_calculate');
  if (calcBtn) {
    calcBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[Renewables] 계산하기 버튼 클릭');
      recalculate();
      // 결과 영역으로 스크롤
      const resultEl = document.querySelector('.result-sticky');
      if (resultEl) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // 🎯 사업자 유형 라디오
  document.querySelectorAll('[name="biz_type"]').forEach(r => {
    r.addEventListener('change', () => {
      updateTaxUI();
      recalculate();
    });
  });

  // 🎯 PDF/인쇄
  const pdfBtn = document.getElementById('btn_pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[Renewables] PDF 버튼 클릭');
      window.print();
    });
  }

  // 🎯 사업자 UI 초기 상태
  updateTaxUI();

  // 🎯 JSON 로드 시도 (실패해도 fallback 사용)
  fetch('/data/assumption.json?t=' + Date.now())
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      ASSUMPTIONS = data;
      console.log('[Renewables] assumption.json 로드 성공');
    })
    .catch(err => {
      console.warn('[Renewables] assumption.json 로드 실패, fallback 사용:', err.message);
    });

  console.log('[Renewables] 초기화 완료 ✅');
}

// DOMContentLoaded 또는 이미 로드됨
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
