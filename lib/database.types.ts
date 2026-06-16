export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      about_pages: {
        Row: {
          about_text: string | null
          business_hours: string | null
          email: string | null
          gallery_urls: string[]
          main_image_url: string | null
          phone: string | null
          restaurant_id: string
          show_business_hours: boolean
          show_contact: boolean
          updated_at: string
        }
        Insert: {
          about_text?: string | null
          business_hours?: string | null
          email?: string | null
          gallery_urls?: string[]
          main_image_url?: string | null
          phone?: string | null
          restaurant_id: string
          show_business_hours?: boolean
          show_contact?: boolean
          updated_at?: string
        }
        Update: {
          about_text?: string | null
          business_hours?: string | null
          email?: string | null
          gallery_urls?: string[]
          main_image_url?: string | null
          phone?: string | null
          restaurant_id?: string
          show_business_hours?: boolean
          show_contact?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "about_pages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily: {
        Row: {
          clicks: number
          day: string
          item_id: string
          menu_id: string
          searches: number
          views: number
        }
        Insert: {
          clicks?: number
          day: string
          item_id: string
          menu_id: string
          searches?: number
          views?: number
        }
        Update: {
          clicks?: number
          day?: string
          item_id?: string
          menu_id?: string
          searches?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_daily_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          event_type: string
          id: number
          item_id: string | null
          menu_id: string | null
          metadata: Json | null
          occurred_at: string
          session_id: string | null
        }
        Insert: {
          event_type: string
          id?: number
          item_id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          session_id?: string | null
        }
        Update: {
          event_type?: string
          id?: number
          item_id?: string | null
          menu_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acting_as_user_id: string | null
          action: string
          actor_user_id: string | null
          created_at: string
          diff: Json | null
          id: number
          ip: string | null
          org_id: string | null
          restaurant_id: string | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          acting_as_user_id?: string | null
          action: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: number
          ip?: string | null
          org_id?: string | null
          restaurant_id?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          acting_as_user_id?: string | null
          action?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: number
          ip?: string | null
          org_id?: string | null
          restaurant_id?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_acting_as_user_id_fkey"
            columns: ["acting_as_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      branding: {
        Row: {
          accent_color: string | null
          background_color: string | null
          banner_image_urls: string[]
          body: Json | null
          logo_media_id: string | null
          logo_url: string | null
          main_heading: Json | null
          nav_bar_color: string | null
          primary_button: Json | null
          primary_color: string | null
          restaurant_id: string
          secondary_button: Json | null
          secondary_color: string | null
          sub_heading: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          banner_image_urls?: string[]
          body?: Json | null
          logo_media_id?: string | null
          logo_url?: string | null
          main_heading?: Json | null
          nav_bar_color?: string | null
          primary_button?: Json | null
          primary_color?: string | null
          restaurant_id: string
          secondary_button?: Json | null
          secondary_color?: string | null
          sub_heading?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          banner_image_urls?: string[]
          body?: Json | null
          logo_media_id?: string | null
          logo_url?: string | null
          main_heading?: Json | null
          nav_bar_color?: string | null
          primary_button?: Json | null
          primary_color?: string | null
          restaurant_id?: string
          secondary_button?: Json | null
          secondary_color?: string | null
          sub_heading?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_drafts: {
        Row: {
          accent_color: string | null
          background_color: string | null
          banner_image_urls: string[]
          body: Json | null
          logo_media_id: string | null
          logo_url: string | null
          main_heading: Json | null
          nav_bar_color: string | null
          primary_button: Json | null
          primary_color: string | null
          restaurant_id: string
          secondary_button: Json | null
          secondary_color: string | null
          sub_heading: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          banner_image_urls?: string[]
          body?: Json | null
          logo_media_id?: string | null
          logo_url?: string | null
          main_heading?: Json | null
          nav_bar_color?: string | null
          primary_button?: Json | null
          primary_color?: string | null
          restaurant_id: string
          secondary_button?: Json | null
          secondary_color?: string | null
          sub_heading?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          banner_image_urls?: string[]
          body?: Json | null
          logo_media_id?: string | null
          logo_url?: string | null
          main_heading?: Json | null
          nav_bar_color?: string | null
          primary_button?: Json | null
          primary_color?: string | null
          restaurant_id?: string
          secondary_button?: Json | null
          secondary_color?: string | null
          sub_heading?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_drafts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          name: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          name: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          restaurant_id: string | null
          revoked_at: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          org_id: string
          restaurant_id?: string | null
          revoked_at?: string | null
          role: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          restaurant_id?: string | null
          revoked_at?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          next_seq: number
          org_id: string
        }
        Insert: {
          next_seq?: number
          org_id: string
        }
        Update: {
          next_seq?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          id: string
          number: string
          org_id: string
          paid_at: string | null
          pdf_path: string | null
          period_end: string
          period_start: string
          restaurant_id: string | null
          status: string
          subscription_id: string
          subtotal_cents: number
          total_cents: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          number: string
          org_id: string
          paid_at?: string | null
          pdf_path?: string | null
          period_end: string
          period_start: string
          restaurant_id?: string | null
          status?: string
          subscription_id: string
          subtotal_cents: number
          total_cents: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          number?: string
          org_id?: string
          paid_at?: string | null
          pdf_path?: string | null
          period_end?: string
          period_start?: string
          restaurant_id?: string | null
          status?: string
          subscription_id?: string
          subtotal_cents?: number
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          bucket: string
          created_at: string
          id: string
          metadata: Json | null
          mime: string
          name: string
          org_id: string | null
          owner_user_id: string
          path: string
          restaurant_id: string | null
          size: number
          url: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mime: string
          name: string
          org_id?: string | null
          owner_user_id: string
          path: string
          restaurant_id?: string | null
          size: number
          url: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mime?: string
          name?: string
          org_id?: string | null
          owner_user_id?: string
          path?: string
          restaurant_id?: string | null
          size?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_usage: {
        Row: {
          created_at: string
          media_id: string
          used_in_id: string
          used_in_table: string
        }
        Insert: {
          created_at?: string
          media_id: string
          used_in_id: string
          used_in_table: string
        }
        Update: {
          created_at?: string
          media_id?: string
          used_in_id?: string
          used_in_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_usage_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[]
          category_id: string
          created_at: string
          currency: string
          custom_headings: Json | null
          description: string | null
          display_details: Json
          id: string
          image_url: string | null
          image_urls: string[]
          labels: string[]
          menu_id: string
          name: string
          pairing_ids: string[]
          preparations: Json
          price_cents: number
          rating: number | null
          sauces: Json
          sides: Json
          sort_order: number
          updated_at: string
          variations: Json
        }
        Insert: {
          allergens?: string[]
          category_id: string
          created_at?: string
          currency?: string
          custom_headings?: Json | null
          description?: string | null
          display_details?: Json
          id?: string
          image_url?: string | null
          image_urls?: string[]
          labels?: string[]
          menu_id: string
          name: string
          pairing_ids?: string[]
          preparations?: Json
          price_cents: number
          rating?: number | null
          sauces?: Json
          sides?: Json
          sort_order?: number
          updated_at?: string
          variations?: Json
        }
        Update: {
          allergens?: string[]
          category_id?: string
          created_at?: string
          currency?: string
          custom_headings?: Json | null
          description?: string | null
          display_details?: Json
          id?: string
          image_url?: string | null
          image_urls?: string[]
          labels?: string[]
          menu_id?: string
          name?: string
          pairing_ids?: string[]
          preparations?: Json
          price_cents?: number
          rating?: number | null
          sauces?: Json
          sides?: Json
          sort_order?: number
          updated_at?: string
          variations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          location: string | null
          name: string
          qr_assigned: boolean
          qr_url: string | null
          restaurant_id: string
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["menu_status"]
          updated_at: string
          viewing_time: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          location?: string | null
          name: string
          qr_assigned?: boolean
          qr_url?: string | null
          restaurant_id: string
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
          viewing_time?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          location?: string | null
          name?: string
          qr_assigned?: boolean
          qr_url?: string | null
          restaurant_id?: string
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
          viewing_time?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          payfast_customer_ref: string | null
          plan_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          payfast_customer_ref?: string | null
          plan_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          payfast_customer_ref?: string | null
          plan_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          additional_discount_pct: number
          base_price_cents: number
          contact_only: boolean
          created_at: string
          description: string | null
          features: Json
          id: string
          included_restaurants: number | null
          is_public: boolean
          max_restaurants: number | null
          name: string
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          additional_discount_pct?: number
          base_price_cents: number
          contact_only?: boolean
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          included_restaurants?: number | null
          is_public?: boolean
          max_restaurants?: number | null
          name: string
          pricing_model: Database["public"]["Enums"]["pricing_model"]
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          additional_discount_pct?: number
          base_price_cents?: number
          contact_only?: boolean
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          included_restaurants?: number | null
          is_public?: boolean
          max_restaurants?: number | null
          name?: string
          pricing_model?: Database["public"]["Enums"]["pricing_model"]
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_org_id: string | null
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          is_super_admin: boolean
          last_name: string | null
          notification_prefs: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          display_name?: string | null
          email: string
          first_name?: string | null
          id: string
          is_super_admin?: boolean
          last_name?: string | null
          notification_prefs?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_org_id?: string | null
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_super_admin?: boolean
          last_name?: string | null
          notification_prefs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_org_fk"
            columns: ["default_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          joined_at: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          user_id: string
        }
        Insert: {
          joined_at?: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          user_id: string
        }
        Update: {
          joined_at?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          city: string | null
          created_at: string
          default_menu_id: string | null
          id: string
          name: string
          org_id: string
          province: string | null
          setup_completed_at: string | null
          slug: string
          status: string
          street: string | null
          table_count: number | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          default_menu_id?: string | null
          id?: string
          name: string
          org_id: string
          province?: string | null
          setup_completed_at?: string | null
          slug: string
          status?: string
          street?: string | null
          table_count?: number | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          default_menu_id?: string | null
          id?: string
          name?: string
          org_id?: string
          province?: string | null
          setup_completed_at?: string | null
          slug?: string
          status?: string
          street?: string | null
          table_count?: number | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_default_menu_fk"
            columns: ["default_menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          menu_item_id: string
          message: string
          moderated_at: string | null
          moderated_by: string | null
          notes: string | null
          rating: number
          restaurant_id: string
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          created_at?: string
          customer_name: string
          id?: string
          menu_item_id: string
          message: string
          moderated_at?: string | null
          moderated_by?: string | null
          notes?: string | null
          rating: number
          restaurant_id: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          menu_item_id?: string
          message?: string
          moderated_at?: string | null
          moderated_by?: string | null
          notes?: string | null
          rating?: number
          restaurant_id?: string
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      special_targets: {
        Row: {
          category_id: string | null
          combo_item_ids: string[] | null
          id: string
          item_id: string | null
          special_id: string
        }
        Insert: {
          category_id?: string | null
          combo_item_ids?: string[] | null
          id?: string
          item_id?: string | null
          special_id: string
        }
        Update: {
          category_id?: string | null
          combo_item_ids?: string[] | null
          id?: string
          item_id?: string | null
          special_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_targets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_targets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_targets_special_id_fkey"
            columns: ["special_id"]
            isOneToOne: false
            referencedRelation: "specials"
            referencedColumns: ["id"]
          },
        ]
      }
      specials: {
        Row: {
          active: boolean
          combo_price_cents: number | null
          created_at: string
          custom_promotional_text: string | null
          date_from: string | null
          date_to: string | null
          description: string | null
          discount_amount_cents: number | null
          discount_pct: number | null
          discount_type: Database["public"]["Enums"]["discount_kind"] | null
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["special_kind"]
          media_id: string | null
          menu_id: string | null
          priority: number
          restaurant_id: string
          selected_days: string[] | null
          time_from: string | null
          time_to: string | null
          time_windows: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          combo_price_cents?: number | null
          created_at?: string
          custom_promotional_text?: string | null
          date_from?: string | null
          date_to?: string | null
          description?: string | null
          discount_amount_cents?: number | null
          discount_pct?: number | null
          discount_type?: Database["public"]["Enums"]["discount_kind"] | null
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["special_kind"]
          media_id?: string | null
          menu_id?: string | null
          priority?: number
          restaurant_id: string
          selected_days?: string[] | null
          time_from?: string | null
          time_to?: string | null
          time_windows?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          combo_price_cents?: number | null
          created_at?: string
          custom_promotional_text?: string | null
          date_from?: string | null
          date_to?: string | null
          description?: string | null
          discount_amount_cents?: number | null
          discount_pct?: number | null
          discount_type?: Database["public"]["Enums"]["discount_kind"] | null
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["special_kind"]
          media_id?: string | null
          menu_id?: string | null
          priority?: number
          restaurant_id?: string
          selected_days?: string[] | null
          time_from?: string | null
          time_to?: string | null
          time_windows?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specials_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specials_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_cents: number
          billing_period: string
          cancelled_at: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          m_payment_id: string | null
          next_billing_date: string | null
          org_id: string
          paused_at: string | null
          payfast_subscription_id: string | null
          payfast_token: string | null
          plan_id: string
          scope: Database["public"]["Enums"]["subscription_scope"]
          scope_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_period?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          m_payment_id?: string | null
          next_billing_date?: string | null
          org_id: string
          paused_at?: string | null
          payfast_subscription_id?: string | null
          payfast_token?: string | null
          plan_id: string
          scope: Database["public"]["Enums"]["subscription_scope"]
          scope_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_period?: string
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          m_payment_id?: string | null
          next_billing_date?: string | null
          org_id?: string
          paused_at?: string | null
          payfast_subscription_id?: string | null
          payfast_token?: string | null
          plan_id?: string
          scope?: Database["public"]["Enums"]["subscription_scope"]
          scope_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_fee_cents: number
          amount_gross_cents: number
          amount_net_cents: number
          created_at: string
          email_address: string | null
          id: string
          m_payment_id: string | null
          occurred_at: string
          org_id: string | null
          payfast_payment_id: string
          payment_status: string
          raw: Json
          restaurant_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount_fee_cents: number
          amount_gross_cents: number
          amount_net_cents: number
          created_at?: string
          email_address?: string | null
          id?: string
          m_payment_id?: string | null
          occurred_at: string
          org_id?: string | null
          payfast_payment_id: string
          payment_status: string
          raw: Json
          restaurant_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount_fee_cents?: number
          amount_gross_cents?: number
          amount_net_cents?: number
          created_at?: string
          email_address?: string | null
          id?: string
          m_payment_id?: string | null
          occurred_at?: string
          org_id?: string | null
          payfast_payment_id?: string
          payment_status?: string
          raw?: Json
          restaurant_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      review_stats: {
        Row: {
          avg_rating: number | null
          distribution: Json | null
          last_updated: string | null
          menu_item_id: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: { p_invitation_id: string; p_user_id: string }
        Returns: undefined
      }
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json }
      has_org_access: {
        Args: { min_role?: string; oid: string }
        Returns: boolean
      }
      has_restaurant_access: {
        Args: { min_role?: string; rid: string }
        Returns: boolean
      }
      increment_invoice_counter: { Args: { p_org_id: string }; Returns: number }
      is_super_admin: { Args: never; Returns: boolean }
      publish_branding: {
        Args: { p_restaurant_id: string }
        Returns: undefined
      }
      reorder_categories: {
        Args: { p_ids: string[]; p_menu_id: string }
        Returns: undefined
      }
      reorder_items: {
        Args: { p_category_id: string; p_ids: string[]; p_menu_id: string }
        Returns: undefined
      }
      role_rank: { Args: { role: string }; Returns: number }
    }
    Enums: {
      discount_kind: "percentage" | "fixed"
      menu_status: "draft" | "published" | "archived"
      org_role: "owner" | "admin" | "manager" | "staff"
      pricing_model: "per_restaurant" | "flat_includes_n" | "custom"
      restaurant_role: "manager" | "staff"
      review_status: "pending" | "approved" | "rejected"
      special_kind: "item_discount" | "category_discount" | "combo"
      subscription_scope: "restaurant" | "org"
      subscription_status:
        | "pending"
        | "active"
        | "paused"
        | "cancelled"
        | "failed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      discount_kind: ["percentage", "fixed"],
      menu_status: ["draft", "published", "archived"],
      org_role: ["owner", "admin", "manager", "staff"],
      pricing_model: ["per_restaurant", "flat_includes_n", "custom"],
      restaurant_role: ["manager", "staff"],
      review_status: ["pending", "approved", "rejected"],
      special_kind: ["item_discount", "category_discount", "combo"],
      subscription_scope: ["restaurant", "org"],
      subscription_status: [
        "pending",
        "active",
        "paused",
        "cancelled",
        "failed",
      ],
    },
  },
} as const

