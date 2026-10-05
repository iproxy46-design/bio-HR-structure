"use client";
import {useEffect,useId,useRef,useState} from "react";
import {Check,ChevronDown,Search} from "lucide-react";

type Option={id:string;label:string};
export function EmployeeFilter({label,value,options,onChange}:{label:string;value:string;options:Option[];onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const id=useId();
 const normalize=(text:string)=>text.toLocaleLowerCase("ru").replace(/ё/g,"е");
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 const matches=options.filter(option=>terms.every(term=>normalize(option.label).includes(term)));
 const selected=options.find(option=>option.id===value);
 useEffect(()=>{if(!open)return;input.current?.focus();const dismiss=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener("pointerdown",dismiss);return()=>document.removeEventListener("pointerdown",dismiss)},[open]);
 useEffect(()=>{if(open)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:"nearest"})},[active,open,id]);
 const choose=(option:Option)=>{onChange(option.id);setOpen(false);trigger.current?.focus()};
 return <div className="employee-filter" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}>
  <span className="filter-caption" id={`${id}-label`}>{label}</span>
  <button ref={trigger} type="button" className={`filter-trigger${open?" is-open":""}`} aria-label={`Фильтр: ${label}`} aria-expanded={open} aria-haspopup="listbox" onClick={()=>{setQuery("");setActive(0);setOpen(!open)}}><span>{selected?.label.replace(/^(—\s*)+/,"")||label}</span><ChevronDown size={18} aria-hidden="true"/></button>
  {open&&<div className="filter-popup"><div className="filter-popup-search"><Search size={16} aria-hidden="true"/><input ref={input} role="combobox" aria-label={`Поиск: ${label}`} aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-list`} aria-activedescendant={matches.length?`${id}-option-${active}`:undefined} placeholder="Начните вводить название" value={query} onChange={event=>{setQuery(event.target.value);setActive(0)}} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();setOpen(false);trigger.current?.focus()}else if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();setActive(index=>Math.max(0,Math.min(matches.length-1,index+(event.key==="ArrowDown"?1:-1))))}else if(event.key==="Enter"&&matches[active]){event.preventDefault();choose(matches[active])}}}/></div>
   <div className="filter-options" id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>{matches.map((option,index)=><button type="button" role="option" aria-selected={option.id===value} id={`${id}-option-${index}`} key={option.id} className={`filter-option${index===active?" highlighted":""}`} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)}><span>{option.label}</span>{option.id===value&&<Check size={16} aria-hidden="true"/>}</button>)}{matches.length===0&&<p className="filter-empty" role="status">Ничего не найдено</p>}</div>
  </div>}
 </div>;
}
