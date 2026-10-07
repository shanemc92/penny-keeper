/* ---------------------------------------------------------------
   Penny Keeper - Irish household finance in a single HTML file
   All data stays in this browser (localStorage). No network calls.
----------------------------------------------------------------*/
"use strict";

const $ = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const uid = ()=> Math.random().toString(36).slice(2,9);
const clamp = (n,a,b)=> Math.min(b,Math.max(a,n));
const num = v => { const n = parseFloat(String(v??'').replace(/[^0-9.\-]/g,'')); return isFinite(n)?n:0; };
const round2 = n => Math.round((n+Number.EPSILON)*100)/100;
/* "left empty" has to stay distinguishable from "entered as zero" on the mortgage
   statement fields, where blank means "work it out" and 0 means "the lender charged 0". */
const blankish = v => v===''||v===null||v===undefined;

const FREQ = {Weekly:52, Fortnightly:26, Monthly:12, Quarterly:4, Annual:1};

let CUR = '€';
const fmt = (n,d)=>{
  if(!isFinite(n)) n=0;
  const s = Math.abs(n).toLocaleString('en-IE',{minimumFractionDigits:d??2,maximumFractionDigits:d??2});
  return (n<0 && Number(s.replace(/[^0-9.]/g,''))!==0 ? '-' : '')+CUR+s;
};
const fmt0 = n => fmt(n,0);
const pct = n => (isFinite(n)?n:0).toLocaleString('en-IE',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
/* Mortgage rates are quoted to two places and the second one matters: 3.65% rounded
   to 3.7% is a different product, and a different repayment. */
const ratePct = n => (isFinite(n)?n:0).toLocaleString('en-IE',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
/* Dates are handled entirely in local time: a bare "2026-03-01" parses to local
   midnight and iso() reads the local components back. Mixing the two - parsing as UTC
   the way `new Date('2026-03-01')` does, then formatting with toISOString() - shifted
   every date addMonths() pushed across the GMT/IST boundary back by a day, so a loan
   starting on the 15th produced payments on the 15th in winter and the 14th in summer,
   and the day count either side of the change was wrong with it. */
const iso = d => {
  const x = (d instanceof Date)?d:new Date(d);
  if(isNaN(x)) return '';
  const p = n => String(n).padStart(2,'0');
  return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());
};
const parseDate = s => {
  if(s instanceof Date) return isNaN(s)?null:s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s??'').trim());
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);      // local midnight, not UTC midnight
  const d = new Date(s);
  return isNaN(d)?null:d;
};
const addMonths = (d,n)=>{ const x=new Date(d.getTime()); const day=x.getDate(); x.setDate(1); x.setMonth(x.getMonth()+n);
  x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate())); return x; };
const addDays = (d,n)=>{ const x=new Date(d.getTime()); x.setDate(x.getDate()+n); return x; };
const daysBetween = (a,b)=> Math.round((b-a)/86400000);
const monthKey = d => iso(d).slice(0,7);

