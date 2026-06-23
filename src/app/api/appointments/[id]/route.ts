import { NextRequest, NextResponse } from 'next/server'
import { withModuleRoute } from '@/core/modules/gates'
import { moduleManifest } from '@/core/modules/manifest'
import { runActionRoute } from '@/modules/operacional/ui/route-adapter'
import { obterConsulta } from '@/modules/operacional/actions/obter-consulta'
import { atualizarConsulta } from '@/modules/operacional/actions/atualizar-consulta'
import { cancelarConsulta } from '@/modules/operacional/actions/cancelar-consulta'

const OPERACIONAL_MODULE = 'operacional'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function handleGET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  return runActionRoute(obterConsulta, { id })
}

async function handlePUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json()
  return runActionRoute(atualizarConsulta, { id, ...body })
}

async function handlePATCH(request: NextRequest, ctx: RouteParams) {
  return handlePUT(request, ctx)
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleGET)
const wrappedPUT = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePUT)
const wrappedPATCH = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handlePATCH)

export function GET(request: NextRequest, ctx: RouteParams) {
  return wrappedGET(request as any, ctx as any)
}
export function PUT(request: NextRequest, ctx: RouteParams) {
  return wrappedPUT(request as any, ctx as any)
}
export function PATCH(request: NextRequest, ctx: RouteParams) {
  return wrappedPATCH(request as any, ctx as any)
}

async function handleDELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  return runActionRoute(cancelarConsulta, { id })
}

const wrappedDELETE = withModuleRoute(OPERACIONAL_MODULE, moduleManifest)(handleDELETE)

export function DELETE(request: NextRequest, ctx: RouteParams) {
  return wrappedDELETE(request as any, ctx as any)
}
