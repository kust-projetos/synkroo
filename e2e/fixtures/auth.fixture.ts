import { test as base, expect } from '@playwright/test'
import path from 'path'
const AUTH_FILE = path.join(__dirname, '..', '.auth', 'admin.json')
export const authenticatedTest = base.extend({ storageState: AUTH_FILE })
export { expect }
