import { Skeleton } from '@/components/ui/skeleton'

export default function DentistasLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-28 mb-1" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <Skeleton className="h-10 w-full rounded-lg" />

      <div className="rounded-xl border border-border">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-border last:border-0">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
