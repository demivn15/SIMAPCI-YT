import React from 'react';
import diego from '../../assets/researchers/diego-peluffo.png';
import eugenio from '../../assets/researchers/eugenio-morocho.png';
import juan from '../../assets/researchers/juan-pablo-astudillo.png';

// Selección y orden proporcionados para la portada; no es un cálculo bibliométrico.
const researchers = [
  {name:'Diego Peluffo, Ph.D.', photo:diego, orcid:'0000-0002-9045-6997'},
  {name:'Eugenio Morocho, Ph.D.', photo:eugenio, orcid:'0000-0002-4705-7923'},
  {name:'Juan Pablo Astudillo, Ph.D.', photo:juan, orcid:'0000-0002-7291-3584'},
];

export function TopResearchers() {
 return <section className="top-researchers" aria-labelledby="top-researchers-title">
  <header><p className="eyebrow">NUESTRA COMUNIDAD</p><h2 id="top-researchers-title">Top 3 investigadores</h2></header>
  <ol className="researcher-grid">{researchers.map((researcher,index)=><li className="researcher-card" key={researcher.orcid}>
   <div className="researcher-portrait"><img src={researcher.photo} alt={researcher.name} width={144} height={144} loading="lazy"/><span className="researcher-place" aria-label={`Puesto ${index+1}`}>{index+1}</span></div>
   <h3>{researcher.name}</h3>
   <a href={`https://orcid.org/${researcher.orcid}`} target="_blank" rel="noopener noreferrer" aria-label={`Ver perfil ORCID de ${researcher.name} (abre otra pestaña)`}><span className="orcid-mark" aria-hidden="true">iD</span>Ver perfil ORCID</a>
  </li>)}</ol>
 </section>;
}
