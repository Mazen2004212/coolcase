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
      order_items: {
        Row: {
          created_at: string
          custom_design_upload_id: string | null
          custom_phone_model: string | null
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
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          customer_visible_note?: string | null
          id?: string
          internal_note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          customer_visible_note?: string | null
          id?: string
          internal_note?: string | null
          order_id?: string
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
          created_at: string
          currency: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_notes: string | null
          floor: string | null
          governorate: string
          id: string
          landmark: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          shipped_at: string | null
          shipping_amount: number
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
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_notes?: string | null
          floor?: string | null
          governorate: string
          id?: string
          landmark?: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          shipped_at?: string | null
          shipping_amount: number
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
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_notes?: string | null
          floor?: string | null
          governorate?: string
          id?: string
          landmark?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shipped_at?: string | null
          shipping_amount?: number
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
          acrylic_price_override: number | null
          category_id: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          short_description: string | null
          silicone_price_override: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          acrylic_price_override?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          short_description?: string | null
          silicone_price_override?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          acrylic_price_override?: number | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          short_description?: string | null
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
      set_default_address: {
        Args: { target_address_id: string }
        Returns: undefined
      }
    }
    Enums: {
      case_material: "SILICONE" | "ACRYLIC"
      network_type: "FOUR_G" | "FIVE_G"
      order_status:
        | "PENDING_CONFIRMATION"
        | "CONFIRMED"
        | "PREPARING"
        | "SHIPPED"
        | "OUT_FOR_DELIVERY"
        | "DELIVERED"
        | "CANCELLED"
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
      case_material: ["SILICONE", "ACRYLIC"],
      network_type: ["FOUR_G", "FIVE_G"],
      order_status: [
        "PENDING_CONFIRMATION",
        "CONFIRMED",
        "PREPARING",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
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
