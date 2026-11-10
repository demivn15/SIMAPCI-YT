import React, {useMemo, useState} from 'react';
import {Award, Download, FolderOpen, ShieldCheck} from 'lucide-react';
import {ScientificProduct, TeacherUser} from '../../types';
import {STUDENT_COLLABORATIONS} from '../../constants/studentCollaborations';
import {ProductCard} from '../catalog/ProductCard';
import {ProductDetailModal} from '../catalog/ProductDetailModal';

type Props={currentUser:TeacherUser; products:ScientificProduct[]};

function certificateText(value:string):string {
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim();
}

function pdfLiteral(value:string):string {
 return certificateText(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}

function wrapText(value:string,maxLength=84):string[] {
 const words=certificateText(value).split(' ');
 const rows:string[]=[];
 let line='';
 words.forEach(word=>{
  const next=line?`${line} ${word}`:word;
  if(next.length>maxLength&&line){rows.push(line);line=word;}
  else line=next;
 });
 if(line) rows.push(line);
 return rows;
}

function makeCertificatePdf(student:TeacherUser,product:ScientificProduct,contribution:string):string {
 const commands=[
  '0.76 0.18 0.16 RG 2 w 30 30 782 535 re S',
  '0.76 0.18 0.16 rg 30 526 782 39 re f',
  'BT /F2 11 Tf 46 540 Td (UNIVERSIDAD YACHAY TECH  |  ECMC) Tj ET',
  'BT /F2 29 Tf 180 467 Td (CERTIFICADO DE COLABORACION) Tj ET',
  'BT /F1 14 Tf 335 429 Td (Se certifica que) Tj ET',
  `BT /F2 25 Tf 240 385 Td (${pdfLiteral(student.name)}) Tj ET`,
  `BT /F1 14 Tf 210 345 Td (participo como ${pdfLiteral(contribution)}) Tj ET`,
  'BT /F1 14 Tf 315 309 Td (en la colaboracion academica) Tj ET',
 ];
 const titleRows=wrapText(product.title,76).slice(0,2);
 titleRows.forEach((line,index)=>commands.push(`BT /F2 16 Tf 70 ${274-index*23} Td (${pdfLiteral(line)}) Tj ET`));
 commands.push(
  `BT /F1 12 Tf 70 211 Td (Linea de investigacion: ${pdfLiteral(product.researchLine)}) Tj ET`,
  `BT /F1 12 Tf 70 188 Td (Escuela: Escuela de Ciencias Matematicas y Computacionales - ${product.school}) Tj ET`,
  `BT /F1 12 Tf 70 165 Td (Estado del registro: ${product.status==='verificado'?'Verificado en SIMAPC':'Pendiente de verificacion'}) Tj ET`,
  `BT /F1 12 Tf 70 142 Td (Fecha de emision: ${pdfLiteral(new Date().toLocaleDateString('es-EC'))}) Tj ET`,
  '0.76 0.18 0.16 RG 1 w 70 112 m 772 112 l S',
  'BT /F1 9 Tf 70 91 Td (Constancia generada desde el entorno demostrativo de SIMAPC.) Tj ET',
  'BT /F1 9 Tf 70 76 Td (No sustituye una certificacion institucional firmada.) Tj ET',
 );
 const stream=commands.join('\n');
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
 ];
 let pdf='%PDF-1.4\n';
 const offsets=[0];
 objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const xrefOffset=pdf.length;
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 offsets.slice(1).forEach(offset=>{pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;});
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
 return pdf;
}

function downloadCertificate(student:TeacherUser,product:ScientificProduct,contribution:string) {
 const pdf=makeCertificatePdf(student,product,contribution);
 const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
 const link=document.createElement('a');
 link.href=url;
 link.download=`certificado-colaboracion-${product.id}.pdf`;
 document.body.appendChild(link);link.click();link.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function StudentCollaborationsView({currentUser,products}:Props) {
 const [selectedProduct,setSelectedProduct]=useState<ScientificProduct|null>(null);
 const collaborations=useMemo(()=>{
  const productById=new Map(products.map(product=>[product.id,product]));
  return (STUDENT_COLLABORATIONS[currentUser.id]||[]).flatMap(record=>{
   const product=productById.get(record.productId);
   return product&&product.school===currentUser.school?[{...record,product}]:[];
  });
 },[currentUser.id,currentUser.school,products]);

 return <section className="student-collaborations" aria-labelledby="student-collaborations-title">
  <div className="reviewer-heading">
   <p className="eyebrow">MI ESPACIO · {currentUser.school}</p>
   <h1 id="student-collaborations-title">Mis colaboraciones</h1>
   <p>Consulta los productos en los que colaboras y descarga una constancia de cada registro verificado.</p>
  </div>
  <div className="student-collaborations-note"><ShieldCheck size={18}/><span>Cuenta demostrativa. Las constancias descargadas están marcadas como documentos del entorno de demostración.</span></div>
  {collaborations.length===0 ? <div className="student-collaborations-empty"><FolderOpen size={32}/><h2>Aún no hay colaboraciones vinculadas</h2><p>Cuando se asocien productos a tu perfil, aparecerán aquí.</p></div> : <div className="student-collaborations-list">
   {collaborations.map(({product,contribution})=><article className="student-collaboration-card" key={product.id}>
    <div className="student-collaboration-role"><Award size={17}/><span>Tu colaboración: {contribution}</span></div>
    <ProductCard product={product} showStatus onClick={()=>setSelectedProduct(product)}/>
    <div className="student-collaboration-actions"><span>{product.status==='verificado'?'Constancia disponible':'Disponible cuando el registro sea verificado'}</span><button type="button" className="student-certificate-button" disabled={product.status!=='verificado'} onClick={()=>downloadCertificate(currentUser,product,contribution)}><Download size={17}/>Descargar certificado</button></div>
   </article>)}
  </div>}
  {selectedProduct&&<ProductDetailModal product={selectedProduct} showStatus onClose={()=>setSelectedProduct(null)}/>}
 </section>;
}
