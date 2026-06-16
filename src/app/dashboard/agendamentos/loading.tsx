import { Skeleton } from '@/components/ui/skeleton'

export default function AgendamentosLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Shell skeleton: header + summary bar + grid */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-36 mb-1" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      {/* Summary bar skeleton */}
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>

      {/* Calendar grid skeleton */}
      <Skeleton className="h-[500px] w-full rounded-xl" />
    </div>
  )
}
