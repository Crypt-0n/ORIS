import type { DiamondNode as DiamondNodeType } from '../../lib/diamondModelUtils';

interface DiamondNodeProps {
  node: DiamondNodeType;
  isSelected: boolean;
  isDragging?: boolean;
  onClick: () => void;
  index: number;
}

const SIZE = 72;

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function DiamondNodeComponent({ node, isSelected, isDragging, onClick, index }: DiamondNodeProps) {
  const color = node.killChainHexColor;

  const hasAdversary = node.axes.adversary.length > 0;
  const hasInfra = node.axes.infrastructure.length > 0;
  const hasCapability = node.axes.capability.length > 0;
  const hasVictim = node.axes.victim.length > 0;

  const dotColor = (filled: boolean) =>
    filled ? color : '#94a3b8';

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center cursor-pointer select-none transition-transform duration-150 ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-105'}`}
      style={{ minWidth: 140 }}
    >
      <div className="relative" style={{ width: SIZE * 2, height: SIZE * 2 }}>
        <svg
          width={SIZE * 2}
          height={SIZE * 2}
          viewBox={`0 0 ${SIZE * 2} ${SIZE * 2}`}
          className="overflow-visible"
        >
          <defs>
            <filter id={`glow-${node.id}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <polygon
            points={`${SIZE},4 ${SIZE * 2 - 4},${SIZE} ${SIZE},${SIZE * 2 - 4} 4,${SIZE}`}
            fill={`${color}18`}
            stroke={isSelected ? color : `${color}80`}
            strokeWidth={isSelected ? 2.5 : 1.5}
            filter={isSelected ? `url(#glow-${node.id})` : undefined}
          />

          <line
            x1={SIZE} y1="4"
            x2={SIZE} y2={SIZE * 2 - 4}
            stroke={`${color}40`}
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <line
            x1="4" y1={SIZE}
            x2={SIZE * 2 - 4} y2={SIZE}
            stroke={`${color}40`}
            strokeWidth="1"
            strokeDasharray="3,3"
          />

          <text
            x={SIZE}
            y={14}
            textAnchor="middle"
            fontSize="7"
            fontWeight="600"
            fill={dotColor(hasAdversary)}
            className="font-mono"
          >
            ADV
          </text>
          <circle
            cx={SIZE}
            cy={22}
            r={3.5}
            fill={dotColor(hasAdversary)}
          />

          <text
            x={SIZE * 2 - 8}
            y={SIZE - 4}
            textAnchor="end"
            fontSize="7"
            fontWeight="600"
            fill={dotColor(hasInfra)}
          >
            INFRA
          </text>
          <circle
            cx={SIZE * 2 - 16}
            cy={SIZE + 4}
            r={3.5}
            fill={dotColor(hasInfra)}
          />

          <text
            x={8}
            y={SIZE - 4}
            textAnchor="start"
            fontSize="7"
            fontWeight="600"
            fill={dotColor(hasCapability)}
          >
            CAP
          </text>
          <circle
            cx={16}
            cy={SIZE + 4}
            r={3.5}
            fill={dotColor(hasCapability)}
          />

          {/* Kill chain phase label on Capability axis */}
          <foreignObject x={-50} y={SIZE + 10} width={60} height={30}>
            <div
              style={{
                fontSize: '6px',
                lineHeight: '1.3',
                color: color,
                fontWeight: 600,
                textAlign: 'right',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
              }}
              title={node.killChainPhaseLabel}
            >
              {node.killChainPhaseLabel}
            </div>
          </foreignObject>

          <circle
            cx={SIZE}
            cy={SIZE * 2 - 22}
            r={3.5}
            fill={dotColor(hasVictim)}
          />
          <text
            x={SIZE}
            y={SIZE * 2 - 8}
            textAnchor="middle"
            fontSize="7"
            fontWeight="600"
            fill={dotColor(hasVictim)}
          >
            VIC
          </text>

          <text
            x={SIZE}
            y={SIZE - 5}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="700"
            fill={color}
          >
            {index + 1}
          </text>

          <foreignObject x={SIZE - 28} y={SIZE + 2} width={56} height={20}>
            <div
              style={{ fontSize: '7px', lineHeight: '1.2', color: '#e2e8f0', textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
            >
              {truncate(node.label, 28)}
            </div>
          </foreignObject>
        </svg>
      </div>

      <div
        className="mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold text-white max-w-[130px] text-center truncate"
        style={{ backgroundColor: color }}
        title={node.killChainPhaseLabel}
      >
        {node.killChainPhaseLabel}
      </div>
    </div>
  );
}
