export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: 'admin' | 'ejecutivo' | 'cliente';
          assigned_executive_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role?: 'admin' | 'ejecutivo' | 'cliente';
          assigned_executive_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          role?: 'admin' | 'ejecutivo' | 'cliente';
          assigned_executive_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      prospects: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string | null;
          product_interest: string | null;
          origin: 'whatsapp' | 'web' | 'referido' | 'otro';
          status: 'nuevo' | 'contactado' | 'cotizado' | 'cerrado' | 'perdido';
          comments: string | null;
          executive_id: string;
          converted_to_client_id: string | null;
          last_activity_at: string;
          priority: 'alta' | 'media' | 'baja' | null;
          lost_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          email?: string | null;
          product_interest?: string | null;
          origin?: 'whatsapp' | 'web' | 'referido' | 'otro';
          status?: 'nuevo' | 'contactado' | 'cotizado' | 'cerrado' | 'perdido';
          comments?: string | null;
          executive_id: string;
          converted_to_client_id?: string | null;
          last_activity_at?: string;
          priority?: 'alta' | 'media' | 'baja' | null;
          lost_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          email?: string | null;
          product_interest?: string | null;
          origin?: 'whatsapp' | 'web' | 'referido' | 'otro';
          status?: 'nuevo' | 'contactado' | 'cotizado' | 'cerrado' | 'perdido';
          comments?: string | null;
          executive_id?: string;
          converted_to_client_id?: string | null;
          last_activity_at?: string;
          priority?: 'alta' | 'media' | 'baja' | null;
          lost_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          owner_user_id: string | null;
          assigned_to: string;
          full_name: string;
          phone: string;
          email: string | null;
          internal_notes: string;
          created_at: string;
          updated_at: string;
          converted_from_prospect_id: string | null;
        };
        Insert: {
          id?: string;
          owner_user_id?: string | null;
          assigned_to: string;
          full_name: string;
          phone: string;
          email?: string | null;
          internal_notes?: string;
          created_at?: string;
          updated_at?: string;
          converted_from_prospect_id?: string | null;
        };
        Update: {
          id?: string;
          owner_user_id?: string | null;
          assigned_to?: string;
          full_name?: string;
          phone?: string;
          email?: string | null;
          internal_notes?: string;
          created_at?: string;
          updated_at?: string;
          converted_from_prospect_id?: string | null;
        };
      };
      interactions: {
        Row: {
          id: string;
          prospect_id: string | null;
          client_id: string | null;
          created_by: string;
          type: 'nota' | 'llamada' | 'whatsapp' | 'email' | 'cambio_status';
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          prospect_id?: string | null;
          client_id?: string | null;
          created_by: string;
          type: 'nota' | 'llamada' | 'whatsapp' | 'email' | 'cambio_status';
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          prospect_id?: string | null;
          client_id?: string | null;
          created_by?: string;
          type?: 'nota' | 'llamada' | 'whatsapp' | 'email' | 'cambio_status';
          content?: string;
          created_at?: string;
        };
      };
      followups: {
        Row: {
          id: string;
          prospect_id: string | null;
          client_id: string | null;
          created_by: string;
          assigned_to: string;
          due_at: string;
          channel: 'llamada' | 'whatsapp' | 'email' | 'otro';
          title: string;
          notes: string;
          status: 'pendiente' | 'completado' | 'cancelado';
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          prospect_id?: string | null;
          client_id?: string | null;
          created_by: string;
          assigned_to: string;
          due_at: string;
          channel: 'llamada' | 'whatsapp' | 'email' | 'otro';
          title: string;
          notes?: string;
          status?: 'pendiente' | 'completado' | 'cancelado';
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          prospect_id?: string | null;
          client_id?: string | null;
          created_by?: string;
          assigned_to?: string;
          due_at?: string;
          channel?: 'llamada' | 'whatsapp' | 'email' | 'otro';
          title?: string;
          notes?: string;
          status?: 'pendiente' | 'completado' | 'cancelado';
          created_at?: string;
          completed_at?: string | null;
        };
      };
      policies: {
        Row: {
          id: string;
          client_id: string;
          insurance_company: string;
          policy_number: string;
          policy_type: 'auto' | 'vida' | 'gmm' | 'daños' | 'hogar' | 'empresa' | 'otro';
          start_date: string;
          end_date: string;
          payment_frequency: 'mensual' | 'trimestral' | 'semestral' | 'anual';
          total_premium: number;
          pdf_url: string | null;
          status: 'activa' | 'por_vencer' | 'vencida';
          created_at: string;
          updated_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          insurance_company: string;
          policy_number: string;
          policy_type: 'auto' | 'vida' | 'gmm' | 'daños' | 'hogar' | 'empresa' | 'otro';
          start_date: string;
          end_date: string;
          payment_frequency: 'mensual' | 'trimestral' | 'semestral' | 'anual';
          total_premium: number;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          insurance_company?: string;
          policy_number?: string;
          policy_type?: 'auto' | 'vida' | 'gmm' | 'daños' | 'hogar' | 'empresa' | 'otro';
          start_date?: string;
          end_date?: string;
          payment_frequency?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
          total_premium?: number;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string;
        };
      };
      policy_documents: {
        Row: {
          id: string;
          policy_id: string;
          document_type: 'poliza' | 'recibo' | 'endoso' | 'carta_finiquito' | 'otro';
          file_name: string;
          file_url: string;
          file_size: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          policy_id: string;
          document_type: 'poliza' | 'recibo' | 'endoso' | 'carta_finiquito' | 'otro';
          file_name: string;
          file_url: string;
          file_size?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          policy_id?: string;
          document_type?: 'poliza' | 'recibo' | 'endoso' | 'carta_finiquito' | 'otro';
          file_name?: string;
          file_url?: string;
          file_size?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
      };
      email_messages: {
        Row: {
          id: string;
          entity_type: 'prospect' | 'client';
          prospect_id: string | null;
          client_id: string | null;
          sent_by: string | null;
          to_email: string;
          cc_email: string | null;
          bcc_email: string | null;
          subject: string;
          body_html: string;
          body_text: string | null;
          status: 'draft' | 'sent' | 'failed';
          provider_message_id: string | null;
          error_details: string | null;
          created_at: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          entity_type: 'prospect' | 'client';
          prospect_id?: string | null;
          client_id?: string | null;
          sent_by?: string | null;
          to_email: string;
          cc_email?: string | null;
          bcc_email?: string | null;
          subject: string;
          body_html: string;
          body_text?: string | null;
          status?: 'draft' | 'sent' | 'failed';
          provider_message_id?: string | null;
          error_details?: string | null;
          created_at?: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: 'prospect' | 'client';
          prospect_id?: string | null;
          client_id?: string | null;
          sent_by?: string | null;
          to_email?: string;
          cc_email?: string | null;
          bcc_email?: string | null;
          subject?: string;
          body_html?: string;
          body_text?: string | null;
          status?: 'draft' | 'sent' | 'failed';
          provider_message_id?: string | null;
          error_details?: string | null;
          created_at?: string;
          sent_at?: string;
        };
      };
      email_attachments: {
        Row: {
          id: string;
          email_message_id: string;
          file_name: string;
          file_path: string;
          mime_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email_message_id: string;
          file_name: string;
          file_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email_message_id?: string;
          file_name?: string;
          file_path?: string;
          mime_type?: string | null;
          file_size?: number | null;
          created_at?: string;
        };
      };
      email_outbound_config: {
        Row: {
          id: string;
          name: string;
          from_email: string;
          from_name: string;
          smtp_host: string;
          smtp_port: number;
          smtp_user: string;
          smtp_password: string;
          smtp_secure: boolean;
          is_active: boolean;
          last_test_at: string | null;
          last_test_status: 'success' | 'failed' | null;
          last_test_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          from_email: string;
          from_name: string;
          smtp_host: string;
          smtp_port?: number;
          smtp_user: string;
          smtp_password: string;
          smtp_secure?: boolean;
          is_active?: boolean;
          last_test_at?: string | null;
          last_test_status?: 'success' | 'failed' | null;
          last_test_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          from_email?: string;
          from_name?: string;
          smtp_host?: string;
          smtp_port?: number;
          smtp_user?: string;
          smtp_password?: string;
          smtp_secure?: boolean;
          is_active?: boolean;
          last_test_at?: string | null;
          last_test_status?: 'success' | 'failed' | null;
          last_test_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Prospect = Database['public']['Tables']['prospects']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type Interaction = Database['public']['Tables']['interactions']['Row'];
export type Followup = Database['public']['Tables']['followups']['Row'];
export type Policy = Database['public']['Tables']['policies']['Row'];
export type PolicyDocument = Database['public']['Tables']['policy_documents']['Row'];
export type EmailMessage = Database['public']['Tables']['email_messages']['Row'];
export type EmailAttachment = Database['public']['Tables']['email_attachments']['Row'];
export type EmailOutboundConfig = Database['public']['Tables']['email_outbound_config']['Row'];
