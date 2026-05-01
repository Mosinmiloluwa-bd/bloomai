import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Crisis from './Crisis';

describe('Crisis page', () => {
  it('renders the Nigeria pilot support resources', () => {
    render(
      <MemoryRouter>
        <Crisis />
      </MemoryRouter>,
    );

    expect(screen.getByText(/asido/i)).toBeInTheDocument();
    expect(screen.getByText(/surpin/i)).toBeInTheDocument();
    expect(screen.getByText(/befrienders worldwide/i)).toBeInTheDocument();
  });
});
