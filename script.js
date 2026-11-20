const months = [
  ["Янв",2],["Фев",6],["Мар",10],["Апр",11],["Май",11],["Июн",12],
  ["Июл",13],["Авг",13],["Сен",9],["Окт",5],["Ноя",4],["Дек",2]
];

const roles = [
  {id:"rop",name:"РОП",count:1,salary:130000,kpi:{min:15000,avg:42500,max:70000}},
  {id:"group",name:"Руководитель группы",count:2,salary:100000,kpi:{min:5000,avg:35000,max:65000}},
  {id:"field",name:"Выездной менеджер",count:4,salary:65000,kpi:{min:0,avg:0,max:0}},
  {id:"engineer",name:"Инженер",count:2,salary:40000,kpi:{min:0,avg:10000,max:20000}},
  {id:"senior",name:"Старший лидоруб",count:1,salary:60000,kpi:{min:3000,avg:24000,max:45000}},
  {id:"lead",name:"Лидоруб",count:2,salary:50000,kpi:{min:13000,avg:22000,max:31000}}
];


const $ = id => document.getElementById(id);
const rub = value => new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB",maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
const compact = value => new Intl.NumberFormat("ru-RU",{notation:"compact",maximumFractionDigits:1}).format(value);
const plain = value => new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
const scenario = () => $("kpiScenario").value;
const selectedKpi = role => role.kpi[scenario()];
const sum = arr => arr.reduce((a,b)=>a+b,0);
const quarterEnd = [2,5,8,11];

function readInputs(){
  return {
    annual:Number($("annualRevenue").value),
    achievement:Number($("achievement").value)/100,
    averageCheck:Math.max(1,Number($("averageCheck").value)||1360000),
    measureConversion:Math.min(0.8,Math.max(0.05,Number($("measureConversion").value)/100||0.30)),
    travelDistance:Math.max(0,Number($("travelDistance").value)||0),
    fuelPrice:Math.max(0,Number($("fuelPrice").value)||0),
    ropMonthlyRate:Math.max(0,Number($("ropMonthlyRate").value)||0)/100,
    groupMonthlyRate:Math.max(0,Number($("groupMonthlyRate").value)||0)/100,
    fieldRate:Math.max(0,Number($("fieldRate").value)||0)/100,
    engineerRate:Math.max(0,Number($("engineerRate").value)||0)/100,
    leadQuarterRate:Math.max(0,Number($("leadQuarterRate").value)||0)/100,
    seniorQuarterRate:Math.max(0,Number($("seniorQuarterRate").value)||0)/100,
    fieldQuarterRate:Math.max(0,Number($("fieldQuarterRate").value)||0)/100,
    ropAnnualBonusBase:Math.max(0,Number($("ropAnnualBonus").value)||0)
  };
}

function calculate(){
  const p=readInputs();
  const revenueYear=p.annual*p.achievement;
  // Распределяем целое количество договоров по месяцам
  const shareTotal = sum(months.map(m => m[1]));
  const annualContracts = Math.round(revenueYear / p.averageCheck);

  const rawContracts = months.map(([name, share]) =>
    annualContracts * share / shareTotal
  );

  const contractAllocation = rawContracts.map(Math.floor);

  let remainder = annualContracts - sum(contractAllocation);

  const remainders = rawContracts
    .map((value, index) => ({
      index,
      remainder: value - Math.floor(value)
    }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < remainder; i++) {
    contractAllocation[remainders[i].index]++;
  }
  const salaryMonth=sum(roles.map(r=>r.count*r.salary));
  const kpiMonth=sum(roles.map(r=>r.count*selectedKpi(r)));
  const salaryYear=salaryMonth*12;
  const kpiYear=kpiMonth*12;
  const travelPerMeasure=p.travelDistance*0.09*p.fuelPrice+p.travelDistance*2.5;
  const displayShares = months.map(([,share]) => Number((share / shareTotal * 100).toFixed(2)));
  // Компенсируем округление в последнем месяце, чтобы отображаемые доли дали ровно 100,00%.
  displayShares[displayShares.length - 1] = Number((100 - sum(displayShares.slice(0, -1))).toFixed(2));
  const monthsData=months.map(([name,share],i)=>{
    const revenue = revenueYear * share / shareTotal;
    const plannedContracts = contractAllocation[i];
    const targetMeasures=Math.ceil(plannedContracts/p.measureConversion);
    const onsiteContracts=revenue;
    const monthlyCommission =
      (roles.find(r=>r.id==="rop").count ? revenue*p.ropMonthlyRate : 0) +
      (roles.find(r=>r.id==="group").count ? revenue*p.groupMonthlyRate : 0) +
      (roles.find(r=>r.id==="field").count ? revenue*p.fieldRate : 0) +
      (roles.find(r=>r.id==="engineer").count ? onsiteContracts*p.engineerRate : 0);
    // Сдельная оплата возникает только при наличии лидорубов в штате.
    const piecework=roles.find(r=>r.id==="lead").count ? targetMeasures*1000 : 0;
    // Компенсация поездок начисляется только при наличии выездных менеджеров.
    const travelCompensation=roles.find(r=>r.id==="field").count ? targetMeasures*travelPerMeasure : 0;
    return {index:i,name,share,sharePercent:displayShares[i],revenue,salary:salaryMonth,kpi:kpiMonth,monthlyCommission,piecework,travelCompensation,targetMeasures,quarterly:0,annualBonus:0};
  });
  quarterEnd.forEach(endIndex=>{
    const startIndex=endIndex-2;
    const quarterRevenue=sum(monthsData.slice(startIndex,endIndex+1).map(m=>m.revenue));
    const quarterlyBonus =
      roles.find(r=>r.id==="lead").count*quarterRevenue*p.leadQuarterRate +
      roles.find(r=>r.id==="senior").count*quarterRevenue*p.seniorQuarterRate +
      roles.find(r=>r.id==="field").count*quarterRevenue*p.fieldQuarterRate;
    monthsData[endIndex].quarterly=quarterlyBonus;
  });
  // Годовой бонус не должен попадать в ФОТ, если должность РОПа обнулена.
  monthsData[11].annualBonus = roles.find(r=>r.id==="rop").count
    ? Math.min(600000, p.ropAnnualBonusBase * p.achievement)
    : 0;
  monthsData.forEach(m=>{
    m.variable=m.monthlyCommission+m.piecework+m.travelCompensation+m.quarterly+m.annualBonus;
    m.fot=m.salary+m.kpi+m.variable;
    m.shareFot=m.revenue?m.fot/m.revenue:0;
  });
  const totalTravel=sum(monthsData.map(m=>m.travelCompensation));
  // Распределяем начисления по конкретным сотрудникам внутри каждой должности.
  const employeeRows=[];
  const modeledRevenue=sum(monthsData.map(m=>m.revenue));
  const roleMonthlyCommission = {
    rop: modeledRevenue*p.ropMonthlyRate,
    group: modeledRevenue*p.groupMonthlyRate,
    field: modeledRevenue*p.fieldRate,
    engineer: modeledRevenue*p.engineerRate
  };
  const quarterRevenueByEnd = quarterEnd.map(endIndex=>sum(monthsData.slice(endIndex-2,endIndex+1).map(m=>m.revenue)));
  const quarterlyByRole = {
    lead: quarterRevenueByEnd.reduce((a,v)=>a+v*p.leadQuarterRate,0),
    senior: quarterRevenueByEnd.reduce((a,v)=>a+v*p.seniorQuarterRate,0),
    field: quarterRevenueByEnd.reduce((a,v)=>a+v*p.fieldQuarterRate,0)
  };
  const annualBonusByRole = {rop:monthsData[11].annualBonus};
  roles.forEach(role=>{
    for(let n=1;n<=role.count;n++){
      const divisor=Math.max(1,role.count);
      const salary=role.salary*12;
      const kpi=selectedKpi(role)*12;
      const monthlyCommission=(roleMonthlyCommission[role.id]||0)/divisor;
      const piecework=role.id==="lead" ? sum(monthsData.map(m=>m.piecework))/divisor : 0;
      const travel=role.id==="field" ? totalTravel/divisor : 0;
      const quarterly=(quarterlyByRole[role.id]||0);
      const annualBonus=(annualBonusByRole[role.id]||0);
      const total=salary+kpi+monthlyCommission+piecework+travel+quarterly+annualBonus;
      employeeRows.push({name:`${role.name} ${n}`,total,salary,kpi,monthlyCommission,piecework,travel,quarterly,annualBonus});
    }
  });
  // Итоговый ФОТ строится по тем же персональным начислениям, что и таблица сотрудников.
  // Это гарантирует совпадение итогов при любом изменении численности.
  const employeeFotYear=sum(employeeRows.map(e=>e.total));
  const variableYear=sum(employeeRows.map(e=>e.monthlyCommission+e.piecework+e.travel+e.quarterly+e.annualBonus));
  const fotYear=employeeFotYear;
  const totalMeasures=sum(monthsData.map(m=>m.targetMeasures));
  return {p,revenueYear,salaryMonth,kpiMonth,salaryYear,kpiYear,variableYear,fotYear,monthsData,totalMeasures,totalTravel,travelPerMeasure,employeeRows};
}
function updateOutputs(){
  const d=calculate();
  $("annualRevenueOut").textContent=rub(d.p.annual);
  $("achievementOut").textContent=Math.round(d.p.achievement*100)+"%";
  $("averageCheckOut").textContent=rub(d.p.averageCheck);
  $("measureConversionOut").textContent=Math.round(d.p.measureConversion*100)+"%";
  $("travelPerMeasure").textContent=rub(d.travelPerMeasure);
  $("totalFot").textContent=rub(d.fotYear);
  $("revenueFact").textContent=rub(d.revenueYear);
  $("fotShare").textContent=(d.revenueYear?d.fotYear/d.revenueYear*100:0).toLocaleString("ru-RU",{maximumFractionDigits:2})+"%";
  $("salaryYear").textContent=rub(d.salaryYear);
  $("kpiYear").textContent=rub(d.kpiYear);
  $("variableYear").textContent=rub(d.variableYear);
  renderStaff();
  renderKpi();
  renderMonthly(d);
  renderEmployees(d);
  renderSeason(d);
  drawMonthlyChart(d);
  drawStructureChart(d);
}

function renderStaff(){
  const body=$("staffTable").querySelector("tbody");
  body.innerHTML="";
  roles.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><span class="role-name">${r.name}</span></td>
      <td><input class="count-input" type="number" min="0" max="100" step="1" value="${r.count}" aria-label="Численность: ${r.name}" data-role="${r.id}" data-field="count"></td>
      <td><input type="number" min="0" step="1000" value="${r.salary}" aria-label="Оклад: ${r.name}" data-role="${r.id}" data-field="salary"></td>
      <td>${plain(r.count*r.salary*12)}</td>`;
    body.appendChild(tr);
  });
  $("staffTotalCount").textContent=sum(roles.map(r=>r.count));
  $("staffTotalSalary").textContent=rub(sum(roles.map(r=>r.count*r.salary*12)));
}

function renderKpi(){
  const body=$("kpiTable").querySelector("tbody");
  body.innerHTML="";
  const activeScenario=scenario();
  $("kpiTable").querySelectorAll("[data-scenario]").forEach(el=>el.classList.toggle("scenario-selected",el.dataset.scenario===activeScenario));
  roles.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><span class="role-name">${r.name}</span></td>
      <td class="${activeScenario==="min"?"scenario-selected":""}">${plain(r.kpi.min)}</td>
      <td class="${activeScenario==="avg"?"scenario-selected":""}">${plain(r.kpi.avg)}</td>
      <td class="${activeScenario==="max"?"scenario-selected":""}">${plain(r.kpi.max)}</td>
      <td><strong>${plain(selectedKpi(r))}</strong></td>`;
    body.appendChild(tr);
  });
}

function renderMonthly(d){
  const body=$("monthlyBody");
  body.innerHTML="";
  d.monthsData.forEach(m=>{
    const quarterlyAnnual=m.quarterly+m.annualBonus;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${m.name}</strong></td>
      <td>${m.sharePercent.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}%</td>
      <td>${plain(m.revenue)}</td>
      <td>${plain(m.salary)}</td>
      <td>${plain(m.kpi)}</td>
      <td>${plain(m.monthlyCommission)}</td>
      <td>${m.targetMeasures.toLocaleString("ru-RU")}</td>
      <td>${plain(m.piecework)}</td>
      <td>${plain(m.travelCompensation)}</td>
      <td>${plain(quarterlyAnnual)}</td>
      <td><strong>${plain(m.fot)}</strong></td>
      <td>${(m.shareFot*100).toLocaleString("ru-RU",{maximumFractionDigits:2})}%</td>`;
    body.appendChild(tr);
  });
  $("monthlyFoot").innerHTML=`<tr>
    <td>Итого</td><td>100%</td><td>${plain(d.revenueYear)}</td>
    <td>${plain(d.salaryYear)}</td><td>${plain(d.kpiYear)}</td>
    <td>${plain(sum(d.monthsData.map(m=>m.monthlyCommission)))}</td>
    <td>${d.totalMeasures.toLocaleString("ru-RU")}</td>
    <td>${plain(sum(d.monthsData.map(m=>m.piecework)))}</td>
    <td>${plain(d.totalTravel)}</td>
    <td>${plain(sum(d.monthsData.map(m=>m.quarterly+m.annualBonus)))}</td>
    <td>${plain(d.fotYear)}</td>
    <td>${(d.revenueYear?d.fotYear/d.revenueYear*100:0).toLocaleString("ru-RU",{maximumFractionDigits:2})}%</td>
  </tr>`;
}

function renderEmployees(d){
  const body=$("employeeFotBody");
  if(!body)return;
  body.innerHTML="";
  d.employeeRows.forEach(e=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${e.name}</strong></td>
      <td><strong>${plain(e.total)}</strong></td>
      <td>${(d.fotYear?e.total/d.fotYear*100:0).toLocaleString("ru-RU",{maximumFractionDigits:2})}%</td>
      <td>${plain(e.total / 12)}</td>
      <td>${plain(e.salary)}</td><td>${plain(e.kpi)}</td>
      <td>${plain(e.monthlyCommission)}</td><td>${plain(e.piecework)}</td>
      <td>${plain(e.travel)}</td><td>${plain(e.quarterly)}</td><td>${plain(e.annualBonus)}</td>`;
    body.appendChild(tr);
  });
  const keys=["total","salary","kpi","monthlyCommission","piecework","travel","quarterly","annualBonus"];
  const values=Object.fromEntries(keys.map(k=>[k,sum(d.employeeRows.map(e=>e[k]))]));
  $("employeeFotFoot").innerHTML=`<tr><td>Итого</td><td>${plain(values.total)}</td><td>100%</td>
  <td>${plain(values.total / 12)}</td>
    <td>${plain(values.salary)}</td><td>${plain(values.kpi)}</td><td>${plain(values.monthlyCommission)}</td>
    <td>${plain(values.piecework)}</td><td>${plain(values.travel)}</td><td>${plain(values.quarterly)}</td><td>${plain(values.annualBonus)}</td></tr>`;
}

function renderSeason(d){
  $("seasonBars").innerHTML=d.monthsData.map(m=>{
    const tip=`Выручка: ${plain(m.revenue)} руб.\\nФОТ: ${plain(m.fot)} руб.\\nФОТ / выручка: ${(m.shareFot*100).toLocaleString("ru-RU",{maximumFractionDigits:2})}%`;
    return `<div class="season-col" tabindex="0" data-tooltip="${tip.replace(/"/g,"&quot;")}" aria-label="${m.name}. ${tip.replace(/\\n/g,", ")}">
      <div class="season-track"><div class="season-fill" style="height:${m.share/Math.max(...months.map(month=>month[1]))*100}%"></div></div><b>${m.name}</b><span>${m.sharePercent.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}%</span>
      <div class="season-tooltip">${tip.replace(/\\n/g,"<br>")}</div></div>`;
  }).join("");
}

const chartHits={monthly:[],structure:[]};

function showChartTooltip(id,html,event,canvas){
  const tip=$(id),wrap=canvas.parentElement,rect=wrap.getBoundingClientRect();
  tip.innerHTML=html;
  tip.style.left=Math.max(8,Math.min(event.clientX-rect.left+12,rect.width-220))+"px";
  tip.style.top=Math.max(8,Math.min(event.clientY-rect.top+12,rect.height-86))+"px";
  tip.classList.add("visible");
}
function hideChartTooltip(id){$(id).classList.remove("visible");}

function canvasContext(id, chartHeight = 230) {
  const canvas = $(id);
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 500;
  const height = chartHeight;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  return { ctx, width, height };
}

function drawMonthlyChart(d){
  const {ctx,width,height}=canvasContext("monthlyChart");
  const values=d.monthsData.map(m=>m.fot), max=Math.max(...values,1), left=48,right=12,top=15,bottom=34;
  ctx.clearRect(0,0,width,height);ctx.font="11px Manrope, sans-serif";ctx.fillStyle="#8b96a8";ctx.strokeStyle="#edf0f5";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=top+(height-top-bottom)*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillText(compact(max*(1-i/4)),5,y+3);}
  const slot=(width-left-right)/values.length, bar=slot*.58;
  chartHits.monthly=[];
  values.forEach((v,i)=>{
    const h=(height-top-bottom)*v/max,x=left+i*slot+(slot-bar)/2,y=height-bottom-h;
    ctx.fillStyle="#8298ed";ctx.beginPath();ctx.roundRect(x,y,bar,h,5);ctx.fill();
    ctx.fillStyle="#7e899b";ctx.textAlign="center";ctx.fillText(months[i][0],x+bar/2,height-12);
    chartHits.monthly.push({x,y,w:bar,h,data:d.monthsData[i]});
  });
}


function drawStructureChart(d) {
  const { ctx, width, height } = canvasContext("structureChart", 270);

  ctx.clearRect(0, 0, width, height);

  const salary = d.salaryYear;
  const kpi = d.kpiYear;
  const variable = d.variableYear;
  const total = salary + kpi + variable;

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(68, height * 0.27);
  const inner = r * 0.62;

  const parts = [
    { name: "Оклады", v: salary, c: "#8298ed" },
    { name: "KPI", v: kpi, c: "#56b69a" },
    { name: "Переменная часть", v: variable, c: "#e9b45d" }
  ];

  let angle = -Math.PI / 2;
  chartHits.structure = [];

  // Рисуем сектора диаграммы
  parts.forEach(p => {
    const share = total ? p.v / total : 0;
    const start = angle;
    const end = angle + share * Math.PI * 2;
    const mid = (start + end) / 2;
    const pct = share * 100;

    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.arc(cx, cy, inner, end, start, true);
    ctx.closePath();

    ctx.fillStyle = p.c;
    ctx.fill();

    // Подписи процентов снаружи диаграммы
    if (pct >= 1) {
      const lineStart = r + 3;
      const lineEnd = r + 19;
      const textR = r + 25;

      const x1 = cx + Math.cos(mid) * lineStart;
      const y1 = cy + Math.sin(mid) * lineStart;
      const x2 = cx + Math.cos(mid) * lineEnd;
      const y2 = cy + Math.sin(mid) * lineEnd;
      const tx = cx + Math.cos(mid) * textR;
      const ty = cy + Math.sin(mid) * textR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = p.c;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#354052";
      ctx.font = "800 11px Manrope, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = Math.cos(mid) >= 0 ? "left" : "right";

      ctx.fillText(
        `${pct.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`,
        tx,
        ty
      );
    }

    chartHits.structure.push({
      start,
      end,
      cx,
      cy,
      r,
      inner,
      data: p,
      pct
    });

    angle = end;
  });

  // Центральная сумма
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#182230";
  ctx.font = "800 16px Manrope, sans-serif";
  ctx.fillText(compact(total), cx, cy + 2);

  ctx.fillStyle = "#8b96a8";
  ctx.font = "10px Manrope, sans-serif";
  ctx.fillText("ФОТ за год", cx, cy + 18);

  // Легенда с индивидуальными цветами
  $("structureLegend").innerHTML = parts.map(p => `
    <span>
      <i style="background-color:${p.c}"></i>
      ${p.name}
    </span>
  `).join("");
}


function attachChartInteractions(){
  const monthly=$("monthlyChart");
  monthly.addEventListener("mousemove",event=>{
    const rect=monthly.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    const hit=chartHits.monthly.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
    if(!hit){hideChartTooltip("monthlyTooltip");return;}
    const m=hit.data;
    showChartTooltip("monthlyTooltip",`<strong>${m.name}</strong><span>ФОТ: ${plain(m.fot)} руб.</span><span>ФОТ / выручка: ${(m.shareFot*100).toLocaleString("ru-RU",{maximumFractionDigits:2})}%</span>`,event,monthly);
  });
  monthly.addEventListener("mouseleave",()=>hideChartTooltip("monthlyTooltip"));

  const structure=$("structureChart");
  structure.addEventListener("mousemove",event=>{
    const rect=structure.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    const hit=chartHits.structure.find(p=>{
      const dx=x-p.cx,dy=y-p.cy,dist=Math.hypot(dx,dy);
      if(dist<p.inner||dist>p.r)return false;
      let a=Math.atan2(dy,dx);if(a<-Math.PI/2)a+=Math.PI*2;
      let s=p.start;if(s<-Math.PI/2)s+=Math.PI*2;
      let e=p.end;if(e<-Math.PI/2)e+=Math.PI*2;
      return a>=s&&a<=e;
    });
    if(!hit){hideChartTooltip("structureTooltip");return;}
    showChartTooltip("structureTooltip",`<strong>${hit.data.name}</strong><span>${plain(hit.data.v)} руб.</span><span>${hit.pct.toLocaleString("ru-RU",{maximumFractionDigits:1})}% годового ФОТ</span>`,event,structure);
  });
  structure.addEventListener("mouseleave",()=>hideChartTooltip("structureTooltip"));
}


function exportToExcel() {
  if (typeof XLSX === "undefined") {
    alert("Не удалось загрузить библиотеку Excel. Проверь подключение к интернету и обнови страницу.");
    return;
  }

  const d = calculate();
  const wb = XLSX.utils.book_new();

  // --------------------------------------------------
  // ЛИСТ 1. СЦЕНАРИЙ КОМПАНИИ
  // --------------------------------------------------

  const scenarioNames = {
    min: "Минимальный",
    avg: "Средний (условный)",
    max: "Максимальный"
  };

  const scenarioData = [
    ["СЦЕНАРИЙ КОМПАНИИ — ФОТ 2027"],
    [],
    ["Параметр", "Выбранное значение"],
    ["Годовой план выручки, руб.", d.p.annual],
    ["Выполнение плана, %", d.p.achievement * 100],
    ["Средний чек, руб.", d.p.averageCheck],
    ["Конверсия замер → договор, %", d.p.measureConversion * 100],
    ["Сценарий KPI", scenarioNames[scenario()]],
    ["Расстояние на один замер, км", d.p.travelDistance],
    ["Стоимость бензина, руб./л", d.p.fuelPrice],
    ["Компенсация за один замер, руб.", d.travelPerMeasure],
    [],
    ["ПАРАМЕТРЫ МОТИВАЦИИ"],
    ["Показатель", "Ставка"],
    ["РОП — ежемесячная комиссия, %", d.p.ropMonthlyRate * 100],
    ["Руководитель группы — комиссия, %", d.p.groupMonthlyRate * 100],
    ["Выездной менеджер — от выручки, %", d.p.fieldRate * 100],
    ["Инженер — от выручки, %", d.p.engineerRate * 100],
    ["Лидоруб — квартальная премия, %", d.p.leadQuarterRate * 100],
    ["Старший лидоруб — квартальная премия, %", d.p.seniorQuarterRate * 100],
    ["Выездной менеджер — квартальная премия, %", d.p.fieldQuarterRate * 100],
    ["Бонус РОП при 100% выполнения, руб.", d.p.ropAnnualBonusBase],
    [],
    ["ШТАТ И ОКЛАДЫ"],
    ["Должность", "Количество сотрудников", "Оклад в месяц, руб.", "Оклад за год, руб."]
  ];

  roles.forEach(role => {
    scenarioData.push([
      role.name,
      role.count,
      role.salary,
      role.count * role.salary * 12
    ]);
  });

  scenarioData.push(
    [],
    ["ИТОГОВЫЕ ПОКАЗАТЕЛИ СЦЕНАРИЯ"],
    ["Показатель", "Значение"],
    ["Расчётная выручка за год, руб.", d.revenueYear],
    ["ФОТ за год, руб.", d.fotYear],
    ["ФОТ / выручка, %", d.revenueYear ? d.fotYear / d.revenueYear * 100 : 0],
    ["Оклады за год, руб.", d.salaryYear],
    ["KPI за год, руб.", d.kpiYear],
    ["Переменная часть за год, руб.", d.variableYear],
    ["Количество целевых замеров за год, шт.", d.totalMeasures]
  );

  const scenarioSheet = XLSX.utils.aoa_to_sheet(scenarioData);
  scenarioSheet["!cols"] = [
    { wch: 48 },
    { wch: 24 },
    { wch: 22 },
    { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(wb, scenarioSheet, "Сценарий компании");


  // --------------------------------------------------
  // ЛИСТ 2. ПОМЕСЯЧНЫЙ РАСЧЁТ
  // --------------------------------------------------

  const monthlyData = [
    [
      "Месяц",
      "Доля выручки, %",
      "Выручка, руб.",
      "Оклады, руб.",
      "KPI, руб.",
      "Ежемесячные комиссии, руб.",
      "Целевые замеры, шт.",
      "KPI за замеры, руб.",
      "Компенсация выездным, руб.",
      "Квартальные / годовые выплаты, руб.",
      "Итого ФОТ, руб.",
      "ФОТ / выручка, %"
    ]
  ];

  d.monthsData.forEach(m => {
    monthlyData.push([
      m.name,
      m.sharePercent,
      m.revenue,
      m.salary,
      m.kpi,
      m.monthlyCommission,
      m.targetMeasures,
      m.piecework,
      m.travelCompensation,
      m.quarterly + m.annualBonus,
      m.fot,
      m.shareFot * 100
    ]);
  });

  monthlyData.push([
    "Итого",
    100,
    d.revenueYear,
    d.salaryYear,
    d.kpiYear,
    sum(d.monthsData.map(m => m.monthlyCommission)),
    d.totalMeasures,
    sum(d.monthsData.map(m => m.piecework)),
    d.totalTravel,
    sum(d.monthsData.map(m => m.quarterly + m.annualBonus)),
    d.fotYear,
    d.revenueYear ? d.fotYear / d.revenueYear * 100 : 0
  ]);

  const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData);
  monthlySheet["!cols"] = [
    { wch: 12 }, { wch: 16 }, { wch: 19 }, { wch: 17 },
    { wch: 15 }, { wch: 24 }, { wch: 19 }, { wch: 19 },
    { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, monthlySheet, "Помесячный расчёт");


  // --------------------------------------------------
  // ЛИСТ 3. ФОТ ПО СОТРУДНИКАМ
  // --------------------------------------------------

  const employeeData = [
    [
      "Сотрудник",
      "Общий ФОТ, руб.",
      "Доля от общего ФОТ, %",
      "Средний ФОТ в месяц, руб.",
      "Оклад, руб.",
      "KPI, руб.",
      "Ежемесячные комиссии, руб.",
      "KPI за замер, руб.",
      "Компенсация выездным, руб.",
      "Квартальные выплаты, руб.",
      "Годовой бонус, руб."
    ]
  ];

  d.employeeRows.forEach(e => {
    employeeData.push([
      e.name,
      e.total,
      d.fotYear ? e.total / d.fotYear * 100 : 0,
      e.total / 12,
      e.salary,
      e.kpi,
      e.monthlyCommission,
      e.piecework,
      e.travel,
      e.quarterly,
      e.annualBonus
    ]);
  });

  const employeeKeys = [
    "total",
    "salary",
    "kpi",
    "monthlyCommission",
    "piecework",
    "travel",
    "quarterly",
    "annualBonus"
  ];

  const employeeTotals = Object.fromEntries(
    employeeKeys.map(key => [
      key,
      sum(d.employeeRows.map(e => e[key]))
    ])
  );

  employeeData.push([
    "Итого",
    employeeTotals.total,
    100,
    employeeTotals.total / 12,
    employeeTotals.salary,
    employeeTotals.kpi,
    employeeTotals.monthlyCommission,
    employeeTotals.piecework,
    employeeTotals.travel,
    employeeTotals.quarterly,
    employeeTotals.annualBonus
  ]);

  const employeeSheet = XLSX.utils.aoa_to_sheet(employeeData);
  employeeSheet["!cols"] = [
    { wch: 28 }, { wch: 20 }, { wch: 23 }, { wch: 22 }, { wch: 18 },
    { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 27 },
    { wch: 23 }, { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(wb, employeeSheet, "ФОТ по сотрудникам");


  // --------------------------------------------------
  // СОХРАНЕНИЕ ФАЙЛА
  // --------------------------------------------------

  const fileName = "ФОТ_2027_" +
    new Date().toLocaleDateString("ru-RU").replace(/\./g, "-") +
    ".xlsx";

  XLSX.writeFile(wb, fileName);
}


function attachEvents(){
  attachChartInteractions();
  $("exportExcelBtn").addEventListener("click", exportToExcel);
  ["annualRevenue","achievement","averageCheck","measureConversion","kpiScenario","ropMonthlyRate","groupMonthlyRate","fieldRate","engineerRate","leadQuarterRate","seniorQuarterRate","fieldQuarterRate","ropAnnualBonus","travelDistance","fuelPrice"].forEach(id=>$(id).addEventListener("input",updateOutputs));
  $("staffTable").addEventListener("change",e=>{
    const el=e.target;if(!el.matches("input[data-role]"))return;
    const role=roles.find(r=>r.id===el.dataset.role);if(!role)return;
    role[el.dataset.field]=Math.max(0,Number(el.value)||0);
    updateOutputs();
  });

  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===btn));
    document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+btn.dataset.tab));
    if(btn.dataset.tab==="overview"){const d=calculate();drawMonthlyChart(d);drawStructureChart(d);}
  }));
  window.addEventListener("resize",()=>{const d=calculate();drawMonthlyChart(d);drawStructureChart(d);});
}
attachEvents();
updateOutputs();
