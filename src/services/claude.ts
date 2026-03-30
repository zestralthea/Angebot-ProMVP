import Anthropic from '@anthropic-ai/sdk';
import type { AngebotInput, AngebotResult, FreelancerBeruf } from '../types/index';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BERUF_KONTEXT: Record<FreelancerBeruf, string> = {
  webdesigner: 'Webdesigner und UI/UX-Spezialist',
  entwickler: 'Softwareentwickler und Programmierer',
  texter: 'Copywriter, Content-Texter und Werbetexter',
  fotograf: 'Fotograf und Bildredakteur',
  grafiker: 'Grafiker und Mediengestalter',
  berater: 'Unternehmensberater und Coach',
  uebersetzer: 'Übersetzer und Dolmetscher',
  social_media: 'Social-Media-Manager und Content Creator',
  sonstige: 'Freiberufler',
};

function berechneSummen(positionen: AngebotInput['positionen'], kleinunternehmer: boolean) {
  const netto = positionen.reduce((sum, p) => sum + p.menge * p.einzelpreis, 0);
  const ustSatz = kleinunternehmer ? 0 : 19;
  const ustBetrag = netto * (ustSatz / 100);
  const brutto = netto + ustBetrag;
  return { nettoSumme: netto, ustBetrag, bruttoSumme: brutto, ustSatz };
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

export async function generateAngebotText(input: AngebotInput): Promise<AngebotResult> {
  const { freelancer, kunde, projekt, positionen, gueltigBisDatum, bearbeitungszeit } = input;
  const summen = berechneSummen(positionen, freelancer.kleinunternehmer);
  const angebotNummer = `AN-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const positionenText = positionen
    .map((p, i) => `  ${i + 1}. ${p.bezeichnung}${p.beschreibung ? ` (${p.beschreibung})` : ''}: ${p.menge} ${p.einheit} × ${formatEur(p.einzelpreis)} = ${formatEur(p.menge * p.einzelpreis)}`)
    .join('\n');

  const prompt = `Du bist ein erfahrener ${BERUF_KONTEXT[freelancer.beruf]} und schreibst ein professionelles Angebot auf Deutsch.

Freelancer: ${freelancer.name}${freelancer.firma ? ` (${freelancer.firma})` : ''}
Beruf: ${BERUF_KONTEXT[freelancer.beruf]}
Kunde: ${kunde.firma || kunde.name}${projekt.branche ? ` – Branche: ${projekt.branche}` : ''}

Projekt: ${projekt.titel}
Projektbeschreibung: ${projekt.beschreibung}
${projekt.besonderheiten ? `Besonderheiten: ${projekt.besonderheiten}` : ''}

Positionen:
${positionenText}

Gesamtbetrag (netto): ${formatEur(summen.nettoSumme)}
${freelancer.kleinunternehmer ? 'Kein Umsatzsteuerausweis (Kleinunternehmer §19 UStG)' : `zzgl. 19% USt.: ${formatEur(summen.ustBetrag)}\nGesamtbetrag (brutto): ${formatEur(summen.bruttoSumme)}`}

Bearbeitungszeit: ${bearbeitungszeit || 'nach Absprache'}
Angebot gültig bis: ${gueltigBisDatum || 'in 4 Wochen'}

Schreibe jetzt den professionellen Angebotstext (ca. 200-350 Wörter). Struktur:
1. Kurze, persönliche Anrede und Bezug zum Projekt
2. Überblick über den angebotenen Leistungsumfang (professionell, überzeugend)
3. Kurzer Absatz zu Vorgehensweise / Arbeitsweise
4. Hinweis auf Angebot-Gültigkeit und nächste Schritte
5. Freundlicher Schluss

Ton: professionell, kompetent, persönlich. KEIN generisches Marketing. Zeige Verständnis für das spezifische Projekt.`;

  const message = await client.messages.create({
    model: 'claude-3-7-sonnet-20250219',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const angebotText = message.content[0].type === 'text' ? message.content[0].text : '';

  const kleinunternehmerHinweis = freelancer.kleinunternehmer
    ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'
    : undefined;

  return {
    angebotNummer,
    angebotText,
    positionen,
    ...summen,
    kleinunternehmerHinweis,
    erstelltAm: new Date().toISOString(),
  };
}
