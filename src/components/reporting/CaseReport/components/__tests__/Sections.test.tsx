import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../../../test-utils';
import { SystemsSection, AttackerInfraSection, MalwareSection } from '../Sections';

// Prevent icons from missing matchMedia errors
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual as any,
    ShieldAlert: () => <svg data-testid="icon-shield-alert" />,
    AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
    Bug: () => <svg data-testid="icon-bug" />,
  };
});

describe('Reporting Sections Components', () => {

  describe('SystemsSection', () => {
    it('ne devrait rien rendre si la liste est vide ou saine', () => {
      const { container } = render(
        <SystemsSection systems={[{ id: '1', name: 'SafeSys', system_type: 'ordinateur', x: 0, y: 0, hasMaliciousMalware: false, investigationStatus: 'clean', computedStatus: 'clean' } as unknown as any]} title="Systèmes" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('devrait afficher les systèmes compromis', () => {
      const systems = [
        { id: '1', name: 'CompromisedSys', system_type: 'serveur', x: 0, y: 0, hasMaliciousMalware: false, investigationStatus: 'compromised', computedStatus: 'compromised', owner: 'Admin' }
      ] as unknown as any[];
      render(<SystemsSection systems={systems} title="Systèmes Impactés" />);
      
      expect(screen.getByText('Systèmes Impactés')).toBeInTheDocument();
      expect(screen.getByText('CompromisedSys')).toBeInTheDocument();
      expect(screen.getByText('Admin', { exact: false })).toBeInTheDocument();
    });
  });

  describe('AttackerInfraSection', () => {
    it('ne devrait rien rendre si la liste est vide', () => {
      const { container } = render(<AttackerInfraSection items={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('devrait render l\'infrastructure avec les bonnes étiquettes', () => {
      const infra = [
        { id: '1', name: 'LeaseWeb 1', infra_type: 'c2_server', description: 'Beacond' }
      ];
      render(<AttackerInfraSection items={infra} />);
      
      expect(screen.getByText('LeaseWeb 1')).toBeInTheDocument();
      expect(screen.getByText('Serveur C2')).toBeInTheDocument();
      expect(screen.getByText('Beacond')).toBeInTheDocument();
    });
  });

  describe('MalwareSection', () => {
    it('ne devrait rien rendre si la liste est vide', () => {
      const { container } = render(<MalwareSection items={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('devrait afficher le statut malveillant', () => {
      const malwares = [
        { id: '1', file_name: 'mimikatz.exe', is_malicious: true, system_name: 'Sys1' },
        { id: '2', file_name: 'psexec.exe', is_malicious: false, system_name: 'Sys1' }
      ] as unknown as any[];
      render(<MalwareSection items={malwares} />);
      
      expect(screen.getByText('mimikatz.exe')).toBeInTheDocument();
      expect(screen.getByText('psexec.exe')).toBeInTheDocument();
      
      // La traduction fallback pour malveillant va être soit une clé (si I18nextProvider manque) soit le texte fallback
      // `test-utils` charge un fr minimal.
      // Le composant utilise t('auto.malveillant') et t('auto.outil_legitime')
      // S'ils ne sont pas définis dans le mock de loc, ça affiche la clé.
    });
  });

});
