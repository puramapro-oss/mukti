import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AffirmationWidgetEditor from '../../../src/components/reprogrammation/AffirmationWidgetEditor'
import AccessibilityPreferencesRoot from '../../../src/components/shared/AccessibilityPreferencesRoot'
import './styles.css'
import '../../../src/app/accessibility.css'

// Real component; tests explicitly provide synthetic API fixtures. No live account or native success is implied.
createRoot(document.getElementById('root')!).render(<StrictMode><AccessibilityPreferencesRoot /><AffirmationWidgetEditor /></StrictMode>)
