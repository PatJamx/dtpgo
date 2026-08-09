import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterForm from './RegisterForm';

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      programs: [{ id: 'prog-1', name: 'BSIT', displayName: 'Bachelor of Science in Information Technology' }],
    }),
  }) as jest.Mock;
});

describe('RegisterForm', () => {
  it('does not show a success state when the submit handler does not return a created student id', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <RegisterForm
        onSubmit={onSubmit}
        isSubmitting={false}
        initialData={{
          studentIdNumber: '12345',
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          email: 'juan.delacruz@gmail.com',
          year: 1,
          programId: 'prog-1',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Juan')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /register student/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/registration successful/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register student/i })).toBeInTheDocument();
  });
});
