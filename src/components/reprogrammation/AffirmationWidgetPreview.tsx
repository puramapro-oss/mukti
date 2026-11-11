'use client'

import { useEffect, useState } from 'react'
import { currentWidgetItem, type WidgetCadence, type WidgetItem } from '@/lib/affirmation-widget'
import styles from './AffirmationWidgetEditor.module.css'

export default function AffirmationWidgetPreview({ items, cadence }: { items: WidgetItem[]; cadence: WidgetCadence }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const update = () => setNow(new Date())
    update()
    const timer = setInterval(update, 30_000)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [])
  const item = now && items.length ? currentWidgetItem({ schemaVersion: 1, items, cadence, configuredAt: now.toISOString() }, now) : null
  return <figure className={styles.preview} aria-label="Aperçu de l’affirmation sur un écran verrouillé">
    <div className={styles.sky} aria-hidden="true"><i /><i /><i /></div>
    <div className={styles.previewTop}>
      <span className={styles.previewDate}>{now?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) ?? 'Ton moment de calme'}</span>
      <span className={styles.clock} aria-hidden="true">{now?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? '09:41'}</span>
      <div className={styles.widget}>
        <span className={styles.widgetLabel}>MUKTI · une pensée pour toi</span>
        <p data-testid="widget-preview-text">{item?.text ?? 'Choisis les mots que tu aimerais retrouver.'}</p>
      </div>
    </div>
    <figcaption className={styles.previewCaption}>Aperçu illustratif<br />Le téléphone adapte la taille et le rendu.</figcaption>
  </figure>
}
