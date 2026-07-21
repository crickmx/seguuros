import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Prospect } from '../types/database';

interface ProspectCardProps {
  prospect: Prospect;
  onClick: () => void;
}

export function ProspectCard({ prospect, onClick }: ProspectCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: prospect.id
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab'
  };

  const priorityColors = {
    alta: '#EF4444',
    media: '#F59E0B',
    baja: '#65EA1E'
  };

  const originLabels = {
    whatsapp: '💬 WhatsApp',
    web: '🌐 Web',
    referido: '👥 Referido',
    otro: '📋 Otro'
  };

  const timeSinceActivity = getTimeSinceActivity(prospect.last_activity_at);
  const isStale = new Date(prospect.last_activity_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? '' : 'card-premium'}
      style={{
        ...style,
        padding: '16px',
        boxShadow: isDragging ? '0 12px 40px rgba(32, 40, 86, 0.25)' : undefined,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        borderLeft: '3px solid',
        borderLeftColor: priorityColors[prospect.priority || 'baja']
      }}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          onClick();
        }
      }}
    >
      {prospect.priority && (
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            right: '12px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: priorityColors[prospect.priority],
            border: '2px solid #FFFFFF'
          }}
        />
      )}

      <h4 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '6px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em'
      }}>
        {prospect.full_name}
      </h4>

      {prospect.product_interest && (
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {prospect.product_interest}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {prospect.phone && (
          <a
            href={`https://wa.me/${prospect.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: '12px',
              color: 'var(--green-accent)',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '8px',
              background: 'rgba(101, 234, 30, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(101, 234, 30, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(101, 234, 30, 0.1)')}
          >
            💬
          </a>
        )}
        {prospect.email && (
          <a
            href={`mailto:${prospect.email}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: '12px',
              color: 'var(--teal)',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '8px',
              background: 'rgba(1, 126, 123, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(1, 126, 123, 0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(1, 126, 123, 0.1)')}
          >
            ✉️
          </a>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
        <span style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontWeight: 500
        }}>
          {originLabels[prospect.origin]}
        </span>

        <span style={{
          color: isStale ? '#EF4444' : 'var(--text-muted)',
          fontWeight: isStale ? 600 : 500,
          fontSize: '11px'
        }}>
          {timeSinceActivity}
        </span>
      </div>
    </div>
  );
}

function getTimeSinceActivity(dateString: string): string {
  const now = new Date();
  const activityDate = new Date(dateString);
  const diffMs = now.getTime() - activityDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)}sem`;
  return `Hace ${Math.floor(diffDays / 30)}mes`;
}
