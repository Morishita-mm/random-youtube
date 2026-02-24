import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders title and input field', () => {
    render(<App />);
    expect(screen.getByText('YouTube Random Player')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Channel URL, handle (@...) or ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });
});
