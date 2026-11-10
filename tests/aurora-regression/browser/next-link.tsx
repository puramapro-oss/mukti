import type { ComponentProps } from 'react'
// Only routing is adapted for this component harness; product components remain unchanged.
export default function HarnessLink(props: ComponentProps<'a'>) { return <a {...props} /> }
