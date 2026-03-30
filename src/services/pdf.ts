import PDFDocument from 'pdfkit';
import type { RechnungInput, RechnungResult, AngebotResult, AngebotInput } from '../types/index';

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function berechneSummen(positionen: AngebotInput['positionen'], kleinunternehmer: boolean) {
  const netto = positionen.reduce((sum, p) => sum + p.menge * p.einzelpreis, 0);
  const ustSatz = kleinunternehmer ? 0 : 19;
  const ustBetrag = netto * (ustSatz / 100);
  const brutto = netto + ustBetrag;
  return { nettoSumme: netto, ustBetrag, bruttoSumme: brutto, ustSatz };
}

export async function generateAngebotPDF(
  input: AngebotInput,
  angebotResult: AngebotResult
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { freelancer, kunde } = input;

    // Header: Absender
    doc.fontSize(10).font('Helvetica');
    const absender = [
      freelancer.name,
      freelancer.firma,
      freelancer.adresse,
      `${freelancer.plz} ${freelancer.ort}`,
      freelancer.email,
      freelancer.telefon,
    ].filter(Boolean).join(' · ');
    doc.text(absender, { align: 'right' });

    if (freelancer.steuernummer) {
      doc.text(`Steuernr.: ${freelancer.steuernummer}`, { align: 'right' });
    }
    if (freelancer.ustIdNr) {
      doc.text(`USt-IdNr.: ${freelancer.ustIdNr}`, { align: 'right' });
    }

    doc.moveDown(2);

    // Empfänger
    doc.font('Helvetica').fontSize(10);
    if (kunde.firma) doc.text(kunde.firma);
    doc.text(kunde.name);
    doc.text(kunde.adresse);
    doc.text(`${kunde.plz} ${kunde.ort}`);

    doc.moveDown(2);

    // Angebotsnummer + Datum
    doc.font('Helvetica-Bold').fontSize(14).text(`Angebot ${angebotResult.angebotNummer}`);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Datum: ${formatDatum(angebotResult.erstelltAm)}`);
    if (input.gueltigBisDatum) {
      doc.text(`Gültig bis: ${formatDatum(input.gueltigBisDatum)}`);
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12).text(`Betreff: ${input.projekt.titel}`);
    doc.moveDown();

    // Angebotstext
    doc.font('Helvetica').fontSize(10).text(angebotResult.angebotText, { lineGap: 4 });
    doc.moveDown();

    // Leistungstabelle
    doc.font('Helvetica-Bold').fontSize(10);
    const tableTop = doc.y;
    const colPos = 60;
    const colMenge = 280;
    const colEinzel = 360;
    const colGesamt = 450;

    doc.text('Pos.', colPos, tableTop);
    doc.text('Bezeichnung', colPos + 30, tableTop);
    doc.text('Menge', colMenge, tableTop);
    doc.text('Einzelpreis', colEinzel, tableTop);
    doc.text('Gesamt', colGesamt, tableTop);

    doc.moveTo(colPos, tableTop + 15).lineTo(540, tableTop + 15).stroke();

    let y = tableTop + 20;
    doc.font('Helvetica').fontSize(9);

    input.positionen.forEach((pos, i) => {
      const gesamt = pos.menge * pos.einzelpreis;
      doc.text(String(i + 1), colPos, y);
      doc.text(pos.bezeichnung, colPos + 30, y, { width: 200 });
      doc.text(`${pos.menge} ${pos.einheit}`, colMenge, y);
      doc.text(formatEur(pos.einzelpreis), colEinzel, y);
      doc.text(formatEur(gesamt), colGesamt, y);
      if (pos.beschreibung) {
        y += 14;
        doc.fillColor('#555555').text(pos.beschreibung, colPos + 30, y, { width: 200 });
        doc.fillColor('#000000');
      }
      y += 16;
    });

    doc.moveTo(colPos, y).lineTo(540, y).stroke();
    y += 8;

    // Summen
    doc.font('Helvetica').fontSize(10);
    doc.text('Zwischensumme (netto):', colEinzel - 80, y);
    doc.text(formatEur(angebotResult.nettoSumme), colGesamt, y);
    y += 16;

    if (!freelancer.kleinunternehmer) {
      doc.text(`zzgl. ${angebotResult.ustSatz}% USt.:`, colEinzel - 80, y);
      doc.text(formatEur(angebotResult.ustBetrag), colGesamt, y);
      y += 16;
      doc.font('Helvetica-Bold');
      doc.text('Gesamtbetrag (brutto):', colEinzel - 80, y);
      doc.text(formatEur(angebotResult.bruttoSumme), colGesamt, y);
    } else {
      doc.font('Helvetica-Bold');
      doc.text('Gesamtbetrag:', colEinzel - 80, y);
      doc.text(formatEur(angebotResult.nettoSumme), colGesamt, y);
    }

    y += 24;
    doc.font('Helvetica').fontSize(9).fillColor('#333333');

    if (freelancer.kleinunternehmer) {
      doc.text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', colPos, y);
      y += 14;
    }

    if (input.bearbeitungszeit) {
      doc.text(`Geschätzte Bearbeitungszeit: ${input.bearbeitungszeit}`, colPos, y);
      y += 14;
    }

    doc.text(`Zahlungsziel: ${input.zahlungsziel || 14} Tage nach Rechnungsstellung`, colPos, y);

    // Footer
    doc.fillColor('#000000').font('Helvetica').fontSize(8);
    doc.text(
      `${freelancer.name}${freelancer.firma ? ' · ' + freelancer.firma : ''} · ${freelancer.adresse} · ${freelancer.plz} ${freelancer.ort}`,
      60, 780, { align: 'center', width: 480 }
    );

    doc.end();
  });
}

export async function generateRechnungPDF(input: RechnungInput): Promise<RechnungResult> {
  const { freelancer, kunde, positionen, rechnungNummer, leistungsdatum } = input;
  const summen = berechneSummen(positionen, freelancer.kleinunternehmer);

  const faelligDatum = new Date();
  faelligDatum.setDate(faelligDatum.getDate() + (input.zahlungsziel || 14));
  const faelligAm = faelligDatum.toISOString();

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(10).font('Helvetica');
    const absender = [
      freelancer.name,
      freelancer.firma,
      freelancer.adresse,
      `${freelancer.plz} ${freelancer.ort}`,
      freelancer.email,
    ].filter(Boolean).join(' · ');
    doc.text(absender, { align: 'right' });
    if (freelancer.steuernummer) doc.text(`Steuernr.: ${freelancer.steuernummer}`, { align: 'right' });
    if (freelancer.ustIdNr) doc.text(`USt-IdNr.: ${freelancer.ustIdNr}`, { align: 'right' });
    if (freelancer.iban) doc.text(`IBAN: ${freelancer.iban}`, { align: 'right' });
    if (freelancer.bic) doc.text(`BIC: ${freelancer.bic}`, { align: 'right' });

    doc.moveDown(2);

    // Empfänger
    if (kunde.firma) doc.text(kunde.firma);
    doc.text(kunde.name);
    doc.text(kunde.adresse);
    doc.text(`${kunde.plz} ${kunde.ort}`);

    doc.moveDown(2);

    // Rechnungskopf — GoBD: Rechnungsnummer + Datum + Leistungsdatum sind Pflicht
    doc.font('Helvetica-Bold').fontSize(14).text('RECHNUNG');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Rechnungsnummer: ${rechnungNummer}`);
    doc.text(`Rechnungsdatum: ${formatDatum(new Date().toISOString())}`);
    doc.text(`Leistungsdatum: ${formatDatum(leistungsdatum)}`);
    if (input.leistungszeitraum) {
      doc.text(`Leistungszeitraum: ${formatDatum(input.leistungszeitraum.von)} – ${formatDatum(input.leistungszeitraum.bis)}`);
    }
    if (input.angebotNummer) doc.text(`Bezug: Angebot ${input.angebotNummer}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(12).text(`Betreff: ${input.projekt.titel}`);
    doc.moveDown();

    // Tabelle
    doc.font('Helvetica-Bold').fontSize(10);
    const tableTop = doc.y;
    const colPos = 60;
    const colMenge = 280;
    const colEinzel = 360;
    const colGesamt = 450;

    doc.text('Pos.', colPos, tableTop);
    doc.text('Leistung', colPos + 30, tableTop);
    doc.text('Menge', colMenge, tableTop);
    doc.text('Einzelpreis', colEinzel, tableTop);
    doc.text('Gesamt', colGesamt, tableTop);
    doc.moveTo(colPos, tableTop + 15).lineTo(540, tableTop + 15).stroke();

    let y = tableTop + 20;
    doc.font('Helvetica').fontSize(9);

    positionen.forEach((pos, i) => {
      const gesamt = pos.menge * pos.einzelpreis;
      doc.text(String(i + 1), colPos, y);
      doc.text(pos.bezeichnung, colPos + 30, y, { width: 200 });
      doc.text(`${pos.menge} ${pos.einheit}`, colMenge, y);
      doc.text(formatEur(pos.einzelpreis), colEinzel, y);
      doc.text(formatEur(gesamt), colGesamt, y);
      if (pos.beschreibung) {
        y += 14;
        doc.fillColor('#555555').text(pos.beschreibung, colPos + 30, y, { width: 200 });
        doc.fillColor('#000000');
      }
      y += 16;
    });

    doc.moveTo(colPos, y).lineTo(540, y).stroke();
    y += 8;

    doc.font('Helvetica').fontSize(10);
    doc.text('Nettobetrag:', colEinzel - 80, y);
    doc.text(formatEur(summen.nettoSumme), colGesamt, y);
    y += 16;

    if (!freelancer.kleinunternehmer) {
      doc.text(`zzgl. ${summen.ustSatz}% USt.:`, colEinzel - 80, y);
      doc.text(formatEur(summen.ustBetrag), colGesamt, y);
      y += 16;
      doc.font('Helvetica-Bold');
      doc.text('Rechnungsbetrag:', colEinzel - 80, y);
      doc.text(formatEur(summen.bruttoSumme), colGesamt, y);
    } else {
      doc.font('Helvetica-Bold');
      doc.text('Rechnungsbetrag:', colEinzel - 80, y);
      doc.text(formatEur(summen.nettoSumme), colGesamt, y);
    }

    y += 24;
    doc.font('Helvetica').fontSize(9).fillColor('#333333');

    if (freelancer.kleinunternehmer) {
      doc.text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', colPos, y);
      y += 14;
    }

    doc.text(`Bitte überweisen Sie den Betrag bis zum ${formatDatum(faelligAm)} auf folgendes Konto:`, colPos, y);
    y += 14;
    if (freelancer.iban) {
      doc.text(`IBAN: ${freelancer.iban}${freelancer.bic ? '  BIC: ' + freelancer.bic : ''}`, colPos, y);
    }
    y += 14;
    doc.text(`Verwendungszweck: ${rechnungNummer}`, colPos, y);

    // Footer
    doc.fillColor('#000000').font('Helvetica').fontSize(8);
    doc.text(
      `${freelancer.name}${freelancer.firma ? ' · ' + freelancer.firma : ''} · ${freelancer.adresse} · ${freelancer.plz} ${freelancer.ort}`,
      60, 780, { align: 'center', width: 480 }
    );

    doc.end();
  });

  return { rechnungNummer, pdfBuffer, ...summen, faelligAm };
}
