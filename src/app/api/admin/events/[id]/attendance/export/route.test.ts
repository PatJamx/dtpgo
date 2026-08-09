import { GET as getExport } from './route'
import { GET as getApi } from '../../attendance/route'
import { NextRequest } from 'next/server'

// NOTE: This test assumes a seeded database and an existing event ID.
// Set EVENT_ID in env or replace fallback with a known seeded event id.
const EVENT_ID = process.env.TEST_EVENT_ID || process.env.EVENT_ID || ''

function buildUrl(path: string, params: Record<string, string | undefined> = {}) {
  const u = new URL('http://localhost' + path)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, v)
  }
  return u.toString()
}

describe('Attendance export parity', () => {
  if (!EVENT_ID) {
    it.skip('skipped: TEST_EVENT_ID not set', () => {})
    return
  }

  it('CSV export row count should be >= API list rows under same filters', async () => {
    const query = {
      sessions: undefined,
      statuses: undefined,
      q: undefined,
      sort: 'name',
      order: 'asc',
    }

    // Call API (paginated first page)
    const apiUrl = buildUrl(`/api/admin/events/${EVENT_ID}/attendance`, {
      ...query,
      page: '1',
      pageSize: '50',
    })
    const apiReq = new NextRequest(apiUrl)
    const apiRes = await getApi(apiReq, { params: Promise.resolve({ id: EVENT_ID }) })
    const apiJson = await apiRes.json()
    expect(apiRes.status).toBe(200)
    expect(apiJson.success).toBe(true)
    const apiRows: unknown[] = apiJson.rows

    // Call CSV export (unpaginated)
    const exportUrl = buildUrl(`/api/admin/events/${EVENT_ID}/attendance/export`, query)
    const expReq = new NextRequest(exportUrl)
    const expRes = await getExport(expReq, { params: Promise.resolve({ id: EVENT_ID }) })
    expect(expRes.status).toBe(200)
    const csvText = await (expRes as Response).text()
    const lines = csvText.trim().split('\n')
    // exclude header
    const csvRowCount = lines.length > 0 ? lines.length - 1 : 0

    expect(csvRowCount).toBeGreaterThanOrEqual(apiRows.length)
  })
})

 
