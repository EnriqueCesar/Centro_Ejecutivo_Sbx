const MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const KPI_META={conexion:{title:'RESUMEN CONEXIÓN | CONEXIÓN CON EL CLIENTE',short:'Conexión',goal:'Conexión',unit:'%',kind:'percent'},bebida:{title:'RESUMEN BEBIDA | CALIDAD DE BEBIDAS',short:'Bebida',goal:'Bebida',unit:'%',kind:'percent'},tplh:{title:'RESUMEN PRODUCTIVIDAD | TPLH',short:'TPLH',goal:'TPLH',unit:'',kind:'number'},segundas:{title:'RESUMEN SEGUNDAS VENTAS |',short:'Segundas Cx',goal:'Segundas Cx',unit:'',kind:'number'},adt:{title:'RESUMEN ADTS | TIENDAS COMPARABLES',short:'ADT',goal:'ADT',unit:'',kind:'number'}};
let DB,state={kpi:'segundas',month:'Jun',region:'Nacional'};
const $=s=>document.querySelector(s);
const fmt=(v,k)=>v==null||Number.isNaN(v)?'--':(k==='percent'?(v*100).toFixed(1)+'%':Math.round(v*10)/10);
const diffFmt=(v,k)=>v==null||Number.isNaN(v)?'--':((v>0?'+':'')+(k==='percent'?(v*100).toFixed(1)+' pp':(Math.round(v*10)/10)));
function storeMap(){return new Map(DB.stores.map(s=>[String(s.ceco),s]));}
function objective(kpi,month){const meta=KPI_META[kpi];return DB.objectives?.[month]?.[meta.goal] ?? null;}
function valuesFor(kpi,year='2026',month='YTD',region='Nacional'){
 const kp=DB.kpis[kpi], sm=storeMap(), out=[];
 Object.entries(kp.records||{}).forEach(([ceco,years])=>{const y=years[year]; if(!y) return; const val=y[month]; if(val==null || val==='') return; const s=sm.get(String(ceco))||{}; if(region!=='Nacional' && s.region!==region) return; out.push({ceco,tienda:s.tienda||ceco,region:s.region||'Sin Región',value:Number(val),aa:years['2025']?.[month]});});
 return out;
}
function avg(arr,field='value'){const vals=arr.map(x=>Number(x[field])).filter(Number.isFinite); return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;}
function regionAgg(kpi,month='YTD'){
 return DB.regions.map(r=>{const rows=valuesFor(kpi,'2026',month,r); const aaRows=valuesFor(kpi,'2025',month,r); const real=avg(rows); const aa=avg(aaRows); const meta=objective(kpi,state.month); return {region:r,real,meta,aa,difMeta:meta==null?null:real-meta,difAA:aa==null?null:real-aa,count:rows.length};}).filter(x=>x.real!=null).sort((a,b)=>b.real-a.real);
}
function score(real,meta,aa,kpi){ if(real==null) return 0; let s=60; if(meta!=null){const d=real-meta; s += d>=0?30:Math.max(-30,d*(KPI_META[kpi].kind==='percent'?900:25));} if(aa!=null){const d=real-aa; s += d>=0?10:Math.max(-10,d*(KPI_META[kpi].kind==='percent'?250:8));} return Math.max(0,Math.min(100,Math.round(s)));}
function statusClass(d,k){if(d==null) return 'amber'; const t=k==='percent'?0.005:0.5; return d>=0?'green':(d>=-t?'amber':'red');}
function renderControls(){
 $('#kpiTabs').innerHTML=Object.keys(DB.kpis).map(k=>`<button class="tab ${k===state.kpi?'active':''}" data-kpi="${k}">${KPI_META[k]?.short||DB.kpis[k].label||k}</button>`).join('');
 $('#kpiTabs').onclick=e=>{const b=e.target.closest('button'); if(!b)return; state.kpi=b.dataset.kpi; render();};
 $('#monthSelect').innerHTML=MONTHS.map(m=>`<option ${m===state.month?'selected':''}>${m}</option>`).join('');
 $('#regionSelect').innerHTML=['Nacional',...DB.regions].map(r=>`<option ${r===state.region?'selected':''}>${r}</option>`).join('');
 $('#monthSelect').onchange=e=>{state.month=e.target.value; render();};
 $('#regionSelect').onchange=e=>{state.region=e.target.value; render();};
}
function renderCards(real,meta,aa,dMeta,dAA,scoreVal){
 const k=KPI_META[state.kpi].kind;
 const cards=[['REAL YTD',fmt(real,k),'Resultado acumulado',''],['META YTD',fmt(meta,k),'Objetivo',''],['DIF vs META',diffFmt(dMeta,k),'Brecha',''+(dMeta>=0?'positive':dMeta<0?'negative':'warning')],['AA YTD',fmt(aa,k),'Año anterior',''],['DIF vs AA',diffFmt(dAA,k),'Comparativo',''+(dAA>=0?'positive':dAA<0?'negative':'warning')],['SEMAFORO',scoreVal>=80?'CUMPLE':scoreVal>=65?'CERCA':'RIESGO',scoreVal>=80?'Cumple / supera':scoreVal>=65?'Cerca de meta':'No cumple',scoreVal>=80?'positive':scoreVal>=65?'warning':'negative']];
 $('#kpiCards').innerHTML=cards.map(c=>`<article class="metric-card ${c[3]}"><header>${c[0]}</header><strong>${c[1]}</strong><em>${c[2]}</em></article>`).join('');
}
function renderRegionTable(regs,national){
 const k=KPI_META[state.kpi].kind;
 $('#regionTable').innerHTML=`<thead><tr><th>Región</th><th>Real</th><th>Meta</th><th>AA</th><th>Dif Meta</th><th>Dif AA</th><th>Semáforo</th></tr></thead><tbody>`+regs.map(r=>`<tr><td>${r.region}</td><td>${fmt(r.real,k)}</td><td>${fmt(r.meta,k)}</td><td>${fmt(r.aa,k)}</td><td>${diffFmt(r.difMeta,k)}</td><td>${diffFmt(r.difAA,k)}</td><td><i class="semaforo ${statusClass(r.difMeta,k)}"></i></td></tr>`).join('')+`<tr class="national"><td>NACIONAL</td><td>${fmt(national.real,k)}</td><td>${fmt(national.meta,k)}</td><td>${fmt(national.aa,k)}</td><td>${diffFmt(national.dMeta,k)}</td><td>${diffFmt(national.dAA,k)}</td><td><i class="semaforo ${statusClass(national.dMeta,k)}"></i></td></tr></tbody>`;
}
function renderRanks(){
 const k=KPI_META[state.kpi].kind; let rows=valuesFor(state.kpi,'2026','YTD',state.region).filter(x=>x.value!=null);
 const top=[...rows].sort((a,b)=>b.value-a.value).slice(0,10), bottom=[...rows].sort((a,b)=>a.value-b.value).slice(0,10);
 const row=x=>`<div class="rank-row"><b>${x.i}</b><div><div class="name">${x.tienda}</div><div class="meta">${x.ceco} · ${x.region}</div></div><div class="value">${fmt(x.value,k)}</div></div>`;
 $('#topList').innerHTML=top.map((x,i)=>row({...x,i:i+1})).join('');
 $('#bottomList').innerHTML=bottom.map((x,i)=>row({...x,i:i+1})).join('');
}
function renderTrend(){
 const k=KPI_META[state.kpi].kind; const vals=MONTHS.map(m=>({m, real:avg(valuesFor(state.kpi,'2026',m,state.region)), meta:objective(state.kpi,m)}));
 const max=Math.max(...vals.flatMap(v=>[v.real||0,v.meta||0]));
 $('#trendTitle').textContent=`TENDENCIA MENSUAL ${KPI_META[state.kpi].short.toUpperCase()}`;
 $('#trendChart').innerHTML=vals.map(v=>`<div class="bar-col"><div class="bar-wrap"><div title="Real ${fmt(v.real,k)}" class="bar" style="height:${max?Math.max(4,(v.real||0)/max*210):4}px"></div><div title="Meta ${fmt(v.meta,k)}" class="bar meta" style="height:${max?Math.max(4,(v.meta||0)/max*210):4}px"></div></div><div class="bar-label">${v.m}</div></div>`).join('');
}
function renderInsights(regs,national,scoreVal){
 const k=KPI_META[state.kpi].kind, best=regs[0], worst=regs[regs.length-1];
 const items=[['Desempeño nacional',`${KPI_META[state.kpi].short} alcanza ${fmt(national.real,k)} YTD, ${national.dMeta>=0?'por arriba':'por debajo'} de meta en ${diffFmt(national.dMeta,k)}.`],['Región líder',`${best?.region||'--'} lidera el desempeño con ${fmt(best?.real,k)}.`],['Mayor oportunidad',`${worst?.region||'--'} concentra la brecha más relevante con ${fmt(worst?.real,k)}.`],['Executive Score',`La lectura ejecutiva se ubica en ${scoreVal}/100: ${scoreVal>=80?'cumple / supera':scoreVal>=65?'cerca de meta':'requiere atención'}.`]];
 $('#insights').innerHTML=items.map((it,i)=>`<div class="insight"><div class="icon">${i+1}</div><div><h4>${it[0]}</h4><p>${it[1]}</p></div></div>`).join('');
 $('#recommendations').innerHTML=[['Prioridad regional',`Enfocar seguimiento en ${worst?.region||'la región con menor desempeño'}.`],['Replicar prácticas',`Documentar acciones de ${best?.region||'la región líder'} y escalar al resto.`],['Ritmo semanal','Revisar avance semanal contra meta y tiendas en bottom 10.'],['Drill Down','Usar filtro de región para profundizar por tienda y CeCo.']].map(r=>`<div class="rec"><b>${r[0]}</b><p>${r[1]}</p></div>`).join('');
}
function render(){
 renderControls(); const meta=KPI_META[state.kpi]; $('#viewTitle').textContent=meta.title; $('#periodPill').textContent=`YTD ${state.month.toUpperCase()} 2026`; $('#scopeLabel').textContent=`${state.region.toUpperCase()} · ${state.month.toUpperCase()}`;
 const real=avg(valuesFor(state.kpi,'2026','YTD',state.region)); const aa=avg(valuesFor(state.kpi,'2025','YTD',state.region)); const obj=objective(state.kpi,state.month); const dMeta=obj==null?null:real-obj; const dAA=aa==null?null:real-aa; const sc=score(real,obj,aa,state.kpi);
 $('#summaryHeadline').innerHTML=`${meta.short} alcanza <span>${fmt(real,meta.kind)}</span> YTD`;
 $('#summaryText').innerHTML=`${dMeta==null?'Sin objetivo disponible':(dMeta>=0?'Por arriba de la meta en ':'Por debajo de la meta en ')+diffFmt(dMeta,meta.kind)} y ${dAA==null?'sin comparativo AA':(dAA>=0?'por arriba del AA en ':'por debajo del AA en ')+diffFmt(dAA,meta.kind)}.`;
 renderCards(real,obj,aa,dMeta,dAA,sc); const regs=regionAgg(state.kpi,'YTD'); renderRegionTable(regs,{real,meta:obj,aa,dMeta,dAA}); renderRanks(); renderTrend(); renderInsights(regs,{real,meta:obj,aa,dMeta,dAA},sc); $('#regionCount').textContent=`${regs.length} regiones`; }
fetch('data/kpi-data.json').then(r=>r.json()).then(j=>{DB=j; render();}).catch(err=>{document.body.innerHTML='<pre>Error cargando data/kpi-data.json\n'+err+'</pre>';});
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
