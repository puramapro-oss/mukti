import { Camera, CameraOff, Eye } from 'lucide-react'

export default function CameraLine({ icon, text }: { icon: 'on' | 'off' | 'imaginary'; text: string }) {
  const Icon = icon === 'on' ? Camera : icon === 'imaginary' ? Eye : CameraOff
  return (
    <p className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/70" />
      <span>{text}</span>
    </p>
  )
}
