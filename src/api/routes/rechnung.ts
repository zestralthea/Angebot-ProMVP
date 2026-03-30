import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { generateRechnungPDF } from '../../services/pdf';
import type { RechnungInput } from '../../types/index';

export const rechnungRouter = Router();

// In production: persist this counter in a database (required by GoBD)
const rechnungCounter = new Map<string, number>();

function nextRechnungNummer(userId: string): string {
  const year = new Date().getFullYear();
  const key = `${userId}-${year}`;
  const current = rechnungCounter.get(key) ?? 0;
  const next = current + 1;
  rechnungCounter.set(key, next);
  return `RE-${year}-${String(next).padStart(4, '0')}`;
}

const PositionSchema = z.object({
  bezeichnung: z.string().min(1),
  beschreibung: z.string().optional(),
  menge: z.number().positive(),
  einheit: z.string().min(1),
  einzelpreis: z.number().nonnegative(),
});

const RechnungInputSchema = z.object({
  userId: z.string().min(1),
  angebotNummer: z.string().optional(),
  leistungsdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leistungszeitraum: z.object({
    von: z.string(),
    bis: z.string(),
  }).optional(),
  freelancer: z.object({
    name: z.string().min(2),
    firma: z.string().optional(),
    adresse: z.string().min(5),
    plz: z.string().regex(/^\d{5}$/),
    ort: z.string().min(2),
    email: z.string().email(),
    steuernummer: z.string().optional(),
    ustIdNr: z.string().optional(),
    kleinunternehmer: z.boolean(),
    beruf: z.enum(['webdesigner', 'entwickler', 'texter', 'fotograf', 'grafiker', 'berater', 'uebersetzer', 'social_media', 'sonstige']),
    iban: z.string().optional(),
    bic: z.string().optional(),
  }),
  kunde: z.object({
    name: z.string().min(2),
    firma: z.string().optional(),
    adresse: z.string().min(5),
    plz: z.string().min(4),
    ort: z.string().min(2),
    email: z.string().email().optional(),
    ustIdNr: z.string().optional(),
  }),
  projekt: z.object({
    titel: z.string().min(3),
    beschreibung: z.string().min(10),
    branche: z.string().optional(),
    besonderheiten: z.string().optional(),
  }),
  positionen: z.array(PositionSchema).min(1),
  zahlungsziel: z.number().int().positive().optional(),
});

// POST /api/rechnung/pdf
rechnungRouter.post('/pdf', async (req: Request, res: Response) => {
  const parsed = RechnungInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Ungültige Eingabe', details: parsed.error.flatten() });
  }

  const { userId, ...rest } = parsed.data;
  const rechnungNummer = nextRechnungNummer(userId);

  try {
    const input: RechnungInput = { ...rest, rechnungNummer } as RechnungInput;
    const result = await generateRechnungPDF(input);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Rechnung_${rechnungNummer}.pdf"`,
      'Content-Length': result.pdfBuffer.length,
      'X-Rechnungs-Nummer': rechnungNummer,
      'X-Faellig-Am': result.faelligAm,
    });
    return res.send(result.pdfBuffer);
  } catch (err) {
    console.error('Rechnung PDF error:', err);
    return res.status(500).json({ code: 'PDF_ERROR', message: 'Fehler beim Erstellen der Rechnung' });
  }
});
