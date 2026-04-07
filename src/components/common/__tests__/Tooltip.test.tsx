import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../Tooltip';

describe('Tooltip Component', () => {
    it('renders the children correctly', () => {
        render(
            <Tooltip content="Helper text">
                <button>Hover me</button>
            </Tooltip>
        );
        expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('shows the tooltip content when hovered and hides when unhovered', () => {
        render(
            <Tooltip content="Hover helper text">
                <span data-testid="tooltip-trigger">Target</span>
            </Tooltip>
        );

        const trigger = screen.getByTestId('tooltip-trigger').parentElement!;
        
        // Tooltip text should NOT be in the DOM initially
        expect(screen.queryByText('Hover helper text')).not.toBeInTheDocument();

        // Hover
        fireEvent.mouseEnter(trigger);
        expect(screen.getByText('Hover helper text')).toBeInTheDocument();

        // Unhover
        fireEvent.mouseLeave(trigger);
        expect(screen.queryByText('Hover helper text')).not.toBeInTheDocument();
    });
});

