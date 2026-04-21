import { APIRequestContext } from '@playwright/test'
const BASE = 'http://localhost:3003'
export async function apiGet(request: APIRequestContext, path: string) { return request.get(`${BASE}${path}`) }
export async function apiPost(request: APIRequestContext, path: string, body: Record<string, unknown>) { return request.post(`${BASE}${path}`, { data: body }) }
export async function apiPut(request: APIRequestContext, path: string, body: Record<string, unknown>) { return request.put(`${BASE}${path}`, { data: body }) }
export async function apiDelete(request: APIRequestContext, path: string) { return request.delete(`${BASE}${path}`) }
