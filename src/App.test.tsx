import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders title, input field, and settings button', () => {
    render(<App />);
    expect(screen.getByText('YouTube Random Player')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add Channel URLs or IDs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });
});
