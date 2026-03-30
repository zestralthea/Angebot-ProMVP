export interface FreelancerProfile {
  name: string;
  firma?: string;
  adresse: string;
  plz: string;
  ort: string;
  email: string;
  telefon?: string;
  steuernummer?: string;         // e.g. "12/345/67890"
  ustIdNr?: string;              // e.g. "DE123456789"
  kleinunternehmer: boolean;     // §19 UStG
  beruf: FreelancerBeruf;
  iban?: string;
  bic?: string;
}

export type FreelancerBeruf =
  | 'webdesigner'
  | 'entwickler'
  | 'texter'
  | 'fotograf'
  | 'grafiker'
  | 'berater'
  | 'uebersetzer'
  | 'social_media'
  | 'sonstige';

export interface AngebotInput {
  freelancer: FreelancerProfile;
  kunde: KundenInfo;
  projekt: ProjektDetails;
  positionen: Position[];
  gueltigBisDatum?: string;      // ISO date string
  bearbeitungszeit?: string;     // e.g. "4 Wochen"
  zahlungsziel?: number;         // Tage, default 14
}

export interface KundenInfo {
  name: string;
  firma?: string;
  adresse: string;
  plz: string;
  ort: string;
  email?: string;
  ustIdNr?: string;
}

export interface ProjektDetails {
  titel: string;
  beschreibung: string;
  branche?: string;              // Kundenbranche für Kontext
  besonderheiten?: string;       // Spezialanforderungen
}

export interface Position {
  bezeichnung: string;
  beschreibung?: string;
  menge: number;
  einheit: string;               // "Std.", "pauschal", "Stück"
  einzelpreis: number;           // EUR, netto
}

export interface AngebotResult {
  angebotNummer: string;
  angebotText: string;           // AI-generated professional text
  positionen: Position[];
  nettoSumme: number;
  ustBetrag: number;
  bruttoSumme: number;
  ustSatz: number;               // 19 or 0 (Kleinunternehmer)
  kleinunternehmerHinweis?: string;
  erstelltAm: string;
}

export interface RechnungInput extends AngebotInput {
  angebotNummer?: string;        // Referenz auf Angebot
  rechnungNummer: string;        // Sequential, GoBD-required
  leistungsdatum: string;        // ISO date, required for Rechnung
  leistungszeitraum?: {
    von: string;
    bis: string;
  };
}

export interface RechnungResult {
  rechnungNummer: string;
  pdfBuffer: Buffer;
  nettoSumme: number;
  ustBetrag: number;
  bruttoSumme: number;
  faelligAm: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
