"use client"

import { ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  keyExtractor: (row: T) => string
}

export function DataTable<T>({ columns, data, loading = false, emptyMessage = "Nenhum resultado encontrado", keyExtractor }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>{columns.map((col) => <TableHead key={col.key} className={col.className}>{col.header}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{columns.map((col) => <TableCell key={col.key} className={col.className}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (data.length === 0) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>{columns.map((col) => <TableHead key={col.key} className={col.className}>{col.header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={keyExtractor(row)}>{columns.map((col) => <TableCell key={col.key} className={col.className}>{col.cell(row)}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
