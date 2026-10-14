import {dailyReport,monthlyReport,createReportPDF} from './reports.mjs';

let library;
function loadPDFLibrary() {
  if(globalThis.jspdf?.jsPDF)return Promise.resolve(globalThis.jspdf.jsPDF);
  if(!library)library=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const timer=setTimeout(()=>failed(),20000);
    function failed(){clearTimeout(timer);script.remove();library=null;reject(new Error('Il modulo PDF non è disponibile. Riapri l’app online per completare la copia offline.'));}
    script.src=new URL('./vendor/jspdf.umd.min.js',import.meta.url).href;
    script.onload=()=>{clearTimeout(timer);if(globalThis.jspdf?.jsPDF)resolve(globalThis.jspdf.jsPDF);else failed();};
    script.onerror=failed;document.head.append(script);
  });
  return library;
}

export async function exportReport(diary,kind,period) {
  const report=kind==='daily'?dailyReport(diary,period):monthlyReport(diary,period);
  const JsPDF=await loadPDFLibrary();
  const pdf=createReportPDF(report,JsPDF);
  const filename=`cibo-sano-${kind==='daily'?'giorno':'mese'}-${report.period}.pdf`;
  // A PDF blob is generated locally. No diary content is sent to a service.
  const url=URL.createObjectURL(pdf.output('blob'));
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  return filename;
}
