import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { EmailDetailModal } from './Email/EmailDetailModal';

interface ActivityItem {
  id: string;
  entity_type: 'prospect' | 'client';
  entity_id: string;
  event_type: 'whatsapp' | 'email' | 'note' | 'followup' | 'status_change' | 'system' | 'policy';
  direction?: 'inbound' | 'outbound';
  title: string;
  description?: string;
  preview?: string;
  metadata: Record<string, any>;
  source_table?: string;
  source_id?: string;
  created_by?: string;
  created_at: string;
  creator_name?: string;
}

interface UnifiedTimelineProps {
  entityType: 'prospect' | 'client';
  entityId: string;
}

const EVENT_TYPE_CONFIG = {
  whatsapp: { icon: '💬', label: 'WhatsApp', color: 'bg-green-100 text-green-800' },
  email: { icon: '📧', label: 'Email', color: 'bg-blue-100 text-blue-800' },
  note: { icon: '📝', label: 'Nota', color: 'bg-gray-100 text-gray-800' },
  followup: { icon: '⏰', label: 'Seguimiento', color: 'bg-yellow-100 text-yellow-800' },
  status_change: { icon: '🔄', label: 'Cambio de estatus', color: 'bg-purple-100 text-purple-800' },
  system: { icon: '⚙️', label: 'Sistema', color: 'bg-indigo-100 text-indigo-800' },
  policy: { icon: '📋', label: 'Póliza', color: 'bg-orange-100 text-orange-800' },
};

export const UnifiedTimeline: React.FC<UnifiedTimelineProps> = ({ entityType, entityId }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();

    const channel = supabase
      .channel('activity-feed-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_feed',
          filter: `entity_id=eq.${entityId}`,
        },
        () => {
          loadActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId, filterType]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading activities for:', { entityType, entityId, filterType });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('❌ No valid session found, refreshing...');
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();

        if (!refreshedSession) {
          console.error('❌ Failed to refresh session');
          setActivities([]);
          return;
        }
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        console.error('❌ No session available');
        setActivities([]);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-unified-activity`;
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
        ...(filterType !== 'all' && { event_type: filterType }),
      });

      console.log('📡 Fetching:', `${apiUrl}?${params}`);

      const response = await fetch(`${apiUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to fetch activities:', errorData);
        throw new Error('Failed to fetch activities');
      }

      const responseData = await response.json();
      console.log('✅ Activities received:', responseData);

      setActivities(responseData.activities || []);
    } catch (error) {
      console.error('💥 Error loading activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleEmailClick = (activity: ActivityItem) => {
    if (activity.event_type === 'email' && activity.source_id) {
      setSelectedEmailId(activity.source_id);
    }
  };

  const filteredActivities = activities.filter((activity) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        activity.title.toLowerCase().includes(searchLower) ||
        activity.description?.toLowerCase().includes(searchLower) ||
        activity.preview?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      {selectedEmailId && (
        <EmailDetailModal
          emailId={selectedEmailId}
          onClose={() => setSelectedEmailId(null)}
        />
      )}
      <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Buscar en historial..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>

      {filteredActivities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No hay actividad registrada</p>
          <p className="text-gray-400 text-sm mt-2">
            {searchTerm
              ? 'No se encontraron resultados para tu búsqueda'
              : 'Cuando ocurran eventos, aparecerán aquí'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((activity) => {
            const config = EVENT_TYPE_CONFIG[activity.event_type];
            const isExpanded = expandedItems.has(activity.id);
            const hasExpandableContent = activity.description || activity.metadata;

            return (
              <div
                key={activity.id}
                className="relative pl-8 pb-6 border-l-2 border-gray-200 last:border-0 last:pb-0"
              >
                <div className="absolute left-0 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-lg">
                  {config.icon}
                </div>

                <div
                  className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${
                    activity.event_type === 'email' ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => activity.event_type === 'email' && handleEmailClick(activity)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        {activity.direction && (
                          <span className="text-xs text-gray-500">
                            {activity.direction === 'inbound' ? '← Entrante' : '→ Saliente'}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        {activity.title}
                      </h4>

                      {activity.preview && !isExpanded && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {activity.preview}
                        </p>
                      )}

                      {isExpanded && activity.description && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {activity.description}
                          </p>
                        </div>
                      )}

                      {isExpanded && activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-md">
                          <h5 className="text-xs font-semibold text-gray-700 mb-2">Detalles:</h5>
                          <dl className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <div key={key}>
                                <dt className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</dt>
                                <dd className="text-gray-700 font-medium">{String(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{formatDate(activity.created_at)}</span>
                        {activity.creator_name && (
                          <span>por {activity.creator_name}</span>
                        )}
                      </div>
                    </div>

                    {hasExpandableContent && (
                      <button
                        onClick={() => toggleExpand(activity.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </>
  );
};
