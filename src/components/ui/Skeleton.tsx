import { cn } from '@/lib/utils'

interface SkeletonProps { className?: string }

export default function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton h-4 w-full', className)} />
}
