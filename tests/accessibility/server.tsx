import { renderToString } from 'react-dom/server'
import Fixture from './Fixture'
export function render() { return renderToString(<Fixture />) }
