import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { generateAngebotText } from '../../services/claude';
import { generateAngebotPDF } from '../../services/pdf';
import type { AngebotInput } from '../../types/index';

export const angebotRouter = Router();

const PositionSchema = z.object({
  bezeichnung: z.string().min(1),
  beschreibung: z.string().optional(),
  menge: z.number().positive(),
  einheit: z.string().min(1),
  einzelpreis: z.number().nonnegative(),
});

const FreelancerSchema = z.object({
  name: z.string().min(2),
  firma: z.string().optional(),
  adresse: z.string().min(5),
  plz: z.string().regex(/^\d{5}$/),
  ort: z.string().min(2),
  email: z.string().email(),
  telefon: z.string().optional(),
  steuernummer: z.string().optional(),
  ustIdNr: z.string().regex(/^DE\d{9}$/).optional(),
  kleinunternehmer: z.boolean(),
  beruf: z.enum(['webdesigner', 'entwickler', 'texter', 'fotograf', 'grafiker', 'berater', 'uebersetzer', 'social_media', 'sonstige']),
  iban: z.string().optional(),
  bic: z.string().optional(),
});

const AngebotInputSchema = z.object({
  freelancer: FreelancerSchema,
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
    beschreibung: z.string().min(20),
    branche: z.string().optional(),
    besonderheiten: z.string().optional(),
  }),
  positionen: z.array(PositionSchema).min(1),
  gueltigBisDatum: z.string().optional(),
  bearbeitungszeit: z.string().optional(),
  zahlungsziel: z.number().int().positive().optional(),
});

// POST /api/angebot/generate — Text + Summen generieren
angebotRouter.post('/generate', async (req: Request, res: Response) => {
  const parsed = AngebotInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Ungültige Eingabe', details: parsed.error.flatten() });
  }

  try {
    const result = await generateAngebotText(parsed.data as AngebotInput);
    return res.json(result);
  } catch (err) {
    console.error('Angebot generation error:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ code: 'AI_ERROR', message: errMsg });
  }
});

// POST /api/angebot/pdf — PDF direkt herunterladen
angebotRouter.post('/pdf', async (req: Request, res: Response) => {
  const parsed = AngebotInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Ungültige Eingabe', details: parsed.error.flatten() });
  }

  try {
    const input = parsed.data as AngebotInput;
    const angebotResult = await generateAngebotText(input);
    const pdfBuffer = await generateAngebotPDF(input, angebotResult);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Angebot_${angebotResult.angebotNummer}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Angebot PDF error:', err);
    return res.status(500).json({ code: 'PDF_ERROR', message: 'Fehler beim Erstellen des PDF' });
  }
});
