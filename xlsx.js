// Kutubxonasiz .xlsx yozuvchi (d-qadam, 2026-11-21): ZIP store (siqishsiz) + CRC32, satrlar inlineStr.
// xlsxYasa([{ nom: "Sklad", qatorlar: [["Seriya", "Profil", 87.5], ...], kenglik: [12, 20, 8] }]) → Uint8Array
(function (g) {
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const utf8 = (s) => new TextEncoder().encode(s);
  const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function ustun(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function varaqNom(n, band) {
    let s = String(n || "Varaq").replace(/[\\/?*[\]:]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Varaq";
    let k = s, i = 2;
    while (band.has(k.toLowerCase())) { const q = ` (${i++})`; k = s.slice(0, 31 - q.length) + q; }
    band.add(k.toLowerCase());
    return k;
  }
  function varaqXml(v) {
    const q = v.qatorlar || [];
    const cols = (v.kenglik || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Number(w) || 10}" customWidth="1"/>`).join("");
    const rows = q.map((r, ri) => `<row r="${ri + 1}">` + (r || []).map((x, ci) => {
      const ref = ustun(ci) + (ri + 1), bosh = ri === 0 && v.sarlavha !== false;
      const st = bosh ? ' s="1"' : (v.pul || []).includes(ci) && typeof x === "number" ? ' s="2"' : "";
      if (x === null || x === undefined || x === "") return "";
      if (typeof x === "number" && isFinite(x)) return `<c r="${ref}"${st}><v>${x}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${esc(x)}</t></is></c>`;
    }).join("") + `</row>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      (v.sarlavha !== false && q.length ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : "") +
      (cols ? `<cols>${cols}</cols>` : "") + `<sheetData>${rows}</sheetData></worksheet>`;
  }
  function zip(fayllar) {  // [{nom, data: Uint8Array}] → Uint8Array (store)
    const qism = [], markaz = [];
    let off = 0;
    for (const f of fayllar) {
      const nom = utf8(f.nom), d = f.data, crc = crc32(d);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true);
      h.setUint16(26, nom.length, true); h.setUint16(28, 0, true);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true);
      c.setUint16(28, nom.length, true); c.setUint32(42, off, true);
      qism.push(new Uint8Array(h.buffer), nom, d);
      markaz.push(new Uint8Array(c.buffer), nom);
      off += 30 + nom.length + d.length;
    }
    const mHajm = markaz.reduce((s, x) => s + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, fayllar.length, true); e.setUint16(10, fayllar.length, true);
    e.setUint32(12, mHajm, true); e.setUint32(16, off, true);
    const hamma = [...qism, ...markaz, new Uint8Array(e.buffer)];
    const out = new Uint8Array(hamma.reduce((s, x) => s + x.length, 0));
    let p = 0; for (const x of hamma) { out.set(x, p); p += x.length; }
    return out;
  }
  function xlsxYasa(varaqlar) {
    if (!varaqlar || !varaqlar.length) varaqlar = [{ nom: "Varaq", qatorlar: [] }];
    const band = new Set(), nomlar = varaqlar.map((v) => varaqNom(v.nom, band));
    const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      varaqlar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + `</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
      nomlar.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + `</sheets></workbook>`;
    const wbr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      varaqlar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${varaqlar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const st = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    return zip([
      { nom: "[Content_Types].xml", data: utf8(ct) }, { nom: "_rels/.rels", data: utf8(rels) },
      { nom: "xl/workbook.xml", data: utf8(wb) }, { nom: "xl/_rels/workbook.xml.rels", data: utf8(wbr) }, { nom: "xl/styles.xml", data: utf8(st) },
      ...varaqlar.map((v, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(varaqXml(v)) })),
    ]);
  }
  // Fayl nomi: Windows/Android taqiqlagan belgilarsiz
  const faylNom = (s) => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, "_").replace(/^[._]+|[._]+$/g, "").slice(0, 120) || "fayl";
  function xlsxYukla(nom, varaqlar) {
    nom = faylNom(nom.replace(/\.xlsx$/i, "")) + ".xlsx";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xlsxYasa(varaqlar)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  g.xlsxYasa = xlsxYasa; g.xlsxYukla = xlsxYukla; g.xlsxFaylNom = faylNom;
  if (typeof module !== "undefined") module.exports = { xlsxYasa, crc32, ustun, varaqNom, faylNom };
})(typeof window !== "undefined" ? window : globalThis);
