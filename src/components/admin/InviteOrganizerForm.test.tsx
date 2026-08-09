import { render, screen, waitFor } from '@testing-library/react'
import { InviteOrganizerForm } from './InviteOrganizerForm'
import { useAuth } from '@/hooks/use-auth'

jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}))

describe('InviteOrganizerForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    })
  })

  it('renders the invite form when there are no events available', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1', email: 'admin@example.com' },
      loading: false,
    })

    render(<InviteOrganizerForm />)

    await waitFor(() => {
      expect(screen.getByText('Invite Organizer')).toBeInTheDocument()
    })

    expect(screen.queryByText('Loading events...')).not.toBeInTheDocument()
  })
})
