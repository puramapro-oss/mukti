'use client';

import { useState } from 'react';
import AccountDeletionButton from './AccountDeletionButton';

export interface LegalAcceptanceRow {
  docType: string;
  version: string;
  acceptedAt: string;
}

export interface MaMemoirePageProps {
  appName: string;
  acceptations: LegalAcceptanceRow[];
  /** true si une suppression est déjà programmée (compte en période de grâce). */
  deletionScheduledFor?: string | null;
  exportEndpoint?: string;
  deleteEndpoint?: string;
  cancelDeleteEndpoint?: string;
}

const DOC_LABELS: Record<string, string> = {
  mentions: 'Mentions légales',
  cgu: 'CGU',
  cgv: 'CGV',
  confidentialite: 'Politique de confidentialité',
};

/**
 * Page « Ma mémoire » (NIYAMA-BRIEF.md §1) : voir/exporter/effacer ses données (RGPD art.
 * 15/17/20). Toute app copie ce fichier et le monte sur sa route `(dashboard)/ma-memoire`,
 * en lui passant les acceptations légales de l'utilisateur courant (lues côté serveur).
 */
export default function MaMemoirePage({
  appName,
  acceptations,
  deletionScheduledFor,
  exportEndpoint = '/api/legal/my-data',
  deleteEndpoint = '/api/account/delete',
  cancelDeleteEndpoint = '/api/account/delete',
}: MaMemoirePageProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(exportEndpoint);
      if (!res.ok) throw new Error(`Export impossible (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mes-donnees.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "L'export a échoué, réessayez.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="ma-memoire-page">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)]">Ma mémoire</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Consultez, exportez ou effacez les données que {appName} conserve à votre sujet.
        </p>
      </header>

      <section className="glass space-y-3 rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Exporter mes données</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Téléchargez une copie complète de vos données au format JSON (droit à la portabilité, art. 20 RGPD).
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="min-h-11 rounded-full bg-[var(--cyan)] px-5 text-sm font-medium text-black disabled:opacity-60"
        >
          {exporting ? 'Préparation…' : 'Exporter mes données (JSON)'}
        </button>
        {exportError && <p className="text-sm text-red-400">{exportError}</p>}
      </section>

      <section className="glass space-y-3 rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Mes acceptations légales</h2>
        {acceptations.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Aucune acceptation enregistrée.</p>
        ) : (
          <ul className="text-sm space-y-1 text-[var(--text-secondary)]">
            {acceptations.map((a) => (
              <li key={`${a.docType}-${a.version}`}>
                {DOC_LABELS[a.docType] ?? a.docType} — version {a.version} acceptée le{' '}
                {new Date(a.acceptedAt).toLocaleString('fr-FR')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass space-y-3 rounded-3xl border border-red-500/20 p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Supprimer mon compte</h2>
        <p className="text-sm text-[var(--text-muted)]">
          La suppression efface vos données personnelles et votre historique, sous réserve des obligations légales
          de conservation (comptable, fiscale).
        </p>
        <AccountDeletionButton
          deletionScheduledFor={deletionScheduledFor}
          deleteEndpoint={deleteEndpoint}
          cancelEndpoint={cancelDeleteEndpoint}
        />
      </section>
    </div>
  );
}
