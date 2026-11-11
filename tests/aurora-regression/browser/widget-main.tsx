import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AffirmationWidgetEditor from '../../../src/components/reprogrammation/AffirmationWidgetEditor'
import './styles.css'

// Real component; tests explicitly provide synthetic API fixtures. No live account or native success is implied.
createRoot(document.getElementById('root')!).render(<StrictMode><AffirmationWidgetEditor /></StrictMode>)
