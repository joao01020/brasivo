"use client";
import { ArrowLeft, ArrowRight, Landmark, Search, Users } from "lucide-react";
import Link from "next/link";
import AccountHeaderActions from "@/components/account/AccountHeaderActions";
import { useEffect, useMemo, useState } from "react";
import type { Representative } from "@/types/chamber";

const STATE_NAMES: Record<string,string> = {AC:"Acre",AL:"Alagoas",AP:"Amapá",AM:"Amazonas",BA:"Bahia",CE:"Ceará",DF:"Distrito Federal",ES:"Espírito Santo",GO:"Goiás",MA:"Maranhão",MT:"Mato Grosso",MS:"Mato Grosso do Sul",MG:"Minas Gerais",PA:"Pará",PB:"Paraíba",PR:"Paraná",PE:"Pernambuco",PI:"Piauí",RJ:"Rio de Janeiro",RN:"Rio Grande do Norte",RS:"Rio Grande do Sul",RO:"Rondônia",RR:"Roraima",SC:"Santa Catarina",SP:"São Paulo",SE:"Sergipe",TO:"Tocantins"};
export default function StateMandates({ uf }: { uf: string }) {
  const [items,setItems]=useState<Representative[]>([]); const [loading,setLoading]=useState(true); const [query,setQuery]=useState(""); const [followCounts,setFollowCounts]=useState<Record<string,number>>({});
  useEffect(()=>{ setLoading(true); fetch(`/api/representatives?state=${uf}`).then(r=>r.ok?r.json():Promise.reject()).then(p=>setItems(p.representatives??[])).catch(()=>setItems([])).finally(()=>setLoading(false)); },[uf]);
  useEffect(()=>{if(!items.length){setFollowCounts({});return;}const ids=items.map(i=>i.id).join(",");let active=true;fetch(`/api/mandates/followers?ids=${encodeURIComponent(ids)}`).then(r=>r.ok?r.json():{counts:{}}).then(p=>{if(active)setFollowCounts(p.counts??{})}).catch(()=>{if(active)setFollowCounts({})});return()=>{active=false};},[items]);
  const followLabel=(count:number)=>count===0?"Seja o primeiro a acompanhar":count===1?"1 pessoa acompanha":`${count.toLocaleString("pt-BR")} pessoas acompanham`;
  const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase("pt-BR"); return q?items.filter(i=>`${i.name} ${i.party}`.toLocaleLowerCase("pt-BR").includes(q)):items},[items,query]);
  return <main className="parliamentary-page"><header className="parliamentary-topbar"><Link className="brand" href="/"><span>BR</span><b>A</b><span>SIVO</span></Link><div className="page-header-right"><Link className="parliamentary-back" href="/"><ArrowLeft size={15}/>Voltar ao mapa</Link><AccountHeaderActions /></div></header>
    <section className="state-directory"><div className="state-directory-heading"><span>MANDATOS EM EXERCÍCIO</span><h1>{STATE_NAMES[uf] ?? uf}</h1><p>Deputados federais atualmente retornados pela fonte oficial da Câmara dos Deputados.</p></div>
      <div className="state-directory-toolbar"><div><Landmark size={16}/><strong>{loading?"…":items.length}</strong><span>deputados federais</span></div><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome ou partido"/></label></div>
      {loading?<div className="parliamentary-loading">Consultando dados oficiais…</div>:<div className="parliamentary-grid">{filtered.map(p=><Link className="parliamentary-card" href={`/mandate/${p.id}`} key={p.id}><img src={p.photoUrl} alt="" aria-hidden="true"/><div><small>DEPUTADO FEDERAL</small><h2>{p.name}</h2><p>{p.party} · {p.state}</p><span className="mandate-card-follow-count"><Users size={12}/>{followLabel(followCounts[String(p.id)]??0)}</span></div><ArrowRight size={17}/></Link>)}</div>}
      {!loading&&filtered.length===0&&<div className="parliamentary-loading">Nenhum mandato encontrado para esta busca.</div>}
      <p className="official-source-note">Dados exibidos a partir da API oficial de Dados Abertos da Câmara dos Deputados.</p>
    </section></main>;
}
