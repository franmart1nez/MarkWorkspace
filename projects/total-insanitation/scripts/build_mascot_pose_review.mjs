import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),card=path.join(root,'workspace/2026-11-12_total-insanitation');
const manifest=JSON.parse(await readFile(path.join(card,'MASCOT_ROUND_02_MANIFEST.json'),'utf8'));
const source=path.join(card,'sources/mascot-round-02'),media=path.join(card,'media/mascot-chatgpt-round-02');
await mkdir(source,{recursive:true});await mkdir(media,{recursive:true});
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const approved=[
 {id:'point-left-v02',title:'Pointing left',image:'media/mascot-trace-v02/wizard-point-left-v02-1024.png',approved:true},
 {id:'mopping-v02',title:'Mopping',image:'media/mascot-trace-v02/wizard-mopping-v02-1024.png',approved:true}
];
const rows=manifest.outputs;
const library=[rows[0],rows[1],approved[0],rows[2],approved[1],...rows.slice(3)];
async function sheet(name,items,columns,title,subtitle){
 const margin=44,gap=20,cw=350,ch=405,header=165,footer=82;
 const width=margin*2+columns*cw+(columns-1)*gap,height=header+Math.ceil(items.length/columns)*(ch+gap)+footer;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f3efdf"/><g font-family="Arial, sans-serif" fill="#171714"><text x="${margin}" y="40" font-size="14" font-weight="700" letter-spacing="2">STAGE 4 / MASCOT POSE SELECTION</text><text x="${margin}" y="88" font-size="37" font-weight="700">${esc(title)}</text><text x="${margin}" y="125" font-size="18" fill="#5b5b55">${esc(subtitle)}</text>`;
 for(let i=0;i<items.length;i++){
  const p=items[i],x=margin+(i%columns)*(cw+gap),y=header+Math.floor(i/columns)*(ch+gap);
  const bytes=await readFile(path.join(card,p.image));
  svg+=`<rect x="${x}" y="${y}" width="${cw}" height="${cw}" rx="12" fill="white"/><image x="${x+10}" y="${y+10}" width="${cw-20}" height="${cw-20}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${bytes.toString('base64')}"/><text x="${x}" y="${y+cw+25}" font-size="18" font-weight="700">${String(i+1).padStart(2,'0')} / ${esc(p.title)}</text><text x="${x}" y="${y+cw+49}" font-size="15" fill="${p.approved?'#42613f':'#5b5b55'}">${p.approved?'Approved SVG v02':'New raster / owner selection pending'}</text>`;
 }
 svg+=`<text x="${margin}" y="${height-42}" font-size="17">${name==='library-overview-02'?'Two approved SVG poses and ten new raster proposals.':'Original returned images; no contour edits or new vector traces.'}</text><text x="${margin}" y="${height-17}" font-size="16" fill="#5b5b55">Choose raster poses first; trace selected contours faithfully, then review transparent ink, backgrounds and display sizes.</text></g></svg>`;
 await writeFile(path.join(source,`${name}.svg`),svg);return {name,width,height};
}
const sheets=[await sheet('contact-sheet-02',rows,5,'Ten remaining poses / raster proposals','ChatGPT from the original greeting JPG. New images await owner selection before SVG tracing.'),await sheet('library-overview-02',library,4,'The twelve-pose library / current review','Pointing left and mopping SVG v02 are approved. All other entries are new raster proposals.')];
const {launchBrowser}=await import(pathToFileURL(path.join(root,'desktop/service/test/browser.mjs')));
const browser=await launchBrowser({args:['--disable-gpu']});
try{for(const s of sheets){const page=await browser.newPage({viewport:{width:s.width,height:s.height},deviceScaleFactor:1});const svg=await readFile(path.join(source,`${s.name}.svg`),'utf8');await page.setContent('<html><body style="margin:0">'+svg+'</body></html>',{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(media,`${s.name}.png`),fullPage:true});await page.close();}}finally{await browser.close();}
for(const s of sheets){await copyFile(path.join(source,`${s.name}.svg`),path.join(path.dirname(manifest.outputs[0].source_image),`${s.name}.svg`));await copyFile(path.join(media,`${s.name}.png`),path.join(path.dirname(manifest.outputs[0].source_image),`${s.name}.png`));}
console.log(JSON.stringify({sheets:sheets.map(s=>({name:s.name,width:s.width,height:s.height})),rasterOutputs:rows.length}));
