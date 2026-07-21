import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Client, Policy } from '../../types/database';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PoliciesTabProps {
  client: Client;
}

export function PoliciesTab({ client }: PoliciesTabProps) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  useEffect(() => {
    loadPolicies();
  }, [client.id]);

  async function loadPolicies() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('client_id', client.id)
        .order('end_date', { ascending: false });

      if (error) throw error;
      if (data) setPolicies(data);
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setLoading(false);
    }
  }

  function getDaysUntilDate(dateString: string): number {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'activa': return 'Activa';
      case 'por_vencer': return 'Por vencer';
      case 'vencida': return 'Vencida';
      default: return status;
    }
  }

  async function handleViewPDF(policy: Policy) {
    if (!policy.pdf_url) {
      alert('Esta póliza no tiene PDF adjunto');
      return;
    }

    try {
      const { data, error } = await supabase
        .storage
        .from('policy_pdfs')
        .createSignedUrl(policy.pdf_url, 3600);

      if (error) throw error;
      if (data) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error getting PDF:', error);
      alert('Error al obtener el PDF');
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', margin: 0 }}>
          Pólizas
        </h2>
        <Button onClick={() => setShowAddModal(true)}>
          + Agregar Póliza
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
          Cargando pólizas...
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#718096', marginBottom: '1rem' }}>
              Este cliente aún no tiene pólizas
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              + Agregar primera póliza
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {policies.map(policy => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              onView={() => setSelectedPolicy(policy)}
              onViewPDF={() => handleViewPDF(policy)}
              getDaysUntilDate={getDaysUntilDate}
              getStatusLabel={getStatusLabel}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <PolicyModal
          client={client}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadPolicies();
          }}
        />
      )}

      {selectedPolicy && (
        <PolicyModal
          client={client}
          policy={selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
          onSuccess={() => {
            setSelectedPolicy(null);
            loadPolicies();
          }}
        />
      )}
    </div>
  );
}

interface PolicyCardProps {
  policy: Policy;
  onView: () => void;
  onViewPDF: () => void;
  getDaysUntilDate: (date: string) => number;
  getStatusLabel: (status: string) => string;
}

function PolicyCard({ policy, onView, onViewPDF, getDaysUntilDate, getStatusLabel }: PolicyCardProps) {
  const daysUntilEnd = getDaysUntilDate(policy.end_date);

  return (
    <div className="card-wallet spring-animation" onClick={onView} style={{ cursor: 'pointer' }}>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '8px' }}>
              {policy.policy_type}
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, marginBottom: '4px', color: '#FFFFFF' }}>
              {policy.insurance_company}
            </h3>
            <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)' }}>
              {policy.policy_number}
            </div>
          </div>
          <div style={{
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)'
          }}>
            {getStatusLabel(policy.status)}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
              Renovación
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>
              {daysUntilEnd < 0 ? 'Vencida' : `${daysUntilEnd}d`}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
              Prima
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>
              ${policy.total_premium.toLocaleString('es-MX')}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '4px' }}>
              Forma de pago
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF', textTransform: 'capitalize' }}>
              {policy.payment_frequency}
            </div>
          </div>
        </div>

        {policy.pdf_url && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewPDF();
            }}
            className="btn-premium"
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              color: '#FFFFFF',
              fontSize: '14px',
              padding: '12px'
            }}
          >
            Ver Póliza
          </button>
        )}
      </div>
    </div>
  );
}

interface PolicyModalProps {
  client: Client;
  policy?: Policy;
  onClose: () => void;
  onSuccess: () => void;
}

function PolicyModal({ client, policy, onClose, onSuccess }: PolicyModalProps) {
  const { profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    insurance_company: policy?.insurance_company || '',
    policy_number: policy?.policy_number || '',
    policy_type: policy?.policy_type || ('auto' as const),
    start_date: policy?.start_date || '',
    payment_frequency: policy?.payment_frequency || ('mensual' as const),
    total_premium: policy ? policy.total_premium.toString() : ''
  });

  const isEditMode = !!policy;
  const canEdit = profile?.role === 'admin' || profile?.role === 'ejecutivo';

  function calculateEndDate(startDate: string): string {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    return end.toISOString().split('T')[0];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isEditMode && !canEdit) {
      alert('No tienes permisos para editar pólizas');
      return;
    }

    try {
      setIsSaving(true);

      let pdfUrl = policy?.pdf_url || null;

      if (pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${client.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('policy_pdfs')
          .upload(fileName, pdfFile);

        if (uploadError) throw uploadError;
        pdfUrl = fileName;
      }

      const endDate = calculateEndDate(formData.start_date);
      const policyData = {
        insurance_company: formData.insurance_company,
        policy_number: formData.policy_number,
        policy_type: formData.policy_type,
        start_date: formData.start_date,
        end_date: endDate,
        payment_frequency: formData.payment_frequency,
        total_premium: parseFloat(formData.total_premium),
        pdf_url: pdfUrl,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('policies')
          .update(policyData)
          .eq('id', policy.id);

        if (error) throw error;

        await supabase.from('interactions').insert({
          client_id: client.id,
          created_by: profile!.id,
          type: 'nota',
          content: `Se actualizó póliza: ${formData.policy_type.toUpperCase()} - ${formData.insurance_company}`
        });
      } else {
        const { error } = await supabase.from('policies').insert({
          client_id: client.id,
          ...policyData,
          created_by: profile!.id
        });

        if (error) throw error;

        await supabase.from('interactions').insert({
          client_id: client.id,
          created_by: profile!.id,
          type: 'nota',
          content: `Se agregó póliza: ${formData.policy_type.toUpperCase()} - ${formData.insurance_company}`
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving policy:', error);
      alert('Error al guardar la póliza');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!policy || !canEdit) return;

    if (!confirm('¿Estás seguro de eliminar esta póliza? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setIsSaving(true);

      if (policy.pdf_url) {
        await supabase.storage
          .from('policy_pdfs')
          .remove([policy.pdf_url]);
      }

      const { error } = await supabase
        .from('policies')
        .delete()
        .eq('id', policy.id);

      if (error) throw error;

      await supabase.from('interactions').insert({
        client_id: client.id,
        created_by: profile!.id,
        type: 'nota',
        content: `Se eliminó póliza: ${policy.policy_type.toUpperCase()} - ${policy.insurance_company}`
      });

      onSuccess();
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert('Error al eliminar la póliza');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleViewPDF() {
    if (!policy?.pdf_url) return;

    try {
      const { data, error } = await supabase
        .storage
        .from('policy_pdfs')
        .createSignedUrl(policy.pdf_url, 3600);

      if (error) throw error;
      if (data) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error getting PDF:', error);
      alert('Error al obtener el PDF');
    }
  }

  const endDate = calculateEndDate(formData.start_date);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
      overflow: 'auto'
    }}>
      <Card style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
          {isEditMode ? 'Editar Póliza' : 'Agregar Póliza'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Aseguradora *
            </label>
            <Input
              type="text"
              value={formData.insurance_company}
              onChange={e => setFormData({ ...formData, insurance_company: e.target.value })}
              required
              disabled={isEditMode && !canEdit}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Número de póliza *
            </label>
            <Input
              type="text"
              value={formData.policy_number}
              onChange={e => setFormData({ ...formData, policy_number: e.target.value })}
              required
              disabled={isEditMode && !canEdit}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Tipo de seguro *
            </label>
            <select
              value={formData.policy_type}
              onChange={e => setFormData({ ...formData, policy_type: e.target.value as any })}
              required
              disabled={isEditMode && !canEdit}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #E6E8EF',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                background: '#FFFFFF',
                color: '#202856'
              }}
            >
              <option value="auto">Auto</option>
              <option value="vida">Vida</option>
              <option value="gmm">GMM</option>
              <option value="daños">Daños</option>
              <option value="hogar">Hogar</option>
              <option value="empresa">Empresa</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Fecha de inicio de vigencia *
            </label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              required
              disabled={isEditMode && !canEdit}
            />
            {formData.start_date && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: '#F0FFFE',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: '#017E7B'
              }}>
                Vigencia automática hasta: {new Date(endDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Forma de pago *
            </label>
            <select
              value={formData.payment_frequency}
              onChange={e => setFormData({ ...formData, payment_frequency: e.target.value as any })}
              required
              disabled={isEditMode && !canEdit}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #E6E8EF',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                background: '#FFFFFF',
                color: '#202856'
              }}
            >
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Prima total *
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.total_premium}
              onChange={e => setFormData({ ...formData, total_premium: e.target.value })}
              required
              disabled={isEditMode && !canEdit}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              PDF de la póliza
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setPdfFile(e.target.files?.[0] || null)}
              disabled={isEditMode && !canEdit}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #E6E8EF',
                borderRadius: '0.75rem',
                fontSize: '0.875rem'
              }}
            />
            {policy?.pdf_url && !pdfFile && (
              <div style={{ marginTop: '0.5rem' }}>
                <Button type="button" onClick={handleViewPDF} variant="secondary">
                  Ver PDF actual
                </Button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {(!isEditMode || canEdit) && (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando...' : isEditMode ? 'Actualizar póliza' : 'Agregar póliza'}
              </Button>
            )}
            {isEditMode && canEdit && (
              <Button type="button" onClick={handleDelete} disabled={isSaving} style={{
                background: '#EF4444',
                color: 'white'
              }}>
                Eliminar
              </Button>
            )}
            <Button type="button" onClick={onClose} variant="secondary">
              {isEditMode && !canEdit ? 'Cerrar' : 'Cancelar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
