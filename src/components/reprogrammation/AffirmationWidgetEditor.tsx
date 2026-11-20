'use client'

import { useLayoutEffect, useRef } from 'react'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Moon, Smartphone, Sun, X } from 'lucide-react'
import Link from 'next/link'
import useAffirmationWidget from '@/hooks/useAffirmationWidget'
import { REPROG_CATEGORIES } from '@/lib/constants/reprogrammation'
import { widgetTextKey, WIDGET_MAX_ITEMS, type WidgetItem } from '@/lib/affirmation-widget'
import AffirmationWidgetPreview from './AffirmationWidgetPreview'
import styles from './AffirmationWidgetEditor.module.css'

export default function AffirmationWidgetEditor() {
  const editor = useAffirmationWidget()
  const locked = editor.busy || editor.refreshingNative || !editor.ready
  const selection = useRef<HTMLDivElement>(null)
  const selectionTitle = useRef<HTMLHeadingElement>(null)
  const draftStatus = useRef<HTMLDivElement>(null)
  const nativeAlert = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<number | 'native' | 'saved' | null>(null)
  useLayoutEffect(() => {
    if (locked || pendingFocus.current === null) return
    const destination = pendingFocus.current
    pendingFocus.current = null
    if (typeof destination === 'number') {
      const buttons = selection.current?.querySelectorAll('button')
      const next = buttons?.[Math.min(destination, buttons.length - 1)]
      ;(next ?? selectionTitle.current)?.focus()
    } else {
      const alert = destination === 'native' && editor.nativeError ? nativeAlert.current : null
      ;(alert ?? draftStatus.current ?? selectionTitle.current)?.focus()
    }
  }, [locked, editor.selected, editor.dirty, editor.nativeError])
  const removeSelected = (item: WidgetItem, index: number) => {
    if (locked) return
    pendingFocus.current = index
    editor.toggle(item)
  }
  const nativeAction = (action: () => Promise<void>) => {
    pendingFocus.current = 'native'
    void action()
  }
  const mobileTitle = !editor.ready ? 'Connexion au téléphone…' : editor.nativeError
    ? 'État du widget à vérifier' : editor.platform === 'web'
      ? 'À configurer dans l’application mobile' : 'Widget indisponible dans cette version'
  const mobileDescription = editor.nativeError
    ? 'Ta sélection en cours reste affichée. Réessaie la connexion pour vérifier ce qui est enregistré.'
    : editor.platform === 'web'
      ? 'Cet aperçu fonctionne dans le navigateur. Pour enregistrer le widget, ouvre cette page dans la version mobile MUKTI qui inclut cette fonction.'
      : 'Cette version mobile ne fournit pas encore le widget, ou le téléphone ne le prend pas en charge.'
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/dashboard/subconscient" className={styles.back}><ArrowLeft size={18} /> Affirmations</Link>
      <span className={styles.brand}>MUKTI <span>/</span> PURAMA</span>
    </header>
    <div className={styles.intro}>
      <div className={styles.eyebrow}><span /> ÉCRAN VERROUILLÉ</div>
      <h1>Un mot doux.<br /><em>Au bon moment.</em></h1>
      <p>Des pensées que tu choisis, à retrouver dans ta journée.<br className={styles.desktopBreak} /> Un petit espace de calme, à ton rythme.</p>
    </div>
    <div className={styles.workspace}>
      <div className={styles.previewColumn}>
        <AffirmationWidgetPreview items={editor.selected} cadence={editor.cadence} />
        <div className={styles.offline}><span /> Les phrases enregistrées restent lisibles dans le widget hors connexion.</div>
      </div>
      <section className={styles.editor} aria-label="Personnaliser mon widget" aria-busy={!editor.ready}>
        <div className={styles.sectionHeading}><span className={styles.step}>01</span><h2>Choisis ton rythme</h2></div>
        <fieldset className={styles.cadence} disabled={locked}>
          <legend className={styles.srOnly}>Fréquence des affirmations</legend>
          <label className={editor.cadence === 'daily' ? styles.chosen : ''}>
            <input type="radio" name="cadence" value="daily" checked={editor.cadence === 'daily'} onChange={() => editor.setCadence('daily')} />
            <Moon size={20} /><span><strong>Chaque jour</strong><small>Une phrase pour la journée</small></span>
          </label>
          <label className={editor.cadence === 'moments' ? styles.chosen : ''}>
            <input type="radio" name="cadence" value="moments" checked={editor.cadence === 'moments'} onChange={() => editor.setCadence('moments')} />
            <Sun size={20} /><span><strong>Trois moments</strong><small>Matin, après-midi et soir</small></span>
          </label>
        </fieldset>
        <p className={styles.hint}>{editor.cadence === 'moments' ? 'Prévu à 7 h, 13 h et 20 h, selon l’heure du téléphone.' : 'La sélection avance chaque jour, selon la date du téléphone.'} Le système peut décaler l’actualisation.</p>
        <div className={styles.sectionHeading}><span className={styles.step}>02</span><h2>Garde les mots qui te parlent</h2></div>
        <div className={styles.filters}>
          <label>Explorer un thème<select value={editor.category} onChange={event => editor.explore(event.target.value, editor.locale)} disabled={locked}>
            {REPROG_CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select></label>
          <label>Langue du catalogue<select value={editor.locale} onChange={event => editor.explore(editor.category, event.target.value as 'fr' | 'en')} disabled={locked}>
            <option value="fr">Français</option><option value="en">English</option>
          </select></label>
        </div>
        <div className={styles.catalogue} role="group" aria-label="Affirmations du catalogue" aria-busy={editor.loading}>
          {editor.loading ? <p className={styles.empty} role="status">Le catalogue arrive…</p>
            : editor.catalogue.length === 0 ? <p className={styles.empty}>Aucune phrase courte disponible pour ce choix. Essaie un autre thème ou une autre langue.</p>
              : editor.catalogue.map(item => {
                const knownId = editor.selected.some(value => value.id === item.id)
                const selected = editor.selected.some(value => widgetTextKey(value.text) === widgetTextKey(item.text))
                return <label key={item.id} className={selected ? styles.selectedRow : styles.row}>
                  <input type="checkbox" checked={selected} disabled={locked || (!knownId && !selected && editor.selected.length >= WIDGET_MAX_ITEMS)} onChange={() => editor.toggle(item)} />
                  <span>{item.text}</span>{selected && <Check size={17} aria-hidden="true" />}
                </label>
              })}
        </div>
        <div className={styles.selectionHeader}><h3 id="widget-selection-title" ref={selectionTitle} tabIndex={-1}>Ma sélection <span>{editor.selected.length} / {WIDGET_MAX_ITEMS}</span></h3>
          {!editor.loading && <button onClick={editor.retry} disabled={locked}>Actualiser le catalogue</button>}
        </div>
        {editor.selected.length ? <div ref={selection} className={styles.selection} role="group" aria-labelledby="widget-selection-title">
          {editor.selected.map((item, index) => <div key={item.id}><p>{item.text}</p><button type="button" aria-label={`Retirer : ${item.text}`} onClick={() => removeSelected(item, index)} disabled={locked}><X size={15} aria-hidden="true" /></button></div>)}
        </div> : <p className={styles.hint}>Choisis au moins une affirmation pour préparer ton widget.</p>}
        <p className={styles.hint}>Les phrases viennent du catalogue MUKTI. Ton journal et tes affirmations personnelles restent dans l’application.</p>
        {editor.native.supported && <div ref={draftStatus} tabIndex={-1} className={styles.draftStatus} role="status">
          <strong>{editor.busy ? 'Vérification en cours…' : editor.nativeError ? 'État enregistré à vérifier' : editor.dirty ? 'Modifications non enregistrées' : editor.hasSavedSelection ? 'Sélection à jour sur le téléphone' : 'Aucune sélection enregistrée'}</strong>
          <p>{editor.nativeError ? 'Le téléphone n’a pas confirmé la dernière opération. L’aperçu et la dernière sélection vérifiée restent affichés.' : editor.dirty ? 'L’aperçu montre tes changements. Enregistre-les pour modifier ton widget.' : editor.hasSavedSelection ? 'Le rythme et les phrases correspondent à la dernière sélection vérifiée.' : 'Choisis tes phrases, puis enregistre-les sur ce téléphone.'}</p>
          {editor.dirty && editor.hasSavedSelection && <button type="button" className={styles.secondary} disabled={locked}
            onClick={() => { pendingFocus.current = 'saved'; editor.restoreSaved() }}>Revenir à la sélection enregistrée</button>}
        </div>}
        {editor.error && <p role="alert" className={styles.error}>{editor.error}</p>}
        {editor.nativeError && <div ref={nativeAlert} tabIndex={-1} role="alert" className={styles.error}>
          <p>{editor.nativeError}</p>
          <button type="button" className={styles.secondary} disabled={locked} onClick={() => nativeAction(editor.refreshNative)}>Réessayer la connexion au téléphone</button>
        </div>}
        {editor.notice && <p role="status" className={styles.notice}>{editor.notice}</p>}
        <div className={styles.actions}>
          {editor.native.supported ? <>
            <button type="button" className={styles.primary} disabled={locked || !editor.selected.length || !editor.dirty} onClick={() => nativeAction(editor.save)}>
              {editor.busy ? 'Vérification sur le téléphone…' : 'Enregistrer ma sélection'}<ArrowUpRight size={18} />
            </button>
            {editor.platform === 'android' && editor.hasSavedSelection && <button type="button" className={styles.secondary} disabled={locked || !editor.canPin} onClick={() => nativeAction(editor.pin)}>Ajouter à mon écran d’accueil</button>}
            {editor.native.configured && <button type="button" className={styles.clear} disabled={locked} onClick={() => nativeAction(editor.clear)}>Retirer la sélection du téléphone</button>}
            <p className={styles.hint}>{editor.nativeError ? 'La présence du widget reste à vérifier sur ce téléphone.' : editor.native.installed ? 'Un widget MUKTI est ajouté sur ce téléphone.' : 'L’ajout du widget se fait ensuite dans les réglages de ton écran.'}</p>
            <button type="button" className={styles.clear} disabled={locked} onClick={() => nativeAction(editor.refreshNative)}>{editor.refreshingNative ? 'Lecture du téléphone…' : 'Actualiser l’état du téléphone'}</button>
          </> : <div className={styles.mobileNotice}><Smartphone size={24} aria-hidden="true" /><p><strong>{mobileTitle}</strong><span>{mobileDescription}</span></p></div>}
        </div>
        <details className={styles.instructions}>
          <summary>Comment l’ajouter à mon écran ?<ChevronRight size={18} /></summary>
          <h3>Sur iPhone · iOS 16 ou plus récent</h3>
          <ol><li>Enregistre ta sélection dans l’application mobile MUKTI.</li><li>Maintiens le doigt sur l’écran verrouillé, puis choisis <strong>Personnaliser</strong>.</li><li>Touche la zone des widgets, puis ajoute <strong>MUKTI · Affirmations</strong>.</li></ol>
          <h3>Sur Android</h3>
          <p>Après enregistrement, utilise <strong>Ajouter à mon écran d’accueil</strong> si ton téléphone le permet, puis confirme la demande du système. Tu peux aussi maintenir le doigt sur une zone libre de l’accueil, ouvrir <strong>Widgets</strong> et ajouter <strong>MUKTI · Affirmations</strong>. L’ajout à l’écran verrouillé dépend du téléphone et de sa version Android.</p>
          <p>Un appui sur le widget retrouve ces réglages. Pour retirer le widget lui-même, utilise les commandes de ton téléphone.</p>
        </details>
      </section>
    </div>
  </div>
}
