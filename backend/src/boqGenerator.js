const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const ExcelJS = require('exceljs');

const TEMPLATE_BOQ_PATH = path.join(__dirname, '..', 'templates', 'TEMPLATE_BOQ.xlsx');

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Updates an input cell <c r="REF" ...> in worksheet XML while preserving its original s="..." style attribute.
 * - If formula is provided, writes <c r="REF" s="..."><f>formula</f><v>val</v></c>
 * - If val is null/undefined/empty, writes self-closing <c r="REF" s="..."/>
 * - Otherwise writes numeric <c r="REF" s="..."><v>val</v></c>
 */
function setXmlInputCell(xml, cellRef, val, formula = null) {
  const re = new RegExp(`<c r="${cellRef}"([^/>]*)(?:/>|>(?:[\\s\\S]*?)</c>)`);
  return xml.replace(re, (match, attrs) => {
    const sMatch = attrs.match(/\bs="(\d+)"/);
    const sAttr = sMatch ? ` s="${sMatch[1]}"` : '';
    if (formula !== null && formula !== undefined && formula !== '') {
      const numVal = val !== null && val !== undefined ? val : 0;
      return `<c r="${cellRef}"${sAttr}><f>${escapeXml(formula)}</f><v>${numVal}</v></c>`;
    }
    if (val === null || val === undefined || val === '') {
      return `<c r="${cellRef}"${sAttr}/>`;
    }
    return `<c r="${cellRef}"${sAttr}><v>${val}</v></c>`;
  });
}

/**
 * Updates the cached <v>...</v> result of a formula cell <c r="REF" ...> in worksheet XML
 * WITHOUT altering its <f ...>...</f> or <f t="shared" .../> tag or style attributes.
 */
function setXmlFormulaResult(xml, cellRef, resultVal) {
  const re = new RegExp(`<c r="${cellRef}"([^/>]*)(?:/>|>([\\s\\S]*?)</c>)`);
  return xml.replace(re, (match, attrs, inner) => {
    const numVal = resultVal !== null && resultVal !== undefined ? resultVal : 0;
    if (!inner) {
      return `<c r="${cellRef}"${attrs}><v>${numVal}</v></c>`;
    }
    if (/<v>[\s\S]*?<\/v>/.test(inner)) {
      const updatedInner = inner.replace(/<v>[\s\S]*?<\/v>/, `<v>${numVal}</v>`);
      return `<c r="${cellRef}"${attrs}>${updatedInner}</c>`;
    }
    return `<c r="${cellRef}"${attrs}>${inner}<v>${numVal}</v></c>`;
  });
}

/**
 * Computes all BoM AE and BoQ NRO Cluster metrics for a given project
 */
function calculateBoqMetrics(project) {
  const fdts = (project.fdts || []).slice(0, 5);

  const fdtCalcs = fdts.map((fdt) => {
    const routes = {
      A24: Number(fdt.routeLineA24 || 0),
      B24: Number(fdt.routeLineB24 || 0),
      C24: Number(fdt.routeLineC24 || 0),
      D24: Number(fdt.routeLineD24 || 0),
      A36: Number(fdt.routeLineA36 || 0),
      B36: Number(fdt.routeLineB36 || 0),
      C36: Number(fdt.routeLineC36 || 0),
      D36: Number(fdt.routeLineD36 || 0),
      A48: Number(fdt.routeLineA48 || 0),
      B48: Number(fdt.routeLineB48 || 0),
      C48: Number(fdt.routeLineC48 || 0),
      D48: Number(fdt.routeLineD48 || 0),
    };

    const totalRoute = Object.values(routes).reduce((a, b) => a + b, 0);
    const slingRoute = Number(fdt.slingWireRouteM || 0);

    const fats = {
      A: Number(fdt.fatCountLineA || 0),
      B: Number(fdt.fatCountLineB || 0),
      C: Number(fdt.fatCountLineC || 0),
      D: Number(fdt.fatCountLineD || 0),
    };
    const totalFat = fats.A + fats.B + fats.C + fats.D;
    const splitter1to8 = totalFat > 0 ? Math.ceil(totalFat / 8) : 0;

    const slackFdt = {
      A: fats.A >= 1 ? 1 : 0,
      B: fats.B >= 1 ? 1 : 0,
      C: fats.C >= 1 ? 1 : 0,
      D: fats.D >= 1 ? 1 : 0,
    };
    const slackFat = { ...fats };

    const calcCableLen = (routeVal, lineLetter) => {
      if (!routeVal || routeVal <= 0) return 0;
      const slacks = slackFat[lineLetter] + slackFdt[lineLetter];
      return Math.ceil(routeVal * 1.05 + slacks * 20);
    };

    const cableLengths = {
      A24: calcCableLen(routes.A24, 'A'),
      B24: calcCableLen(routes.B24, 'B'),
      C24: calcCableLen(routes.C24, 'C'),
      D24: calcCableLen(routes.D24, 'D'),
      A36: calcCableLen(routes.A36, 'A'),
      B36: calcCableLen(routes.B36, 'B'),
      C36: calcCableLen(routes.C36, 'C'),
      D36: calcCableLen(routes.D36, 'D'),
      A48: calcCableLen(routes.A48, 'A'),
      B48: calcCableLen(routes.B48, 'B'),
      C48: calcCableLen(routes.C48, 'C'),
      D48: calcCableLen(routes.D48, 'D'),
    };

    const totalCableLength = Object.values(cableLengths).reduce((a, b) => a + b, 0);
    const strandWireWithTol = slingRoute > 0 ? Math.ceil(slingRoute * 1.05) : 0;

    const fdt48 = fdt.fdtCapacity === '48C' ? 1 : 0;
    const fdt72 = fdt.fdtCapacity === '72C' || !fdt.fdtCapacity ? 1 : 0;
    const fdt96 = fdt.fdtCapacity === '96C' ? 1 : 0;
    const fdt144 = fdt.fdtCapacity === '144C' ? 1 : 0;
    const totalFdtUnits = fdt48 + fdt72 + fdt96 + fdt144;

    const totalSlackLength =
      (slackFdt.A + slackFdt.B + slackFdt.C + slackFdt.D + slackFat.A + slackFat.B + slackFat.C + slackFat.D) * 20;

    const poles = {
      p7m5: Number(fdt.newPole7m5 || 0),
      p7m4: Number(fdt.newPole7m4 || 0),
      p7m3: Number(fdt.newPole7m3 || 0),
      p7m25: Number(fdt.newPole7m25 || 0),
      p9m5: Number(fdt.newPole9m5 || 0),
      p9m4: Number(fdt.newPole9m4 || 0),
      extLn: Number(fdt.extPoleLn || 0),
      extMti: Number(fdt.extPoleMti || 0),
      extMr: Number(fdt.extPoleMr || 0),
    };

    const totalNewPoles = poles.p7m5 + poles.p7m4 + poles.p7m3 + poles.p7m25 + poles.p9m5 + poles.p9m4;
    const totalAllPoles = totalNewPoles + poles.extLn + poles.extMti + poles.extMr;

    const labelCable = Number((totalAllPoles * 0.1).toFixed(4));
    const labelFdt = totalFdtUnits;
    const labelFat = totalFat;
    const labelPole = totalNewPoles;

    const cableHanger = slackFdt.A + slackFat.A + slackFat.B + slackFat.C + slackFat.D;
    const plateBelt = (totalFat + totalFdtUnits) * 4;
    const polesExcl7m25 =
      poles.p7m5 + poles.p7m4 + poles.p7m3 + poles.p9m5 + poles.p9m4 + poles.extLn + poles.extMti + poles.extMr;
    const suspensionClamp = Number((polesExcl7m25 * 0.2).toFixed(4));
    const buldogGrip = Number(((strandWireWithTol / 40) * 6).toFixed(4));
    const poleClampSingle = Number((totalAllPoles - suspensionClamp).toFixed(4));
    const deadEndClamp = Number((poleClampSingle * 2).toFixed(4));
    const pondasiTiang = totalNewPoles;
    const steelClamp = suspensionClamp;

    const splicingFdt = totalFat;
    const splicingFat = totalFat;
    const testcomFat = totalFat;
    const testcomFdt = splitter1to8;
    const surveyRoute = totalCableLength + strandWireWithTol;

    return {
      fdt,
      routes,
      totalRoute,
      slingRoute,
      cableLengths,
      totalCableLength,
      strandWireWithTol,
      fdt48,
      fdt72,
      fdt96,
      fdt144,
      totalFdtUnits,
      splitter1to8,
      totalFat,
      fats,
      slackFdt,
      slackFat,
      totalSlackLength,
      labelCable,
      labelFdt,
      labelFat,
      labelPole,
      poles,
      totalNewPoles,
      totalAllPoles,
      cableHanger,
      plateBelt,
      suspensionClamp,
      buldogGrip,
      deadEndClamp,
      pondasiTiang,
      poleClampSingle,
      steelClamp,
      splicingFdt,
      splicingFat,
      testcomFat,
      testcomFdt,
      surveyRoute,
    };
  });

  const sumField = (getter) => Number(fdtCalcs.reduce((acc, item) => acc + getter(item), 0).toFixed(4));

  const totals = {
    routeA24: sumField((x) => x.routes.A24),
    routeB24: sumField((x) => x.routes.B24),
    routeC24: sumField((x) => x.routes.C24),
    routeD24: sumField((x) => x.routes.D24),
    routeA36: sumField((x) => x.routes.A36),
    routeB36: sumField((x) => x.routes.B36),
    routeC36: sumField((x) => x.routes.C36),
    routeD36: sumField((x) => x.routes.D36),
    routeA48: sumField((x) => x.routes.A48),
    routeB48: sumField((x) => x.routes.B48),
    routeC48: sumField((x) => x.routes.C48),
    routeD48: sumField((x) => x.routes.D48),
    totalRoute: sumField((x) => x.totalRoute),
    slingRoute: sumField((x) => x.slingRoute),
    cableLenA24: sumField((x) => x.cableLengths.A24),
    cableLenB24: sumField((x) => x.cableLengths.B24),
    cableLenC24: sumField((x) => x.cableLengths.C24),
    cableLenD24: sumField((x) => x.cableLengths.D24),
    cableLenA36: sumField((x) => x.cableLengths.A36),
    cableLenB36: sumField((x) => x.cableLengths.B36),
    cableLenC36: sumField((x) => x.cableLengths.C36),
    cableLenD36: sumField((x) => x.cableLengths.D36),
    cableLenA48: sumField((x) => x.cableLengths.A48),
    cableLenB48: sumField((x) => x.cableLengths.B48),
    cableLenC48: sumField((x) => x.cableLengths.C48),
    cableLenD48: sumField((x) => x.cableLengths.D48),
    totalCable24: sumField(
      (x) => x.cableLengths.A24 + x.cableLengths.B24 + x.cableLengths.C24 + x.cableLengths.D24
    ),
    totalCable36: sumField(
      (x) => x.cableLengths.A36 + x.cableLengths.B36 + x.cableLengths.C36 + x.cableLengths.D36
    ),
    totalCable48: sumField(
      (x) => x.cableLengths.A48 + x.cableLengths.B48 + x.cableLengths.C48 + x.cableLengths.D48
    ),
    totalCableLength: sumField((x) => x.totalCableLength),
    strandWireWithTol: sumField((x) => x.strandWireWithTol),
    fdt48: sumField((x) => x.fdt48),
    fdt72: sumField((x) => x.fdt72),
    fdt96: sumField((x) => x.fdt96),
    fdt144: sumField((x) => x.fdt144),
    splitter1to8: sumField((x) => x.splitter1to8),
    totalFat: sumField((x) => x.totalFat),
    fatLineA: sumField((x) => x.fats.A),
    fatLineB: sumField((x) => x.fats.B),
    fatLineC: sumField((x) => x.fats.C),
    fatLineD: sumField((x) => x.fats.D),
    slackFdtA: sumField((x) => x.slackFdt.A),
    slackFdtB: sumField((x) => x.slackFdt.B),
    slackFdtC: sumField((x) => x.slackFdt.C),
    slackFdtD: sumField((x) => x.slackFdt.D),
    totalSlackLength: sumField((x) => x.totalSlackLength),
    labelCable: sumField((x) => x.labelCable),
    labelFdt: sumField((x) => x.labelFdt),
    labelFat: sumField((x) => x.labelFat),
    labelPole: sumField((x) => x.labelPole),
    p7m5: sumField((x) => x.poles.p7m5),
    p7m4: sumField((x) => x.poles.p7m4),
    p7m3: sumField((x) => x.poles.p7m3),
    p7m25: sumField((x) => x.poles.p7m25),
    p9m5: sumField((x) => x.poles.p9m5),
    p9m4: sumField((x) => x.poles.p9m4),
    extLn: sumField((x) => x.poles.extLn),
    extMti: sumField((x) => x.poles.extMti),
    extMr: sumField((x) => x.poles.extMr),
    cableHanger: sumField((x) => x.cableHanger),
    plateBelt: sumField((x) => x.plateBelt),
    suspensionClamp: sumField((x) => x.suspensionClamp),
    buldogGrip: sumField((x) => x.buldogGrip),
    deadEndClamp: sumField((x) => x.deadEndClamp),
    pondasiTiang: sumField((x) => x.pondasiTiang),
    poleClampSingle: sumField((x) => x.poleClampSingle),
    steelClamp: sumField((x) => x.steelClamp),
    splicingFdt: sumField((x) => x.splicingFdt),
    splicingFat: sumField((x) => x.splicingFat),
    totalSplicing: sumField((x) => x.splicingFdt + x.splicingFat),
    testcomFat: sumField((x) => x.testcomFat),
    testcomFdt: sumField((x) => x.testcomFdt),
    surveyRoute: sumField((x) => x.surveyRoute),
  };

  return { fdtCalcs, totals };
}

/**
 * Generates a 100% OpenXML-compliant Workbook matching CONTOH BOQ.xlsx byte-for-byte
 * in styles, column widths, theme colors, merged cells, and shared formulas.
 */
async function generateBoqWorkbook(project) {
  const templateBuf = fs.readFileSync(TEMPLATE_BOQ_PATH);
  const zip = await JSZip.loadAsync(templateBuf);

  const { fdtCalcs, totals } = calculateBoqMetrics(project);

  const clusterName = project.clusterName || 'CLUSTER FTTH';
  const oltName = project.oltName || 'KOTAMOBAGU BARAT';
  const netType = project.netType || 'Aerial';
  const totalHp = Number(project.totalHomepass || 0);

  // 1. Update sharedStrings.xml for O3 (index 862) and O2 (index 863)
  let sharedStringsXml = await zip.file('xl/sharedStrings.xml').async('string');
  sharedStringsXml = sharedStringsXml
    .replace(
      '<si><t>KELURAHAN POYOWA BESAR SATU KOTAMOBAGU</t></si>',
      `<si><t>${escapeXml(clusterName)}</t></si>`
    )
    .replace(
      '<si><t>KOTAMOBAGU BARAT</t></si>',
      `<si><t>${escapeXml(oltName)}</t></si>`
    );
  zip.file('xl/sharedStrings.xml', sharedStringsXml);

  // 2. Update sheet2.xml (BoQ NRO Cluster) and sheet4.xml (BoM AE)
  let nroXml = await zip.file('xl/worksheets/sheet2.xml').async('string');
  let bomXml = await zip.file('xl/worksheets/sheet4.xml').async('string');

  // Update O4 (Net Type) if different from 'Aerial', and O5 (Total Homepass)
  if (netType !== 'Aerial') {
    nroXml = nroXml.replace(
      /<c r="O4" s="83" t="s"><v>\d+<\/v><\/c>/,
      `<c r="O4" s="83" t="inlineStr"><is><t>${escapeXml(netType)}</t></is></c>`
    );
  }
  nroXml = setXmlInputCell(nroXml, 'O5', totalHp);

  // Update B1 in BoM AE (<c r="B1" s="262" t="str"><f>'BoQ NRO Cluster'!O3</f><v>...</v></c>)
  bomXml = setXmlFormulaResult(bomXml, 'B1', escapeXml(clusterName));

  // Clear all FDT 1..5 (Cols E..I) input cells and zero out formula caches first
  const fdtColLetters = ['E', 'F', 'G', 'H', 'I'];
  const emptyInputRows = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 30, 31, 32, 33, 36, 37, 38, 39, 53, 54, 55, 56, 57];
  const zeroInputRows = [58, 59, 60, 61, 75];
  const formulaRowsPerFdt = [
    14,
    16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
    28, 29,
    34, 35,
    40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
    62, 63, 64, 65, 66, 67, 69, 70, 73, 74, 76, 77, 79, 80,
  ];

  for (const colLetter of fdtColLetters) {
    for (const r of emptyInputRows) {
      bomXml = setXmlInputCell(bomXml, `${colLetter}${r}`, null);
    }
    for (const r of zeroInputRows) {
      bomXml = setXmlInputCell(bomXml, `${colLetter}${r}`, 0);
    }
    for (const r of formulaRowsPerFdt) {
      bomXml = setXmlFormulaResult(bomXml, `${colLetter}${r}`, 0);
    }
  }

  // 3. Populate active FDT columns (E, F, G, H, I) in BoM AE
  fdtCalcs.forEach((fc, idx) => {
    const colLetter = fdtColLetters[idx];
    if (!colLetter) return;
    const { fdt, routes, cableLengths } = fc;

    if (routes.A24 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}2`, routes.A24);
    if (routes.B24 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}3`, routes.B24);
    if (routes.C24 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}4`, routes.C24);
    if (routes.D24 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}5`, routes.D24);
    if (routes.A36 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}6`, routes.A36);
    if (routes.B36 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}7`, routes.B36);
    if (routes.C36 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}8`, routes.C36);
    if (routes.D36 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}9`, routes.D36);
    if (routes.A48 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}10`, routes.A48);
    if (routes.B48 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}11`, routes.B48);
    if (routes.C48 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}12`, routes.C48);
    if (routes.D48 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}13`, routes.D48);

    bomXml = setXmlFormulaResult(bomXml, `${colLetter}14`, fc.totalRoute);

    if (fdt.slingWireFormula && fc.slingRoute > 0) {
      bomXml = setXmlInputCell(bomXml, `${colLetter}15`, fc.slingRoute, fdt.slingWireFormula);
    } else if (fc.slingRoute > 0) {
      bomXml = setXmlInputCell(bomXml, `${colLetter}15`, fc.slingRoute);
    }

    const cLenKeys = ['A24', 'B24', 'C24', 'D24', 'A36', 'B36', 'C36', 'D36', 'A48', 'B48', 'C48', 'D48'];
    cLenKeys.forEach((k, kIdx) => {
      bomXml = setXmlFormulaResult(bomXml, `${colLetter}${16 + kIdx}`, cableLengths[k] || 0);
    });

    bomXml = setXmlFormulaResult(bomXml, `${colLetter}28`, fc.totalCableLength);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}29`, fc.strandWireWithTol);

    if (fc.fdt48 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}30`, fc.fdt48);
    if (fc.fdt72 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}31`, fc.fdt72);
    if (fc.fdt96 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}32`, fc.fdt96);
    if (fc.fdt144 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}33`, fc.fdt144);

    bomXml = setXmlFormulaResult(bomXml, `${colLetter}34`, fc.splitter1to8);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}35`, fc.totalFat);

    if (fc.fats.A > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}36`, fc.fats.A);
    if (fc.fats.B > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}37`, fc.fats.B);
    if (fc.fats.C > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}38`, fc.fats.C);
    if (fc.fats.D > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}39`, fc.fats.D);

    bomXml = setXmlFormulaResult(bomXml, `${colLetter}40`, fc.slackFdt.A);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}41`, fc.slackFdt.B);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}42`, fc.slackFdt.C);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}43`, fc.slackFdt.D);

    bomXml = setXmlFormulaResult(bomXml, `${colLetter}44`, fc.slackFat.A);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}45`, fc.slackFat.B);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}46`, fc.slackFat.C);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}47`, fc.slackFat.D);

    bomXml = setXmlFormulaResult(bomXml, `${colLetter}48`, fc.totalSlackLength);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}49`, fc.labelCable);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}50`, fc.labelFdt);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}51`, fc.labelFat);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}52`, fc.labelPole);

    if (fc.poles.p7m5 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}53`, fc.poles.p7m5);
    if (fc.poles.p7m4 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}54`, fc.poles.p7m4);
    if (fc.poles.p7m3 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}55`, fc.poles.p7m3);
    if (fc.poles.p7m25 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}56`, fc.poles.p7m25);
    if (fc.poles.p9m5 > 0) bomXml = setXmlInputCell(bomXml, `${colLetter}57`, fc.poles.p9m5);
    bomXml = setXmlInputCell(bomXml, `${colLetter}58`, fc.poles.p9m4 || 0);
    bomXml = setXmlInputCell(bomXml, `${colLetter}59`, fc.poles.extLn || 0);
    bomXml = setXmlInputCell(bomXml, `${colLetter}60`, fc.poles.extMti || 0);
    bomXml = setXmlInputCell(bomXml, `${colLetter}61`, fc.poles.extMr || 0);

    bomXml = setXmlFormulaResult(bomXml, `${colLetter}62`, fc.cableHanger);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}63`, fc.plateBelt);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}64`, fc.suspensionClamp);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}65`, fc.buldogGrip);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}66`, fc.deadEndClamp);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}67`, fc.pondasiTiang);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}69`, fc.poleClampSingle);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}70`, fc.steelClamp);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}73`, fc.splicingFdt);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}74`, fc.splicingFat);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}76`, fc.testcomFat);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}77`, fc.testcomFdt);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}79`, fc.surveyRoute);
    bomXml = setXmlFormulaResult(bomXml, `${colLetter}80`, fc.surveyRoute);
  });

  // 4. Update Column C (Qty Total) cached results in BoM AE (including 0s!)
  const colCTotalsMap = {
    2: totals.routeA24,
    3: totals.routeB24,
    4: totals.routeC24,
    5: totals.routeD24,
    6: totals.routeA36,
    7: totals.routeB36,
    8: totals.routeC36,
    9: totals.routeD36,
    10: totals.routeA48,
    11: totals.routeB48,
    12: totals.routeC48,
    13: totals.routeD48,
    14: totals.totalRoute,
    15: totals.slingRoute,
    16: totals.cableLenA24,
    17: totals.cableLenB24,
    18: totals.cableLenC24,
    19: totals.cableLenD24,
    20: totals.cableLenA36,
    21: totals.cableLenB36,
    22: totals.cableLenC36,
    23: totals.cableLenD36,
    24: totals.cableLenA48,
    25: totals.cableLenB48,
    26: totals.cableLenC48,
    27: totals.cableLenD48,
    28: totals.totalCableLength,
    29: totals.strandWireWithTol,
    30: totals.fdt48,
    31: totals.fdt72,
    32: totals.fdt96,
    33: totals.fdt144,
    34: totals.splitter1to8,
    35: totals.totalFat,
    36: totals.fatLineA,
    37: totals.fatLineB,
    38: totals.fatLineC,
    39: totals.fatLineD,
    40: totals.slackFdtA,
    41: totals.slackFdtB,
    42: totals.slackFdtC,
    43: totals.slackFdtD,
    44: totals.fatLineA,
    45: totals.fatLineB,
    46: totals.fatLineC,
    47: totals.fatLineD,
    48: totals.totalSlackLength,
    49: totals.labelCable,
    50: totals.labelFdt,
    51: totals.labelFat,
    52: totals.labelPole,
    53: totals.p7m5,
    54: totals.p7m4,
    55: totals.p7m3,
    56: totals.p7m25,
    57: totals.p9m5,
    58: totals.p9m4,
    59: totals.extLn,
    60: totals.extMti,
    61: totals.extMr,
    62: totals.cableHanger,
    63: totals.plateBelt,
    64: totals.suspensionClamp,
    65: totals.buldogGrip,
    66: totals.deadEndClamp,
    67: totals.pondasiTiang,
    69: totals.poleClampSingle,
    70: totals.steelClamp,
    73: totals.splicingFdt,
    74: totals.splicingFat,
    76: totals.testcomFat,
    77: totals.testcomFdt,
    79: totals.surveyRoute,
    80: totals.surveyRoute,
  };

  for (const [rStr, val] of Object.entries(colCTotalsMap)) {
    const r = Number(rStr);
    bomXml = setXmlFormulaResult(bomXml, `C${r}`, val || 0);
  }

  // 5. Update cached results in BoQ NRO Cluster (sheet2.xml) WITHOUT modifying <f t="shared" ...> tags
  const updateNroPair = (matRow, srvRow, qty) => {
    const v = qty || 0;
    if (matRow) {
      nroXml = setXmlFormulaResult(nroXml, `D${matRow}`, v);
      nroXml = setXmlFormulaResult(nroXml, `K${matRow}`, v);
    }
    if (srvRow) {
      nroXml = setXmlFormulaResult(nroXml, `E${srvRow}`, v);
      nroXml = setXmlFormulaResult(nroXml, `K${srvRow}`, v);
    }
  };

  updateNroPair(15, 16, totals.totalCable24);
  updateNroPair(17, 18, totals.totalCable36);
  updateNroPair(19, 20, totals.totalCable48);
  updateNroPair(42, 43, totals.fdt48);
  updateNroPair(44, 45, totals.fdt72);
  updateNroPair(46, 47, totals.fdt96);
  updateNroPair(48, 49, totals.fdt144);
  updateNroPair(63, 64, totals.totalFat);

  // Splicing (Row 92)
  nroXml = setXmlFormulaResult(nroXml, 'E92', totals.totalSplicing || 0);
  nroXml = setXmlFormulaResult(nroXml, 'K92', totals.totalSplicing || 0);

  // Labels (Rows 94..97: both D and E have qty, K has 2*qty)
  const updateBothMatSrv = (r, qty) => {
    const v = qty || 0;
    nroXml = setXmlFormulaResult(nroXml, `D${r}`, v);
    nroXml = setXmlFormulaResult(nroXml, `E${r}`, v);
    nroXml = setXmlFormulaResult(nroXml, `K${r}`, Number((v * 2).toFixed(4)));
  };
  updateBothMatSrv(94, totals.labelCable);
  updateBothMatSrv(95, totals.labelFdt);
  updateBothMatSrv(96, totals.labelFat);
  updateBothMatSrv(97, totals.labelPole);

  // Poles (Rows 213..220)
  updateNroPair(213, 214, totals.p7m4);
  updateNroPair(215, 216, totals.p9m4);
  updateNroPair(217, 218, totals.p7m3);
  nroXml = setXmlFormulaResult(nroXml, 'D219', totals.p7m25 || 0);
  nroXml = setXmlFormulaResult(nroXml, 'E220', totals.p7m25 || 0);

  // Cable hanger, strand wire, pole accessories (Rows 225..239)
  updateBothMatSrv(225, totals.cableHanger);
  updateBothMatSrv(226, totals.strandWireWithTol);
  updateBothMatSrv(228, totals.plateBelt);
  updateBothMatSrv(229, totals.suspensionClamp);
  updateBothMatSrv(231, totals.buldogGrip);
  updateBothMatSrv(235, totals.steelClamp);
  updateBothMatSrv(236, totals.poleClampSingle);
  updateBothMatSrv(238, totals.deadEndClamp);
  updateBothMatSrv(239, totals.pondasiTiang);

  // Testcomm & Documentation & PM (Rows 287, 291, 296)
  nroXml = setXmlFormulaResult(nroXml, 'E287', totals.testcomFat || 0);
  nroXml = setXmlFormulaResult(nroXml, 'K287', totals.testcomFat || 0);
  nroXml = setXmlFormulaResult(nroXml, 'E291', totals.surveyRoute || 0);
  nroXml = setXmlFormulaResult(nroXml, 'K291', totals.surveyRoute || 0);
  nroXml = setXmlFormulaResult(nroXml, 'E296', totals.surveyRoute || 0);
  nroXml = setXmlFormulaResult(nroXml, 'K296', totals.surveyRoute || 0);

  zip.file('xl/worksheets/sheet2.xml', nroXml);
  zip.file('xl/worksheets/sheet4.xml', bomXml);

  // 6. Remove calcChain.xml and set fullCalcOnLoad="1" so Excel never complains about stale calcChain
  zip.remove('xl/calcChain.xml');

  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  contentTypesXml = contentTypesXml.replace(/<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/g, '');
  zip.file('[Content_Types].xml', contentTypesXml);

  let wbRelsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  wbRelsXml = wbRelsXml.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/g, '');
  zip.file('xl/_rels/workbook.xml.rels', wbRelsXml);

  let wbXml = await zip.file('xl/workbook.xml').async('string');
  if (/<calcPr[^>]*\/>/.test(wbXml)) {
    wbXml = wbXml.replace(/<calcPr([^>]*)\/>/, (m, attrs) => {
      const cleaned = attrs.replace(/\bfullCalcOnLoad="[^"]*"/g, '');
      return `<calcPr${cleaned} fullCalcOnLoad="1"/>`;
    });
  }
  zip.file('xl/workbook.xml', wbXml);

  const outBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    xlsx: {
      writeBuffer: async () => outBuffer,
    },
  };
}

function resolveExcelFillHex(fgColor) {
  if (!fgColor) return null;
  if (fgColor.argb) {
    const hex = fgColor.argb.length === 8 ? fgColor.argb.slice(2) : fgColor.argb;
    if (hex.toUpperCase() === 'FFFFFF') return '#FFFFFF';
    return `#${hex}`;
  }
  if (fgColor.theme !== undefined) {
    const t = fgColor.theme;
    const tint = Number(fgColor.tint || 0);
    if (t === 0 && tint < -0.2) return '#A6A6A6';
    if (t === 2) return '#DDD9C4';
    if (t === 3) return '#B8CCE4';
    if (t === 5) return '#E6B8B7';
    if (t === 8) return '#92CDDC';
    if (t === 0) return '#FFFFFF';
  }
  return null;
}

async function extractBoqPreviewData(project) {
  const wbWrapper = await generateBoqWorkbook(project);
  const buf = await wbWrapper.xlsx.writeBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const extractSheet = (ws, maxCols, isAccountingZeroDash = false) => {
    if (!ws) return [];
    const rows = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells = [];
      let hasContent = false;

      for (let c = 1; c <= maxCols; c++) {
        const cell = row.getCell(c);
        const raw = cell.value;
        let formula = null;
        let displayVal = raw;
        let isFormula = false;

        if (raw && typeof raw === 'object') {
          if ('richText' in raw && Array.isArray(raw.richText)) {
            displayVal = raw.richText.map((rt) => rt.text).join('');
          } else if ('formula' in raw || 'sharedFormula' in raw) {
            isFormula = true;
            formula = raw.formula || raw.sharedFormula;
            // Note: ExcelJS XML parser omits `result` when <v>0</v> is 0
            if (raw.result !== undefined) {
              displayVal = raw.result;
              if (displayVal && typeof displayVal === 'object' && 'error' in displayVal) {
                displayVal = displayVal.error;
              }
            } else {
              displayVal = 0;
            }
          }
        }

        const bgHex = resolveExcelFillHex(cell.fill?.fgColor);
        const hasBorder = Boolean(
          cell.border &&
            (cell.border.top || cell.border.bottom || cell.border.left || cell.border.right)
        );

        let formattedDisplay = displayVal ?? '';
        let numericVal = typeof displayVal === 'number' ? displayVal : null;

        if (isAccountingZeroDash && isFormula && displayVal === 0 && r >= 7 && c >= 4 && c <= 12) {
          formattedDisplay = '-';
        }

        if (
          (formattedDisplay !== '' && formattedDisplay !== null && formattedDisplay !== undefined) ||
          (bgHex && bgHex !== '#FFFFFF')
        ) {
          hasContent = true;
        }

        cells.push({
          col: c,
          address: cell.address,
          value: formattedDisplay,
          numericVal,
          formula,
          bold: Boolean(cell.font?.bold),
          bgHex,
          hasBorder,
          align: cell.alignment?.horizontal || null,
        });
      }

      if (hasContent || r <= 15) {
        rows.push({
          rowNumber: r,
          height: row.height || 18,
          cells,
        });
      }
    }
    return rows;
  };

  const summarySheet = wb.getWorksheet('Summary PO Permit');
  const nroSheet = wb.getWorksheet('BoQ NRO Cluster');
  const feederSheet = wb.getWorksheet('BoQ NRO All Feeder');
  const bomSheet = wb.getWorksheet('BoM AE');

  return {
    summaryPermitRows: extractSheet(summarySheet, 2, false),
    nroClusterRows: extractSheet(nroSheet, 17, true),
    nroFeederRows: extractSheet(feederSheet, 17, true),
    bomAeRows: extractSheet(bomSheet, 20, false),
  };
}

module.exports = {
  calculateBoqMetrics,
  generateBoqWorkbook,
  extractBoqPreviewData,
};
