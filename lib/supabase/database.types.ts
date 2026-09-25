export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          alternate_phone: string | null
          apartment: string | null
          building_number: string
          city_area: string
          created_at: string
          delivery_notes: string | null
          floor: string | null
          governorate: string
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          phone: string
          recipient_name: string
          street_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alternate_phone?: string | null
          apartment?: string | null
          building_number: string
          city_area: string
          created_at?: string
          delivery_notes?: string | null
          floor?: string | null
          governorate: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          phone: string
          recipient_name: string
          street_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alternate_phone?: string | null
          apartment?: string | null
          building_number?: string
          city_area?: string
          created_at?: string
          delivery_notes?: string | null
          floor?: string | null
          governorate?: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          phone?: string
          recipient_name?: string
          street_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_staff: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          permissions: string[]
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          permissions?: string[]
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          permissions?: string[]
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_id: string
          discount_amount: number
          id: string
          order_id: string
          subtotal_amount: number
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_id: string
          discount_amount: number
          id?: string
          order_id: string
          subtotal_amount: number
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_id?: string
          discount_amount?: number
          id?: string
          order_id?: string
          subtotal_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          minimum_subtotal: number
          per_customer_limit: number | null
          starts_at: string | null
          title: string
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          minimum_subtotal?: number
          per_customer_limit?: number | null
          starts_at?: string | null
          title: string
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          minimum_subtotal?: number
          per_customer_limit?: number | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_case_templates: {
        Row: {
          allowed_script: string
          arabic_font_key: string
          arabic_font_size: number
          arabic_font_weight: number
          arabic_max_characters: number
          arabic_text_align: string
          arabic_text_color: string
          arabic_text_rotation: number
          arabic_text_x: number
          arabic_text_y: number
          created_at: string
          created_by: string | null
          english_font_key: string
          english_font_size: number
          english_font_weight: number
          english_max_characters: number
          english_text_align: string
          english_text_color: string
          english_text_rotation: number
          english_text_transform: string
          english_text_x: number
          english_text_y: number
          font_key: string
          font_size: number
          font_weight: number
          id: string
          image_path: string
          is_active: boolean
          max_characters: number
          name: string
          slug: string
          sort_order: number
          text_align: string
          text_color: string
          text_rotation: number
          text_transform: string
          text_x: number
          text_y: number
          updated_at: string
        }
        Insert: {
          allowed_script?: string
          arabic_font_key?: string
          arabic_font_size?: number
          arabic_font_weight?: number
          arabic_max_characters?: number
          arabic_text_align?: string
          arabic_text_color?: string
          arabic_text_rotation?: number
          arabic_text_x?: number
          arabic_text_y?: number
          created_at?: string
          created_by?: string | null
          english_font_key?: string
          english_font_size?: number
          english_font_weight?: number
          english_max_characters?: number
          english_text_align?: string
          english_text_color?: string
          english_text_rotation?: number
          english_text_transform?: string
          english_text_x?: number
          english_text_y?: number
          font_key?: string
          font_size?: number
          font_weight?: number
          id?: string
          image_path: string
          is_active?: boolean
          max_characters?: number
          name: string
          slug: string
          sort_order?: number
          text_align?: string
          text_color?: string
          text_rotation?: number
          text_transform?: string
          text_x?: number
          text_y?: number
          updated_at?: string
        }
        Update: {
          allowed_script?: string
          arabic_font_key?: string
          arabic_font_size?: number
          arabic_font_weight?: number
          arabic_max_characters?: number
          arabic_text_align?: string
          arabic_text_color?: string
          arabic_text_rotation?: number
          arabic_text_x?: number
          arabic_text_y?: number
          created_at?: string
          created_by?: string | null
          english_font_key?: string
          english_font_size?: number
          english_font_weight?: number
          english_max_characters?: number
          english_text_align?: string
          english_text_color?: string
          english_text_rotation?: number
          english_text_transform?: string
          english_text_x?: number
          english_text_y?: number
          font_key?: string
          font_size?: number
          font_weight?: number
          id?: string
          image_path?: string
          is_active?: boolean
          max_characters?: number
          name?: string
          slug?: string
          sort_order?: number
          text_align?: string
          text_color?: string
          text_rotation?: number
          text_transform?: string
          text_x?: number
          text_y?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_case_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_uploads: {
        Row: {
          created_at: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          storage_path: string
          upload_type: Database["public"]["Enums"]["upload_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          storage_path: string
          upload_type: Database["public"]["Enums"]["upload_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          storage_path?: string
          upload_type?: Database["public"]["Enums"]["upload_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_log: {
        Row: {
          error_message: string | null
          event: string
          id: string
          order_id: string
          provider_message_id: string | null
          recipient_email: string
          sent_at: string
          subject: string | null
          success: boolean
        }
        Insert: {
          error_message?: string | null
          event: string
          id?: string
          order_id: string
          provider_message_id?: string | null
          recipient_email: string
          sent_at?: string
          subject?: string | null
          success?: boolean
        }
        Update: {
          error_message?: string | null
          event?: string
          id?: string
          order_id?: string
          provider_message_id?: string | null
          recipient_email?: string
          sent_at?: string
          subject?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          custom_design_upload_id: string | null
          custom_phone_model: string | null
          custom_template_id: string | null
          customization_snapshot: Json | null
          customization_type: string | null
          id: string
          line_total: number
          material: Database["public"]["Enums"]["case_material"]
          network_type: Database["public"]["Enums"]["network_type"]
          order_id: string
          phone_model: string
          product_id: string | null
          product_image_snapshot: string | null
          product_name_snapshot: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          custom_design_upload_id?: string | null
          custom_phone_model?: string | null
          custom_template_id?: string | null
          customization_snapshot?: Json | null
          customization_type?: string | null
          id?: string
          line_total: number
          material: Database["public"]["Enums"]["case_material"]
          network_type: Database["public"]["Enums"]["network_type"]
          order_id: string
          phone_model: string
          product_id?: string | null
          product_image_snapshot?: string | null
          product_name_snapshot: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          custom_design_upload_id?: string | null
          custom_phone_model?: string | null
          custom_template_id?: string | null
          customization_snapshot?: Json | null
          customization_type?: string | null
          id?: string
          line_total?: number
          material?: Database["public"]["Enums"]["case_material"]
          network_type?: Database["public"]["Enums"]["network_type"]
          order_id?: string
          phone_model?: string
          product_id?: string | null
          product_image_snapshot?: string | null
          product_name_snapshot?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_custom_design_upload_id_fkey"
            columns: ["custom_design_upload_id"]
            isOneToOne: false
            referencedRelation: "customer_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_custom_template_id_fkey"
            columns: ["custom_template_id"]
            isOneToOne: false
            referencedRelation: "custom_case_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          customer_visible_note: string | null
          id: string
          internal_note: string | null
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status"] | null
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          customer_visible_note?: string | null
          id?: string
          internal_note?: string | null
          order_id: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          customer_visible_note?: string | null
          id?: string
          internal_note?: string | null
          order_id?: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          alternate_phone: string | null
          apartment: string | null
          building_number: string
          cancelled_at: string | null
          city_area: string
          confirmed_at: string | null
          coupon_code_snapshot: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_notes: string | null
          discount_amount: number
          floor: string | null
          governorate: string
          id: string
          is_test: boolean
          landmark: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          rejected_at: string | null
          shipped_at: string | null
          shipping_amount: number
          shipping_courier: string
          shipping_current_location: string
          shipping_notes: string
          shipping_tracking_number: string
          status: Database["public"]["Enums"]["order_status"]
          street_name: string
          subtotal_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          alternate_phone?: string | null
          apartment?: string | null
          building_number: string
          cancelled_at?: string | null
          city_area: string
          confirmed_at?: string | null
          coupon_code_snapshot?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_notes?: string | null
          discount_amount?: number
          floor?: string | null
          governorate: string
          id?: string
          is_test?: boolean
          landmark?: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          rejected_at?: string | null
          shipped_at?: string | null
          shipping_amount: number
          shipping_courier?: string
          shipping_current_location?: string
          shipping_notes?: string
          shipping_tracking_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          street_name: string
          subtotal_amount: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          alternate_phone?: string | null
          apartment?: string | null
          building_number?: string
          cancelled_at?: string | null
          city_area?: string
          confirmed_at?: string | null
          coupon_code_snapshot?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_notes?: string | null
          discount_amount?: number
          floor?: string | null
          governorate?: string
          id?: string
          is_test?: boolean
          landmark?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          rejected_at?: string | null
          shipped_at?: string | null
          shipping_amount?: number
          shipping_courier?: string
          shipping_current_location?: string
          shipping_notes?: string
          shipping_tracking_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          street_name?: string
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          currency: string
          expected_amount: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          payment_proof_upload_id: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verification_source: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          expected_amount: number
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          payment_proof_upload_id?: string | null
          rejection_reason?: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verification_source?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          expected_amount?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          payment_proof_upload_id?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verification_source?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_proof_upload_id_fkey"
            columns: ["payment_proof_upload_id"]
            isOneToOne: false
            referencedRelation: "customer_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          is_primary: boolean
          original_storage_path: string | null
          processed_storage_path: string | null
          product_id: string
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          original_storage_path?: string | null
          processed_storage_path?: string | null
          product_id: string
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          original_storage_path?: string | null
          processed_storage_path?: string | null
          product_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          acrylic_enabled: boolean
          acrylic_original_price_override: number | null
          acrylic_price_override: number | null
          category_id: string | null
          created_at: string
          description: string | null
          display_order: number
          double_layer_enabled: boolean
          double_layer_original_price_override: number | null
          double_layer_price_override: number | null
          id: string
          is_active: boolean
          is_available: boolean
          is_featured: boolean
          name: string
          short_description: string | null
          silicone_enabled: boolean
          silicone_original_price_override: number | null
          silicone_price_override: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          acrylic_enabled?: boolean
          acrylic_original_price_override?: number | null
          acrylic_price_override?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          double_layer_enabled?: boolean
          double_layer_original_price_override?: number | null
          double_layer_price_override?: number | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_featured?: boolean
          name: string
          short_description?: string | null
          silicone_enabled?: boolean
          silicone_original_price_override?: number | null
          silicone_price_override?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          acrylic_enabled?: boolean
          acrylic_original_price_override?: number | null
          acrylic_price_override?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          double_layer_enabled?: boolean
          double_layer_original_price_override?: number | null
          double_layer_price_override?: number | null
          id?: string
          is_active?: boolean
          is_available?: boolean
          is_featured?: boolean
          name?: string
          short_description?: string | null
          silicone_enabled?: boolean
          silicone_original_price_override?: number | null
          silicone_price_override?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      staff_signup_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_signup_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      store_settings: {
        Row: {
          id: string
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      order_tracking_events: {
        Row: {
          created_at: string | null
          customer_visible_note: string | null
          id: string | null
          order_id: string | null
          status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          created_at?: string | null
          customer_visible_note?: string | null
          id?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          created_at?: string | null
          customer_visible_note?: string | null
          id?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      attach_instapay_proof: {
        Args: { p_order_id: string; p_upload_id: string }
        Returns: Json
      }
      attach_payment_proof: {
        Args: { p_order_id: string; p_upload_id: string }
        Returns: Json
      }
      create_order: {
        Args: {
          p_address_id?: string
          p_apartment: string
          p_building_number: string
          p_city_area: string
          p_coupon_code?: string
          p_customer_email: string
          p_customer_id: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_notes: string
          p_floor: string
          p_governorate: string
          p_items: Json
          p_landmark: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_shipping_amount: number
          p_street_name: string
          p_subtotal_amount: number
        }
        Returns: Json
      }
      generate_order_number: { Args: never; Returns: string }
      review_instapay_payment: {
        Args: {
          p_decision: Database["public"]["Enums"]["payment_status"]
          p_expected_proof_upload_id: string
          p_order_id: string
          p_rejection_reason?: string
        }
        Returns: Json
      }
      review_payment_proof: {
        Args: {
          p_decision: Database["public"]["Enums"]["payment_status"]
          p_expected_proof_upload_id: string
          p_order_id: string
          p_rejection_reason?: string
        }
        Returns: Json
      }
      set_default_address: {
        Args: { target_address_id: string }
        Returns: undefined
      }
      track_order: {
        Args: { p_contact: string; p_order_number: string }
        Returns: Json
      }
      transition_order_status: {
        Args: {
          p_customer_visible_note?: string
          p_internal_note?: string
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
          p_send_email?: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      case_material: "SILICONE" | "ACRYLIC" | "DOUBLE_LAYER"
      network_type: "FOUR_G" | "FIVE_G"
      order_status:
        | "PENDING_CONFIRMATION"
        | "CONFIRMED"
        | "PREPARING"
        | "SHIPPED"
        | "OUT_FOR_DELIVERY"
        | "DELIVERED"
        | "CANCELLED"
        | "PENDING_ADMIN_APPROVAL"
        | "REJECTED"
      payment_method: "INSTAPAY" | "CASH_ON_DELIVERY"
      payment_status:
        | "PENDING"
        | "PENDING_VERIFICATION"
        | "VERIFIED"
        | "REJECTED"
        | "NOT_REQUIRED"
        | "REFUNDED"
      upload_type: "PRODUCT_IMAGE" | "CUSTOM_CASE_DESIGN" | "PAYMENT_PROOF"
      user_role: "CUSTOMER" | "ADMIN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      case_material: ["SILICONE", "ACRYLIC", "DOUBLE_LAYER"],
      network_type: ["FOUR_G", "FIVE_G"],
      order_status: [
        "PENDING_CONFIRMATION",
        "CONFIRMED",
        "PREPARING",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "PENDING_ADMIN_APPROVAL",
        "REJECTED",
      ],
      payment_method: ["INSTAPAY", "CASH_ON_DELIVERY"],
      payment_status: [
        "PENDING",
        "PENDING_VERIFICATION",
        "VERIFIED",
        "REJECTED",
        "NOT_REQUIRED",
        "REFUNDED",
      ],
      upload_type: ["PRODUCT_IMAGE", "CUSTOM_CASE_DESIGN", "PAYMENT_PROOF"],
      user_role: ["CUSTOMER", "ADMIN"],
    },
  },
} as const
