const SHEET_NAME = "Transaksi";

function doGet() {
  return json({ok:true, service:"Arus Kas WSIT", message:"API aktif"});
}

function doPost(e) {
  try {
    const body = JSON.parse(e.parameter.payload || "{}");
    if (body.action === "list") return json({ok:true, transactions:listTransactions()});
    if (body.action === "upsert") { upsertTransaction(body.transaction); return json({ok:true}); }
    if (body.action === "delete") { deleteTransaction(body.id); return json({ok:true}); }
    return json({ok:false,error:"Action tidak dikenal"});
  } catch(err) {
    return json({ok:false,error:String(err)});
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(["ID","Tipe","Jumlah","Keterangan","Tanggal","Dibuat"]);
  return sh;
}

function listTransactions() {
  const sh = getSheet(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2,1,last-1,6).getValues().map(r => ({
    id:String(r[0]), type:String(r[1]), amount:Number(r[2]) || 0,
    description:String(r[3]), date:formatDate(r[4]), createdAt:String(r[5])
  })).filter(x => x.id);
}

function upsertTransaction(tx) {
  const sh=getSheet(), data=listTransactions();
  const idx=data.findIndex(x=>x.id===tx.id);
  const row=[tx.id,tx.type,Number(tx.amount),tx.description,tx.date,tx.createdAt || new Date().toISOString()];
  if(idx>=0) sh.getRange(idx+2,1,1,6).setValues([row]);
  else sh.appendRow(row);
}

function deleteTransaction(id) {
  const sh=getSheet(), data=listTransactions(), idx=data.findIndex(x=>x.id===id);
  if(idx>=0) sh.deleteRow(idx+2);
}

function formatDate(v) {
  if (Object.prototype.toString.call(v)==="[object Date]" && !isNaN(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const s=String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d=new Date(s);
  return isNaN(d) ? s : Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
