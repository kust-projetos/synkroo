import { Skeleton } from '@/components/ui/skeleton'

export default function CampanhasLoading() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-28 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border p-6">
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-4 w-24 mb-4" />
            <div className="flex justify-between">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
