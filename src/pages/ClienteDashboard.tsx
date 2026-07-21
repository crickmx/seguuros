import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import type { Policy, Profile, Client, PolicyDocument } from '../types/database';

export function ClienteDashboard() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PoliciesView />} />
        <Route path="/help" element={<HelpView />} />
      </Routes>
    </Layout>
  );
}

function PoliciesView() {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);
  const [executive, setExecutive] = useState<Profile | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [policyDocuments, setPolicyDocuments] = useState<PolicyDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadPolicies(), loadExecutive(), loadClientData()]);
    setLoading(false);
  }

  async function loadClientData() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('owner_user_id', profile!.id)
      .maybeSingle();
    if (data) setClientData(data);
  }

  async function loadPolicies() {
    if (!clientData) {
      const { data: tempClient } = await supabase
        .from('clients')
        .select('id')
        .eq('owner_user_id', profile!.id)
        .maybeSingle();

      if (tempClient) {
        const { data } = await supabase
          .from('policies')
          .select('*')
          .eq('client_id', tempClient.id);
        if (data) setPolicies(sortPolicies(data));
      }
    } else {
      const { data } = await supabase
        .from('policies')
        .select('*')
        .eq('client_id', clientData.id);
      if (data) setPolicies(sortPolicies(data));
    }
  }

  function sortPolicies(policies: Policy[]): Policy[] {
    const statusOrder = { 'activa': 1, 'por_vencer': 2, 'vencida': 3 };
    return [...policies].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  async function loadExecutive() {
    if (profile?.assigned_executive_id) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.assigned_executive_id)
        .maybeSingle();
      if (data) setExecutive(data);
    }
  }

  function getDaysUntilDate(dateString: string): number {
    const today = new Date();
    const targetDate = new Date(dateString);
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getStatusVariant(status: string): 'success' | 'warning' | 'error' {
    switch (status) {
      case 'activa': return 'success';
      case 'por_vencer': return 'warning';
      case 'vencida': return 'error';
      default: return 'success';
    }
  }

  function getPolicyIcon(type: string): string {
    switch (type) {
      case 'auto': return '🚗';
      case 'vida': return '❤️';
      case 'gmm': return '🏥';
      case 'daños': return '🏠';
      case 'hogar': return '🏡';
      case 'empresa': return '🏢';
      default: return '📄';
    }
  }

  function getDocumentIcon(type: string): string {
    switch (type) {
      case 'poliza': return '📋';
      case 'recibo': return '🧾';
      case 'endoso': return '📝';
      case 'carta_finiquito': return '✅';
      default: return '📄';
    }
  }

  function getDocumentTypeName(type: string): string {
    switch (type) {
      case 'poliza': return 'Póliza';
      case 'recibo': return 'Recibo';
      case 'endoso': return 'Endoso';
      case 'carta_finiquito': return 'Carta de Finiquito';
      default: return 'Documento';
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async function loadPolicyDocuments(policyId: string) {
    setLoadingDocuments(true);
    const { data } = await supabase
      .from('policy_documents')
      .select('*')
      .eq('policy_id', policyId)
      .order('created_at', { ascending: false });
    if (data) setPolicyDocuments(data);
    setLoadingDocuments(false);
  }

  async function handlePolicyClick(policyId: string) {
    if (expandedPolicyId === policyId) {
      setExpandedPolicyId(null);
      setPolicyDocuments([]);
      setPreviewUrl(null);
    } else {
      setExpandedPolicyId(policyId);
      setPreviewUrl(null);
      await loadPolicyDocuments(policyId);
    }
  }

  function handlePreviewDocument(doc: PolicyDocument) {
    setPreviewUrl(doc.file_url);
  }

  function handleDownloadDocument(doc: PolicyDocument) {
    window.open(doc.file_url, '_blank');
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '250px', borderRadius: '1rem' }} />
        ))}
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div>
        <div style={{
          maxWidth: '600px',
          margin: '4rem auto',
          textAlign: 'center',
          padding: '3rem 2rem'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #F7F8FC 0%, #E6E8EF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '64px',
            margin: '0 auto 2rem'
          }}>
            📋
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
            Aún no tienes pólizas
          </h2>
          <p style={{ color: '#718096', marginBottom: '2.5rem', lineHeight: 1.8, fontSize: '1.0625rem' }}>
            Tu ejecutivo agregará tus pólizas de seguro y podrás verlas aquí. Mientras tanto, puedes contactarlo para cualquier consulta.
          </p>
          {executive && (
            <a
              href={`https://wa.me/${executive.phone?.replace(/\D/g, '')}?text=Hola, quisiera información sobre mis seguros`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 32px',
                background: '#65EA1E',
                color: '#202856',
                textDecoration: 'none',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '1rem',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(101, 234, 30, 0.25)',
                border: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(101, 234, 30, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(101, 234, 30, 0.25)';
              }}
            >
              <span style={{ fontSize: '20px' }}>💬</span>
              Hablar con mi ejecutivo
            </a>
          )}
        </div>
      </div>
    );
  }

  const clientName = clientData?.full_name || profile?.full_name || 'Cliente';
  const firstName = clientName.split(' ')[0];

  return (
    <div>
      <div style={{
        background: 'linear-gradient(135deg, #194988 0%, #017E7B 100%)',
        borderRadius: '20px',
        padding: '32px',
        marginBottom: '32px',
        boxShadow: '0 8px 24px rgba(32, 40, 86, 0.12)',
        color: '#FFFFFF'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px', color: '#FFFFFF' }}>
          Hola, {firstName}
        </h1>
        <p style={{ fontSize: '1.0625rem', opacity: 0.9, lineHeight: 1.6 }}>
          Bienvenido a tu portal de seguros
        </p>
      </div>

      <h2 style={{ fontSize: '1.375rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
        Mis Seguros
      </h2>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
        {policies.map(policy => {
          const isExpanded = expandedPolicyId === policy.id;
          const daysUntilRenewal = getDaysUntilDate(policy.end_date);

          return (
            <Card
              key={policy.id}
              style={{
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <div onClick={() => handlePolicyClick(policy.id)} style={{ padding: isExpanded ? '0 0 1rem 0' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #194988 0%, #017E7B 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    flexShrink: 0
                  }}>
                    {getPolicyIcon(policy.policy_type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.6875rem',
                      color: '#718096',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      marginBottom: '4px'
                    }}>
                      {policy.policy_type}
                    </p>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#202856', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {policy.insurance_company}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <Badge variant={getStatusVariant(policy.status)} style={{ fontSize: '0.75rem' }}>
                      {policy.status === 'activa' ? 'Activa' : policy.status === 'por_vencer' ? 'Por Renovar' : 'Vencida'}
                    </Badge>
                    <span style={{
                      fontSize: '1.25rem',
                      color: '#718096',
                      transition: 'transform 0.3s ease',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ▼
                    </span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div style={{
                  padding: '0 1rem 1rem 1rem',
                  animation: 'slideDown 0.3s ease'
                }}>
                  <div style={{
                    borderTop: '1px solid #E6E8EF',
                    paddingTop: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>Número de póliza</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#202856' }}>{policy.policy_number}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>Prima total</p>
                        <p style={{ fontSize: '1rem', fontWeight: 700, color: '#017E7B' }}>${policy.total_premium.toLocaleString('es-MX')}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>Forma de pago</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#202856', textTransform: 'capitalize' }}>{policy.payment_frequency}</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '4px' }}>Vigencia</p>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#202856' }}>
                          {new Date(policy.start_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' - '}
                          {new Date(policy.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {daysUntilRenewal <= 60 && (
                      <div style={{ marginBottom: '1rem' }}>
                        {daysUntilRenewal > 0 && daysUntilRenewal <= 60 && (
                          <div style={{
                            background: policy.status === 'por_vencer' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(1, 126, 123, 0.08)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${policy.status === 'por_vencer' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(1, 126, 123, 0.15)'}`
                          }}>
                            <p style={{
                              fontSize: '0.8125rem',
                              color: policy.status === 'por_vencer' ? '#DC2626' : '#017E7B',
                              fontWeight: 600
                            }}>
                              <span style={{
                                color: '#FFFFFF',
                                background: policy.status === 'por_vencer' ? '#EF4444' : '#017E7B',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginRight: '8px'
                              }}>
                                {policy.status === 'por_vencer' ? '⚠' : 'ℹ'}
                              </span>
                              Renovación en {daysUntilRenewal} días
                            </p>
                          </div>
                        )}
                        {daysUntilRenewal < 0 && (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.15)'
                          }}>
                            <p style={{ fontSize: '0.8125rem', color: '#DC2626', fontWeight: 600 }}>
                              <span style={{ color: '#FFFFFF', background: '#EF4444', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>✕</span>
                              Póliza vencida
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#FFFFFF', background: '#194988', padding: '4px', borderRadius: '6px', fontSize: '0.875rem', display: 'inline-flex', width: '24px', height: '24px', alignItems: 'center', justifyContent: 'center' }}>📎</span>
                      <span>Documentos</span>
                    </h3>
                    {loadingDocuments ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: '#718096' }}>
                        Cargando documentos...
                      </div>
                    ) : policyDocuments.length > 0 ? (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {policyDocuments.map(doc => (
                          <div
                            key={doc.id}
                            style={{
                              background: '#F7F8FC',
                              borderRadius: '10px',
                              padding: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              transition: 'all 0.2s ease',
                              border: '1px solid transparent'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#E6E8EF';
                              e.currentTarget.style.borderColor = '#194988';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#F7F8FC';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #194988 0%, #017E7B 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              flexShrink: 0
                            }}>
                              {getDocumentIcon(doc.document_type)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#202856', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {doc.file_name}
                              </p>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.6875rem', color: '#718096' }}>
                                  {getDocumentTypeName(doc.document_type)}
                                </span>
                                {doc.file_size && (
                                  <>
                                    <span style={{ fontSize: '0.6875rem', color: '#E6E8EF' }}>•</span>
                                    <span style={{ fontSize: '0.6875rem', color: '#718096' }}>
                                      {formatFileSize(doc.file_size)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewDocument(doc);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: '#017E7B',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#016663';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#017E7B';
                                }}
                              >
                                <span style={{ color: '#FFFFFF' }}>👁️</span> Ver
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadDocument(doc);
                                }}
                                style={{
                                  padding: '6px 10px',
                                  background: '#202856',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#194988';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#202856';
                                }}
                              >
                                <span style={{ color: '#FFFFFF' }}>⬇</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        background: '#F7F8FC',
                        borderRadius: '10px',
                        padding: '1.5rem',
                        textAlign: 'center'
                      }}>
                        <p style={{ fontSize: '1.5rem', marginBottom: '6px' }}>📄</p>
                        <p style={{ fontSize: '0.8125rem', color: '#718096' }}>
                          No hay documentos adjuntos
                        </p>
                      </div>
                    )}
                  </div>

                  {previewUrl && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#202856' }}>
                          Vista previa
                        </h3>
                        <button
                          onClick={() => setPreviewUrl(null)}
                          style={{
                            background: '#F7F8FC',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            color: '#718096',
                            fontWeight: 600,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#E6E8EF';
                            e.currentTarget.style.color = '#202856';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#F7F8FC';
                            e.currentTarget.style.color = '#718096';
                          }}
                        >
                          Cerrar
                        </button>
                      </div>
                      <div style={{
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '2px solid #E6E8EF',
                        background: '#FFFFFF'
                      }}>
                        <iframe
                          src={previewUrl}
                          style={{
                            width: '100%',
                            height: '400px',
                            border: 'none'
                          }}
                          title="Vista previa del documento"
                        />
                      </div>
                    </div>
                  )}

                  {executive && (
                    <a
                      href={`https://wa.me/${executive.phone?.replace(/\D/g, '')}?text=Hola, tengo una pregunta sobre mi póliza ${policy.policy_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        background: '#65EA1E',
                        color: '#202856',
                        textDecoration: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#5DD119';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(101, 234, 30, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#65EA1E';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span>💬</span>
                      <span>Contactar a mi ejecutivo</span>
                    </a>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {executive && (
        <a
          href={`https://wa.me/${executive.phone?.replace(/\D/g, '')}?text=Hola ${executive.full_name}, necesito ayuda con mis seguros`}
          target="_blank"
          rel="noopener noreferrer"
          className="floating-action-button"
          title="Hablar con mi asesor"
        >
          💬
        </a>
      )}
    </div>
  );
}

function HelpView() {
  const { profile } = useAuth();
  const [executive, setExecutive] = useState<Profile | null>(null);

  useEffect(() => {
    loadExecutive();
  }, []);

  async function loadExecutive() {
    if (profile?.assigned_executive_id) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.assigned_executive_id)
        .maybeSingle();
      if (data) setExecutive(data);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
        Ayuda y Soporte
      </h2>
      <Card>
        <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #F7F8FC 0%, #E6E8EF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            margin: '0 auto 1.5rem'
          }}>
            💬
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
            ¿Necesitas ayuda?
          </h3>
          <p style={{ color: '#718096', marginBottom: '2rem', lineHeight: 1.6, fontSize: '1rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
            Estamos aquí para ayudarte con cualquier duda sobre tus pólizas, pagos o renovaciones.
          </p>
          {executive ? (
            <div>
              <Card style={{ maxWidth: '400px', margin: '0 auto 2rem', textAlign: 'left' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#718096', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tu ejecutivo asignado
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #194988 0%, #017E7B 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: '#FFFFFF'
                  }}>
                    {executive.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#202856', marginBottom: '2px' }}>
                      {executive.full_name}
                    </p>
                    {executive.email && (
                      <p style={{ fontSize: '0.875rem', color: '#718096' }}>
                        {executive.email}
                      </p>
                    )}
                    {executive.phone && (
                      <p style={{ fontSize: '0.875rem', color: '#718096' }}>
                        {executive.phone}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
              <a
                href={`https://wa.me/${executive.phone?.replace(/\D/g, '')}?text=Hola ${executive.full_name}, necesito ayuda`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '16px 32px',
                  background: '#65EA1E',
                  color: '#202856',
                  textDecoration: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(101, 234, 30, 0.25)',
                  border: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(101, 234, 30, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(101, 234, 30, 0.25)';
                }}
              >
                <span style={{ fontSize: '20px' }}>💬</span>
                Hablar por WhatsApp
              </a>
            </div>
          ) : (
            <p style={{ color: '#718096', fontSize: '0.9375rem' }}>
              Aún no tienes un ejecutivo asignado. Por favor contacta con administración.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
